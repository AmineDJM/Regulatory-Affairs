"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, type Module, type Action } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { deleteFileByKey } from "@/lib/storage";
import { releaseBlob } from "@/lib/drive-storage";
import {
  DELETE_REGISTRY,
  deleteDelegateOf,
  isDeletableKind,
  type DeletableKind,
} from "@/lib/admin-delete-registry";

export interface DeleteResult {
  ok: boolean;
  error?: string;
  redirect?: string;
}


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
 * LE CŒUR de la suppression réversible — partagé par le Super Admin et le créateur.
 *
 * Instantané complet (ligne principale + pièces jointes + commentaires) déposé dans la corbeille
 * (Administration → Corbeille), puis suppression. Restaurable — ou détruit pour de bon (là
 * seulement, les fichiers sont effacés). Les enfants supprimés en cascade ne sont pas restaurables.
 * `summary` distingue, dans le journal, une suppression par l'administrateur d'une suppression par
 * le créateur.
 */
async function snapshotAndSoftDelete(kind: DeletableKind, id: string, actorId: string, summary: string): Promise<DeleteResult> {
  const spec = DELETE_REGISTRY[kind];
  const name = await spec.describe(id);
  if (name === null) return { ok: false, error: "Élément introuvable (déjà supprimé ?)." };

  // 0) Instantané de la ligne principale (tous les champs scalaires/Json).
  const payload = await deleteDelegateOf(spec).findUnique({ where: { id } });
  if (!payload) return { ok: false, error: "Élément introuvable (déjà supprimé ?)." };

  // 1) Instantané puis retrait des Documents/Commentaires polymorphes. Les FICHIERS
  //    restent dans le stockage : ils ne sont effacés qu'à la destruction réelle.
  let docsSnapshot: Record<string, unknown>[] = [];
  let commentsSnapshot: Record<string, unknown>[] = [];
  if (spec.entityType) {
    docsSnapshot = (await prisma.document.findMany({ where: { entityType: spec.entityType, entityId: id } })) as unknown as Record<string, unknown>[];
    commentsSnapshot = (await prisma.comment.findMany({ where: { entityType: spec.entityType, entityId: id } })) as unknown as Record<string, unknown>[];
    await prisma.document.deleteMany({ where: { entityType: spec.entityType, entityId: id } });
    await prisma.comment.deleteMany({ where: { entityType: spec.entityType, entityId: id } });
  }

  // 2) Suppression de la ligne principale (les enfants en cascade suivent).
  try {
    await spec.remove(id);
  } catch (err) {
    console.error("[softDelete] échec suppression", kind, id, err);
    // Remet les documents/commentaires retirés à l'étape 1 (la ligne principale existe encore).
    if (spec.entityType) {
      if (docsSnapshot.length) await prisma.document.createMany({ data: docsSnapshot as never[] }).catch(() => {});
      if (commentsSnapshot.length) await prisma.comment.createMany({ data: commentsSnapshot as never[] }).catch(() => {});
    }
    return { ok: false, error: "Suppression impossible (des éléments liés bloquent). Détachez-les puis réessayez." };
  }

  // 3) Dépôt dans la corbeille (restaurable par le Super Admin).
  await prisma.deletedRecord.create({
    data: {
      kind, label: spec.label, name, sourceId: id,
      payload: payload as Prisma.InputJsonValue,
      documents: docsSnapshot.length ? (docsSnapshot as Prisma.InputJsonValue) : undefined,
      comments: commentsSnapshot.length ? (commentsSnapshot as Prisma.InputJsonValue) : undefined,
      deletedById: actorId,
    },
  });

  await recordAudit({
    actorId, action: "DELETE", module: spec.module, entityType: spec.entityType, entityId: id, summary,
  });

  revalidatePath(spec.redirect);
  return { ok: true, redirect: spec.redirect };
}

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
  return snapshotAndSoftDelete(kind, id, user.id, `Suppression définitive (Super Admin) — ${DELETE_REGISTRY[kind].label} « ${name ?? id} » (restaurable depuis la corbeille)`);
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
  return snapshotAndSoftDelete(kind, id, user.id, `Suppression par ${isCreator ? "le créateur" : "un administrateur"} — ${spec.label} « ${name ?? id} » (restaurable depuis la corbeille)`);
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

  const exists = await deleteDelegateOf(spec).findUnique({ where: { id: rec.sourceId } });
  if (exists) return { ok: false, error: "Un enregistrement avec cet identifiant existe déjà (déjà restauré ?)." };

  try {
    await deleteDelegateOf(spec).create({ data: rec.payload as Record<string, unknown> });
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
