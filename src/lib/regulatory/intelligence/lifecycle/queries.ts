import { prisma } from "@/lib/prisma";

/**
 * Lifecycle d'un dossier (G12) : chronologie des événements + obligations (avec calcul
 * OVERDUE à la lecture pour les échéances dépassées non traitées).
 */
export async function listLifecycle(dossierId: string) {
  const [events, obligations] = await Promise.all([
    prisma.regulatoryLifecycleEvent.findMany({
      where: { dossierId }, orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, kind: true, sequenceNo: true, operation: true, label: true, note: true, effectiveDate: true, createdAt: true },
    }),
    prisma.regulatoryObligation.findMany({
      where: { dossierId }, orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      select: { id: true, label: true, certType: true, dueDate: true, status: true, note: true, completedAt: true },
    }),
  ]);
  const now = Date.now();
  const withOverdue = obligations.map((o) => ({
    ...o,
    status: o.status === "OPEN" && o.dueDate && o.dueDate.getTime() < now ? "OVERDUE" : o.status,
  }));
  return { events, obligations: withOverdue };
}
