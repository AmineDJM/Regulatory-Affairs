import { prisma } from "@/lib/prisma";
import { chainesContratsPch, produitsVentesPch, territoiresPch, venteParProduitEtMois } from "@/lib/ventes-pch/requetes";
import type { MesureKpi } from "./definition";
import type { Fenetre } from "./score";
import type { LigneDetail } from "./types";
import { executionDesMarches } from "./mesures";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES BRIQUES PCH — « Livré PCH », « Demande non servie PCH », « Exécution des marchés » — pour les KAM et les
 * responsables de BU. Elles LISENT « Ventes PCH » (`ventes-pch/requetes.ts`) : rien n'est ressaisi, rien n'est estimé.
 *
 * ── À QUI SE RAPPORTE LE CHIFFRE ────────────────────────────────────────────────────────────
 * • un KAM : les établissements de SON secteur (les liens `SalesSectorInstitution` des secteurs actifs de sa BU où il
 *   est affecté — la même lecture que le panel, `clausePanelDuKam`), pour les produits de la BU de ce secteur ;
 * • un responsable de BU (chef ou superviseur), ou une BU choisie dans la définition : toute la BU, par ses produits ;
 * • sans secteur ni BU : pas de chiffre, avec sa raison.
 * Le livré PCH est le sell-out de la molécule vers les hôpitaux : il n'est pas « la vente du KAM », il est l'activité de
 * son territoire — la définition de la brique le dit.
 *
 * ── LA MÊME PÉRIODE QUE LES AUTRES BRIQUES ───────────────────────────────────────────────────
 * La fenêtre du KPI (un ou plusieurs mois) devient des mois « AAAA-MM » inclus. Une ligne PCH est datée du mois de sa
 * facture. Sans AUCUNE ligne PCH pour le périmètre sur la période (import absent, produits non rattachés), la valeur
 * est absente avec sa raison : un zéro dirait « rien livré » là où l'on ne sait simplement pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface ResultatPch {
  valeur: number | null;
  raison: string | null;
}

const cleMois = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** La fenêtre du KPI en bornes de mois « AAAA-MM » incluses (la borne de fin de la fenêtre est exclusive). */
export function bornesPch(f: Fenetre): { debut: string; fin: string } {
  return { debut: cleMois(f.debut), fin: cleMois(new Date(f.fin.getTime() - 1)) };
}

interface Secteur {
  /** Les BU des secteurs du KAM. */
  buIds: string[];
  /** Les établissements de ses secteurs, par BU (un établissement peut couvrir des produits de BU différentes). */
  institutionsParBu: Map<string, Set<string>>;
}

/** Les secteurs actifs d'un KAM, dans sa BU — la même condition que `clausePanelDuKam`. */
async function secteurDuKam(userId: string): Promise<Secteur | null> {
  const secteurs = await prisma.salesSector.findMany({
    where: { isActive: true, reps: { some: { repId: userId } }, businessUnit: { reps: { some: { repId: userId } } } },
    select: { businessUnitId: true, institutions: { select: { institutionId: true } } },
  });
  if (secteurs.length === 0) return null;
  const parBu = new Map<string, Set<string>>();
  for (const s of secteurs) {
    const set = parBu.get(s.businessUnitId) ?? parBu.set(s.businessUnitId, new Set()).get(s.businessUnitId)!;
    for (const i of s.institutions) set.add(i.institutionId);
  }
  return { buIds: [...parBu.keys()], institutionsParBu: parBu };
}

/** Les BU d'une personne : celle du choix de la définition, sinon celles qu'elle dirige ou supervise, sinon sa BU de rattachement. */
async function busDe(userId: string, buChoisie?: string): Promise<string[]> {
  if (buChoisie) return [buChoisie];
  const dirigees = await prisma.businessUnit.findMany({ where: { isActive: true, OR: [{ headId: userId }, { supervisorId: userId }] }, select: { id: true } });
  if (dirigees.length) return dirigees.map((b) => b.id);
  const profil = await prisma.salesRepProfile.findUnique({ where: { repId: userId }, select: { businessUnitId: true } });
  return profil?.businessUnitId ? [profil.businessUnitId] : [];
}

type Perimetre =
  | { genre: "SECTEUR"; secteur: Secteur }
  | { genre: "BU"; buIds: string[] }
  | { genre: "AUCUN"; raison: string };

async function perimetreDe(userId: string, m: MesureKpi): Promise<Perimetre> {
  if (m.buId) return { genre: "BU", buIds: [m.buId] };
  const secteur = await secteurDuKam(userId);
  if (secteur) return { genre: "SECTEUR", secteur };
  const bus = await busDe(userId);
  return bus.length ? { genre: "BU", buIds: bus } : { genre: "AUCUN", raison: "La personne n'a ni secteur, ni BU dirigée, supervisée ou de rattachement." };
}

const SANS_DONNEE = "Aucune ligne PCH pour ce périmètre sur la période (import absent ou produits non rattachés).";

/** Livré et non servi du périmètre sur la période, ou null (avec raison) quand la PCH n'a rien pour lui. */
async function lirePch(p: Perimetre, f: Fenetre): Promise<{ livre: number; nonServi: number; etablissements: number } | { raison: string }> {
  if (p.genre === "AUCUN") return { raison: p.raison };
  const periode = bornesPch(f);
  if (p.genre === "BU") {
    const produits = [...new Set((await Promise.all(p.buIds.map((b) => produitsVentesPch(b)))).flat().map((x) => x.id))];
    if (produits.length === 0) return { raison: "Aucun produit de la BU n'est rattaché à des postes PCH." };
    const lignes = await venteParProduitEtMois({ ...periode, productIds: produits });
    if (lignes.length === 0) return { raison: SANS_DONNEE };
    return { livre: lignes.reduce((s, l) => s + l.livre, 0), nonServi: lignes.reduce((s, l) => s + l.nonServi, 0), etablissements: 0 };
  }
  let livre = 0, nonServi = 0, etablissements = 0, lignes = 0;
  for (const [buId, institutions] of p.secteur.institutionsParBu) {
    if (institutions.size === 0) continue;
    const t = await territoiresPch(periode, { buId });
    lignes += t.etablissements.length;
    for (const e of t.etablissements) {
      if (!e.institutionId || !institutions.has(e.institutionId)) continue;
      livre += e.livre; nonServi += e.nonServi; etablissements++;
    }
  }
  if ([...p.secteur.institutionsParBu.values()].every((s) => s.size === 0)) return { raison: "Le secteur du KAM ne compte aucun établissement." };
  if (lignes === 0) return { raison: SANS_DONNEE };
  return { livre, nonServi, etablissements };
}

/** LA VALEUR d'une brique PCH. */
export async function calculerBriquePch(m: MesureKpi, userId: string, f: Fenetre): Promise<ResultatPch> {
  if (m.brique === "EXECUTION_MARCHES") {
    const bus = await busDe(userId, m.buId);
    if (bus.length === 0) return { valeur: null, raison: "La personne n'a ni BU dirigée, supervisée ou de rattachement, ni BU choisie." };
    const chaines = new Map<string, { attribue: number; livre: number }>();
    for (const b of bus) for (const l of await chainesContratsPch(b)) chaines.set(l.cle, { attribue: l.chaine.attribue, livre: l.chaine.livre });
    const r = executionDesMarches([...chaines.values()]);
    return r.pct === null ? { valeur: null, raison: "Aucun marché attribué sur les produits de la BU." } : { valeur: r.pct, raison: null };
  }
  const lu = await lirePch(await perimetreDe(userId, m), f);
  if ("raison" in lu) return { valeur: null, raison: lu.raison };
  return { valeur: m.brique === "LIVRE_PCH" ? lu.livre : lu.nonServi, raison: null };
}

/** « D'OÙ VIENT LE CHIFFRE » — les établissements du secteur (livré, non servi), ou les produits de la BU. */
export async function detailBriquePch(m: MesureKpi, userId: string, f: Fenetre): Promise<LigneDetail[]> {
  if (m.brique === "EXECUTION_MARCHES") {
    const bus = await busDe(userId, m.buId);
    const lignes = new Map<string, Awaited<ReturnType<typeof chainesContratsPch>>[number]>();
    for (const b of bus) for (const l of await chainesContratsPch(b)) lignes.set(l.cle, l);
    return [...lignes.values()].map((l) => ({
      date: null, libelle: `${l.nom}${l.marche ? ` · ${l.marche.reference}` : ""}`,
      etat: `${l.chaine.livre} livrées / ${l.chaine.attribue} attribuées`, compte: l.chaine.attribue > 0 && l.chaine.livre >= l.chaine.attribue,
    }));
  }
  const p = await perimetreDe(userId, m);
  if (p.genre === "AUCUN") return [];
  const periode = bornesPch(f);
  const nonServi = m.brique === "NON_SERVI_PCH";
  const sortie: LigneDetail[] = [];
  if (p.genre === "SECTEUR") {
    for (const [buId, institutions] of p.secteur.institutionsParBu) {
      const t = await territoiresPch(periode, { buId });
      for (const e of t.etablissements) {
        if (!e.institutionId || !institutions.has(e.institutionId)) continue;
        sortie.push({ date: null, libelle: `${e.nom} · ${e.dr}`, etat: `${e.livre} livrée(s) · ${e.nonServi} non servie(s)`, compte: nonServi ? e.nonServi > 0 : e.livre > 0 });
      }
    }
    return sortie.sort((a, z) => a.libelle.localeCompare(z.libelle, "fr")).slice(0, 300);
  }
  const produits = await Promise.all(p.buIds.map((b) => produitsVentesPch(b)));
  const nom = new Map(produits.flat().map((x) => [x.id, x.nom]));
  const lignes = await venteParProduitEtMois({ ...periode, productIds: [...nom.keys()] });
  const parProduit = new Map<string, { livre: number; nonServi: number }>();
  for (const l of lignes) {
    const x = parProduit.get(l.productId) ?? parProduit.set(l.productId, { livre: 0, nonServi: 0 }).get(l.productId)!;
    x.livre += l.livre; x.nonServi += l.nonServi;
  }
  for (const [id, x] of parProduit) sortie.push({ date: null, libelle: nom.get(id) ?? "Produit", etat: `${x.livre} livrée(s) · ${x.nonServi} non servie(s)`, compte: nonServi ? x.nonServi > 0 : x.livre > 0 });
  return sortie.sort((a, z) => a.libelle.localeCompare(z.libelle, "fr"));
}
