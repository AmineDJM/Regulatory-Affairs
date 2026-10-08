"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { canGovernMarketingEnvelope } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { companyIdForNew } from "@/lib/company";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, fdDate, fdCase, type ActionResult } from "@/lib/actions/types";
import { bornesAnnee, CATEGORIES_AD_PRO, DOMAINE_MARKETING, MODULES_AD_PRO_BUDGET } from "@/lib/budget-marketing/domaine";

/**
 * BUDGET MARKETING — les gestes de la Direction Marketing sur SES enveloppes (Direction, 08/10).
 *
 * Créer, régler (nom, montant, période, BU / produit, active) et retirer une enveloppe `domaine = MARKETING`. Le
 * CONTENU (catégories, lignes, imputation) passe par les actions de Budgets (`budget-envelope-actions.ts`), qui
 * reconnaissent le droit du module sur une enveloppe marketing (`canManageEnvelope`). Les listes d'accès ne sont
 * jamais touchées ici : elles restent au Super Admin, dans Budgets.
 */

const REFUS: ActionResult = { ok: false, error: "Réservé à la Direction Marketing (Budget Marketing)." };

function revalider() {
  revalidatePath("/budget-marketing");
  revalidatePath("/budgets");
}

export async function createMarketingEnvelope(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canGovernMarketingEnvelope(user, "CREATE")) return REFUS;
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom de l'enveloppe est obligatoire." };
  const montant = fdNum(formData, "totalAmount") ?? 0;
  if (montant < 0) return { ok: false, error: "Le montant ne peut pas être négatif." };
  const { debut, fin } = bornesAnnee(fdNum(formData, "annee"));
  const adPro = fdCase(formData, "adPro") === true;

  const created = await prisma.budgetEnvelope.create({
    data: {
      name,
      domaine: DOMAINE_MARKETING,
      modules: adPro ? [...MODULES_AD_PRO_BUDGET] : [],
      module: adPro ? MODULES_AD_PRO_BUDGET[0] : null,
      businessUnitId: fdStr(formData, "businessUnitId"),
      productId: fdStr(formData, "productId"),
      periodStart: debut,
      periodEnd: fin,
      totalAmount: montant,
      notes: fdStr(formData, "notes"),
      createdById: user.id,
      companyId: await companyIdForNew(user.id),
      // Une enveloppe Ad & Pro naît avec ses six catégories, chacune liée à son module : les postes accordés s'y rangent.
      ...(adPro ? { categories: { create: CATEGORIES_AD_PRO.map((c) => ({ name: c.nom, module: c.module })) } } : {}),
    },
    select: { id: true },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Budget Marketing", entityId: created.id, summary: `Enveloppe marketing « ${name} »` });
  revalider();
  return { ok: true, id: created.id };
}

export async function updateMarketingEnvelope(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Paramètres manquants." };
  const env = await prisma.budgetEnvelope.findUnique({ where: { id }, select: { domaine: true } });
  if (!env) return { ok: false, error: "Enveloppe introuvable." };
  if (!canGovernMarketingEnvelope(user, "UPDATE", env)) return REFUS;
  const montant = fdNum(formData, "totalAmount");
  if (montant != null && montant < 0) return { ok: false, error: "Le montant ne peut pas être négatif." };
  const debut = fdDate(formData, "periodStart");
  const fin = fdDate(formData, "periodEnd");
  if (debut && fin && fin < debut) return { ok: false, error: "La fin de période précède son début." };
  const actif = fdCase(formData, "isActive");

  await prisma.budgetEnvelope.update({
    where: { id },
    data: {
      name,
      businessUnitId: fdStr(formData, "businessUnitId"),
      productId: fdStr(formData, "productId"),
      notes: fdStr(formData, "notes"),
      ...(montant != null ? { totalAmount: montant } : {}),
      ...(debut ? { periodStart: debut } : {}),
      ...(fin ? { periodEnd: fin } : {}),
      ...(actif !== undefined ? { isActive: actif } : {}),
    },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Budget Marketing", entityId: id, summary: `Enveloppe marketing « ${name} » modifiée` });
  revalider();
  return { ok: true };
}

export async function deleteMarketingEnvelope(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const env = await prisma.budgetEnvelope.findUnique({ where: { id }, select: { name: true, domaine: true } });
  if (!env) return { ok: false, error: "Enveloppe introuvable." };
  if (!canGovernMarketingEnvelope(user, "DELETE", env)) return REFUS;
  // Les dépenses imputées repassent en « à imputer » (clé étrangère SetNull) ; les catégories partent avec l'enveloppe.
  await prisma.budgetEnvelope.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Budget Marketing", entityId: id, summary: `Enveloppe marketing « ${env.name} » supprimée` });
  revalider();
  return { ok: true };
}
