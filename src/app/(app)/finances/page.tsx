import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { requireModule } from "@/lib/session";
import { hasGlobalView } from "@/lib/rbac";
import { getFinanceData } from "@/lib/queries/finance";
import { getComptaData } from "@/lib/queries/compta";
import { ComptaCockpit } from "./compta-cockpit";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendChart } from "@/components/dashboard/charts";
import { FINANCES_TABS } from "@/lib/labels";
import { formatCurrency } from "@/lib/utils";
import { RecettesDepensesChart } from "./finance-charts";
import { TreasuryUpdateRequestButton } from "./treasury-update-request";

export const dynamic = "force-dynamic";

/**
 * FINANCES — LE TABLEAU DE BORD. Ce qu'on regarde, pas ce qu'on saisit.
 *
 * Le module portait trois métiers sur une seule page : la situation de trésorerie, la file des
 * règlements et le livre comptable. Celui qui PAIE et celui qui TIENT LES COMPTES s'y disputaient
 * le défilement, et la question « où en est-on ? » se noyait sous deux tableaux.
 *
 * Trois sous-modules, dans l'ordre où l'on y passe — Dashboard, Paiements à faire, Comptabilité —,
 * atteignables par les onglets ET par les flèches. Ici : les soldes, ce que le DAF doit traiter,
 * et les courbes. Rien qui s'écrive.
 */
export default async function FinancesPage() {
  const user = await requireModule("FINANCES");
  const [data, compta, tabs] = await Promise.all([
    getFinanceData(user.id),
    getComptaData(user.id),
    visibleTabs(user, FINANCES_TABS),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finances"
        description="Trésorerie, ce qu'il reste à traiter et l'évolution des flux. Les règlements et le livre comptable ont leur propre écran. La paie est tenue par les Ressources humaines."
      >
        <Link href="/finances/factures">
          <Button variant="outline"><ReceiptText className="h-4 w-4" /> Factures</Button>
        </Link>
        {/* L'administration DEMANDE l'actualisation ; les Finances la font. */}
        {(user.role === "SUPER_ADMIN" || hasGlobalView(user)) && <TreasuryUpdateRequestButton />}
      </PageHeader>
      <ModuleTabs tabs={tabs} arrows />

      {/* Treasury KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Solde trésorerie" value={formatCurrency(data.totalBalance)} icon="Landmark" tone={data.totalBalance >= 0 ? "success" : "danger"} />
        <KpiCard label="Encaissements (mois)" value={formatCurrency(data.encMonth)} icon="TrendingUp" tone="success" />
        <KpiCard label="Décaissements (mois)" value={formatCurrency(data.decMonth)} icon="TrendingDown" tone="danger" />
        <KpiCard label="À encaisser (prévu)" value={formatCurrency(data.pendingIn)} icon="Hourglass" tone="info" />
        <KpiCard label="À régler (prévu)" value={formatCurrency(data.pendingOut)} icon="Clock" tone="warning" />
      </div>

      {data.accounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {data.accounts.map((a) => (
            <div key={a.account} className="surface flex items-center gap-3 px-4 py-2.5">
              <span className="text-sm text-muted-foreground">{a.account}</span>
              <span className={`font-semibold ${a.balance >= 0 ? "text-foreground" : "text-destructive"}`}>{formatCurrency(a.balance)}</span>
            </div>
          ))}
          {data.openingTotal !== 0 && (
            <span className="text-xs text-muted-foreground">dont {formatCurrency(data.openingTotal)} de solde d&apos;ouverture + flux réglés</span>
          )}
        </div>
      )}

      {/* Ce que le DAF doit traiter — le cockpit reste au tableau de bord : c'est de la lecture. */}
      <ComptaCockpit d={compta} />

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
    </div>
  );
}
