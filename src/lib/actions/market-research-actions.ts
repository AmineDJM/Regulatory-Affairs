"use server";

import { revalidatePath } from "next/cache";
import type { MarketResearchStatus, PlayerStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";

const MODULE = "BUSINESS_DEVELOPMENT" as const;
const BASE = "/business-development/etudes";

function num(fd: FormData, key: string): number | null {
  const v = fd.get(key);
  if (v === null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────── Étude ───────────────────────────
export async function createMarketResearch(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "CREATE")) return { ok: false, error: "Non autorisé." };
  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "Le titre de l'étude est obligatoire." };
  const research = await prisma.marketResearch.create({ data: { title, notes: fdStr(formData, "notes"), createdById: user.id } });

  // Molécules initiales (une par ligne) → une ligne de tableau par molécule.
  const molecules = (fdStr(formData, "molecules") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (molecules.length) {
    await prisma.marketResearchRow.createMany({
      data: molecules.map((product, i) => ({ researchId: research.id, product, sortOrder: i })),
    });
  }
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Business Development", summary: `Étude de marché « ${title} »` });
  revalidatePath(BASE);
  return { ok: true, id: research.id };
}

export async function updateMarketResearch(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Étude introuvable." };
  await prisma.marketResearch.update({
    where: { id },
    data: {
      title: fdStr(formData, "title") ?? undefined,
      status: (fdStr(formData, "status") as MarketResearchStatus) ?? undefined,
      notes: fdStr(formData, "notes"),
    },
  });
  revalidatePath(`${BASE}/${id}`);
  revalidatePath(BASE);
  return { ok: true };
}

export async function deleteMarketResearch(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Étude introuvable." };
  await prisma.marketResearch.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Business Development", summary: "Étude de marché supprimée" });
  revalidatePath(BASE);
  return { ok: true };
}

// ─────────────────────────── Lignes (produits / molécules) ───────────────────────────
export async function addResearchRow(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const researchId = fdStr(formData, "researchId");
  if (!researchId) return { ok: false, error: "Étude introuvable." };
  const count = await prisma.marketResearchRow.count({ where: { researchId } });
  const row = await prisma.marketResearchRow.create({
    data: { researchId, product: fdStr(formData, "product") || "Nouveau produit", sortOrder: count },
  });
  revalidatePath(`${BASE}/${researchId}`);
  return { ok: true, id: row.id };
}

export async function updateResearchRow(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const researchId = fdStr(formData, "researchId");
  if (!id) return { ok: false, error: "Ligne introuvable." };
  await prisma.marketResearchRow.update({
    where: { id },
    data: {
      therapeuticClass: fdStr(formData, "therapeuticClass"),
      product: fdStr(formData, "product") ?? undefined,
      marketVolume: num(formData, "marketVolume"),
      marketValueUsd: num(formData, "marketValueUsd"),
      avgPricePerBoxUsd: num(formData, "avgPricePerBoxUsd"),
      comment: fdStr(formData, "comment"),
    },
  });
  if (researchId) revalidatePath(`${BASE}/${researchId}`);
  return { ok: true };
}

export async function deleteResearchRow(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const researchId = fdStr(formData, "researchId");
  if (!id) return { ok: false, error: "Ligne introuvable." };
  await prisma.marketResearchRow.delete({ where: { id } });
  if (researchId) revalidatePath(`${BASE}/${researchId}`);
  return { ok: true };
}

// ─────────────────────────── Acteurs du marché ───────────────────────────
export async function addResearchPlayer(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const rowId = fdStr(formData, "rowId");
  const researchId = fdStr(formData, "researchId");
  if (!rowId) return { ok: false, error: "Ligne introuvable." };
  const count = await prisma.marketResearchPlayer.count({ where: { rowId } });
  const player = await prisma.marketResearchPlayer.create({
    data: { rowId, rank: count + 1, name: fdStr(formData, "name") || `Acteur ${count + 1}` },
  });
  if (researchId) revalidatePath(`${BASE}/${researchId}`);
  return { ok: true, id: player.id };
}

export async function updateResearchPlayer(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const researchId = fdStr(formData, "researchId");
  if (!id) return { ok: false, error: "Acteur introuvable." };
  const statusRaw = fdStr(formData, "status");
  await prisma.marketResearchPlayer.update({
    where: { id },
    data: {
      name: fdStr(formData, "name") ?? undefined,
      marketShareValue: num(formData, "marketShareValue"),
      status: statusRaw === "IMPORT" || statusRaw === "MANUFACTURING" ? (statusRaw as PlayerStatus) : null,
    },
  });
  if (researchId) revalidatePath(`${BASE}/${researchId}`);
  return { ok: true };
}

export async function deleteResearchPlayer(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const researchId = fdStr(formData, "researchId");
  if (!id) return { ok: false, error: "Acteur introuvable." };
  await prisma.marketResearchPlayer.delete({ where: { id } });
  if (researchId) revalidatePath(`${BASE}/${researchId}`);
  return { ok: true };
}
