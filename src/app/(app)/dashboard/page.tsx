import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getDashboardData } from "@/lib/queries/dashboard";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { TrendChart, DonutChart, MiniBarChart } from "@/components/dashboard/charts";
import { ROLE_LABELS, REGULATORY_STATUS, BUDGET_CATEGORY, WORKSPACE_TABS } from "@/lib/labels";
import { formatCurrency, formatCompact, percent } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  PRE_SUBMISSION: "#94a3b8",
  IN_PREPARATION: "#60a5fa",
  SUBMITTED: "#3b82f6",
  AWAITING_BV_PAYMENT: "#f59e0b",
  AWAITING_ANPP: "#fbbf24",
  RESPONDING_TO_QUERIES: "#f97316",
  DECISION_OBTAINED: "#16a34a",
  BLOCKED: "#dc2626",
  CLOSED: "#0d9488",
};

export default async function DashboardPage() {
  const user = await requireModule("DASHBOARD");
  const data = await getDashboardData(user);

  return (
    <div className="space-y-7">
      <ModuleTabs tabs={await visibleTabs(user, WORKSPACE_TABS)} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bonjour {user.name.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          Voici la synthèse de votre activité — {ROLE_LABELS[user.role] ?? user.role}.
        </p>
      </div>

      {/* Regulatory */}
      {data.regulatory && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Regulatory
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <KpiCard label="Dossiers" value={data.regulatory.total} icon="FileCheck2" />
            <KpiCard label="Pré-soumission" value={data.regulatory.preSubmission} icon="FileClock" tone="info" />
            <KpiCard label="Déposés" value={data.regulatory.submitted} icon="Send" tone="info" />
            <KpiCard label="Attente BV/ANPP" value={data.regulatory.awaitingBV + data.regulatory.awaitingANPP} icon="Clock" tone="warning" />
            <KpiCard label="Décisions" value={data.regulatory.decisions} icon="BadgeCheck" tone="success" />
            <KpiCard label="Bloqués / Retard" value={data.regulatory.blocked + data.regulatory.late} icon="AlertTriangle" tone="danger" />
          </div>
          {data.regulatory.byStatus.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Répartition des dossiers par statut</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  data={data.regulatory.byStatus.map((s) => ({
                    label: REGULATORY_STATUS[s.status]?.label ?? s.status,
                    value: s.count,
                    color: STATUS_COLORS[s.status] ?? "#94a3b8",
                  }))}
                />
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Sales */}
      {data.sales && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Ventes
          </h2>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-3 lg:col-span-1">
              <KpiCard label="CA mensuel" value={formatCompact(data.sales.caMonth)} icon="TrendingUp" tone="success" hint="DZD" />
              <KpiCard label="CA annuel" value={formatCompact(data.sales.caYear)} icon="Coins" hint="DZD" />
              <KpiCard label="Ventes PCH" value={formatCompact(data.sales.pchRevenue)} icon="Building2" tone="info" hint="DZD" />
              <KpiCard label="Commandes" value={data.sales.orders} icon="ShoppingCart" />
            </div>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Chiffre d&apos;affaires (6 mois)</CardTitle>
                <CardDescription>Évolution mensuelle du CA en DZD</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart data={data.sales.monthlySeries} color="#16a34a" />
              </CardContent>
            </Card>
          </div>
          {data.sales.topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top produits</CardTitle>
              </CardHeader>
              <CardContent>
                <MiniBarChart data={data.sales.topProducts} />
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Logistics */}
      {data.logistics && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Logistique PCH
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <KpiCard label="Commandes en cours" value={data.logistics.inProgress} icon="Package" />
            <KpiCard label="Arrivées cette semaine" value={data.logistics.arrivingThisWeek} icon="PackageCheck" tone="info" />
            <KpiCard label="Arrivées en retard" value={data.logistics.lateOrders} icon="PackageX" tone="danger" />
            <KpiCard label="Livraisons PCH prévues" value={data.logistics.pchPlanned} icon="Truck" />
            <KpiCard label="Valeur commandes" value={formatCompact(data.logistics.totalValue)} icon="Wallet" hint="toutes devises" />
          </div>
        </section>
      )}

      {/* Budgets */}
      {data.budgets && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Budgets {new Date().getFullYear()}
          </h2>
          <div className="grid gap-3 lg:grid-cols-3">
            <KpiCard label="Budget initial" value={formatCompact(data.budgets.initial)} icon="Wallet" hint="DZD" />
            <KpiCard label="Consommé" value={formatCompact(data.budgets.consumed)} icon="CreditCard" tone="warning" hint="DZD" />
            <KpiCard label="Restant" value={formatCompact(data.budgets.remaining)} icon="PiggyBank" tone="success" hint="DZD" />
          </div>
          {data.budgets.byDepartment.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Consommation par département</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.budgets.byDepartment.map((d) => (
                  <div key={d.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{BUDGET_CATEGORY[d.label] ?? d.label}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(d.consumed)} / {formatCurrency(d.initial)}
                      </span>
                    </div>
                    <Progress
                      value={percent(d.consumed, d.initial)}
                      tone={
                        percent(d.consumed, d.initial) > 95
                          ? "danger"
                          : percent(d.consumed, d.initial) > 80
                            ? "warning"
                            : "success"
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Secondary grid: Sponsoring / Medical / BD / Congress */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.sponsoring && (
          <Card>
            <CardHeader>
              <CardTitle>Sponsoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="En attente" value={data.sponsoring.pending} />
              <Row label="Accordés" value={data.sponsoring.accepted} />
              <Row label="Budget accordé" value={formatCurrency(data.sponsoring.granted)} />
            </CardContent>
          </Card>
        )}
        {data.medical && (
          <Card>
            <CardHeader>
              <CardTitle>Annuaire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Visites prévues" value={data.medical.planned} />
              <Row label="Visites réalisées (mois)" value={data.medical.completed} />
              <Row label="À venir" value={data.medical.upcoming} />
            </CardContent>
          </Card>
        )}
        {data.bd && (
          <Card>
            <CardHeader>
              <CardTitle>Business Development</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Opportunités en cours" value={data.bd.inProgress} />
              <Row label="Prioritaires" value={data.bd.priority} />
            </CardContent>
          </Card>
        )}
        {data.congress && (
          <Card>
            <CardHeader>
              <CardTitle>Congrès à venir</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Internationaux" value={data.congress.upcomingInternational} />
              <Row label="Nationaux" value={data.congress.upcomingNational} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
