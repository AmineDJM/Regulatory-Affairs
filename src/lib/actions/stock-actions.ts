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

// ── Stock initial (initialisation puis calcul) ──

/**
 * Définit (ou met à jour) le stock initial d'un produit à un emplacement. Le niveau
 * courant affiché = stock initial + mouvements. Un seul stock initial par couple
 * (produit, emplacement). Permet d'initialiser le stock à l'adoption, puis de le
 * laisser se calculer à partir des mouvements.
 */
export async function setStockOpeningLevel(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "STOCKS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const resolved = await resolveProduct(formData);
  if (!resolved) return { ok: false, error: "Sélectionnez un produit (catalogue Regulatory) ou saisissez un libellé." };
  const location = fdStr(formData, "location") ?? "PCH";
  const quantity = Math.max(0, Math.round(fdNum(formData, "quantity") ?? 0));
  const date = fdDate(formData, "date") ?? new Date();
  const notes = fdStr(formData, "notes");

  const existing = await prisma.stockOpeningLevel.findFirst({
    where: resolved.productId
      ? { productId: resolved.productId, location }
      : { productId: null, product: resolved.product, location },
    select: { id: true },
  });
  if (existing) {
    await prisma.stockOpeningLevel.update({
      where: { id: existing.id },
      data: { product: resolved.product, dci: resolved.dci, quantity, date, notes },
    });
  } else {
    await prisma.stockOpeningLevel.create({
      data: { productId: resolved.productId, product: resolved.product, dci: resolved.dci, location, quantity, date, notes, createdById: user.id },
    });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Stocks", summary: `Stock initial — ${resolved.product} (${location}) : ${quantity}` });
  revalidatePath("/stocks");
  return { ok: true };
}

export async function deleteStockOpeningLevel(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "STOCKS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  await prisma.stockOpeningLevel.delete({ where: { id } }).catch(() => undefined);
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Stocks", summary: "Stock initial supprimé" });
  revalidatePath("/stocks");
  return { ok: true };
}
