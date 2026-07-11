import { prisma } from "@/lib/prisma";

/** Cycles de réserves d'un dossier + points (G9) — pour le workspace. */
export async function listReserveCycles(dossierId: string) {
  return prisma.regulatoryReserveCycle.findMany({
    where: { dossierId },
    orderBy: { cycle: "desc" },
    select: {
      id: true, cycle: true, letterFilename: true, ocrConfidence: true, ocrNeedsReview: true, status: true, receivedAt: true,
      points: {
        orderBy: { ordinal: "asc" },
        select: { id: true, ordinal: true, category: true, verbatim: true, proposedResponse: true, finalResponse: true, status: true },
      },
    },
  });
}
