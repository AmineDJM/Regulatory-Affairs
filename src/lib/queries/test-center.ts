import { prisma } from "@/lib/prisma";
import { findInterruptedRuns } from "@/lib/test-center/recovery";

/** Données du tableau de bord Test Center (dernier run + historique + runs interrompus). */
export async function getTestCenterDashboard() {
  const [runs, interrupted] = await Promise.all([
    prisma.testRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
    findInterruptedRuns(),
  ]);
  const last = runs[0] ?? null;
  const lastFindings = last
    ? await prisma.testFinding.findMany({ where: { testRunId: last.id }, orderBy: [{ severity: "asc" }, { createdAt: "asc" }], take: 200 })
    : [];
  const lastArtifacts = last ? await prisma.testArtifact.count({ where: { testRunId: last.id } }) : 0;
  return { runs, interrupted, last, lastFindings, lastArtifacts };
}
