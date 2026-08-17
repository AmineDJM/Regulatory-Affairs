"use server";

import { revalidatePath } from "next/cache";
import type { EntityType, InvoiceStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { companyIdForNew } from "@/lib/company";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";

/**
 * LES FACTURES — reçues ou émises, avec leur pièce et leur règlement.
 *
 * `recipient` (destinataire) et `payer` (payeur) sont écrits EN CLAIR plutôt que déduits d'un
 * sens « entrante / sortante » : selon la facture, la même société est l'un ou l'autre, et
 * c'est précisément ce qu'on vient vérifier six mois plus tard.
 *
 * La DATE DE PAIEMENT gouverne le statut : la renseigner, c'est déclarer la facture réglée ;
 * l'effacer, c'est la remettre à régler. Deux champs qui se contredisent (une date de paiement
 * sur une facture « à régler ») créent un doute qu'aucun tableau ne lève.
 */

const STATUSES: InvoiceStatus[] = ["UNPAID", "PARTIAL", "PAID", "CANCELLED"];
const parseStatus = (v: string | null): InvoiceStatus =>
  v && STATUSES.includes(v as InvoiceStatus) ? (v as InvoiceStatus) : "UNPAID";

/** Le statut découle de la date de paiement, sauf annulation explicite. */
function statusFor(raw: string | null, paidDate: Date | null): InvoiceStatus {
  const asked = parseStatus(raw);
  if (asked === "CANCELLED" || asked === "PARTIAL") return asked;
  return paidDate ? "PAID" : "UNPAID";
}

function readFields(formData: FormData) {
  const paidDate = fdDate(formData, "paidDate");
  const amountRaw = fdStr(formData, "amount");
  return {
    title: fdStr(formData, "title"),
    number: fdStr(formData, "number"),
    issueDate: fdDate(formData, "issueDate"),
    dueDate: fdDate(formData, "dueDate"),
    paidDate,
    amount: amountRaw ? Number(amountRaw) : null,
    status: statusFor(fdStr(formData, "status"), paidDate),
    recipient: fdStr(formData, "recipient"),
    payer: fdStr(formData, "payer"),
    notes: fdStr(formData, "notes"),
  };
}

export async function createInvoice(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "CREATE")) return { ok: false, error: "Non autorisé." };

  const { title, ...f } = readFields(formData);
  if (!title) return { ok: false, error: "L'objet de la facture est obligatoire." };
  if (f.amount !== null && !Number.isFinite(f.amount)) return { ok: false, error: "Montant invalide." };

  const created = await prisma.invoice.create({
    data: {
      ...f, title,
      companyId: await companyIdForNew(user.id),
      sourceType: (fdStr(formData, "sourceType") as EntityType | null) ?? null,
      sourceId: fdStr(formData, "sourceId"),
      createdById: user.id, updatedById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Finances",
    summary: `Facture « ${title} »${f.number ? ` (n° ${f.number})` : ""}`,
  });
  revalidatePath("/finances/factures");
  return { ok: true, id: created.id };
}

export async function updateInvoice(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Facture introuvable." };

  const { title, ...f } = readFields(formData);
  if (!title) return { ok: false, error: "L'objet de la facture est obligatoire." };

  await prisma.invoice.update({ where: { id }, data: { ...f, title, updatedById: user.id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Finances",
    summary: `Facture « ${title} » mise à jour`,
  });
  revalidatePath("/finances/factures");
  revalidatePath(`/finances/factures/${id}`);
  return { ok: true };
}

/** Marquer réglée / à régler depuis la ligne du tableau — le geste le plus fréquent. */
export async function setInvoicePaid(input: { id: string; paidDate: string | null }): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const paid = input.paidDate ? new Date(input.paidDate) : null;
  if (input.paidDate && Number.isNaN(paid!.getTime())) return { ok: false, error: "Date invalide." };

  await prisma.invoice.update({
    where: { id: input.id },
    // Le statut suit la date : pas de facture « à régler » portant une date de paiement.
    data: { paidDate: paid, status: paid ? "PAID" : "UNPAID", updatedById: user.id },
  });
  revalidatePath("/finances/factures");
  return { ok: true };
}

export async function deleteInvoice(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Facture introuvable." };
  const inv = await prisma.invoice.findUnique({ where: { id }, select: { title: true } });
  if (!inv) return { ok: false, error: "Facture introuvable." };

  await prisma.invoice.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Finances",
    summary: `Facture « ${inv.title} » supprimée`,
  });
  revalidatePath("/finances/factures");
  return { ok: true };
}
