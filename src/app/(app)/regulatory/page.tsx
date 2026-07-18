import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, scopeRegulatory } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { regProgress, type RegWorkflowState } from "@/lib/regulatory-workflow";
import { currentCompanyWhere, getCompanies } from "@/lib/company";
import { getAppSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { PHARMA_FORM, DOSAGE_UNIT } from "@/lib/labels";
import { RegulatoryTable, type RegulatoryRow } from "./regulatory-table";
import { NewProductButton } from "./new-product";
import { SuppliersManager } from "./suppliers-manager";

/** Étape de traitement d'un dossier : Nouveau → En cours (BV présoumission) → Terminé (DE). */
function regStage(status: string, hasBv: boolean): "new" | "in_progress" | "done" {
  if (status === "DECISION_OBTAINED" || status === "CLOSED") return "done";
  if (hasBv || ["SUBMITTED", "AWAITING_BV_PAYMENT", "AWAITING_ANPP", "RESPONDING_TO_QUERIES", "BLOCKED"].includes(status)) return "in_progress";
  return "new";
}

export default async function RegulatoryPage() {
  const user = await requireModule("REGULATORY");
  const canCreate = userCan(user, "REGULATORY", "CREATE");

  const canUpdate = userCan(user, "REGULATORY", "UPDATE");
  const [products, suppliers, companies, settings, bvOrders] = await Promise.all([
    prisma.regulatoryProduct.findMany({
      where: { ...scopeRegulatory(user), ...currentCompanyWhere() },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      include: {
        responsible: { select: { name: true } },
        assistant: { select: { name: true } },
        supplier: { select: { name: true } },
        company: { select: { id: true, name: true, shortName: true, color: true } },
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

  const rows: RegulatoryRow[] = products.map((p) => {
    const prog = regProgress(p.workflow as RegWorkflowState | null);
    const done = prog.done;
    const total = prog.total;
    const dosage = [p.dosage, p.dosageUnit ? DOSAGE_UNIT[p.dosageUnit] ?? p.dosageUnit : null]
      .filter(Boolean)
      .join(" ");
    return {
      id: p.id,
      reference: p.reference,
      dci: p.dci,
      brandName: p.brandName ?? "",
      dosage,
      form: p.pharmaceuticalForm ? PHARMA_FORM[p.pharmaceuticalForm] ?? p.pharmaceuticalForm : "",
      therapeuticClass: p.therapeuticClass ?? "",
      supplier: p.supplier?.name ?? "",
      category: p.category,
      manufacturingStatus: p.manufacturingStatus,
      status: p.status,
      priority: p.priority,
      responsible: p.responsible?.name ?? "",
      assistant: p.assistant?.name ?? "",
      targetDate: p.targetDate?.toISOString() ?? null,
      progress: Math.round((done / total) * 100),
      stepsDone: done,
      stepsTotal: total,
      stage: regStage(p.status, bvSet.has(p.id)),
    };
  });

  // Assignable users for the create form (regulatory team + leadership).
  const assignableUsers = canCreate
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Regulatory"
        description="Suivi des molécules/DCI et de leur avancement réglementaire jusqu'à l'enregistrement."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/regulatory/requests" className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-secondary">
            <MessageSquareText className="h-4 w-4" /> Demandes info médicale
          </Link>
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
          { label: "Enregistrement (CTD)", href: "/regulatory/enregistrement", show: settings.regEnrollmentEnabled },
        ]}
      />

      <RegulatoryTable rows={rows} canEditPriority={canUpdate} />
    </div>
  );
}
