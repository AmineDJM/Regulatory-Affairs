import { prisma } from "@/lib/prisma";

/** Packs de règles + résumé (statut, nombre de règles, aperçu) — pour l'administration (G5). */
export async function listRulePacks() {
  return prisma.regulatoryRulePack.findMany({
    orderBy: [{ status: "asc" }, { code: "asc" }],
    select: {
      id: true, code: true, name: true, description: true, jurisdiction: true, version: true, status: true, approvedAt: true,
      _count: { select: { rules: true } },
      rules: {
        orderBy: { ordinal: "asc" },
        select: { id: true, code: true, kind: true, sectionCode: true, factKey: true, severity: true, blocker: true, active: true, title: true },
      },
    },
  });
}
