"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { executeRun } from "@/lib/test-center/runner";
import { resumeCleanup } from "@/lib/test-center/recovery";
import type { RunConfig, TestRunMode } from "@/lib/test-center/types";

/**
 * Actions du Test Center — **Super Admin uniquement**. En phase 1, seuls les modes
 * « Audit lecture seule » et « Test synthétique sûr » sont exécutables ; les autres sont
 * réservés aux phases suivantes. Le nettoyage est garanti et vérifié côté runner.
 */

const MODES: TestRunMode[] = ["READ_ONLY_AUDIT", "SAFE_SYNTHETIC_TEST", "STAGING_FULL_TEST", "CHAOS_TEST", "SECURITY_AUDIT", "PERFORMANCE_BENCHMARK"];
const PHASE1_MODES: TestRunMode[] = ["READ_ONLY_AUDIT", "SAFE_SYNTHETIC_TEST"];

export async function runTestCenter(input: { mode: string; productionConfirmed?: boolean; safetyPhrase?: string }): Promise<{ ok: boolean; runId?: string; error?: string }> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };

  const mode = MODES.includes(input.mode as TestRunMode) ? (input.mode as TestRunMode) : "SAFE_SYNTHETIC_TEST";
  if (!PHASE1_MODES.includes(mode)) {
    return { ok: false, error: "Ce mode sera activé dans une phase ultérieure. Phase 1 : « Audit lecture seule » ou « Test synthétique sûr »." };
  }
  const config: RunConfig = { productionConfirmed: input.productionConfirmed, safetyPhrase: input.safetyPhrase };
  const res = await executeRun({ mode, initiatedById: user.id, config });
  revalidatePath("/admin/test-center");
  return res;
}

export async function resumeTestCleanup(runId: string): Promise<{ ok: boolean; error?: string; residuals?: number }> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  if (!runId) return { ok: false, error: "Run introuvable." };
  const r = await resumeCleanup(runId);
  revalidatePath("/admin/test-center");
  return { ok: r.cleanupStatus === "DONE", residuals: r.residuals, error: r.cleanupStatus === "DONE" ? undefined : `${r.residuals} ressource(s) subsistent.` };
}
