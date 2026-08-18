"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * LES GAMMES — création, contenu, et rattachement des personnes.
 *
 * Qui décide : l'administration. Une gamme n'est pas un réglage d'écran, c'est une clé de
 * lecture de la plateforme : de ce rattachement découle ce que chacun voit. Le confier au
 * module Regulatory reviendrait à laisser l'équipe qui instruit les dossiers décider de qui
 * les voit.
 *
 * Ce qu'on ne fait JAMAIS ici : supprimer un produit. Retirer un produit d'une gamme le laisse
 * exactement où il est, simplement sans gamme ; supprimer une gamme fait de même pour tous les
 * siens. Un écran de rangement ne doit pas pouvoir détruire un dossier réglementaire.
 */

const ADMIN_PATH = "/admin/gammes";

function canManage(user: SessionUser): boolean {
  return userCan(user, "ADMIN", "CREATE");
}

/** Crée une gamme dans une entité. */
export async function createProductRange(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé à l'administration." };

  const companyId = fdStr(formData, "companyId");
  const name = fdStr(formData, "name");
  if (!companyId) return { ok: false, error: "L'entité est obligatoire : une gamme appartient à une société." };
  if (!name) return { ok: false, error: "Le nom de la gamme est obligatoire." };

  const company = await prisma.company.findFirst({ where: { id: companyId, isActive: true }, select: { name: true } });
  if (!company) return { ok: false, error: "Entité inconnue ou désactivée." };

  const dup = await prisma.productRange.findFirst({ where: { companyId, name }, select: { id: true } });
  if (dup) return { ok: false, error: `« ${name} » existe déjà dans cette entité.` };

  const range = await prisma.productRange.create({
    data: {
      companyId, name,
      description: fdStr(formData, "description") || null,
      color: fdStr(formData, "color") || null,
      createdById: user.id,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "ADMIN",
    summary: `Gamme créée : ${company.name} › ${name}`,
  });
  revalidatePath(ADMIN_PATH);
  return { ok: true, id: range.id };
}

/** Renomme / recolore une gamme, ou la désactive. L'entité, elle, ne bouge pas. */
export async function updateProductRange(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé à l'administration." };

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Gamme introuvable." };
  const existing = await prisma.productRange.findUnique({ where: { id }, select: { name: true, companyId: true } });
  if (!existing) return { ok: false, error: "Gamme introuvable." };

  const name = fdStr(formData, "name") || existing.name;
  if (name !== existing.name) {
    const dup = await prisma.productRange.findFirst({
      where: { companyId: existing.companyId, name, id: { not: id } },
      select: { id: true },
    });
    if (dup) return { ok: false, error: `« ${name} » existe déjà dans cette entité.` };
  }
  const isActiveRaw = formData.get("isActive");

  await prisma.productRange.update({
    where: { id },
    data: {
      name,
      description: fdStr(formData, "description") || null,
      color: fdStr(formData, "color") || null,
      ...(isActiveRaw != null ? { isActive: isActiveRaw === "on" || isActiveRaw === "true" } : {}),
    },
  });

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "ADMIN",
    summary: `Gamme modifiée : ${existing.name}${name !== existing.name ? ` → ${name}` : ""}`,
  });
  revalidatePath(ADMIN_PATH);
  return { ok: true };
}

/**
 * Supprime une gamme. Ses PRODUITS restent : ils redeviennent simplement « sans gamme »
 * (la clé étrangère est en `SET NULL`), et les rattachements de personnes tombent avec elle.
 */
export async function deleteProductRange(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé à l'administration." };

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Gamme introuvable." };
  const existing = await prisma.productRange.findUnique({
    where: { id },
    select: { name: true, company: { select: { name: true } }, _count: { select: { products: true, userAccess: true } } },
  });
  if (!existing) return { ok: false, error: "Gamme introuvable." };

  await prisma.productRange.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "ADMIN",
    summary: `Gamme supprimée : ${existing.company.name} › ${existing.name} — ${existing._count.products} produit(s) rendus « sans gamme », ${existing._count.userAccess} rattachement(s) levés`,
  });
  revalidatePath(ADMIN_PATH);
  return { ok: true };
}

/**
 * RANGE DES PRODUITS DANS UNE GAMME — ou les en sort (`rangeId` vide).
 *
 * Un produit ne peut relever que d'une gamme DE SON ENTITÉ : classer un produit d'Adventum
 * dans une gamme de Pharmagène ouvrirait le dossier à des gens d'une autre société sans que
 * l'écran d'entité le montre jamais.
 */
export async function setProductsRange(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé à l'administration." };

  const rangeId = fdStr(formData, "rangeId");
  const productIds = formData.getAll("productId").map((v) => String(v)).filter(Boolean);
  if (productIds.length === 0) return { ok: false, error: "Aucun produit sélectionné." };

  // Sortir de toute gamme : geste légitime, et le seul qui n'a pas d'entité à vérifier.
  if (!rangeId) {
    const res = await prisma.regulatoryProduct.updateMany({
      where: { id: { in: productIds } },
      data: { rangeId: null, updatedById: user.id },
    });
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "ADMIN",
      summary: `${res.count} produit(s) retirés de leur gamme`,
    });
    revalidatePath(ADMIN_PATH);
    return { ok: true, message: `${res.count} produit(s) retirés de leur gamme.` };
  }

  const range = await prisma.productRange.findUnique({
    where: { id: rangeId },
    select: { name: true, companyId: true, company: { select: { name: true } } },
  });
  if (!range) return { ok: false, error: "Gamme introuvable." };

  const products = await prisma.regulatoryProduct.findMany({
    where: { id: { in: productIds } },
    select: { id: true, reference: true, companyId: true },
  });
  const foreign = products.filter((p) => p.companyId && p.companyId !== range.companyId);
  if (foreign.length > 0) {
    return {
      ok: false,
      error: `${foreign.length} produit(s) appartiennent à une autre entité (${foreign.map((p) => p.reference).slice(0, 3).join(", ")}…) : une gamme ne range que des produits de sa société.`,
    };
  }

  const res = await prisma.regulatoryProduct.updateMany({
    where: { id: { in: products.map((p) => p.id) } },
    // Un produit sans entité qu'on range prend celle de la gamme : c'est le seul moment où
    // l'information manquante est connue avec certitude.
    data: { rangeId, companyId: range.companyId, updatedById: user.id },
  });

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "ADMIN",
    summary: `${res.count} produit(s) rangés dans ${range.company.name} › ${range.name}`,
  });
  revalidatePath(ADMIN_PATH);
  revalidatePath("/regulatory");
  return { ok: true, message: `${res.count} produit(s) rangés dans « ${range.name} ».` };
}

/**
 * RATTACHE UNE PERSONNE À DES GAMMES — la liste envoyée REMPLACE la précédente.
 *
 * Envoyer une liste vide détache de toutes les gammes : la personne relève alors de ses seules
 * entités. Remplacer plutôt qu'ajouter évite l'écran où l'on croit avoir retiré un accès parce
 * qu'on a décoché une case.
 */
export async function setUserRanges(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé à l'administration." };

  const userId = fdStr(formData, "userId");
  if (!userId) return { ok: false, error: "Personne introuvable." };
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!target) return { ok: false, error: "Personne introuvable." };

  const wanted = formData.getAll("rangeId").map((v) => String(v)).filter(Boolean);
  const ranges = wanted.length
    ? await prisma.productRange.findMany({
        where: { id: { in: wanted } },
        select: { id: true, name: true, company: { select: { name: true } } },
      })
    : [];
  if (ranges.length !== wanted.length) return { ok: false, error: "Une gamme sélectionnée n'existe plus." };

  await prisma.$transaction([
    prisma.userProductRange.deleteMany({ where: { userId, rangeId: { notIn: ranges.map((r) => r.id) } } }),
    ...ranges.map((r) =>
      prisma.userProductRange.upsert({
        where: { userId_rangeId: { userId, rangeId: r.id } },
        create: { userId, rangeId: r.id, grantedById: user.id },
        update: {},
      }),
    ),
  ]);

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "ADMIN",
    summary: ranges.length
      ? `${target.name} rattaché(e) à ${ranges.length} gamme(s) : ${ranges.map((r) => `${r.company.name} › ${r.name}`).join(", ")}`
      : `${target.name} détaché(e) de toutes les gammes — il/elle relève de ses entités`,
  });
  revalidatePath(ADMIN_PATH);
  return { ok: true, message: ranges.length ? `${ranges.length} gamme(s) rattachée(s).` : "Rattachements levés." };
}

/**
 * Vide une gamme d'un seul produit (bouton « × » sur la ligne). Le produit reste, sans gamme.
 */
export async function removeProductFromRange(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé à l'administration." };
  const productId = fdStr(formData, "productId");
  if (!productId) return { ok: false, error: "Produit introuvable." };
  const p = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { reference: true } });
  if (!p) return { ok: false, error: "Produit introuvable." };

  await prisma.regulatoryProduct.update({ where: { id: productId }, data: { rangeId: null, updatedById: user.id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "ADMIN",
    summary: `${p.reference} retiré de sa gamme (le dossier reste, sans gamme)`,
  });
  revalidatePath(ADMIN_PATH);
  return { ok: true };
}
