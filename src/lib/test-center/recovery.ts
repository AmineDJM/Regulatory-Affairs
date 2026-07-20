import { prisma } from "@/lib/prisma";
import { cleanupRun, verifyClean } from "./manifest";

/**
 * Récupération des runs interrompus (§22). Au démarrage / à l'ouverture du dashboard,
 * on détecte les runs restés `RUNNING` trop longtemps ou `CLEANUP_INCOMPLETE` et on
 * propose de **reprendre leur nettoyage** — jamais automatiquement sur un run ambigu.
 */

const STALE_MINUTES = 30;

export async function findInterruptedRuns() {
  const staleCut = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
  return prisma.testRun.findMany({
    where: {
      OR: [
        { status: "CLEANUP_INCOMPLETE" },
        { status: "RUNNING", startedAt: { lt: staleCut } },
        { cleanupStatus: { in: ["PENDING", "RUNNING", "INCOMPLETE"] }, finishedAt: { not: null } },
      ],
    },
    orderBy: { startedAt: "desc" },
    select: { id: true, mode: true, status: true, cleanupStatus: true, startedAt: true, resourcesCreated: true, resourcesDeleted: true },
  });
}

export interface ResumeResult { cleanupStatus: "DONE" | "INCOMPLETE"; deleted: number; errors: number; residuals: number }

/** Reprend le nettoyage d'un run (idempotent : n'agit que sur les artefacts non supprimés). */
export async function resumeCleanup(runId: string): Promise<ResumeResult> {
  await prisma.testRun.update({ where: { id: runId }, data: { cleanupStatus: "RUNNING" } });
  const clean = await cleanupRun(runId);
  const verify = await verifyClean(runId);
  const cleanupStatus: "DONE" | "INCOMPLETE" = verify.clean && clean.errors === 0 ? "DONE" : "INCOMPLETE";
  await prisma.testRun.update({
    where: { id: runId },
    data: { cleanupStatus, status: cleanupStatus === "DONE" ? "PASSED" : "CLEANUP_INCOMPLETE", resourcesDeleted: { increment: clean.deleted } },
  });
  return { cleanupStatus, deleted: clean.deleted, errors: clean.errors, residuals: verify.residuals.length };
}
