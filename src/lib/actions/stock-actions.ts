"use server";

import { revalidatePath } from "next/cache";
import type { StockDirection } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

const DIRECTIONS: StockDirection[] = ["IN", "OUT", "ADJUST"];

/**
 * Détermine le produit du mouvement. Priorité au produit Regulatory sélectionné
 * (source de vérité du catalogue) : on en reprend le libellé (nom commercial ou
 * DCI) et la DCI. À défaut, on accepte un libellé libre (compatibilité).
 */
async function resolveProduct(formData: FormData): Promise<{ product: string; dci: string | null; productId: string | null } | null> {
  const productId = fdStr(formData, "productId");
  if (productId) {
    const reg = await prisma.regulatoryProduct.findUnique({
      where: { id: productId },
      select: { brandName: true, dci: true },
    });
    if (!reg) return null;
    return { product: reg.brandName?.trim() || reg.dci, dci: reg.dci, productId };
  }
  const free = fdStr(formData, "product");
  if (!free) return null;
  return { product: free, dci: fdStr(formData, "dci"), productId: null };
}

export async function createStockMovement(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "STOCKS", "CREATE")) return { ok: false, error: "Non autorisé." };
  const resolved = await resolveProduct(formData);
  if (!resolved) return { ok: false, error: "Sélectionnez un produit (catalogue Regulatory) ou saisissez un libellé." };
  const dirRaw = fdStr(formData, "direction");
  const direction = (dirRaw && DIRECTIONS.includes(dirRaw as StockDirection) ? dirRaw : "IN") as StockDirection;

  const created = await prisma.stockMovement.create({
    data: {
      product: resolved.product,
      productId: resolved.productId,
      dci: resolved.dci,
      direction,
      quantity: Math.max(0, Math.round(fdNum(formData, "quantity") ?? 0)),
      date: fdDate(formData, "date") ?? new Date(),
      location: fdStr(formData, "location") ?? "PCH",
      notes: fdStr(formData, "notes"),
      createdById: user.id,
    },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Stocks", summary: `Mouvement de stock — ${resolved.product}` });
  revalidatePath("/stocks");
  return { ok: true, id: created.id };
}

export async function updateStockMovement(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "STOCKS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const existing = await prisma.stockMovement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: "Mouvement introuvable." };
  const resolved = await resolveProduct(formData);
  if (!resolved) return { ok: false, error: "Sélectionnez un produit (catalogue Regulatory) ou saisissez un libellé." };
  const dirRaw = fdStr(formData, "direction");
  const direction = (dirRaw && DIRECTIONS.includes(dirRaw as StockDirection) ? dirRaw : "IN") as StockDirection;

  await prisma.stockMovement.update({
    where: { id },
    data: {
      product: resolved.product,
      productId: resolved.productId,
      dci: resolved.dci,
      direction,
      quantity: Math.max(0, Math.round(fdNum(formData, "quantity") ?? 0)),
      date: fdDate(formData, "date") ?? new Date(),
      location: fdStr(formData, "location") ?? "PCH",
      notes: fdStr(formData, "notes"),
    },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Stocks", summary: `Mouvement de stock modifié — ${resolved.product}` });
  revalidatePath("/stocks");
  return { ok: true, id };
}

export async function deleteStockMovement(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "STOCKS", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  await prisma.stockMovement.delete({ where: { id } });
  revalidatePath("/stocks");
  return { ok: true };
}
