import { createHash } from "crypto";
import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  detecterEntete, lireVentes, lireReceptions, periodeDuFichier, libellePeriode, moisDe, quantiteNonServie,
  type Entete, type LigneVenteLue, type LigneReceptionLue, type NatureFichier,
} from "./lecture";
import { cleClient, cleFournisseur, clePresentation } from "./normalisation";
import {
  indexEtablissementsPch, indexProduitsPch, decisionPoste, proposerFournisseurs,
  type ProduitRef, type PosteExistant, type DecisionPoste, type RattachementProduit,
} from "./correspondance";
import { planRemplacement, dateDuMois, cleTranche, SOURCE_RECEPTIONS, type Tranche, type ImportExistant } from "./calculs";

/**
 * VENTES PCH — LE CÔTÉ BASE DE L'IMPORT (serveur uniquement : `xlsx`, `crypto`, Prisma).
 *
 *   fichier(s) → nature (en-tête) → période (dates) → lignes → rattachements (établissement, poste → produit) →
 *   APERÇU (rien n'est écrit) → APPLICATION : le même fichier ne fait rien ; chaque tranche (DR × mois, ou réceptions
 *   × mois) qu'il porte REMPLACE la même tranche ; le fichier original est gardé ; les lignes s'écrivent par lots.
 *
 * Les gestes de rattachement (établissement, poste, fournisseur, DR) s'appliquent aux lignes DÉJÀ importées et se
 * mémorisent pour les fichiers suivants.
 */

const LOT = 1000;

// ─────────────────────────── Lecture du classeur ───────────────────────────

/** Les lignes brutes de la première feuille qui a l'en-tête d'un fichier PCH. Dates en numéros de série (bruts). */
export function lireClasseurPch(buffer: Buffer): { lignes: unknown[][]; entete: Entete } | null {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  for (const nom of wb.SheetNames) {
    const lignes = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nom], { header: 1, raw: true, defval: null, blankrows: false });
    const entete = detecterEntete(lignes);
    if (entete) return { lignes, entete };
  }
  return null;
}

// ─────────────────────────── Contexte de rattachement ───────────────────────────

interface Contexte {
  etab: ReturnType<typeof indexEtablissementsPch>;
  wilayaDe: Map<string, string | null>;
  resoudre: ReturnType<typeof indexProduitsPch>;
  postes: Map<number, PosteExistant & { designation: string }>;
  nomProduit: Map<string, string>;
}

async function chargerContexte(): Promise<Contexte> {
  const [etabs, memEtab, produits, postes] = await Promise.all([
    prisma.medicalInstitution.findMany({ select: { id: true, name: true, isActive: true, wilaya: true } }),
    prisma.pchEtablissementMemoire.findMany({ select: { cle: true, institutionId: true } }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, canonicalName: true, dci: true, dosage: true, dosageUnit: true, form: true, packaging: true } }),
    prisma.pchPoste.findMany({ select: { poste: true, productId: true, manuel: true, designation: true } }),
  ]);
  const refs: ProduitRef[] = produits.map((p) => ({ id: p.id, nom: p.canonicalName, dci: p.dci, dosage: p.dosage, dosageUnit: p.dosageUnit, form: p.form, packaging: p.packaging }));
  const memPostes = new Map(postes.filter((p) => p.manuel && p.productId).map((p) => [p.poste, p.productId!]));
  return {
    etab: indexEtablissementsPch(etabs, new Map(memEtab.map((m) => [m.cle, m.institutionId]))),
    wilayaDe: new Map(etabs.map((e) => [e.id, e.wilaya])),
    resoudre: indexProduitsPch(refs, memPostes),
    postes: new Map(postes.map((p) => [p.poste, { productId: p.productId, manuel: p.manuel, designation: p.designation }])),
    nomProduit: new Map(refs.map((p) => [p.id, p.nom])),
  };
}

// ─────────────────────────── Préparation (pure sur le contexte) ───────────────────────────

export interface ProduitReconnu { productId: string; nom: string; lignes: number; quantite: number; nonServi: number }

export interface Apercu {
  nomFichier: string;
  empreinte: string;
  nature: NatureFichier;
  deja: { le: string; nomFichier: string } | null;
  sources: string[];
  periode: { debut: string; fin: string; annuel: boolean; libelle: string; mois: string[] };
  lignes: number;
  ignorees: number;
  /** Ventes : établissements distincts, rattachés, à rattacher ; lignes non servies, retours, lignes sans date. */
  etablissements: number;
  etablissementsRattaches: number;
  etablissementsARattacher: number;
  nonServies: number;
  quantiteNonServie: number;
  retours: number;
  sansDate: number;
  /** Réceptions : fournisseurs distincts, lignes par type (FO, TR, RC, CO). */
  fournisseurs: number;
  parType: Record<string, number>;
  produits: ProduitReconnu[];
  /** Postes de NOS molécules qui ne désignent aucun de nos produits avec certitude. */
  postesARattacher: number;
  /** Ce que l'application remplacera : tranches (source × mois) déjà importées. */
  remplace: { source: string; mois: string }[];
}

interface Preparation {
  apercu: Apercu;
  tranches: Tranche[];
  decisions: Map<number, DecisionPoste & { designation: string; molecule: string | null; cle: string | null }>;
  ventes: Omit<Prisma.PchVenteLigneCreateManyInput, "importId">[];
  receptions: Omit<Prisma.PchReceptionLigneCreateManyInput, "importId">[];
  wilayasParDr: Map<string, Map<string, number>>;
}

/** LE PRODUIT DE CHAQUE POSTE du fichier — tous ses libellés lus, la mémoire respectée (`decisionPoste`). */
function deciderPostes(ctx: Contexte, items: { poste: number | null; designation: string; uc: string | null }[]) {
  const lectures = new Map<number, { designation: string; lus: Map<string, RattachementProduit> }>();
  for (const it of items) {
    if (it.poste === null) continue;
    const e = lectures.get(it.poste) ?? lectures.set(it.poste, { designation: it.designation, lus: new Map() }).get(it.poste)!;
    const k = `${it.designation}|${it.uc ?? ""}`;
    if (!e.lus.has(k)) e.lus.set(k, ctx.resoudre(it.poste, it.designation, it.uc));
  }
  const decisions: Preparation["decisions"] = new Map();
  for (const [poste, { designation, lus }] of lectures) {
    const r = [...lus.values()];
    const d = decisionPoste(ctx.postes.get(poste), r);
    const pr = r[0]?.presentation;
    decisions.set(poste, { ...d, designation, molecule: pr?.molecule || null, cle: pr ? clePresentation(pr) : null });
  }
  return decisions;
}

const dec = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

function preparerVentes(ctx: Contexte, base: Pick<Apercu, "nomFichier" | "empreinte">, lues: LigneVenteLue[], ignorees: number): Preparation | { erreur: string } {
  const periode = periodeDuFichier(lues.map((l) => l.dateFacture));
  if (!periode) return { erreur: "Aucune date de facture lisible : la période du fichier ne se devine pas." };
  const sources = [...new Set(lues.map((l) => l.dr).filter(Boolean))].sort();
  if (!sources.length) return { erreur: "Colonne ANNEXE vide : la direction régionale du fichier est inconnue." };
  const decisions = deciderPostes(ctx, lues.map((l) => ({ poste: l.poste, designation: l.dci, uc: l.uc })));
  const parClient = new Map<string, ReturnType<Contexte["etab"]>>();
  const produits = new Map<string, ProduitReconnu>();
  const wilayasParDr = new Map<string, Map<string, number>>();
  const moisPresents = new Set<string>();
  let nonServies = 0, qteNonServie = 0, retours = 0, sansDate = 0;
  const ventes: Preparation["ventes"] = lues.map((l) => {
    const cle = cleClient(l.client);
    const r = parClient.get(cle) ?? parClient.set(cle, ctx.etab(l.client)).get(cle)!;
    const d = l.poste !== null ? decisions.get(l.poste) : undefined;
    const mois = l.dateFacture ? moisDe(l.dateFacture) : periode.moisSansDate;
    if (!l.dateFacture) sansDate++;
    moisPresents.add(mois);
    const ns = quantiteNonServie(l.statut, l.qteCommandee);
    if (l.statut === "NON_SERVIE") { nonServies++; qteNonServie += ns; }
    if (l.statut === "RETOUR") retours++;
    if (d?.productId) {
      const p = produits.get(d.productId) ?? produits.set(d.productId, { productId: d.productId, nom: ctx.nomProduit.get(d.productId) ?? "", lignes: 0, quantite: 0, nonServi: 0 }).get(d.productId)!;
      p.lignes++; p.quantite += l.qteLivree; p.nonServi += ns;
    }
    if (r.institutionId) {
      const w = ctx.wilayaDe.get(r.institutionId);
      if (w) { const m = wilayasParDr.get(l.dr) ?? wilayasParDr.set(l.dr, new Map()).get(l.dr)!; m.set(w, (m.get(w) ?? 0) + 1); }
    }
    return {
      ligneSource: l.ligneSource, dr: l.dr, mois: dateDuMois(mois), famille: l.famille, classe: l.classe,
      client: l.client, clientCle: cle, institutionId: r.institutionId, poste: l.poste, dci: l.dci,
      molecule: d?.molecule ?? null, cle: d?.cle ?? null, productId: d?.productId ?? null,
      uc: l.uc, lot: l.lot, ddp: l.ddp, qteCommandee: l.qteCommandee, qteLivree: l.qteLivree,
      coutAchat: dec(l.coutAchat), prixVente: dec(l.prixVente),
      valeurAchat: l.coutAchat !== null ? dec(l.qteLivree * l.coutAchat) : null,
      dateFacture: l.dateFacture ? new Date(`${l.dateFacture}T00:00:00Z`) : null,
      statut: l.statut,
    };
  });
  const rattaches = [...parClient.values()].filter((r) => r.institutionId).length;
  const mois = [...moisPresents].sort();
  return {
    apercu: {
      ...base, nature: "VENTES_DR", deja: null, sources,
      periode: { debut: mois[0], fin: mois[mois.length - 1], annuel: periode.annuel, libelle: libellePeriode(periode), mois },
      lignes: ventes.length, ignorees,
      etablissements: parClient.size, etablissementsRattaches: rattaches, etablissementsARattacher: parClient.size - rattaches,
      nonServies, quantiteNonServie: qteNonServie, retours, sansDate,
      fournisseurs: 0, parType: {},
      produits: [...produits.values()].sort((a, b) => b.quantite - a.quantite),
      postesARattacher: [...decisions.values()].filter((d) => !d.productId && (d.statut === "AMBIGU" || d.statut === "MOLECULE")).length,
      remplace: [],
    },
    tranches: sources.flatMap((s) => mois.map((m) => ({ source: s, mois: m }))),
    decisions, ventes, receptions: [], wilayasParDr,
  };
}

function preparerReceptions(ctx: Contexte, base: Pick<Apercu, "nomFichier" | "empreinte">, lues: LigneReceptionLue[], ignorees: number): Preparation | { erreur: string } {
  const periode = periodeDuFichier(lues.map((l) => l.dateStockage));
  if (!periode) return { erreur: "Aucune date de stockage lisible : la période du fichier ne se devine pas." };
  const decisions = deciderPostes(ctx, lues.map((l) => ({ poste: l.codePro, designation: l.designation, uc: l.conditionnement })));
  const produits = new Map<string, ProduitReconnu>();
  const parType: Record<string, number> = {};
  const fournisseurs = new Set<string>();
  const moisPresents = new Set<string>();
  const receptions: Preparation["receptions"] = lues.map((l) => {
    const d = l.codePro !== null ? decisions.get(l.codePro) : undefined;
    const mois = l.dateStockage ? moisDe(l.dateStockage) : periode.moisSansDate;
    moisPresents.add(mois);
    parType[l.type] = (parType[l.type] ?? 0) + 1;
    fournisseurs.add(cleFournisseur(l.fournisseur));
    if (d?.productId && l.type === "FO") {
      const p = produits.get(d.productId) ?? produits.set(d.productId, { productId: d.productId, nom: ctx.nomProduit.get(d.productId) ?? "", lignes: 0, quantite: 0, nonServi: 0 }).get(d.productId)!;
      p.lignes++; p.quantite += l.qte;
    }
    return {
      ligneSource: l.ligneSource, mois: dateDuMois(mois),
      dateStockage: l.dateStockage ? new Date(`${l.dateStockage}T00:00:00Z`) : null,
      gamme: l.gamme, classe: l.classe, codeFour: l.codeFour, fournisseur: l.fournisseur, fournisseurCle: cleFournisseur(l.fournisseur),
      numBr: l.numBr, codePro: l.codePro, designation: l.designation,
      molecule: d?.molecule ?? null, cle: d?.cle ?? null, productId: d?.productId ?? null,
      conditionnement: l.conditionnement, qte: l.qte, coutUnit: dec(l.coutUnit), devise: l.devise, type: l.type, avoirNo: l.avoirNo,
    };
  });
  const mois = [...moisPresents].sort();
  return {
    apercu: {
      ...base, nature: "RECEPTIONS", deja: null, sources: [SOURCE_RECEPTIONS],
      periode: { debut: mois[0], fin: mois[mois.length - 1], annuel: periode.annuel, libelle: libellePeriode(periode), mois },
      lignes: receptions.length, ignorees,
      etablissements: 0, etablissementsRattaches: 0, etablissementsARattacher: 0, nonServies: 0, quantiteNonServie: 0, retours: parType.RC ?? 0, sansDate: 0,
      fournisseurs: fournisseurs.size, parType,
      produits: [...produits.values()].sort((a, b) => b.quantite - a.quantite),
      postesARattacher: [...decisions.values()].filter((d) => !d.productId && (d.statut === "AMBIGU" || d.statut === "MOLECULE")).length,
      remplace: [],
    },
    tranches: mois.map((m) => ({ source: SOURCE_RECEPTIONS, mois: m })),
    decisions, ventes: [], receptions, wilayasParDr: new Map(),
  };
}

/** Les imports qui comptent encore, avec leurs tranches (sources × mois). */
async function importsExistants(nature: NatureFichier): Promise<(ImportExistant & { nomFichier: string; createdAt: Date })[]> {
  const rows = await prisma.pchVenteImport.findMany({
    where: { nature, remplaceParId: null },
    select: { id: true, empreinte: true, sources: true, mois: true, nomFichier: true, createdAt: true },
  });
  return rows.map((r) => ({ id: r.id, empreinte: r.empreinte, nomFichier: r.nomFichier, createdAt: r.createdAt, tranches: r.sources.flatMap((s) => r.mois.map((m) => ({ source: s, mois: m }))) }));
}

async function preparer(buffer: Buffer, nomFichier: string, ctx: Contexte): Promise<Preparation | { erreur: string }> {
  const empreinte = createHash("sha256").update(buffer).digest("hex");
  const lu = lireClasseurPch(buffer);
  if (!lu) return { erreur: `« ${nomFichier} » n'a ni l'en-tête des ventes d'une DR (CLIENT, POSTE, DCI, QTÉ_LIVRÉE…) ni celui des réceptions (NOM_FOUR, CODE_PRO, TYPE_RECEP…).` };
  const base = { nomFichier, empreinte };
  const p = lu.entete.nature === "VENTES_DR"
    ? (() => { const r = lireVentes(lu.lignes, lu.entete); return preparerVentes(ctx, base, r.lignes, r.ignorees); })()
    : (() => { const r = lireReceptions(lu.lignes, lu.entete); return preparerReceptions(ctx, base, r.lignes, r.ignorees); })();
  if ("erreur" in p) return p;
  if (p.apercu.lignes === 0) return { erreur: `« ${nomFichier} » ne porte aucune ligne.` };
  const existants = await importsExistants(p.apercu.nature);
  const plan = planRemplacement(empreinte, p.tranches, existants);
  if (plan.deja) {
    const e = existants.find((x) => x.id === plan.importId);
    p.apercu.deja = { le: (e?.createdAt ?? new Date()).toISOString(), nomFichier: e?.nomFichier ?? nomFichier };
  } else {
    p.apercu.remplace = plan.tranchesRemplacees.map((t) => ({ source: t.source, mois: t.mois }));
  }
  return p;
}

// ─────────────────────────── Aperçu & application ───────────────────────────

/** APERÇU d'un fichier : tout est lu et rattaché, RIEN n'est écrit. */
export async function apercuFichierPch(buffer: Buffer, nomFichier: string): Promise<{ ok: true; apercu: Apercu } | { ok: false; error: string }> {
  // Le même fichier déjà importé (même remplacé depuis) se dit : l'appliquer ne ferait rien.
  const empreinte = createHash("sha256").update(buffer).digest("hex");
  const meme = await prisma.pchVenteImport.findUnique({ where: { empreinte }, select: { createdAt: true, nomFichier: true } });
  const p = await preparer(buffer, nomFichier, await chargerContexte());
  if ("erreur" in p) return { ok: false, error: p.erreur };
  if (meme && !p.apercu.deja) p.apercu.deja = { le: meme.createdAt.toISOString(), nomFichier: meme.nomFichier };
  return { ok: true, apercu: p.apercu };
}

export type ResultatApplication =
  | { ok: true; deja: true; nomFichier: string }
  | { ok: true; deja: false; importId: string; lignes: number; remplacees: number; apercu: Apercu }
  | { ok: false; error: string };

/**
 * APPLIQUER un fichier — idempotent :
 *   • même empreinte → rien ;
 *   • chaque tranche (source × mois) du fichier remplace la même tranche (lignes effacées, l'import d'origine gardé,
 *     marqué « remplacé » s'il ne lui reste rien) ;
 *   • les lignes s'écrivent par lots de 1 000 ; les postes vus se mémorisent (rattachement automatique, jamais par-dessus
 *     un rattachement fait à la main) ; les fournisseurs « à nous » se proposent ; les DR inconnues se créent.
 */
export async function appliquerFichierPch(buffer: Buffer, nomFichier: string, auteurId: string): Promise<ResultatApplication> {
  const empreinte = createHash("sha256").update(buffer).digest("hex");
  if (await prisma.pchVenteImport.findUnique({ where: { empreinte }, select: { id: true } })) return { ok: true, deja: true, nomFichier };
  const ctx = await chargerContexte();
  const p = await preparer(buffer, nomFichier, ctx);
  if ("erreur" in p) return { ok: false, error: p.erreur };
  if (p.apercu.deja) return { ok: true, deja: true, nomFichier };
  const nature = p.apercu.nature;
  const existants = await importsExistants(nature);
  const plan = planRemplacement(empreinte, p.tranches, existants);
  if (plan.deja) return { ok: true, deja: true, nomFichier };

  // Les postes dont le rattachement change : leurs lignes DÉJÀ importées suivent.
  const changes: { poste: number; productId: string | null }[] = [];
  const nouveaux: Prisma.PchPosteCreateManyInput[] = [];
  for (const [poste, d] of p.decisions) {
    const avant = ctx.postes.get(poste);
    if (!avant) nouveaux.push({ poste, designation: d.designation, molecule: d.molecule, cle: d.cle, productId: d.productId, manuel: false, statut: d.statut });
    else if (!avant.manuel && avant.productId !== d.productId) changes.push({ poste, productId: d.productId });
  }

  const resultat = await prisma.$transaction(async (tx) => {
    let remplacees = 0;
    if (plan.tranchesRemplacees.length) {
      if (nature === "VENTES_DR") {
        const r = await tx.pchVenteLigne.deleteMany({ where: { OR: plan.tranchesRemplacees.map((t) => ({ dr: t.source, mois: dateDuMois(t.mois) })) } });
        remplacees = r.count;
      } else {
        const r = await tx.pchReceptionLigne.deleteMany({ where: { mois: { in: plan.tranchesRemplacees.map((t) => dateDuMois(t.mois)) } } });
        remplacees = r.count;
      }
    }
    const imp = await tx.pchVenteImport.create({
      data: {
        nature, nomFichier, empreinte, taille: buffer.length, fichier: buffer,
        sources: p.apercu.sources, mois: p.apercu.periode.mois, annuel: p.apercu.periode.annuel,
        lignes: p.apercu.lignes, auteurId,
        rapport: { ...p.apercu, produits: p.apercu.produits.slice(0, 50), remplacees, tranchesRemplacees: plan.tranchesRemplacees.map(cleTranche) } as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    if (plan.importsRemplaces.length) {
      await tx.pchVenteImport.updateMany({ where: { id: { in: plan.importsRemplaces } }, data: { remplaceParId: imp.id, remplaceLe: new Date() } });
    }
    if (nature === "VENTES_DR") {
      for (let k = 0; k < p.ventes.length; k += LOT) await tx.pchVenteLigne.createMany({ data: p.ventes.slice(k, k + LOT).map((x) => ({ ...x, importId: imp.id })) });
    } else {
      for (let k = 0; k < p.receptions.length; k += LOT) await tx.pchReceptionLigne.createMany({ data: p.receptions.slice(k, k + LOT).map((x) => ({ ...x, importId: imp.id })) });
    }
    if (nouveaux.length) await tx.pchPoste.createMany({ data: nouveaux, skipDuplicates: true });
    for (const c of changes) {
      const d = p.decisions.get(c.poste)!;
      await tx.pchPoste.update({ where: { poste: c.poste }, data: { productId: c.productId, statut: d.statut, designation: d.designation, molecule: d.molecule, cle: d.cle } });
      await tx.pchVenteLigne.updateMany({ where: { poste: c.poste }, data: { productId: c.productId } });
      await tx.pchReceptionLigne.updateMany({ where: { codePro: c.poste }, data: { productId: c.productId } });
    }
    return { importId: imp.id, remplacees };
  }, { timeout: 180_000, maxWait: 20_000 });

  await apresImport(p, auteurId);
  return { ok: true, deja: false, importId: resultat.importId, lignes: p.apercu.lignes, remplacees: resultat.remplacees, apercu: p.apercu };
}

/** Après l'écriture : les DR inconnues se créent (wilayas déduites des clients rattachés), les fournisseurs se proposent. */
async function apresImport(p: Preparation, auteurId: string): Promise<void> {
  for (const dr of p.apercu.nature === "VENTES_DR" ? p.apercu.sources : []) {
    const wilayas = [...(p.wilayasParDr.get(dr)?.entries() ?? [])].sort((a, b) => b[1] - a[1]).map(([w]) => w);
    const existe = await prisma.pchDirectionRegionale.findUnique({ where: { code: dr }, select: { wilayas: true } });
    if (!existe) await prisma.pchDirectionRegionale.create({ data: { code: dr, libelle: dr, wilayas } });
    else if (existe.wilayas.length === 0 && wilayas.length) await prisma.pchDirectionRegionale.update({ where: { code: dr }, data: { wilayas } });
  }
  const produits = [...new Set([...p.decisions.values()].map((d) => d.productId).filter((x): x is string => !!x))];
  if (produits.length) await proposerFournisseursPch(produits, auteurId);
}

/**
 * PROPOSE les fournisseurs « à nous » des produits donnés : parmi les fournisseurs FO de leurs postes, ceux qui reprennent
 * le laboratoire partenaire, le détenteur de la décision ou le fabricant de leurs dossiers. Une proposition n'écrase
 * jamais ce qu'une personne a réglé (une ligne existante, active ou non, ne bouge pas).
 */
export async function proposerFournisseursPch(productIds: string[], auteurId: string | null): Promise<number> {
  const [livreurs, dossiers, deja] = await Promise.all([
    prisma.pchReceptionLigne.groupBy({ by: ["productId", "fournisseur", "fournisseurCle"], where: { productId: { in: productIds }, type: "FO" } }),
    prisma.regulatoryProduct.findMany({ where: { productId: { in: productIds } }, select: { productId: true, partnerLab: true, deHolder: true, manufacturer: true } }),
    prisma.pchFournisseurProduit.findMany({ where: { productId: { in: productIds } }, select: { productId: true, fournisseurCle: true } }),
  ]);
  const existe = new Set(deja.map((d) => `${d.productId}|${d.fournisseurCle}`));
  const data: Prisma.PchFournisseurProduitCreateManyInput[] = [];
  for (const pid of productIds) {
    const labos = dossiers.filter((d) => d.productId === pid).flatMap((d) => [d.partnerLab, d.deHolder, d.manufacturer]);
    const miens = livreurs.filter((l) => l.productId === pid);
    for (const f of proposerFournisseurs(miens.map((l) => l.fournisseur), labos)) {
      const cle = cleFournisseur(f);
      if (existe.has(`${pid}|${cle}`)) continue;
      existe.add(`${pid}|${cle}`);
      data.push({ productId: pid, fournisseurCle: cle, libelle: f, origine: "AUTO", actif: true, createdById: auteurId });
    }
  }
  if (data.length) await prisma.pchFournisseurProduit.createMany({ data, skipDuplicates: true });
  return data.length;
}

// ─────────────────────────── Gestes de rattachement ───────────────────────────

/** « Ce client de la PCH est cet établissement » — appliqué à toutes ses lignes, mémorisé pour les fichiers suivants. */
export async function rattacherEtablissementPch(cle: string, institutionId: string | null, auteurId: string): Promise<{ ok: true; lignes: number } | { ok: false; error: string }> {
  if (!cle) return { ok: false, error: "Client vide." };
  if (institutionId) {
    const e = await prisma.medicalInstitution.findUnique({ where: { id: institutionId }, select: { id: true } });
    if (!e) return { ok: false, error: "Établissement introuvable." };
  }
  const r = await prisma.$transaction(async (tx) => {
    if (institutionId) await tx.pchEtablissementMemoire.upsert({ where: { cle }, update: { institutionId, confirmeParId: auteurId }, create: { cle, institutionId, confirmeParId: auteurId } });
    else await tx.pchEtablissementMemoire.deleteMany({ where: { cle } });
    return tx.pchVenteLigne.updateMany({ where: { clientCle: cle }, data: { institutionId } });
  });
  return { ok: true, lignes: r.count };
}

/** « Ce poste PCH est ce produit » (ou n'est aucun des nôtres) — fait À LA MAIN : il ne bougera plus. */
export async function rattacherPostePch(poste: number, productId: string | null, auteurId: string): Promise<{ ok: true; lignes: number } | { ok: false; error: string }> {
  const existant = await prisma.pchPoste.findUnique({ where: { poste }, select: { poste: true } });
  if (!existant) return { ok: false, error: "Poste PCH inconnu (jamais vu dans un fichier)." };
  if (productId && !(await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }))) return { ok: false, error: "Produit introuvable." };
  const n = await prisma.$transaction(async (tx) => {
    await tx.pchPoste.update({ where: { poste }, data: { productId, manuel: true, statut: "MEMOIRE", confirmeParId: auteurId } });
    const a = await tx.pchVenteLigne.updateMany({ where: { poste }, data: { productId } });
    const b = await tx.pchReceptionLigne.updateMany({ where: { codePro: poste }, data: { productId } });
    return a.count + b.count;
  });
  if (productId) await proposerFournisseursPch([productId], auteurId);
  return { ok: true, lignes: n };
}

/** Un fournisseur PCH « à nous » pour un produit : ajouté, réactivé ou retiré (la ligne reste, inactive). */
export async function reglerFournisseurPch(productId: string, fournisseur: string, actif: boolean, auteurId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const cle = cleFournisseur(fournisseur);
  if (!cle) return { ok: false, error: "Fournisseur vide." };
  if (!(await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }))) return { ok: false, error: "Produit introuvable." };
  await prisma.pchFournisseurProduit.upsert({
    where: { productId_fournisseurCle: { productId, fournisseurCle: cle } },
    update: { actif, origine: "MANUEL" },
    create: { productId, fournisseurCle: cle, libelle: fournisseur.trim(), origine: "MANUEL", actif, createdById: auteurId },
  });
  return { ok: true };
}

/** Le libellé et les wilayas d'une direction régionale. */
export async function enregistrerDirectionRegionale(code: string, libelle: string, wilayas: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = code.trim().toUpperCase();
  if (!c) return { ok: false, error: "Code vide." };
  const l = libelle.trim() || c;
  const w = [...new Set(wilayas.map((x) => x.trim()).filter(Boolean))];
  await prisma.pchDirectionRegionale.upsert({ where: { code: c }, update: { libelle: l, wilayas: w }, create: { code: c, libelle: l, wilayas: w } });
  return { ok: true };
}
