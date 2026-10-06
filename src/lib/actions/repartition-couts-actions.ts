"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

/**
 * LA RÈGLE D'ALLOCATION DES COÛTS PARTAGÉS D'UNE BU, pour une année : la part de chaque produit (0..100), somme ≤ 100.
 * Un geste des FINANCES (module FINANCES, « Valider ») — ni le KAM ni la segmentation n'y touchent (§69, §86).
 */
export async function enregistrerRepartitionBu(input: { businessUnitId: string; annee: number; productIds: string[]; pcts: string[] }): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "VALIDATE")) return { ok: false, error: "La répartition des coûts est un geste des Finances (Administration › Accès)." };
  const annee = Math.floor(Number(input.annee));
  if (!Number.isFinite(annee) || annee < 2000 || annee > 2100) return { ok: false, error: "Année invalide." };
  const bu = await prisma.businessUnit.findUnique({ where: { id: input.businessUnitId }, select: { id: true, name: true } });
  if (!bu) return { ok: false, error: "Business Unit introuvable." };
  if (input.productIds.length !== input.pcts.length) return { ok: false, error: "Parts incohérentes." };
  const parts = input.productIds.map((productId, i) => ({ productId, pct: (input.pcts[i] ?? "").trim() === "" ? null : Number(input.pcts[i].replace(",", ".")) }));
  if (parts.some((p) => p.pct !== null && (!Number.isFinite(p.pct) || p.pct < 0 || p.pct > 100))) return { ok: false, error: "Chaque part est un pourcentage entre 0 et 100." };
  const total = parts.reduce((s, p) => s + (p.pct ?? 0), 0);
  if (total > 100.0001) return { ok: false, error: `La somme des parts fait ${Math.round(total * 100) / 100} % : elle ne peut pas dépasser 100 % (le reste demeure « non alloué »).` };
  const produitsBu = new Set((await prisma.promoProduct.findMany({ where: { businessUnitId: bu.id, productId: { not: null } }, select: { productId: true } })).map((p) => p.productId!));
  if (parts.some((p) => !produitsBu.has(p.productId))) return { ok: false, error: "Un produit n'appartient pas au catalogue de cette BU." };
  await prisma.$transaction(async (tx) => {
    for (const p of parts) {
      if (p.pct === null || p.pct === 0) await tx.coutRepartitionBu.deleteMany({ where: { businessUnitId: bu.id, annee, productId: p.productId } });
      else await tx.coutRepartitionBu.upsert({
        where: { businessUnitId_annee_productId: { businessUnitId: bu.id, annee, productId: p.productId } },
        update: { pct: p.pct, updatedById: user.id }, create: { businessUnitId: bu.id, annee, productId: p.productId, pct: p.pct, updatedById: user.id },
      });
    }
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "FINANCES", field: "repartition-couts", newValue: JSON.stringify(parts), summary: `Répartition des coûts partagés de la BU ${bu.name} pour ${annee} : ${Math.round(total * 100) / 100} % répartis, ${Math.round((100 - total) * 100) / 100} % non alloués.` });
  revalidatePath("/produits");
  revalidatePath("/business-units");
  return { ok: true };
}
