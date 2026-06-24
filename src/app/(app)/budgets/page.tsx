import { requireModule } from "@/lib/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createBudget } from "@/lib/actions/budget-actions";
import { BUDGET_CATEGORY } from "@/lib/labels";
import { BudgetsTable, type BudgetRow } from "./budgets-table";

export default async function BudgetsPage() {
  const user = await requireModule("BUDGETS");
  const canCreate = can(user.role, "BUDGETS", "CREATE");
  const year = new Date().getFullYear();

  const lines = await prisma.budgetLine.findMany({ orderBy: [{ year: "desc" }, { department: "asc" }] });

  const rows: BudgetRow[] = lines.map((l) => {
    const initial = toNumber(l.initialBudget);
    const consumed = toNumber(l.consumedBudget);
    return {
      id: l.id, year: l.year, month: l.month, department: l.department, label: l.label,
      initial, consumed, remaining: initial - consumed, future: toNumber(l.futureCommitted), status: l.status,
    };
  });

  const yearRows = rows.filter((r) => r.year === year);
  const totalInitial = yearRows.reduce((a, r) => a + r.initial, 0);
  const totalConsumed = yearRows.reduce((a, r) => a + r.consumed, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Budgets" description="Suivi des budgets internes par département : prévu vs réel.">
        {canCreate && (
          <CreateRecordButton
            label="Nouvelle ligne"
            title="Nouvelle ligne budgétaire"
            action={createBudget}
            fields={[
              { type: "number", name: "year", label: "Année", defaultValue: year, required: true },
              { type: "number", name: "month", label: "Mois (1-12, vide = annuel)" },
              { type: "select", name: "department", label: "Département", options: optionsFromMap(BUDGET_CATEGORY), required: true },
              { type: "text", name: "label", label: "Ligne budgétaire", required: true, full: true },
              { type: "number", name: "initialBudget", label: "Budget initial (DZD)" },
              { type: "number", name: "consumedBudget", label: "Budget consommé (DZD)" },
              { type: "number", name: "futureCommitted", label: "Engagements futurs (DZD)" },
              { type: "textarea", name: "comments", label: "Commentaires" },
            ]}
          />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={`Budget initial ${year}`} value={formatCurrency(totalInitial)} icon="Wallet" />
        <KpiCard label="Consommé" value={formatCurrency(totalConsumed)} icon="CreditCard" tone="warning" />
        <KpiCard label="Restant" value={formatCurrency(totalInitial - totalConsumed)} icon="PiggyBank" tone="success" />
        <KpiCard label="Lignes" value={yearRows.length} icon="ListChecks" />
      </div>

      <BudgetsTable rows={rows} />
    </div>
  );
}
