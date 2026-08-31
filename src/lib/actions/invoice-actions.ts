"use server";

import { revalidatePath } from "next/cache";
import type { EntityType, InvoiceStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { companyIdForNew } from "@/lib/company";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";
import { toNumber } from "@/lib/utils";
import { buildRef } from "@/lib/refs";
import { settlementAction, invoiceDirection, invoiceSettlementLabel } from "@/lib/finances/settlement";

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
    // Sens de l'argent — jamais deviné des noms : voir `invoiceDirection`.
    direction: invoiceDirection(fdStr(formData, "direction")),
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
      // Le type ne se pose QUE si la cible existe : un « PCH_ORDER » sans identifiant serait
      // un lien qui pointe nulle part (le select « Bon de commande » peut rester vide).
      sourceType: fdStr(formData, "sourceId") ? ((fdStr(formData, "sourceType") as EntityType | null) ?? null) : null,
      sourceId: fdStr(formData, "sourceId"),
      createdById: user.id, updatedById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Finances",
    summary: `Facture « ${title} »${f.number ? ` (n° ${f.number})` : ""}`,
  });
  // Une facture créée DÉJÀ réglée (saisie a posteriori) inscrit son mouvement aussitôt.
  await syncInvoiceSettlement(created.id, user.id);
  revalidatePath("/finances/factures");
  revalidatePath("/finances");
  // Née rattachée à un bon de commande PCH : la fiche marché l'affiche aussi.
  if (fdStr(formData, "sourceType") === "PCH_ORDER") revalidatePath("/pch");
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
  // La date de règlement peut avoir été posée ou retirée depuis la fiche : l'écriture suit.
  await syncInvoiceSettlement(id, user.id);
  revalidatePath("/finances/factures");
  revalidatePath(`/finances/factures/${id}`);
  revalidatePath("/finances");
  return { ok: true };
}

/**
 * RATTACHER une facture EXISTANTE à un bon de commande PCH (ou l'en détacher) — le geste
 * a posteriori : la facture arrivée par Finances avant que le lien soit fait. C'est ce lien
 * (sourceType = PCH_ORDER) qui la fait apparaître sous SON bon dans la fiche marché, et qui
 * répond à « quelle facture correspond à quel BC ».
 */
export async function setInvoiceOrder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Facture introuvable." };
  const inv = await prisma.invoice.findUnique({ where: { id }, select: { title: true, number: true } });
  if (!inv) return { ok: false, error: "Facture introuvable." };

  const orderId = fdStr(formData, "pchOrderId");
  let orderLabel: string | null = null;
  if (orderId) {
    const o = await prisma.pchOrder.findUnique({ where: { id: orderId }, select: { reference: true, tender: { select: { reference: true } } } });
    if (!o) return { ok: false, error: "Bon de commande introuvable." };
    orderLabel = `BC ${o.reference ?? "s/n"} — ${o.tender.reference}`;
  }
  await prisma.invoice.update({
    where: { id },
    data: { sourceType: orderId ? "PCH_ORDER" : null, sourceId: orderId, updatedById: user.id },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Finances",
    summary: orderId
      ? `Facture « ${inv.title} » rattachée au ${orderLabel}`
      : `Facture « ${inv.title} » détachée de son bon de commande`,
  });
  revalidatePath("/finances/factures");
  revalidatePath("/pch");
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
  // L'ARGENT PASSE PAR LES FINANCES : marquer réglée y inscrit le mouvement, dé-marquer le retire.
  await syncInvoiceSettlement(input.id, user.id);
  revalidatePath("/finances/factures");
  revalidatePath("/finances");
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

/**
 * L'ÉCRITURE FINANCIÈRE D'UNE FACTURE — créée quand on la marque réglée, retirée quand on
 * revient dessus.
 *
 * TOUT PAIEMENT DE LA PLATEFORME PASSE PAR LES FINANCES. Marquer une facture « réglée » posait
 * une date, et rien d'autre : l'argent bougeait sans qu'aucune écriture n'apparaisse, si bien
 * que la trésorerie et le budget décrivaient une entreprise qui n'existait pas — et l'écran
 * qu'on aurait consulté pour s'en apercevoir était précisément celui qui mentait.
 *
 * Idempotent, dans les deux sens : ré-enregistrer une facture déjà réglée ne double pas son
 * écriture, et dé-marquer un règlement retire la sienne plutôt que de la laisser traîner.
 */
async function syncInvoiceSettlement(invoiceId: string, actorId: string): Promise<void> {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true, number: true, title: true, amount: true, paidDate: true, direction: true,
      companyId: true, payer: true, recipient: true, transactionId: true,
    },
  });
  if (!inv) return;

  const what = settlementAction({ paidDate: inv.paidDate, transactionId: inv.transactionId });
  if (what === "NOOP") return;

  if (what === "REMOVE") {
    const txId = inv.transactionId!;
    // On délie AVANT de supprimer : si la suppression échoue, la facture ne pointe plus vers
    // une écriture fantôme — mieux vaut une écriture orpheline, visible, qu'un lien mort.
    await prisma.invoice.update({ where: { id: inv.id }, data: { transactionId: null } });
    await prisma.financeTransaction.delete({ where: { id: txId } }).catch(() => undefined);
    await recordAudit({
      actorId, action: "UPDATE", module: "Finances", entityType: "FINANCE_TRANSACTION", entityId: txId,
      summary: `Règlement annulé — écriture retirée pour « ${inv.title} »`,
    });
    return;
  }

  // CREATE — le montant est obligatoire pour écrire : une écriture à zéro est un mouvement qui
  // n'a pas eu lieu, et elle brouillerait la trésorerie sans rien apporter.
  const amount = inv.amount != null ? toNumber(inv.amount) : 0;
  if (!(amount > 0)) return;

  const year = (inv.paidDate ?? new Date()).getFullYear();
  const refs = (await prisma.financeTransaction.findMany({
    where: { reference: { startsWith: `FIN-${year}-` } },
    select: { reference: true },
  })).map((r) => r.reference);

  const direction = invoiceDirection(inv.direction);
  const tx = await prisma.financeTransaction.create({
    data: {
      reference: buildRef("FIN", year, refs),
      date: inv.paidDate ?? new Date(),
      direction,
      category: "AUTRE",
      label: invoiceSettlementLabel(inv),
      amount,
      method: "BANK_TRANSFER",
      account: "Banque",
      // La contrepartie, c'est L'AUTRE : pour une facture reçue, celui qu'on paie.
      counterparty: (direction === "OUT" ? inv.recipient : inv.payer) ?? null,
      status: "SETTLED",
      companyId: inv.companyId,
      createdById: actorId,
    },
    select: { id: true },
  });
  await prisma.invoice.update({ where: { id: inv.id }, data: { transactionId: tx.id } });
  await recordAudit({
    actorId, action: "CREATE", module: "Finances", entityType: "FINANCE_TRANSACTION", entityId: tx.id,
    summary: `${direction === "OUT" ? "Décaissement" : "Encaissement"} ${amount.toLocaleString("fr-FR")} DZD — « ${inv.title} » (facture réglée)`,
  });
}
