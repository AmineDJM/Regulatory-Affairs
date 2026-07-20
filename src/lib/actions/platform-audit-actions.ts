"use server";

import { requireUser } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { runDiagnostic } from "@/lib/platform-audit/engine";
import { generateIdeas } from "@/lib/platform-audit/ai";

/**
 * Génère les **idées IA** du diagnostic de plateforme. Réservé au **Super Admin**.
 * Recalcule le diagnostic côté serveur (jamais de données passées par le client) puis
 * demande à Claude des propositions concrètes. La partie déterministe est, elle, rendue
 * directement par la page.
 */
export async function generatePlatformIdeas(): Promise<{ ok: boolean; text?: string; error?: string }> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };

  const diag = await runDiagnostic();
  const res = await generateIdeas(diag);
  if (!res.ok || !res.text) return { ok: false, error: res.error ?? "Analyse IA indisponible." };

  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Administration", summary: `Diagnostic plateforme — idées IA générées (score ${diag.healthScore}/100)` });
  return { ok: true, text: res.text };
}
