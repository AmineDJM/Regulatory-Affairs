"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, type Module, type Action } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { deleteFileByKey } from "@/lib/storage";
import { releaseBlob } from "@/lib/drive-storage";
import {
  DELETE_REGISTRY,
  apercuSuppression,
  deleteDelegateOf,
  isDeletableKind,
  type ApercuSuppression,
  type DeletableKind,
} from "@/lib/admin-delete-registry";
import { restaurerLotDeLaCorbeille, supprimerReversible, type DeleteResult } from "@/lib/suppression/coeur";

export type { DeleteResult } from "@/lib/suppression/coeur";


/**
 * Ce que le CRÉATEUR d'un objet peut supprimer lui-même — pas seulement le Super Admin.
 *
 * Un courrier saisi par erreur, un document légal en double : la personne qui l'a créé doit
 * pouvoir le retirer sans passer par l'administrateur. La suppression reste RÉVERSIBLE (elle
 * dépose l'instantané dans la même corbeille) : ce n'est donc pas un pouvoir de destruction, c'est
 * un pouvoir de rangement, que le Super Admin peut toujours défaire.
 */
const CREATOR_DELETABLE = new Set<DeletableKind>(["MAIL_ENTRY", "LEGAL_DOCUMENT"]);

/**
 * Le droit MODULE qui, à défaut d'être le créateur, autorise aussi la suppression réversible.
 *
 * Une assistante qui gère le registre du courrier doit pouvoir retirer un pli qu'un collègue a
 * saisi de travers, sans en être l'auteur — c'est son métier. On honore donc le droit `DELETE` du
 * module, en plus du créateur, sans pour autant confier ce pouvoir à tout le monde.
 */
const CREATOR_DELETE_PERMISSION: Partial<Record<DeletableKind, [Module, Action]>> = {
  MAIL_ENTRY: ["MAIL_REGISTER", "DELETE"],
  LEGAL_DOCUMENT: ["LEGAL", "DELETE"],
};


/**
 * LE CŒUR de la suppression réversible vit dans `lib/suppression/coeur.ts` (§118.162) : ce fichier
 * est `"use server"`, donc tout ce qu'il exporte est un point d'entrée public — une fonction qui
 * prend un type et un identifiant sans vérifier qui appelle n'a rien à y faire. Les actions
 * ci-dessous vérifient le DROIT, puis délèguent.
 */
/**
 * Suppression « définitive » d'un enregistrement par le Super Admin (et lui seul).
 * RÉVERSIBLE : voir `snapshotAndSoftDelete`.
 */
export async function superAdminDelete(formData: FormData): Promise<DeleteResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Réservé au Super Admin." };
  }

  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id || !isDeletableKind(kind)) return { ok: false, error: "Élément invalide." };

  const name = await DELETE_REGISTRY[kind].describe(id);
  return supprimerReversible(kind, id, user.id, `Suppression définitive (Super Admin) — ${DELETE_REGISTRY[kind].label} « ${name ?? id} » (restaurable depuis la corbeille)`);
}

/**
 * Suppression par LE CRÉATEUR de son propre objet (courrier, document légal).
 *
 * Le serveur revérifie tout : le type doit être dans `CREATOR_DELETABLE`, et l'appelant doit en
 * être le créateur — ou le Super Admin, qui peut toujours. La suppression reste réversible (même
 * corbeille) : un administrateur peut la défaire. On ne délègue donc pas un pouvoir de destruction,
 * seulement de rangement.
 */
export async function deleteOwnRecord(formData: FormData): Promise<DeleteResult> {
  const user = await requireUser();
  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id || !isDeletableKind(kind)) return { ok: false, error: "Élément invalide." };
  if (!CREATOR_DELETABLE.has(kind)) return { ok: false, error: "Ce type d'élément ne peut pas être supprimé ainsi." };

  const spec = DELETE_REGISTRY[kind];
  const creatorId = spec.creatorOf ? await spec.creatorOf(id) : null;
  const isCreator = creatorId !== null && creatorId === user.id;
  const perm = CREATOR_DELETE_PERMISSION[kind];
  const hasModuleDelete = perm ? userCan(user, perm[0], perm[1]) : false;
  if (!isCreator && !hasModuleDelete && user.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Seul le créateur (ou un administrateur) peut supprimer cet élément." };
  }

  const name = await spec.describe(id);
  return supprimerReversible(kind, id, user.id, `Suppression par ${isCreator ? "le créateur" : "un administrateur"} — ${spec.label} « ${name ?? id} » (restaurable depuis la corbeille)`);
}

/**
 * Restaure un élément de la corbeille des suppressions définitives : la ligne
 * principale est recréée à l'identique (mêmes id/référence), ainsi que ses pièces
 * jointes et commentaires. Les enfants perdus en cascade ne reviennent pas.
 */
export async function restoreDeletedRecord(formData: FormData): Promise<DeleteResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const recId = String(formData.get("id") ?? "");
  const rec = await prisma.deletedRecord.findUnique({ where: { id: recId } });
  if (!rec || rec.restoredAt || rec.purgedAt) return { ok: false, error: "Entrée introuvable ou déjà traitée." };
  if (!isDeletableKind(rec.kind)) return { ok: false, error: "Type inconnu." };
  const spec = DELETE_REGISTRY[rec.kind];

  // UN LOT (§118.162) : la demande ET ses branches reviennent ensemble, ou rien ne revient.
  const lot = await restaurerLotDeLaCorbeille(rec, rec.kind);
  if (lot) {
    if (!lot.ok) return lot;
    await prisma.deletedRecord.update({ where: { id: recId }, data: { restoredAt: new Date() } });
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: spec.module, entityType: spec.entityType, entityId: rec.sourceId,
      summary: `Restauration depuis la corbeille — ${spec.label} « ${rec.name} », avec ses éléments liés`,
    });
    revalidatePath("/admin/corbeille");
    revalidatePath(spec.redirect);
    return { ok: true, redirect: spec.redirect };
  }

  const exists = await deleteDelegateOf(spec).findUnique({ where: { id: rec.sourceId } });
  if (exists) return { ok: false, error: "Un enregistrement avec cet identifiant existe déjà (déjà restauré ?)." };

  try {
    await deleteDelegateOf(spec).create({ data: rec.payload as Record<string, unknown> });
    // Ce que la suppression avait compensé ailleurs (un solde de congés rendu, par exemple)
    // se reprend ici : sans ce geste, restaurer donnerait à la fois l'objet et sa compensation.
    await spec.restored?.(rec.sourceId);
    const docs = (rec.documents as Record<string, unknown>[] | null) ?? [];
    if (docs.length) await prisma.document.createMany({ data: docs as never[], skipDuplicates: true });
    const comments = (rec.comments as Record<string, unknown>[] | null) ?? [];
    if (comments.length) await prisma.comment.createMany({ data: comments as never[], skipDuplicates: true });
  } catch (err) {
    console.error("[restoreDeletedRecord] échec restauration", rec.kind, rec.sourceId, err);
    return { ok: false, error: "Restauration impossible (élément lié manquant, ex. employé ou dossier parent supprimé)." };
  }

  await prisma.deletedRecord.update({ where: { id: recId }, data: { restoredAt: new Date() } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: spec.module, entityType: spec.entityType, entityId: rec.sourceId,
    summary: `Restauration depuis la corbeille — ${spec.label} « ${rec.name} »`,
  });
  revalidatePath("/admin/corbeille");
  revalidatePath(spec.redirect);
  return { ok: true, redirect: spec.redirect };
}

/** Destruction RÉELLE d'une entrée de la corbeille : efface aussi les fichiers stockés. */
export async function destroyDeletedRecord(formData: FormData): Promise<DeleteResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const recId = String(formData.get("id") ?? "");
  const rec = await prisma.deletedRecord.findUnique({ where: { id: recId } });
  if (!rec || rec.purgedAt) return { ok: false, error: "Entrée introuvable ou déjà détruite." };

  // Fichiers des pièces jointes snapshotées (s'il n'a pas été restauré).
  if (!rec.restoredAt) {
    const docs = (rec.documents as { fileKey?: string | null }[] | null) ?? [];
    for (const d of docs) {
      if (d.fileKey) await deleteFileByKey(d.fileKey).catch(() => {});
    }
    // Cas particulier : audio d'un rapport terrain (blob chiffré du Drive).
    const audioBlobId = (rec.payload as { audioBlobId?: string | null } | null)?.audioBlobId;
    if (rec.kind === "FIELD_REPORT" && audioBlobId) await releaseBlob(audioBlobId).catch(() => {});
  }

  await prisma.deletedRecord.update({ where: { id: recId }, data: { purgedAt: new Date() } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Administration",
    summary: `Corbeille — destruction définitive : ${rec.label} « ${rec.name} »`,
  });
  revalidatePath("/admin/corbeille");
  return { ok: true };
}

/**
 * CE QUE LA SUPPRESSION EMPORTERA — lu par la fenêtre de confirmation AVANT le clic (§118.53).
 *
 * Même porte que la suppression elle-même : le Super Admin, ou — pour les types qu'un MODULE
 * laisse supprimer depuis son écran — qui détient ce droit ET voit la ligne. Un aperçu ouvert à
 * tout le monde dirait à n'importe qui ce qui dépend d'une demande qu'il ne voit pas.
 */
/**
 * La porte de l'aperçu est EXACTEMENT celle de l'action qui supprime — ni plus large (on dirait à
 * quelqu'un ce qui dépend d'une ligne qu'il ne peut pas toucher), ni plus étroite (le bouton ne
 * s'armerait pas devant une suppression que l'action accepte).
 */
const SUPPRIME_PAR_SON_MODULE: Partial<Record<DeletableKind, { module: Module; action: Action; ligne: boolean }>> = {
  // `deleteEvent` (§118.162) : le droit « supprimer » du module Événements, et lui seul.
  EVENT: { module: "EVENTS", action: "DELETE", ligne: false },
  // `deleteBdProject` (§118.163) : le droit du module Projets ET la ligne dans sa portée.
  BD_PROJECT: { module: "BD_PROJECTS", action: "DELETE", ligne: true },
};

/**
 * Le prédicat est NOMMÉ : écrit en ligne avec un module lu dans une table, la carte de
 * confirmation l'aurait décrit « gardé par rien » (§118.150g) — la dérivation ne reconnaît une
 * garde qu'à son nom ou à un module littéral.
 */
async function peutSupprimerDepuisSonModule(user: Awaited<ReturnType<typeof requireUser>>, kind: DeletableKind, id: string): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true;
  const droit = SUPPRIME_PAR_SON_MODULE[kind];
  if (!droit || !userCan(user, droit.module, droit.action)) return false;
  const entite = DELETE_REGISTRY[kind].entityType;
  return !droit.ligne || !entite || canAccessEntity(user, entite, id, droit.action);
}

export async function apercuDeSuppression(formData: FormData): Promise<ApercuSuppression | { erreur: string }> {
  const user = await requireUser();
  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id || !isDeletableKind(kind)) return { erreur: "Élément invalide." };
  if (!(await peutSupprimerDepuisSonModule(user, kind, id))) return { erreur: "Réservé à qui peut supprimer cet élément." };
  return apercuSuppression(kind, id);
}
