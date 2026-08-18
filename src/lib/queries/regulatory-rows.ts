import { prisma } from "@/lib/prisma";
import { scopeRegulatory, isRegulatorySupervisor, type SessionUser } from "@/lib/rbac";
import { currentCompanyWhereFor, getMyCompanies } from "@/lib/company";
import { getAppSettings } from "@/lib/settings";
import { regProgress, type RegWorkflowState } from "@/lib/regulatory-workflow";
import { regStage } from "@/lib/regulatory/stage";
import { effectiveStage } from "@/lib/regulatory/manufacturing-stage";
import { PHARMA_FORM, DOSAGE_UNIT } from "@/lib/labels";
import type { RegulatoryRow } from "@/app/(app)/regulatory/regulatory-table";

/**
 * LES LIGNES DU TABLEAU REGULATORY — chargées une seule fois, lues par deux écrans.
 *
 * Le suivi des dossiers (`/regulatory`) et le PIPELINE (`/regulatory/pipeline`)
 * montrent les mêmes objets sous deux angles : ce qu'on instruit, et ce qu'on étudie. Deux
 * chargements parallèles finiraient par diverger sur une colonne — celle qu'on aurait corrigée
 * d'un côté seulement.
 */
export async function getRegulatoryRows(user: SessionUser) {
  const [products, suppliers, companies, settings] = await Promise.all([
    prisma.regulatoryProduct.findMany({
      where: { ...scopeRegulatory(user), ...await currentCompanyWhereFor(user.id) },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      include: {
        responsible: { select: { name: true } },
        assistant: { select: { name: true } },
        supplier: { select: { name: true } },
        company: { select: { id: true, name: true, shortName: true, color: true } },
        // Variations : c'est la variation OBTENUE qui fait foi sur le niveau de process.
        variations: { select: { toStatus: true, status: true, decisionDate: true, createdAt: true } },
      },
    }),
    prisma.supplier.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getMyCompanies(user.id),
    getAppSettings(),
  ]);
  // Supervision Regulatory : Super Admin + rôles configurés (priorité, dates, MàJ de statut).
  const canSupervise = isRegulatorySupervisor(user, settings.regulatorySupervisorRoles);

  const rows: RegulatoryRow[] = products.map((p) => {
    const prog = regProgress(p.workflow as RegWorkflowState | null);
    const done = prog.done;
    const total = prog.total;
    const dosage = [p.dosage, p.dosageUnit ? DOSAGE_UNIT[p.dosageUnit] ?? p.dosageUnit : null]
      .filter(Boolean)
      .join(" ");
    const stage = effectiveStage(p.manufacturingStatus, p.variations);
    return {
      id: p.id,
      reference: p.reference,
      dci: p.dci,
      brandName: p.brandName ?? "",
      dosage,
      form: p.pharmaceuticalForm ? PHARMA_FORM[p.pharmaceuticalForm] ?? p.pharmaceuticalForm : "",
      packaging: p.packaging ?? "",
      therapeuticClass: p.therapeuticClass ?? "",
      therapeuticSegments: p.therapeuticSegments ?? [],
      companyId: p.companyId ?? "",
      companyName: p.company?.shortName ?? p.company?.name ?? "",
      supplier: p.supplier?.name ?? "",
      category: p.category,
      // RÈGLE : une variation OBTENUE fait foi ; sinon, le niveau déclaré sur la fiche.
      manufacturingStatus: stage.status,
      manufacturingSource: stage.source,
      manufacturingPending: stage.pendingTo,
      status: p.status,
      priority: p.priority,
      isLocked: p.isLocked,
      responsible: p.responsible?.name ?? "",
      responsibleId: p.responsibleId ?? "",
      assistant: p.assistant?.name ?? "",
      targetSubmissionDate: p.targetSubmissionDate?.toISOString() ?? null,
      targetDate: p.targetDate?.toISOString() ?? null,
      progress: Math.round((done / total) * 100),
      stepsDone: done,
      stepsTotal: total,
      // LE VERROU EST LE PIPELINE : un dossier verrouillé attend d'être ouvert, un dossier
      // ouvert est à traiter, un dossier abouti reste abouti. Règle pure et testée.
      stage: regStage({ isLocked: p.isLocked, status: p.status }),
    };
  });

  return { rows, products, suppliers, companies, settings, canSupervise };
}
