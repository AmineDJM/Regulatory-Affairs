import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { beneficiaryName, beneficiarySubtitle } from "@/lib/care";
import type { BeneficiaryRow, QuoteRow } from "@/components/care/care-panel";

/**
 * Lecture du dossier de prise en charge — personnes, leurs cases, et les devis.
 *
 * Une seule fonction pour les deux périmètres : la question est la même, la réponse doit
 * l'être. Les noms venant de l'annuaire sont résolus **en une requête** plutôt qu'une par
 * personne — un dossier de vingt participants ne doit pas coûter vingt allers-retours.
 */
export async function getCareDossier(scope: "NATIONAL" | "INTERNATIONAL", requestId: string): Promise<{
  beneficiaries: BeneficiaryRow[];
  quotes: QuoteRow[];
}> {
  const where = scope === "NATIONAL" ? { congressNationalId: requestId } : { congressInternationalId: requestId };

  const [rows, quotes] = await Promise.all([
    prisma.careBeneficiary.findMany({
      where,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, doctorId: true, firstName: true, lastName: true, jobTitle: true, institution: true,
        requesterOpinion: true, requesterNote: true, status: true, decisionNote: true,
        cells: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: { id: true, kind: true, serviceKind: true, label: true, notes: true, status: true, amountDzd: true, expenseOrderId: true },
        },
      },
    }),
    prisma.careQuote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, supplier: true, reference: true, amountDzd: true, status: true, note: true,
        cells: { select: { cellId: true, cell: { select: { label: true } } } },
      },
    }),
  ]);

  // Les noms de l'annuaire, en UNE requête.
  const doctorIds = rows.map((r) => r.doctorId).filter((x): x is string => Boolean(x));
  const doctors = doctorIds.length
    ? await prisma.medicalDoctor.findMany({ where: { id: { in: doctorIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(doctors.map((d) => [d.id, d.name]));

  return {
    beneficiaries: rows.map((r) => {
      const identity = { ...r, doctorName: r.doctorId ? nameById.get(r.doctorId) ?? null : null };
      return {
        id: r.id,
        name: beneficiaryName(identity),
        subtitle: beneficiarySubtitle(identity),
        fromDirectory: Boolean(r.doctorId),
        requesterOpinion: r.requesterOpinion,
        requesterNote: r.requesterNote,
        status: r.status,
        decisionNote: r.decisionNote,
        cells: r.cells.map((c) => ({
          id: c.id, kind: c.kind, serviceKind: c.serviceKind, label: c.label, notes: c.notes,
          status: c.status,
          amountDzd: c.amountDzd != null ? toNumber(c.amountDzd) : null,
          expenseOrderId: c.expenseOrderId,
        })),
      };
    }),
    quotes: quotes.map((q) => ({
      id: q.id, supplier: q.supplier, reference: q.reference,
      amountDzd: toNumber(q.amountDzd), status: q.status, note: q.note,
      cellIds: q.cells.map((c) => c.cellId),
      cellLabels: q.cells.map((c) => c.cell.label),
    })),
  };
}
