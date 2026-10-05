import { prisma } from "@/lib/prisma";
import { refusSuppressionRapportDeVisite } from "@/lib/sfe/tournee";
import {
  gestesDeRemise, lireNumeriques, lireRemises, refusRemise, remisNetParArticle, resumeRemises,
  type GesteDeRemise,
} from "@/lib/promo/remises";
import { etatValidite, libelleArticleStock } from "@/lib/promo/stock";
import { remettreAuMedecin, reprendreRemisesDeLaVisite, type AncreRemise, type Tx } from "@/lib/promo/stock-ecriture";

export type { AncreRemise };

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE MATÉRIEL REMIS EN VISITE, CÔTÉ SERVEUR (§118.166) — un seul endroit pour les QUATRE portes
 * qui enregistrent une visite faite : le rapport d'une visite planifiée, la visite imprévue, la
 * saisie rapide de « Ma journée », et le compte rendu de visite du module Rapports terrain
 * (§118.204). Quatre copies auraient fini par ne pas remettre pareil — et le symptôme serait un
 * stock juste ou faux selon le bouton qu'un délégué a pris (§118.5, §118.71).
 *
 * L'ordre est toujours le même : LIRE et vérifier hors transaction (tout ce qui ne va pas, en une
 * fois), puis ÉCRIRE sous le verrou de chaque article, dans la transaction de la visite. Le SOLDE
 * ne se juge que sous le verrou : le lire avant laisserait deux visites simultanées passer toutes
 * deux sur le même reste.
 *
 * Serveur seulement — ce module lit la base. Ce n'est PAS un fichier « use server » : rien ici
 * n'est un point d'entrée, et `RefusRemise` (une classe) n'aurait pas le droit d'y être exportée.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * UNE REMISE QUI DÉPASSE LE STOCK ANNULE TOUTE LA VISITE. Levée DANS la transaction : la visite,
 * ses produits, ses messages et ses remises s'écrivent ensemble ou pas du tout — une visite
 * enregistrée dont la remise a été refusée noterait le médecin « visité » sans ce qu'on lui a donné.
 */
export class RefusRemise extends Error {}

export interface MaterielLu {
  /** Les remises SAISIES (article, quantité) — la cible ; les gestes se calculent sous le verrou. */
  remises: { itemId: string; quantite: number }[];
  numeriques: string[];
  libelles: Map<string, string>;
}

/** Ce qu'une visite porte DÉJÀ — ce qu'une correction peut devoir reprendre ou garder. */
export interface DejaDansLaVisite {
  /** Les articles remis lors de cette visite (contre-passés ou non) : ils se verrouillent. */
  remis: string[];
  /** Les supports numériques déjà présentés : on peut les garder même s'ils ont expiré depuis. */
  presentes: string[];
}

const RIEN: DejaDansLaVisite = { remis: [], presentes: [] };

const libelleDe = (a: { catalogue: { nom: string }; produits: { product: { canonicalName: string } }[] }) =>
  libelleArticleStock(a.catalogue.nom, a.produits.map((p) => p.product.canonicalName));

/** CE QU'UNE VISITE PORTE DÉJÀ. Une visite qui n'existe pas encore (création) ne porte rien. */
export async function dejaDansLaVisite(visitId: string | null): Promise<DejaDansLaVisite> {
  if (!visitId) return RIEN;
  const [ms, ps] = await Promise.all([
    prisma.promoStockMovement.findMany({ where: { visitId, kind: "DISTRIBUTION" }, select: { itemId: true }, distinct: ["itemId"] }),
    prisma.medicalVisitSupportNumerique.findMany({ where: { visitId }, select: { itemId: true } }),
  ]);
  return { remis: ms.map((m) => m.itemId), presentes: ps.map((p) => p.itemId) };
}

/**
 * LIRE ET VÉRIFIER LE BLOC « MATÉRIEL REMIS » — avant toute écriture, tout ce qui ne va pas en
 * une fois (§118.18) : un article inconnu, un support numérique saisi avec une quantité, un
 * article ordinaire coché comme support, un article archivé, un support qui n'est plus valide.
 * Ce que la visite porte déjà échappe aux deux dernières règles : corriger le texte d'un rapport
 * ne doit pas imposer de retirer une remise faite quand l'article était encore actif.
 */
export async function lireMaterielRemis(formData: FormData, deja: DejaDansLaVisite, maintenant: Date):
  Promise<{ ok: true; materiel: MaterielLu } | { ok: false; error: string }> {
  const lues = lireRemises(formData.getAll("materielItemId"), formData.getAll("materielQuantite"));
  if (!lues.ok) return lues;
  const numeriques = lireNumeriques(formData.getAll("numeriqueItemId"));
  const ids = [...new Set([...lues.remises.map((r) => r.itemId), ...numeriques, ...deja.remis])];
  const articles = ids.length
    ? await prisma.promoStockItem.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, isActive: true, valableJusquau: true,
          catalogue: { select: { nom: true, famille: true } },
          produits: { select: { product: { select: { canonicalName: true } } } },
        },
      })
    : [];
  const parId = new Map(articles.map((a) => [a.id, a]));
  const fautes: string[] = [];
  for (const r of lues.remises) {
    const a = parId.get(r.itemId);
    if (!a) { fautes.push("un article remis est introuvable"); continue; }
    if (a.catalogue.famille === "NUMERIQUE") fautes.push(`« ${libelleDe(a)} » est un support numérique : il se présente, il ne se remet pas`);
    else if (!a.isActive && !deja.remis.includes(a.id)) fautes.push(`« ${libelleDe(a)} » est archivé : il ne se remet plus`);
  }
  for (const id of numeriques) {
    const a = parId.get(id);
    if (!a) { fautes.push("un support numérique coché est introuvable"); continue; }
    if (a.catalogue.famille !== "NUMERIQUE") fautes.push(`« ${libelleDe(a)} » n'est pas un support numérique : il se remet, avec sa quantité`);
    else if (!deja.presentes.includes(id) && (!a.isActive || etatValidite(a.valableJusquau, maintenant) === "PERIME")) {
      fautes.push(`« ${libelleDe(a)} » n'est plus valide : il ne se présente plus`);
    }
  }
  if (fautes.length) return { ok: false, error: `Matériel remis à revoir : ${fautes.join(" ; ")}.` };
  return { ok: true, materiel: { remises: lues.remises, numeriques, libelles: new Map(articles.map((a) => [a.id, libelleDe(a)])) } };
}

/**
 * CE QU'UN COMPTE RENDU DE VISITE (rapport terrain) PORTE DÉJÀ (§118.204). Il n'a pas de supports
 * numériques : une présentation se rattache à une VISITE (`MedicalVisitSupportNumerique`), et le
 * compte rendu qui n'en a pas ne les propose pas.
 */
export async function dejaDansLeRapport(fieldReportId: string): Promise<DejaDansLaVisite> {
  const ms = await prisma.promoStockMovement.findMany({ where: { fieldReportId, kind: "DISTRIBUTION" }, select: { itemId: true }, distinct: ["itemId"] });
  return { remis: ms.map((m) => m.itemId), presentes: [] };
}

/** LES ARTICLES À VERROUILLER : ce qu'on remet, et ce que la visite avait déjà remis. */
export function verrousDuRapport(m: MaterielLu, deja: DejaDansLaVisite): string[] {
  return [...new Set([...m.remises.map((r) => r.itemId), ...deja.remis])];
}

/**
 * ÉCRIRE LES REMISES D'UNE VISITE — sous le verrou de chaque article, dans la transaction de la
 * visite. Ce qui a déjà été remis se relit ICI (après l'écriture de la visite, qui sérialise deux
 * envois du même rapport) : seuls les articles dont la quantité CHANGE sont contre-passés puis
 * remis ; un rapport renvoyé à l'identique n'écrit rien. Rend les gestes écrits.
 */
export async function ecrireRemises(tx: Tx, m: MaterielLu, verrouilles: ReadonlyMap<string, unknown>, c: {
  ancre: AncreRemise; doctorId: string | null; detenteurId: string; auteurId: string; maintenant: Date; motif: string;
}): Promise<GesteDeRemise[]> {
  const mouvements = await tx.promoStockMovement.findMany({
    where: { ...c.ancre, kind: { in: ["DISTRIBUTION", "REVERSAL"] } },
    select: { id: true, itemId: true, kind: true, delta: true, annuleId: true },
  });
  const avant = remisNetParArticle(mouvements.map((x) => ({ ...x, delta: Number(x.delta) })));
  const gestes = gestesDeRemise(avant, m.remises).filter((g) => g.geste !== "AUCUN");
  // JAMAIS UNE ÉCRITURE SANS LE VERROU DE SON ARTICLE. La liste verrouillée a été calculée AVANT la
  // transaction ; si un autre envoi du même rapport a remis entre-temps un article qu'elle ne
  // contient pas, le reprendre ici l'écrirait sans verrou. On le DIT au lieu de deviner : l'autre
  // envoi est plus récent que l'écran de cette personne.
  if (gestes.some((g) => !verrouilles.has(g.itemId))) {
    throw new RefusRemise("Ce rapport vient d'être enregistré par ailleurs, avec une autre remise : rechargez l'écran et reprenez la saisie — rien n'est enregistré de cet envoi.");
  }
  for (const g of gestes) {
    if (g.geste === "REPRENDRE" || g.geste === "REMPLACER") {
      await reprendreRemisesDeLaVisite(tx, c.ancre, g.itemId, c.auteurId, "Rapport de visite corrigé");
    }
    if (g.geste === "REMETTRE" || g.geste === "REMPLACER") {
      const r = await remettreAuMedecin(tx, g.itemId, {
        holderId: c.detenteurId, quantite: g.apres, ancre: c.ancre, doctorId: c.doctorId,
        motif: c.motif, auteurId: c.auteurId, maintenant: c.maintenant,
      });
      if (!r.ok) throw new RefusRemise(refusRemise(m.libelles.get(g.itemId) ?? "Article", g.apres, r.refus));
    }
  }
  // LES PRÉSENTATIONS NUMÉRIQUES sont un ensemble par visite : remplacées, jamais cumulées. Un
  // compte rendu sans visite n'en porte pas — l'appelant refuse un support coché (§118.204).
  if ("visitId" in c.ancre) {
    const visitId = c.ancre.visitId;
    await tx.medicalVisitSupportNumerique.deleteMany({ where: { visitId } });
    if (m.numeriques.length) {
      await tx.medicalVisitSupportNumerique.createMany({ data: m.numeriques.map((itemId) => ({ visitId, itemId })), skipDuplicates: true });
    }
  }
  return gestes;
}

/** Le motif écrit sur chaque remise : la date et le médecin, lisibles dans le journal du stock. */
export function motifDeRemise(date: Date, medecin: string | null): string {
  return `Remis lors de la visite du ${date.toLocaleDateString("fr-FR")}${medecin ? ` — ${medecin}` : ""}`;
}

/** Ce que l'audit dit du matériel d'une visite. Vide quand rien n'a été remis ni présenté. */
export function phraseMateriel(m: MaterielLu): string {
  const parts = [
    ...(m.remises.length ? [`remis : ${resumeRemises(m.remises.map((r) => ({ libelle: m.libelles.get(r.itemId) ?? "Article", quantite: r.quantite })))}`] : []),
    ...(m.numeriques.length ? [`présenté en numérique : ${m.numeriques.map((id) => m.libelles.get(id) ?? "Support").join(", ")}`] : []),
  ];
  return parts.length ? ` — ${parts.join(" ; ")}` : "";
}

/** Une visite touche-t-elle le stock (pour revalider l'écran du stock) ? */
export function toucheLeStock(m: MaterielLu, deja: DejaDansLaVisite): boolean {
  return m.remises.length > 0 || deja.remis.length > 0;
}

/**
 * LE FORMULAIRE PORTE-T-IL DU MATÉRIEL ? (une quantité non nulle, ou un support coché). Lu ici,
 * avec les autres champs du bloc, pour que les noms du bloc ne vivent qu'à un endroit.
 */
export function formulairePorteDuMateriel(formData: FormData): { materiel: boolean; numerique: boolean } {
  const numerique = formData.getAll("numeriqueItemId").some((v) => String(v).trim() !== "");
  return { materiel: numerique || formData.getAll("materielQuantite").some((q) => Number(q) > 0), numerique };
}

/**
 * UN COMPTE RENDU QUI PORTE DES REMISES NE SE SUPPRIME PAS (§118.204) — comme une visite rapportée
 * (§118.193d) : ses remises, et leurs corrections, restent au registre du stock, et le compte rendu
 * est ce qui les justifie. Lu par l'action de suppression ET par la corbeille du Super Admin : deux
 * portes, une règle (§118.71). Rend la phrase du refus, ou `null`.
 */
export async function refusSuppressionRapport(fieldReportId: string): Promise<string | null> {
  const n = await prisma.promoStockMovement.count({ where: { fieldReportId } });
  if (n > 0) {
    return "Ce compte rendu porte du matériel remis : ses remises restent au registre du stock, et c'est lui qui les justifie — il ne se supprime pas. Une remise saisie par erreur se corrige dans le compte rendu (« Corriger / renvoyer », quantité à 0).";
  }
  // LA VISITE QU'IL DOCUMENTE (§118.212) : le retirer ne doit pas changer le taux en silence.
  const rapport = await prisma.fieldReport.findUnique({ where: { id: fieldReportId }, select: { visitId: true } });
  if (!rapport?.visitId) return null;
  const visite = await prisma.medicalVisit.findUnique({
    where: { id: rapport.visitId },
    select: { status: true, date: true, report: true, doctor: { select: { name: true } } },
  });
  if (!visite) return null;
  const autres = await prisma.fieldReport.count({ where: { visitId: rapport.visitId, id: { not: fieldReportId } } });
  return refusSuppressionRapportDeVisite({
    statut: visite.status, date: visite.date, rapportEcrit: Boolean(visite.report), autresRapports: autres,
    maintenant: new Date(), praticien: visite.doctor?.name ?? null,
  });
}
