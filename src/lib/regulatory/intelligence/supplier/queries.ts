import { prisma } from "@/lib/prisma";

/** Demandes fournisseur d'un dossier + questions (G8) — pour le workspace. */
export async function listSupplierRequests(dossierId: string) {
  return prisma.regulatorySupplierRequest.findMany({
    where: { dossierId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, subject: true, supplierName: true, supplierEmail: true, emailDraft: true, status: true,
      deadline: true, sentAt: true, remindedAt: true, respondedAt: true, responseNote: true,
      questions: { orderBy: { ordinal: "asc" }, select: { id: true, ordinal: true, question: true, answer: true, answered: true } },
    },
  });
}
