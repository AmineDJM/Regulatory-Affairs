import { prisma } from "@/lib/prisma";

/** Sources du corpus + leurs versions (statut, sections) — pour l'administration. */
export async function listCorpusSources() {
  return prisma.regulatorySource.findMany({
    orderBy: [{ authority: "asc" }, { code: "asc" }],
    select: {
      id: true, authority: true, jurisdiction: true, code: true, title: true, sourceUrl: true,
      versions: {
        orderBy: { createdAt: "desc" },
        select: { id: true, version: true, status: true, effectiveAt: true, approvedAt: true, _count: { select: { sections: true } } },
      },
    },
  });
}
