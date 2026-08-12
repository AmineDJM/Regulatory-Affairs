import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, scopeRegulatory, isRegulatorySupervisor } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { regProgress, regTreatmentStarted, type RegWorkflowState } from "@/lib/regulatory-workflow";
import { currentCompanyWhere, getCompanies } from "@/lib/company";
import { canSeeRegEnrollment } from "@/lib/org-chart-access";
import { getAppSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { PHARMA_FORM, DOSAGE_UNIT } from "@/lib/labels";
import { effectiveStage } from "@/lib/regulatory/manufacturing-stage";
import { RegulatoryTable, type RegulatoryRow } from "./regulatory-table";
import { NewProductButton } from "./new-product";
import { SuppliersManager } from "./suppliers-manager";

/** Étape de traitement d'un dossier : Nouveau → En cours → Terminé (DE).
 *  Le traitement DÉMARRE à l'étape 3 de la préparation (« Demande du BV 25 % » de
 *  présoumission) marquée faite — ou, à défaut de suivi d'étapes, à la présence d'un
 *  ordre de BV (hasBv) ou d'un statut avancé. Il se TERMINE à la décision (DE obtenue). */
function regStage(status: string, treatmentStarted: boolean, hasBv: boolean): "new" | "in_progress" | "done" {
  if (status === "DECISION_OBTAINED" || status === "CLOSED") return "done";
  if (treatmentStarted || hasBv || ["SUBMITTED", "AWAITING_BV_PAYMENT", "AWAITING_ANPP", "RESPONDING_TO_QUERIES", "BLOCKED"].includes(status)) return "in_progress";
  return "new";
}

export default async function RegulatoryPage() {
  const user = await requireModule("REGULATORY");
  const canCreate = userCan(user, "REGULATORY", "CREATE");
  // Confier un dossier à quelqu'un, c'est le MODIFIER : même droit que l'édition de la fiche.
  const canAssign = userCan(user, "REGULATORY", "UPDATE");
  const [products, suppliers, companies, settings, bvOrders] = await Promise.all([
    prisma.regulatoryProduct.findMany({
      where: { ...scopeRegulatory(user), ...currentCompanyWhere() },
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
    getCompanies(),
    getAppSettings(),
    // Une demande de BV de présoumission = un ordre de dépense rattaché au dossier :
    // sa présence fait basculer le dossier en « En cours de traitement ».
    prisma.expenseOrder.findMany({ where: { sourceType: "REGULATORY_PRODUCT" }, select: { sourceId: true } }),
  ]);
  const bvSet = new Set(bvOrders.map((o) => o.sourceId).filter((x): x is string => Boolean(x)));
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
      supplier: p.supplier?.name ?? "",
      category: p.category,
      // RÈGLE : une variation OBTENUE fait foi ; sinon, le niveau déclaré sur la fiche.
      manufacturingStatus: stage.status,
      manufacturingSource: stage.source,
      manufacturingPending: stage.pendingTo,
      status: p.status,
      priority: p.priority,
      responsible: p.responsible?.name ?? "",
      responsibleId: p.responsibleId ?? "",
      assistant: p.assistant?.name ?? "",
      targetSubmissionDate: p.targetSubmissionDate?.toISOString() ?? null,
      targetDate: p.targetDate?.toISOString() ?? null,
      progress: Math.round((done / total) * 100),
      stepsDone: done,
      stepsTotal: total,
      stage: regStage(p.status, regTreatmentStarted(p.workflow as RegWorkflowState | null), bvSet.has(p.id)),
    };
  });

  // Personnes à qui un dossier peut être confié : l'équipe Regulatory + la Direction. Sert au
  // formulaire de création ET au menu déroulant « Chargé du dossier » du tableau.
  const assignableUsers = canCreate || canAssign
    ? await prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: ["HEAD_OF_REGULATORY", "REGULATORY_ASSISTANT", "DIRECTION"] },
        },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Liste détaillée des fournisseurs pour le gestionnaire (création / activation).
  const supplierList = canCreate
    ? await prisma.supplier.findMany({
        select: { id: true, name: true, country: true, contactEmail: true, active: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Compté sur les produits DÉJÀ chargés — même portée, mêmes droits : on ne signale jamais un
  // dossier que la personne n'aurait pas le droit de voir, et cela évite une requête de plus.
  const unassignedCount = products.filter((p) => !p.companyId).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Regulatory"
        description="Suivi des molécules/DCI et de leur avancement réglementaire jusqu'à l'enregistrement."
      >
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <>
              <SuppliersManager suppliers={supplierList} />
              <NewProductButton users={assignableUsers} suppliers={suppliers} companies={companies} />
            </>
          )}
        </div>
      </PageHeader>

      <ModuleTabs
        tabs={[
          { label: "Dossiers", href: "/regulatory" },
          { label: "Enregistrement (CTD)", href: "/regulatory/enregistrement", show: canSeeRegEnrollment(user, settings) },
        ]}
      />

      {/* Un dossier sans entité est visible de TOUT LE MONDE en vue « toutes les entités ».
          On ne le devine pas à sa place — on le signale, pour qu'un humain le rattache. */}
      {unassignedCount > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            <strong>{unassignedCount} dossier{unassignedCount > 1 ? "s" : ""} sans entité.</strong>{" "}
            L&apos;entité détermine qui a le droit de voir un dossier : tant qu&apos;elle n&apos;est pas
            renseignée, {unassignedCount > 1 ? "ces dossiers apparaissent" : "ce dossier apparaît"} à
            toute personne en vue « toutes les entités ». Ouvrez {unassignedCount > 1 ? "-les" : "-le"} et
            renseignez l&apos;entité.
          </span>
        </p>
      )}

      <RegulatoryTable
        rows={rows}
        canEditPriority={canSupervise}
        canAssign={canAssign}
        assignableUsers={assignableUsers}
      />
    </div>
  );
}
