"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * ACCÈS AUX ENTITÉS — attribution par les ressources humaines.
 *
 * Une personne peut être salariée d'Adventum et travailler pour trois entités du groupe :
 * l'appartenance et le droit d'accès sont deux choses distinctes. Ce fichier gère le second.
 *
 * ⚠️ Une garde structurelle : **on ne modifie jamais ses PROPRES accès**. Sans elle, quiconque
 * gère les ressources humaines pourrait s'ouvrir toutes les entités du groupe en un clic — et
 * l'étanchéité ne vaudrait plus rien. Un Super Admin passe par l'Administration.
 */

function canManage(user: { role: string; secondaryRole?: string | null }): boolean {
  return hasGlobalView(user as never) || userCan(user as never, "RH", "UPDATE");
}

/** Accorde ou révoque l'accès d'une personne à une entité. */
export async function setCompanyAccess(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const actor = await requireUser();
  if (!canManage(actor)) return { ok: false, error: "Réservé aux ressources humaines." };

  const userId = fdStr(formData, "userId");
  const companyId = fdStr(formData, "companyId");
  const mode = fdStr(formData, "mode"); // "none" | "view" | "edit"
  if (!userId || !companyId || !mode) return { ok: false, error: "Requête incomplète." };
  if (userId === actor.id && actor.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Vous ne pouvez pas modifier vos propres accès aux entités." };
  }

  const [target, company] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } }),
  ]);
  if (!target || !company) return { ok: false, error: "Personne ou entité introuvable." };

  try {
    if (mode === "none") {
      await prisma.userCompanyAccess.deleteMany({ where: { userId, companyId } });
    } else {
      const canEdit = mode === "edit";
      await prisma.userCompanyAccess.upsert({
        where: { userId_companyId: { userId, companyId } },
        create: { userId, companyId, canEdit, grantedById: actor.id },
        update: { canEdit, grantedById: actor.id },
      });
    }

    await recordAudit({
      actorId: actor.id, action: "UPDATE", module: "Ressources humaines", entityId: userId,
      summary: `Accès entité « ${company.name} » pour ${target.name} : ${mode === "none" ? "retiré" : mode === "edit" ? "voir et modifier" : "voir seulement"}.`,
    });
    revalidatePath("/rh");
    return { ok: true };
  } catch (err) {
    console.error("[company-access] enregistrement impossible", err);
    return { ok: false, error: "L'accès n'a pas pu être enregistré." };
  }
}
