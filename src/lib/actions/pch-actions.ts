"use server";

import { revalidatePath } from "next/cache";
import type { PchTenderStatus, PchOrderStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { buildRef } from "@/lib/refs";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, fdDate, fdBool, type ActionResult } from "@/lib/actions/types";

const TENDER_STATUSES: PchTenderStatus[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const ORDER_STATUSES: PchOrderStatus[] = ["PENDING", "VALIDATED", "DELIVERED", "PAID", "CANCELLED"];
const int = (formData: FormData, key: string) => Math.max(0, Math.round(fdNum(formData, key) ?? 0));

// ───────────────────────────── Appels d'offres ─────────────────────────────

export async function createTender(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "CREATE")) return { ok: false, error: "Non autorisé." };
  let reference = fdStr(formData, "reference");
  if (!reference) {
    const year = new Date().getFullYear();
    const refs = await prisma.pchTender.findMany({ where: { reference: { startsWith: `AO-${year}-` } }, select: { reference: true } });
    reference = buildRef("AO", year, refs.map((r) => r.reference));
  }
  const exists = await prisma.pchTender.findUnique({ where: { reference }, select: { id: true } });
  if (exists) return { ok: false, error: "Cette référence existe déjà." };
  const statusRaw = fdStr(formData, "status");

  const created = await prisma.pchTender.create({
    data: {
      reference,
      title: fdStr(formData, "title"),
      products: fdStr(formData, "products"),
      supplier: fdStr(formData, "supplier"),
      supplierCountry: fdStr(formData, "supplierCountry"),
      quantity: int(formData, "quantity"),
      value: fdNum(formData, "value"),
      client: fdStr(formData, "client") ?? "PCH",
      status: (statusRaw && TENDER_STATUSES.includes(statusRaw as PchTenderStatus) ? statusRaw : "NOT_STARTED") as PchTenderStatus,
      awardDate: fdDate(formData, "awardDate"),
      cautionAmount: fdNum(formData, "cautionAmount"),
      cautionDeposited: fdBool(formData, "cautionDeposited"),
      cautionStart: fdDate(formData, "cautionStart"),
      cautionEnd: fdDate(formData, "cautionEnd"),
      notes: fdStr(formData, "notes"),
      companyId: fdStr(formData, "companyId") || null,
      createdById: user.id,
    },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "PCH", summary: `Appel d'offres ${reference}` });
  revalidatePath("/pch");
  return { ok: true, id: created.id };
}

export async function updateTender(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const statusRaw = fdStr(formData, "status");

  await prisma.pchTender.update({
    where: { id },
    data: {
      title: fdStr(formData, "title"),
      products: fdStr(formData, "products"),
      supplier: fdStr(formData, "supplier"),
      supplierCountry: fdStr(formData, "supplierCountry"),
      quantity: int(formData, "quantity"),
      value: fdNum(formData, "value"),
      client: fdStr(formData, "client") ?? "PCH",
      status: (statusRaw && TENDER_STATUSES.includes(statusRaw as PchTenderStatus) ? (statusRaw as PchTenderStatus) : undefined),
      awardDate: fdDate(formData, "awardDate"),
      cautionAmount: fdNum(formData, "cautionAmount"),
      cautionDeposited: fdBool(formData, "cautionDeposited"),
      cautionStart: fdDate(formData, "cautionStart"),
      cautionEnd: fdDate(formData, "cautionEnd"),
      notes: fdStr(formData, "notes"),
      updatedById: user.id,
    },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "PCH", summary: `Appel d'offres mis à jour` });
  revalidatePath("/pch");
  revalidatePath(`/pch/${id}`);
  return { ok: true };
}

export async function deleteTender(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  await prisma.pchTender.delete({ where: { id } }); // cascade → bons de commande
  await recordAudit({ actorId: user.id, action: "DELETE", module: "PCH", summary: "Appel d'offres supprimé" });
  revalidatePath("/pch");
  return { ok: true };
}

// ───────────────────────────── Bons de commande ─────────────────────────────

export async function createOrder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "CREATE")) return { ok: false, error: "Non autorisé." };
  const tenderId = fdStr(formData, "tenderId");
  if (!tenderId) return { ok: false, error: "Appel d'offres manquant." };
  const tender = await prisma.pchTender.findUnique({ where: { id: tenderId }, select: { id: true } });
  if (!tender) return { ok: false, error: "Appel d'offres introuvable." };
  const statusRaw = fdStr(formData, "status");

  await prisma.pchOrder.create({
    data: {
      tenderId,
      reference: fdStr(formData, "reference"),
      products: fdStr(formData, "products"),
      quantity: int(formData, "quantity"),
      value: fdNum(formData, "value"),
      status: (statusRaw && ORDER_STATUSES.includes(statusRaw as PchOrderStatus) ? statusRaw : "PENDING") as PchOrderStatus,
      receivedDate: fdDate(formData, "receivedDate"),
      paymentDate: fdDate(formData, "paymentDate"),
      notes: fdStr(formData, "notes"),
      createdById: user.id,
    },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "PCH", summary: "Bon de commande PCH" });
  revalidatePath(`/pch/${tenderId}`);
  revalidatePath("/pch");
  return { ok: true };
}

export async function updateOrder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const order = await prisma.pchOrder.findUnique({ where: { id }, select: { tenderId: true } });
  if (!order) return { ok: false, error: "Bon de commande introuvable." };
  const statusRaw = fdStr(formData, "status");

  await prisma.pchOrder.update({
    where: { id },
    data: {
      reference: fdStr(formData, "reference"),
      products: fdStr(formData, "products"),
      quantity: int(formData, "quantity"),
      value: fdNum(formData, "value"),
      status: (statusRaw && ORDER_STATUSES.includes(statusRaw as PchOrderStatus) ? (statusRaw as PchOrderStatus) : undefined),
      receivedDate: fdDate(formData, "receivedDate"),
      paymentDate: fdDate(formData, "paymentDate"),
      notes: fdStr(formData, "notes"),
    },
  });
  revalidatePath(`/pch/${order.tenderId}`);
  return { ok: true };
}

export async function deleteOrder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "PCH", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const order = await prisma.pchOrder.findUnique({ where: { id }, select: { tenderId: true } });
  if (!order) return { ok: false, error: "Introuvable." };
  await prisma.pchOrder.delete({ where: { id } });
  revalidatePath(`/pch/${order.tenderId}`);
  return { ok: true };
}
