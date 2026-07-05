"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

const SCOPES = ["PCH", "HOSPITAL", "ANNEX"] as const;
const PATH = "/stocks";

/** Crée une annexe PCH (site de stockage secondaire). */
export async function createStockAnnex(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "STOCKS", "CREATE")) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Indiquez le nom de l'annexe." };
  const existing = await prisma.stockAnnex.findUnique({ where: { name } });
  if (existing) return { ok: false, error: "Cette annexe existe déjà." };
  const annex = await prisma.stockAnnex.create({ data: { name } });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Stocks", summary: `Annexe PCH créée — ${name}` });
  revalidatePath(PATH);
  return { ok: true, id: annex.id };
}

/** Supprime une annexe (et ses états de stock, en cascade). */
export async function deleteStockAnnex(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "STOCKS", "DELETE")) return { ok: false, error: "Suppression réservée (droit Supprimer sur Stocks)." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const annex = await prisma.stockAnnex.findUnique({ where: { id }, select: { name: true } });
  if (!annex) return { ok: false, error: "Annexe introuvable." };
  await prisma.stockAnnex.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Stocks", summary: `Annexe PCH supprimée — ${annex.name}` });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Enregistre un ÉTAT de stock daté : « à cette date, il reste X unités » pour un
 * produit et un lieu (PCH / hôpital / annexe). S'il existe déjà un état pour le même
 * jour, il est remplacé (correction simple).
 */
export async function recordStockSnapshot(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "STOCKS", "CREATE") && !userCan(user, "STOCKS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const scope = fdStr(formData, "scope");
  const productId = fdStr(formData, "productId");
  const date = fdDate(formData, "date");
  const quantity = fdNum(formData, "quantity");
  const annexId = fdStr(formData, "annexId");
  if (!scope || !(SCOPES as readonly string[]).includes(scope)) return { ok: false, error: "Lieu de stock invalide." };
  if (scope === "ANNEX" && !annexId) return { ok: false, error: "Choisissez l'annexe concernée." };
  if (!productId) return { ok: false, error: "Choisissez le produit." };
  if (!date) return { ok: false, error: "Indiquez la date de l'état de stock." };
  if (quantity === null || quantity < 0) return { ok: false, error: "Indiquez la quantité restante (≥ 0)." };

  const product = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { dci: true, brandName: true } });
  if (!product) return { ok: false, error: "Produit introuvable." };

  // Un seul état par jour et par (produit, lieu) : on remplace s'il existe.
  const dayStart = new Date(date); dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const existing = await prisma.stockSnapshot.findFirst({
    where: { scope, annexId: scope === "ANNEX" ? annexId : null, productId, date: { gte: dayStart, lt: dayEnd } },
  });
  if (existing) {
    await prisma.stockSnapshot.update({ where: { id: existing.id }, data: { quantity: Math.round(quantity), date } });
  } else {
    await prisma.stockSnapshot.create({
      data: { scope, annexId: scope === "ANNEX" ? annexId : null, productId, date, quantity: Math.round(quantity), createdById: user.id },
    });
  }
  await recordAudit({ actorId: user.id, action: existing ? "UPDATE" : "CREATE", module: "Stocks", summary: `État de stock ${scope} — ${product.brandName ?? product.dci} : ${Math.round(quantity)} u.` });
  revalidatePath(PATH);
  return { ok: true };
}

/** Supprime un état de stock (correction). */
export async function deleteStockSnapshot(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const snap = await prisma.stockSnapshot.findUnique({ where: { id }, select: { createdById: true } });
  if (!snap) return { ok: false, error: "État introuvable." };
  if (!userCan(user, "STOCKS", "DELETE") && snap.createdById !== user.id) return { ok: false, error: "Non autorisé." };
  await prisma.stockSnapshot.delete({ where: { id } });
  revalidatePath(PATH);
  return { ok: true };
}
