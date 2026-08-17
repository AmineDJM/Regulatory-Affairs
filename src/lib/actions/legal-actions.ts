"use server";

import { revalidatePath } from "next/cache";
import type { EntityType, LegalDocKind, LegalDocStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { companyIdForNew } from "@/lib/company";
import { canRenew, canCancel, validateDates, proposeRenewalDates } from "@/lib/legal/lifecycle";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";

/**
 * LES ENGAGEMENTS DE LA SOCIÉTÉ — écriture.
 *
 * Deux principes tiennent tout ce fichier :
 *   • le FICHIER n'est jamais copié. Rattacher un document du Drive écrit une RÉFÉRENCE
 *     (`driveNodeId`) : il continue de vivre, de se versionner et de se renommer dans le Drive,
 *     et Legal en montre toujours la version courante. Une copie aurait divergé dès la première
 *     correction, et l'on n'aurait plus su laquelle fait foi.
 *   • un renouvellement N'ÉCRASE RIEN. Il crée un nouveau document qui pointe vers l'ancien, et
 *     l'ancien passe en « renouvelé ». L'historique des engagements est justement ce qu'on vient
 *     chercher dans un module Legal.
 */

const KINDS: LegalDocKind[] = ["CONTRACT", "PURCHASE_ORDER", "AGREEMENT", "NDA", "INSURANCE", "LICENSE", "LEASE", "OTHER"];
const parseKind = (v: string | null): LegalDocKind =>
  v && KINDS.includes(v as LegalDocKind) ? (v as LegalDocKind) : "CONTRACT";

/** Champs communs à la création et à la modification. */
function readFields(formData: FormData) {
  return {
    title: fdStr(formData, "title"),
    reference: fdStr(formData, "reference"),
    kind: parseKind(fdStr(formData, "kind")),
    counterparty: fdStr(formData, "counterparty"),
    startDate: fdDate(formData, "startDate"),
    endDate: fdDate(formData, "endDate"),
    notes: fdStr(formData, "notes"),
    amount: fdStr(formData, "amount") ? Number(fdStr(formData, "amount")) : null,
  };
}

export async function createLegalDocument(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "LEGAL", "CREATE")) return { ok: false, error: "Non autorisé." };

  const { title, ...f } = readFields(formData);
  if (!title) return { ok: false, error: "Le titre exact du document est obligatoire." };
  const dates = validateDates(f.startDate, f.endDate);
  if (!dates.ok) return { ok: false, error: dates.error };

  const companyId = await companyIdForNew(user.id);
  const created = await prisma.legalDocument.create({
    data: {
      ...f, title,
      companyId,
      // Le fichier du Drive est RÉFÉRENCÉ, jamais recopié.
      driveNodeId: fdStr(formData, "driveNodeId"),
      sourceType: (fdStr(formData, "sourceType") as EntityType | null) ?? null,
      sourceId: fdStr(formData, "sourceId"),
      createdById: user.id,
      updatedById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Legal",
    entityType: "LEGAL_DOCUMENT", entityId: created.id,
    summary: `Document légal « ${title} »`,
  });
  revalidatePath("/legal");
  return { ok: true, id: created.id };
}

export async function updateLegalDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "LEGAL", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Document introuvable." };

  const { title, ...f } = readFields(formData);
  if (!title) return { ok: false, error: "Le titre exact du document est obligatoire." };
  const dates = validateDates(f.startDate, f.endDate);
  if (!dates.ok) return { ok: false, error: dates.error };

  await prisma.legalDocument.update({
    where: { id },
    data: {
      ...f, title,
      // Changer les dates rouvre la surveillance : on efface le dernier rappel pour que la
      // nouvelle échéance soit annoncée à son tour.
      lastRemindedAt: null,
      updatedById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Legal",
    entityType: "LEGAL_DOCUMENT", entityId: id,
    summary: `Document légal « ${title} » mis à jour`,
  });
  revalidatePath("/legal");
  revalidatePath(`/legal/${id}`);
  return { ok: true };
}

/**
 * MODIFIER depuis la FICHE du document.
 *
 * Même règle métier que `updateLegalDocument`, mais l'identifiant est LIÉ côté serveur
 * (`editLegalDocument.bind(null, id)`) au lieu d'être posé dans un champ caché : un champ caché se
 * réécrit dans le navigateur, et l'on modifierait alors l'engagement de quelqu'un d'autre.
 */
export async function editLegalDocument(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const fd = new FormData();
  for (const [k, v] of formData.entries()) fd.append(k, v);
  fd.set("id", id);
  return updateLegalDocument(fd);
}

/**
 * RATTACHER UN DOCUMENT DU DRIVE À LEGAL — sans copie.
 *
 * C'est le geste attendu : on a déjà le contrat dans le Drive, on veut juste le déclarer comme
 * engagement et lui donner ses dates. Le fichier ne bouge pas, ne se duplique pas ; Legal pointe
 * dessus. Supprimer la fiche Legal ne supprime donc jamais le fichier.
 */
export async function attachDriveNodeToLegal(input: {
  driveNodeId: string; title?: string; kind?: string; counterparty?: string;
  startDate?: string; endDate?: string; reference?: string; notes?: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "LEGAL", "CREATE")) return { ok: false, error: "Non autorisé à alimenter Legal." };

  const node = await prisma.driveNode.findUnique({
    where: { id: input.driveNodeId },
    select: { id: true, name: true, type: true, isTrashed: true },
  });
  if (!node || node.isTrashed) return { ok: false, error: "Fichier introuvable dans le Drive." };
  if (node.type !== "FILE") return { ok: false, error: "Seul un fichier peut devenir un document légal." };

  // Déjà rattaché : on ne crée pas une deuxième fiche pour le même fichier — c'est exactement le
  // doublon qu'on cherche à éviter.
  const already = await prisma.legalDocument.findFirst({
    where: { driveNodeId: node.id }, select: { id: true },
  });
  if (already) return { ok: false, error: "Ce fichier figure déjà dans Legal.", id: already.id };

  const start = input.startDate ? new Date(input.startDate) : null;
  const end = input.endDate ? new Date(input.endDate) : null;
  const dates = validateDates(start, end);
  if (!dates.ok) return { ok: false, error: dates.error };

  const companyId = await companyIdForNew(user.id);
  const created = await prisma.legalDocument.create({
    data: {
      // Le nom du fichier fait un titre par défaut acceptable ; on laisse le corriger.
      title: (input.title ?? "").trim() || node.name,
      reference: input.reference?.trim() || null,
      kind: parseKind(input.kind ?? null),
      counterparty: input.counterparty?.trim() || null,
      startDate: start, endDate: end,
      notes: input.notes?.trim() || null,
      driveNodeId: node.id,
      companyId, createdById: user.id, updatedById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Legal",
    entityType: "LEGAL_DOCUMENT", entityId: created.id,
    summary: `Document du Drive rattaché à Legal — « ${node.name} » (le fichier reste dans le Drive)`,
  });
  revalidatePath("/legal");
  revalidatePath("/drive");
  return { ok: true, id: created.id };
}

/**
 * RENOUVELER — un nouveau document qui prend la suite, l'ancien passe en « renouvelé ».
 *
 * Les dates proposées viennent du module pur : lendemain du terme, même durée. On les laisse
 * corrigeables — une reconduction change souvent de durée.
 */
export async function renewLegalDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "LEGAL", "CREATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Document introuvable." };

  const previous = await prisma.legalDocument.findUnique({ where: { id } });
  if (!previous) return { ok: false, error: "Document introuvable." };
  if (!canRenew(previous.status)) {
    return { ok: false, error: "Ce document ne peut plus être renouvelé (déjà renouvelé ou annulé)." };
  }

  const proposed = proposeRenewalDates({ startDate: previous.startDate, endDate: previous.endDate });
  const startDate = fdDate(formData, "startDate") ?? proposed.startDate;
  const endDate = fdDate(formData, "endDate") ?? proposed.endDate;
  const dates = validateDates(startDate, endDate);
  if (!dates.ok) return { ok: false, error: dates.error };

  const created = await prisma.$transaction(async (tx) => {
    const next = await tx.legalDocument.create({
      data: {
        title: fdStr(formData, "title") ?? previous.title,
        reference: fdStr(formData, "reference") ?? previous.reference,
        kind: previous.kind,
        counterparty: previous.counterparty,
        startDate, endDate,
        amount: previous.amount,
        notes: fdStr(formData, "notes"),
        // Le renouvellement pointe vers le même fichier tant qu'on n'en a pas déposé un autre.
        driveNodeId: fdStr(formData, "driveNodeId") ?? previous.driveNodeId,
        sourceType: previous.sourceType, sourceId: previous.sourceId,
        companyId: previous.companyId,
        renewedFromId: previous.id,
        createdById: user.id, updatedById: user.id,
      },
      select: { id: true },
    });
    // L'ancien SORT DU JEU sans disparaître : plus de rappel, mais il reste consultable.
    await tx.legalDocument.update({
      where: { id: previous.id },
      data: { status: "RENEWED", updatedById: user.id },
    });
    return next;
  });

  // Le renouvellement s'inscrit AU JOURNAL DES DEUX : sur l'ancien, parce que c'est là qu'on
  // cherchera ce qu'il est devenu ; sur le nouveau, parce que c'est là qu'on cherchera d'où il vient.
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Legal",
    entityType: "LEGAL_DOCUMENT", entityId: previous.id,
    summary: `Renouvelé — la suite est « ${fdStr(formData, "title") ?? previous.title} »`,
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Legal",
    entityType: "LEGAL_DOCUMENT", entityId: created.id,
    summary: `Renouvellement de « ${previous.title} »`,
  });
  revalidatePath("/legal");
  revalidatePath(`/legal/${id}`);
  return { ok: true, id: created.id };
}

/** ANNULER avant terme — le document reste, avec son motif ; il ne rappelle plus. */
export async function cancelLegalDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "LEGAL", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Document introuvable." };

  const doc = await prisma.legalDocument.findUnique({ where: { id }, select: { title: true, status: true } });
  if (!doc) return { ok: false, error: "Document introuvable." };
  if (!canCancel(doc.status)) return { ok: false, error: "Ce document ne peut plus être annulé." };

  await prisma.legalDocument.update({
    where: { id },
    data: {
      status: "CANCELLED" satisfies LegalDocStatus,
      cancelledAt: new Date(),
      cancelReason: fdStr(formData, "reason"),
      updatedById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Legal",
    entityType: "LEGAL_DOCUMENT", entityId: id,
    field: "status", oldValue: doc.status, newValue: "CANCELLED",
    summary: `Annulation de « ${doc.title} »`,
  });
  revalidatePath("/legal");
  revalidatePath(`/legal/${id}`);
  return { ok: true };
}

/** Supprimer la FICHE — jamais le fichier du Drive, qui ne nous appartient pas. */
export async function deleteLegalDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "LEGAL", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Document introuvable." };
  const doc = await prisma.legalDocument.findUnique({ where: { id }, select: { title: true } });
  if (!doc) return { ok: false, error: "Document introuvable." };

  await prisma.legalDocument.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Legal",
    entityType: "LEGAL_DOCUMENT", entityId: id,
    summary: `Fiche légale « ${doc.title} » supprimée (le fichier reste dans le Drive)`,
  });
  revalidatePath("/legal");
  return { ok: true };
}
