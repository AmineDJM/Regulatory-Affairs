import { prisma } from "@/lib/prisma";

/**
 * PORTE DE SOUMISSION (Phase 6). Un dossier ne peut passer « prêt pour revue » / « soumis »
 * tant qu'il subsiste un **bloqueur non levé** (OPEN/ACKNOWLEDGED). Un bloqueur ne peut être
 * levé (WAIVED) qu'avec justification par un rôle d'approbation, ou RESOLVED après correction.
 */
export interface Readiness {
  hasVersion: boolean;
  openBlockers: { id: string; title: string }[];
  clearedBlockers: number;
  completeness: number | null;
  conforme: boolean;
}

export async function submissionReadiness(dossierId: string): Promise<Readiness> {
  const version = await prisma.regulatoryDossierVersion.findFirst({
    where: { dossierId }, orderBy: { versionNo: "desc" }, select: { id: true },
  });
  if (!version) return { hasVersion: false, openBlockers: [], clearedBlockers: 0, completeness: null, conforme: false };

  const [blockers, assessment] = await Promise.all([
    prisma.regulatoryFinding.findMany({ where: { dossierVersionId: version.id, blocker: true }, select: { id: true, title: true, status: true } }),
    prisma.regulatoryAssessment.findUnique({ where: { dossierVersionId: version.id }, select: { completeness: true, conforme: true } }),
  ]);
  const openBlockers = blockers.filter((b) => b.status === "OPEN" || b.status === "ACKNOWLEDGED").map((b) => ({ id: b.id, title: b.title }));
  const clearedBlockers = blockers.length - openBlockers.length;
  return {
    hasVersion: true,
    openBlockers,
    clearedBlockers,
    completeness: assessment?.completeness ?? null,
    conforme: assessment?.conforme ?? false,
  };
}
