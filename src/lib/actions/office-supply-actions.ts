"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

const DENIED: ActionResult = { ok: false, error: "Non autorisé." };

/**
 * Le catalogue est maintenu par les gestionnaires du Bureau du secrétariat — ET par ceux des
 * moyens généraux. C'est le MÊME catalogue vu de deux endroits : il alimente les demandes
 * d'achat d'un côté, le détail des tickets de caisse de l'autre. En tenir deux reviendrait à
 * comparer des consommations qui ne parlent pas des mêmes articles.
 */
function canManageCatalog(user: SessionUser): boolean {
  return hasGlobalView(user.role)
    || userCan(user, "ADMIN_REQUESTS", "UPDATE")
    || userCan(user, "GENERAL_MEANS", "UPDATE");
}

export async function createSupplyArticle(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageCatalog(user)) return DENIED;
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom de l'article est obligatoire." };

  const created = await prisma.officeSupplyArticle.create({
    data: {
      name,
      category: fdStr(formData, "category"),
      unit: fdStr(formData, "unit"),
      reference: fdStr(formData, "reference"),
      estimatedPrice: fdNum(formData, "estimatedPrice") ?? undefined,
      supplierHint: fdStr(formData, "supplierHint"),
      notes: fdStr(formData, "notes"),
      createdById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Bureau du secrétariat", entityType: "OFFICE_SUPPLY_ARTICLE", entityId: created.id, summary: `Article « ${name} » ajouté au catalogue` });
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  revalidatePath("/moyens-generaux");
  return { ok: true, id: created.id };
}

export async function updateSupplyArticle(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageCatalog(user)) return DENIED;
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Nom requis." };

  await prisma.officeSupplyArticle.update({
    where: { id },
    data: {
      name,
      category: fdStr(formData, "category"),
      unit: fdStr(formData, "unit"),
      reference: fdStr(formData, "reference"),
      estimatedPrice: fdNum(formData, "estimatedPrice") ?? null,
      supplierHint: fdStr(formData, "supplierHint"),
      notes: fdStr(formData, "notes"),
    },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "OFFICE_SUPPLY_ARTICLE", entityId: id, summary: `Article « ${name} » modifié` });
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  revalidatePath("/moyens-generaux");
  return { ok: true, id };
}

/** Active / désactive un article (un article retiré n'apparaît plus dans le menu). */
export async function toggleSupplyArticle(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageCatalog(user)) return DENIED;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const a = await prisma.officeSupplyArticle.findUnique({ where: { id }, select: { active: true, name: true } });
  if (!a) return { ok: false, error: "Article introuvable." };
  await prisma.officeSupplyArticle.update({ where: { id }, data: { active: !a.active } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "OFFICE_SUPPLY_ARTICLE", entityId: id, summary: `Article « ${a.name} » ${a.active ? "désactivé" : "réactivé"}` });
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  revalidatePath("/moyens-generaux");
  return { ok: true };
}
