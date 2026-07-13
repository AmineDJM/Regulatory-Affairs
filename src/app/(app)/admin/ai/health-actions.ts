"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { performAiHealthCheck } from "@/lib/ai-health";

/** Lance À LA DEMANDE la sonde de santé de l'API IA (bouton « Tester maintenant »).
 *  Journalise + alerte les Super Admins comme le test quotidien. Réservé à l'admin. */
export async function runAiHealthCheckNow(): Promise<{ ok: boolean; error?: string; latencyMs?: number; model?: string }> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN" && !userCan(user, "ADMIN", "UPDATE")) {
    return { ok: false, error: "Réservé au Super Admin." };
  }
  const r = await performAiHealthCheck({ force: true });
  revalidatePath("/admin/ai");
  return { ok: r.ok, error: r.error, latencyMs: Math.round(r.latencyMs), model: r.model };
}
