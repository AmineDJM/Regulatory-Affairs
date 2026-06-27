"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * Self-service : l'utilisateur complète ses coordonnées pendant l'onboarding.
 * N'écrase un champ que s'il est renseigné (l'onboarding enrichit, n'efface pas
 * ce que l'admin a pu saisir).
 */
export async function saveOnboardingProfile(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const phone = fdStr(formData, "phone");
  const title = fdStr(formData, "title");
  const data: { phone?: string; title?: string } = {};
  if (phone) data.phone = phone;
  if (title) data.title = title;
  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id: user.id }, data });
  }
  return { ok: true };
}

/**
 * Marque l'onboarding comme terminé. Le drapeau `mustOnboard` est lu à chaud par
 * le layout, donc l'effet est immédiat (pas de reconnexion nécessaire).
 */
export async function completeOnboarding(): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { mustOnboard: false, onboardedAt: new Date() },
  });
  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    module: "Onboarding",
    summary: "Configuration guidée du compte terminée",
  });
  revalidatePath("/dashboard");
  return { ok: true };
}
