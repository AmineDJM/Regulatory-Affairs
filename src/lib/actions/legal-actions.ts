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
import { attachFormFiles } from "@/lib/documents";
import { createExpenseOrder } from "@/lib/expense-orders";
import { normalizeReaderIds } from "@/lib/legal/readers";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";

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

const KINDS: LegalDocKind[] = ["CONTRACT", "QUOTE", "PURCHASE_ORDER", "INVOICE", "AGREEMENT", "NDA", "INSURANCE", "LICENSE", "LEASE", "OTHER"];
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
    // DOSSIER DE CLASSEMENT. Vide = « non classé », et c'est un état normal : un engagement se
    // dépose vite, il se range ensuite. Le dossier ne change RIEN à qui peut le lire.
    folderId: fdStr(formData, "folderId"),
    // LA CHAÎNE : la pièce dont CELLE-CI découle (le BC de son devis, la facture de son BC).
    // Vide = pièce isolée — un bail ne suit rien.
    chainFromId: fdStr(formData, "chainFromId"),
  };
}

/** Le maillon amont existe-t-il ? Un identifiant de formulaire ne se croit pas sur parole. */
async function checkChainFrom(chainFromId: string | null, selfId?: string): Promise<string | null> {
  if (!chainFromId) return null;
  if (selfId && chainFromId === selfId) return "Une pièce ne peut pas se suivre elle-même.";
  const prev = await prisma.legalDocument.findUnique({ where: { id: chainFromId }, select: { id: true } });
  return prev ? null : "La pièce amont (devis / bon de commande) n'existe plus.";
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
  const chainErr = await checkChainFrom(f.chainFromId);
  if (chainErr) return { ok: false, error: chainErr };

  // LE NŒUD DU DRIVE EST VÉRIFIÉ AVANT D'ÊTRE ÉCRIT. L'identifiant vient d'un champ de
  // formulaire : sans contrôle, on référencerait un fichier corbeillé, inexistant, ou qu'on n'a
  // pas le droit de lire — et la fiche montrerait un lien mort ou, pire, une pièce d'ailleurs.
  const driveNodeId = fdStr(formData, "driveNodeId");
  if (driveNodeId) {
    const node = await prisma.driveNode.findUnique({ where: { id: driveNodeId }, select: { isTrashed: true } });
    if (!node || node.isTrashed) return { ok: false, error: "Le dossier / fichier choisi n'existe plus dans le Drive." };
    if (!canViewDrive(await resolveDriveAccess(user, driveNodeId))) {
      return { ok: false, error: "Vous n'avez pas accès à ce dossier / fichier du Drive." };
    }
  }

  const companyId = await companyIdForNew(user.id);
  const created = await prisma.legalDocument.create({
    data: {
      ...f, title,
      companyId,
      // Le fichier du Drive est RÉFÉRENCÉ, jamais recopié.
      driveNodeId,
      sourceType: (fdStr(formData, "sourceType") as EntityType | null) ?? null,
      sourceId: fdStr(formData, "sourceId"),
      createdById: user.id,
      updatedById: user.id,
    },
    select: { id: true },
  });
  // LES LECTEURS DÉSIGNÉS. Aucun nom = document visible de tout le module (le cas d'une police
  // d'assurance courante). Un ou plusieurs noms = personne d'autre ne le voit, ni dans la liste
  // ni par son lien — le déposant gardant sa propre porte, on le retire de la liste.
  const readerIds = normalizeReaderIds(formData.getAll("readerId").map((v) => String(v)), user.id);
  if (readerIds.length > 0) {
    const known = await prisma.user.findMany({
      where: { id: { in: readerIds }, isActive: true },
      select: { id: true },
    });
    await prisma.legalDocumentReader.createMany({
      data: known.map((u) => ({ documentId: created.id, userId: u.id, grantedById: user.id })),
      skipDuplicates: true,
    });
  }

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Legal",
    entityType: "LEGAL_DOCUMENT", entityId: created.id,
    summary: `Document légal « ${title} »${readerIds.length ? ` — restreint à ${readerIds.length} lecteur(s)` : ""}`,
  });

  // Les pièces jointes du formulaire, rattachées au document qui vient de naître. Un échec de
  // fichier ne défait PAS la création : l'engagement est enregistré, on dit ce qui n'a pas suivi.
  const files = await attachFormFiles(user.id, "LEGAL_DOCUMENT", created.id, formData);

  revalidatePath("/legal");
  return {
    ok: true,
    id: created.id,
    message: files.failed.length
      ? `Document créé. ${files.attached} pièce(s) jointe(s) ; échec sur : ${files.failed.map((x) => x.name).join(", ")}.`
      : undefined,
  };
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
  const chainErr = await checkChainFrom(f.chainFromId, id);
  if (chainErr) return { ok: false, error: chainErr };

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

/**
 * REVOIR LES LECTEURS d'un document légal — la liste envoyée REMPLACE la précédente.
 *
 * Qui peut : le DÉPOSANT et le Super Admin, personne d'autre. Le droit d'écriture sur le module
 * ne suffit pas : pouvoir corriger une date d'échéance n'est pas pouvoir s'ouvrir un document
 * qu'on ne devrait pas lire — ce serait la porte dérobée exacte que la restriction ferme.
 *
 * Une liste vide rouvre le document à tout le module. C'est une décision, et elle est tracée
 * comme telle : on saura qui a levé la restriction, et quand.
 */
export async function setLegalReaders(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Document introuvable." };

  const doc = await prisma.legalDocument.findUnique({
    where: { id },
    select: { title: true, createdById: true, readers: { select: { userId: true } } },
  });
  if (!doc) return { ok: false, error: "Document introuvable." };

  const isOwner = doc.createdById === user.id;
  if (!isOwner && user.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Seul le déposant du document peut en revoir les lecteurs." };
  }

  const wanted = normalizeReaderIds(formData.getAll("readerId").map((v) => String(v)), doc.createdById);
  const known = wanted.length
    ? (await prisma.user.findMany({ where: { id: { in: wanted }, isActive: true }, select: { id: true } })).map((u) => u.id)
    : [];

  await prisma.$transaction([
    prisma.legalDocumentReader.deleteMany({ where: { documentId: id, userId: { notIn: known } } }),
    ...known.map((userId) =>
      prisma.legalDocumentReader.upsert({
        where: { documentId_userId: { documentId: id, userId } },
        create: { documentId: id, userId, grantedById: user.id },
        update: {},
      }),
    ),
  ]);

  const before = doc.readers.length;
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Legal",
    entityType: "LEGAL_DOCUMENT", entityId: id, field: "readers",
    oldValue: String(before), newValue: String(known.length),
    summary: known.length
      ? `« ${doc.title} » — restreint à ${known.length} lecteur(s) désigné(s)`
      : `« ${doc.title} » — restriction levée : visible de tout le module Legal`,
  });
  revalidatePath("/legal");
  revalidatePath(`/legal/${id}`);
  return { ok: true, message: known.length ? `${known.length} lecteur(s) autorisé(s).` : "Restriction levée." };
}

/**
 * ENVOYER UNE FACTURE AU RÈGLEMENT — le dernier maillon de la chaîne d'achat.
 *
 * La facture de Legal devient un ordre de dépense par la porte commune (`createExpenseOrder`),
 * qui applique la règle du CENTRE DE PAIEMENT : dès 50 000 DZD, autorisation du PDG ou du Super
 * Admin avant que les Finances ne voient l'ordre. La fiche garde le lien (`expenseOrderId`) —
 * c'est lui qui permet d'afficher l'état du règlement au bout de la chaîne, et il empêche
 * d'envoyer deux fois la même facture au paiement.
 */
export async function sendLegalInvoiceToSettlement(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "LEGAL", "UPDATE") && !userCan(user, "FINANCES", "CREATE")) {
    return { ok: false, error: "Non autorisé." };
  }
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Document introuvable." };

  const doc = await prisma.legalDocument.findUnique({
    where: { id },
    select: { id: true, title: true, reference: true, kind: true, amount: true, counterparty: true, endDate: true, expenseOrderId: true },
  });
  if (!doc) return { ok: false, error: "Document introuvable." };
  if (doc.kind !== "INVOICE") return { ok: false, error: "Seule une facture s'envoie au règlement." };
  if (doc.expenseOrderId) return { ok: false, error: "Cette facture est déjà partie au règlement." };
  const amount = doc.amount ? Number(doc.amount) : 0;
  if (!amount || amount <= 0) return { ok: false, error: "Renseignez d'abord le montant de la facture." };

  const order = await createExpenseOrder({
    label: `${doc.reference ? `${doc.reference} — ` : ""}${doc.title}`,
    amount,
    category: "FOURNISSEUR",
    beneficiary: doc.counterparty,
    sourceType: "LEGAL_DOCUMENT",
    sourceId: doc.id,
    requestedById: user.id,
    dueDate: doc.endDate,
  });
  await prisma.legalDocument.update({ where: { id }, data: { expenseOrderId: order.id, updatedById: user.id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Legal",
    entityType: "LEGAL_DOCUMENT", entityId: id,
    summary: `Facture « ${doc.title} » envoyée au règlement (${amount.toLocaleString("fr-FR")} DZD)`,
  });
  revalidatePath(`/legal/${id}`);
  return { ok: true, message: "Facture envoyée au règlement — elle suit désormais le circuit du centre de paiement." };
}
