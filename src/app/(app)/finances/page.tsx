import Link from "next/link";
import { Users, ReceiptText } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getFinanceData } from "@/lib/queries/finance";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { TrendChart, DonutChart } from "@/components/dashboard/charts";
import { createTransaction } from "@/lib/actions/finance-actions";
import { FINANCE_CATEGORY, FINANCE_DIRECTION, FINANCE_METHOD, FINANCE_STATUS } from "@/lib/labels";
import { formatCurrency } from "@/lib/utils";
import { LedgerTable } from "./ledger-table";
import { RecettesDepensesChart } from "./finance-charts";
import { ImportTransactionsButton } from "./import-transactions";

const DONUT_COLORS = ["#dc2626", "#d97706", "#7c3aed", "#2563eb", "#0891b2", "#db2777", "#65a30d", "#0d9488", "#9333ea", "#475569"];

export default async function FinancesPage() {
  const user = await requireModule("FINANCES");
  const canCreate = userCan(user, "FINANCES", "CREATE");
  const data = await getFinanceData();
  const pendingOrders = await prisma.expenseOrder.count({ where: { status: "PENDING" } });

  return (
    <div className="space-y-6">
      <PageHeader title="Finances" description="Trésorerie, livre comptable et paie — la situation financière en temps réel.">
        <Link href="/finances/ordres-de-depense">
          <Button variant="outline">
            <ReceiptText className="h-4 w-4" /> Ordres de dépense
            {pendingOrders > 0 && <span className="ml-1 rounded-full bg-warning/20 px-1.5 text-xs font-semibold text-warning">{pendingOrders}</span>}
          </Button>
        </Link>
        <Link href="/finances/paie"><Button variant="outline"><Users className="h-4 w-4" /> Paie</Button></Link>
        {canCreate && (
          <>
            <ImportTransactionsButton />
            <CreateRecordButton
              label="Nouvelle écriture"
              title="Nouvelle écriture comptable"
              description="Recette, dépense, apport (CCA), prêt, salaire…"
              action={createTransaction}
              fields={[
                { type: "date", name: "date", label: "Date", required: true },
                { type: "select", name: "direction", label: "Sens", options: optionsFromMap(FINANCE_DIRECTION), defaultValue: "OUT" },
                { type: "select", name: "category", label: "Catégorie", options: optionsFromMap(FINANCE_CATEGORY), defaultValue: "FOURNISSEUR" },
                { type: "text", name: "label", label: "Libellé", required: true, full: true },
                { type: "number", name: "amount", label: "Montant (DZD)", required: true },
                { type: "select", name: "method", label: "Moyen de paiement", options: optionsFromMap(FINANCE_METHOD), defaultValue: "BANK_TRANSFER" },
                { type: "text", name: "account", label: "Compte", defaultValue: "Banque" },
                { type: "text", name: "counterparty", label: "Tiers (client / fournisseur)" },
                { type: "text", name: "invoiceRef", label: "Réf. facture" },
                { type: "select", name: "status", label: "Statut", options: optionsFromMap(FINANCE_STATUS), defaultValue: "SETTLED" },
                { type: "textarea", name: "notes", label: "Notes" },
              ]}
            />
          </>
        )}
      </PageHeader>

      {/* Treasury KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Solde trésorerie" value={formatCurrency(data.totalBalance)} icon="Landmark" tone={data.totalBalance >= 0 ? "success" : "danger"} />
        <KpiCard label="Encaissements (mois)" value={formatCurrency(data.encMonth)} icon="TrendingUp" tone="success" />
        <KpiCard label="Décaissements (mois)" value={formatCurrency(data.decMonth)} icon="TrendingDown" tone="danger" />
        <KpiCard label="À encaisser (prévu)" value={formatCurrency(data.pendingIn)} icon="Hourglass" tone="info" />
        <KpiCard label="À régler (prévu)" value={formatCurrency(data.pendingOut)} icon="Clock" tone="warning" />
      </div>

      {data.accounts.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {data.accounts.map((a) => (
            <div key={a.account} className="surface flex items-center gap-3 px-4 py-2.5">
              <span className="text-sm text-muted-foreground">{a.account}</span>
              <span className={`font-semibold ${a.balance >= 0 ? "text-foreground" : "text-destructive"}`}>{formatCurrency(a.balance)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Évolution de la trésorerie</CardTitle><CardDescription>Solde cumulé (6 mois)</CardDescription></CardHeader>
          <CardContent><TrendChart data={data.trend} color="#1e293b" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recettes vs Dépenses</CardTitle><CardDescription>Par mois (6 mois)</CardDescription></CardHeader>
          <CardContent><RecettesDepensesChart data={data.recVsDep} /></CardContent>
        </Card>
      </div>

      {data.byCategoryOut.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Répartition des dépenses par poste</CardTitle></CardHeader>
          <CardContent>
            <DonutChart
              data={data.byCategoryOut.slice(0, 10).map((c, i) => ({
                label: FINANCE_CATEGORY[c.category] ?? c.category,
                value: Math.round(c.amount),
                color: DONUT_COLORS[i % DONUT_COLORS.length],
              }))}
            />
          </CardContent>
        </Card>
      )}

      {/* Ledger */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Livre comptable</h2>
        <LedgerTable rows={data.rows} />
      </section>
    </div>
  );
}
