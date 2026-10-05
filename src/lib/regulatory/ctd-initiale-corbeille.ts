import type { DeletedRecord, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { canAccessEntity } from "@/lib/entity-access";
import type { SessionUser } from "@/lib/rbac";
import {
  CTD_INITIALE_CATEGORIE, CTD_INITIALE_ENTITE, CTD_INITIALE_ETAPE, CTD_INITIALE_LIBELLE, KIND_CORBEILLE_CTD,
  cheminSur, cheminRenomme, dossierApresRenommage, dossiersDeLaCtd, refusRenommageDossier, type MotifRetraitCtd,
} from "./ctd-initiale";

/**
 * LA CTD INITIALE, CÔTÉ SERVEUR — le retrait réversible, la restauration, le renommage d'un dossier.
 *
 * Ce module n'est PAS un fichier d'actions (§118.153) : il reçoit l'identité de l'acteur en argument, et
 * un fichier « use server » en ferait un point d'entrée public. Il n'est appelé que par les actions de
 * `regulatory-ctd-actions.ts` (qui ont vérifié le droit) et par la restauration de la corbeille (Super Admin).
 *
 * ── LE RETRAIT EST UN LOT, ET IL EST RÉVERSIBLE ─────────────────────────────────────────────
 *
 * Supprimer la CTD, ou la remplacer, retire d'UN bloc tous ses documents : leurs lignes partent à la
 * corbeille (`DeletedRecord`, type `REGULATORY_CTD`), leurs FICHIERS restent dans le stockage — ils ne
 * sont effacés qu'à la destruction réelle de l'entrée, qui est un geste du Super Admin. Une ligne retirée
 * à la fois par `deleteDocument` laisserait, au premier échec en route, une CTD à moitié effacée.
 * Tout ou rien : la suppression des lignes est conditionnelle sur ce qui a été LU (deux retraits
 * simultanés ne partagent pas la CTD — le second ne trouve plus rien et le dit).
 */

/**
 * CE QU'UNE PERSONNE PEUT FAIRE DE LA CTD — UNE lecture, pour l'écran ET pour les actions.
 *
 * LA PORTE EST CELLE DU DÉPÔT DE DOCUMENTS DU DOSSIER, ET ELLE N'EST JAMAIS PLUS LARGE : `deposer` = le droit
 * de téléverser sur CE dossier (`canAccessEntity` UPLOAD — donc la portée de ligne, la gamme et le verrou
 * confidentiel) ; `gerer` = ce droit ET celui de modifier le dossier ou d'y supprimer (le même que
 * `deleteDocument`). Retirer un ensemble complet est plus lourd que d'y ajouter un fichier : qui peut
 * seulement déposer ajoute, il ne retire pas. L'écran lit ces deux faits, il ne les recalcule pas — un
 * bouton offert à qui l'action refusera fait chercher une panne qui n'existe pas.
 */
export async function droitsSurLaCtd(user: SessionUser, productId: string): Promise<{ deposer: boolean; gerer: boolean }> {
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPLOAD"))) return { deposer: false, gerer: false };
  const gerer = (await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPDATE")) || (await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "DELETE"));
  return { deposer: true, gerer };
}

/** Le prédicat des actions — NOMMÉ : la dérivation des contrats ne reconnaît une garde qu'à son nom (§118.150g). */
export async function peutGererLaCtd(user: SessionUser, productId: string): Promise<boolean> {
  return (await droitsSurLaCtd(user, productId)).gerer;
}

/** Les documents de la CTD initiale d'un dossier, dans l'ordre de dépôt. */
export const cibleCtd = (productId: string) => ({
  entityType: CTD_INITIALE_ENTITE as "REGULATORY_PRODUCT", entityId: productId, stepKey: CTD_INITIALE_ETAPE, category: CTD_INITIALE_CATEGORIE as "CTD_FULL",
});

export async function documentsDeLaCtd(productId: string) {
  return prisma.document.findMany({ where: cibleCtd(productId), orderBy: [{ folder: "asc" }, { name: "asc" }, { version: "asc" }] });
}

export type ResultatRetraitCtd = { ok: true; fichiers: number; octets: number; entree: string } | { ok: false; error: string };

export const PHRASE_AUCUNE_CTD = `Ce dossier n'a pas de ${CTD_INITIALE_LIBELLE} à retirer.`;

/**
 * MET LA CTD À LA CORBEILLE. L'appelant a vérifié le DROIT ; ce module écrit l'entrée, retire les lignes,
 * dit ce qu'il a réellement retiré — le nombre, lu au moment de retirer, pas celui que l'écran montrait.
 */
export async function mettreLaCtdALaCorbeille(
  productId: string, actorId: string, motif: MotifRetraitCtd,
): Promise<ResultatRetraitCtd> {
  const produit = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { reference: true, dci: true } });
  if (!produit) return { ok: false, error: "Dossier introuvable." };

  let entree = "";
  let fichiers = 0;
  let octets = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const docs = await tx.document.findMany({ where: cibleCtd(productId) });
      if (docs.length === 0) throw new Error("AUCUNE");
      octets = docs.reduce((s, d) => s + (d.sizeBytes ?? 0), 0);
      fichiers = docs.length;
      // L'ÉCRITURE EST CONDITIONNELLE sur ce qui a été lu : un retrait simultané a déjà emporté une partie
      // des lignes — le compte ne tombe plus juste, et rien ne part (la transaction est rejetée).
      const retire = await tx.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
      if (retire.count !== docs.length) throw new Error("CONCURRENT");
      const rec = await tx.deletedRecord.create({
        data: {
          kind: KIND_CORBEILLE_CTD,
          label: CTD_INITIALE_LIBELLE,
          name: `${produit.reference} — ${CTD_INITIALE_LIBELLE} (${docs.length} fichier${docs.length > 1 ? "s" : ""}${motif === "REMPLACEE" ? ", remplacée" : ""})`,
          sourceId: productId,
          payload: { productId, motif, fichiers: docs.length, octets } as Prisma.InputJsonValue,
          documents: JSON.parse(JSON.stringify(docs)) as Prisma.InputJsonValue,
          deletedById: actorId,
        },
        select: { id: true },
      });
      entree = rec.id;
    }, { timeout: 60_000 });
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (m === "AUCUNE") return { ok: false, error: PHRASE_AUCUNE_CTD };
    if (m === "CONCURRENT") return { ok: false, error: `La ${CTD_INITIALE_LIBELLE} vient d'être modifiée par quelqu'un d'autre — rechargez la fiche : rien n'a été retiré.` };
    console.error("[ctd initiale] retrait impossible", e);
    return { ok: false, error: `Retrait impossible : rien n'a été retiré (${m || "erreur"}).` };
  }

  await recordAudit({
    actorId, action: "DELETE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: productId,
    summary: motif === "REMPLACEE"
      ? `${CTD_INITIALE_LIBELLE} remplacée — ${fichiers} fichier(s) précédent(s) à la corbeille (restaurables par le Super Admin)`
      : `${CTD_INITIALE_LIBELLE} supprimée — ${fichiers} fichier(s) à la corbeille (restaurables par le Super Admin)`,
  });
  return { ok: true, fichiers, octets, entree };
}

/**
 * RESTAURE une CTD de la corbeille (Super Admin, via l'écran de la corbeille). Les fichiers n'ont pas
 * bougé : on ne recrée que les lignes, avec les mêmes identifiants. Refuse quand une CTD vit déjà sur le
 * dossier — deux ensembles se fondraient en un, et « une seule CTD initiale vivante » ne tiendrait plus.
 */
export async function restaurerLaCtdDeLaCorbeille(rec: DeletedRecord, actorId: string): Promise<{ ok: boolean; error?: string; redirect?: string }> {
  const produit = await prisma.regulatoryProduct.findUnique({ where: { id: rec.sourceId }, select: { id: true } });
  if (!produit) return { ok: false, error: "Le dossier de cette CTD n'existe plus : rien à restaurer." };
  const docs = (rec.documents as Record<string, unknown>[] | null) ?? [];
  if (docs.length === 0) return { ok: false, error: "Cette entrée ne porte aucun fichier." };
  try {
    await prisma.$transaction(async (tx) => {
      if ((await tx.document.count({ where: cibleCtd(rec.sourceId) })) > 0) throw new Error("EXISTE");
      await tx.document.createMany({ data: docs as never[] });
    }, { timeout: 60_000 });
  } catch (e) {
    if (e instanceof Error && e.message === "EXISTE") {
      return { ok: false, error: `Une ${CTD_INITIALE_LIBELLE} vit déjà sur ce dossier : retirez-la d'abord (elle ira à la corbeille), puis restaurez celle-ci.` };
    }
    console.error("[ctd initiale] restauration impossible", e);
    return { ok: false, error: "Restauration impossible — rien n'a été recréé (un fichier de cette CTD a déjà été restauré ailleurs, ou le dossier a changé)." };
  }
  await prisma.deletedRecord.update({ where: { id: rec.id }, data: { restoredAt: new Date() } });
  await recordAudit({
    actorId, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: rec.sourceId,
    summary: `Restauration depuis la corbeille — ${rec.label} « ${rec.name} »`,
  });
  return { ok: true, redirect: `/regulatory/${rec.sourceId}` };
}

export type ResultatRenommageDossier = { ok: true; fichiers: number; nouveau: string } | { ok: false; error: string };

/**
 * RENOMME UN DOSSIER de la CTD : tous les documents du dossier et de ses descendants suivent. Seules
 * les lignes de la CTD sont touchées (jamais une pièce d'une autre étape qui porterait le même chemin).
 */
export async function renommerUnDossierDeLaCtd(productId: string, ancienBrut: string, nouveauNom: string, actorId: string): Promise<ResultatRenommageDossier> {
  const ancien = cheminSur(ancienBrut);
  if (!ancien) return { ok: false, error: "Dossier à renommer introuvable." };
  const docs = await prisma.document.findMany({ where: cibleCtd(productId), select: { id: true, folder: true } });
  if (!dossiersDeLaCtd(docs).includes(ancien)) return { ok: false, error: `Le dossier « ${ancien} » n'existe pas dans la ${CTD_INITIALE_LIBELLE}.` };
  const refus = refusRenommageDossier(ancien, nouveauNom, dossiersDeLaCtd(docs));
  if (refus) return { ok: false, error: refus };
  const nouveau = cheminRenomme(ancien, nouveauNom.trim());
  if (nouveau === ancien) return { ok: true, fichiers: 0, nouveau };

  // Un UPDATE par chemin distinct, jamais un par fichier : trois cents fichiers dans quinze dossiers = quinze écritures.
  const parChemin = new Map<string, string[]>();
  for (const d of docs) {
    const apres = dossierApresRenommage(d.folder, ancien, nouveau);
    if (apres === cheminSur(d.folder)) continue;
    const cle = d.folder ?? "";
    parChemin.set(cle, [...(parChemin.get(cle) ?? []), d.id]);
  }
  let fichiers = 0;
  await prisma.$transaction(async (tx) => {
    for (const [dossier, idsDuChemin] of parChemin) {
      const apres = dossierApresRenommage(dossier, ancien, nouveau);
      // L'écriture suit ce qui a été lu : un fichier déplacé entre-temps ne change pas de dossier.
      const r = await tx.document.updateMany({ where: { id: { in: idsDuChemin }, folder: dossier, ...cibleCtd(productId) }, data: { folder: apres } });
      fichiers += r.count;
    }
  }, { timeout: 60_000 });

  await recordAudit({
    actorId, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: productId,
    field: "folder", oldValue: ancien, newValue: nouveau,
    summary: `${CTD_INITIALE_LIBELLE} : dossier « ${ancien} » renommé « ${nouveau} » (${fichiers} fichier(s))`,
  });
  return { ok: true, fichiers, nouveau };
}
