"use server";

import { revalidatePath } from "next/cache";
import type { StockDirection } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

const DIRECTIONS: StockDirection[] = ["IN", "OUT", "ADJUST"];

export async function createStockMovement(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "STOCKS", "CREATE")) return { ok: false, error: "Non autorisé." };
  const product = fdStr(formData, "product");
  if (!product) return { ok: false, error: "Le produit est obligatoire." };
  const dirRaw = fdStr(formData, "direction");
  const direction = (dirRaw && DIRECTIONS.includes(dirRaw as StockDirection) ? dirRaw : "IN") as StockDirection;

  const created = await prisma.stockMovement.create({
    data: {
      product,
      dci: fdStr(formData, "dci"),
      direction,
      quantity: Math.max(0, Math.round(fdNum(formData, "quantity") ?? 0)),
      date: fdDate(formData, "date") ?? new Date(),
      location: fdStr(formData, "location") ?? "PCH",
      notes: fdStr(formData, "notes"),
      createdById: user.id,
    },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Stocks", summary: `Mouvement de stock — ${product}` });
  revalidatePath("/stocks");
  return { ok: true, id: created.id };
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
