import Link from "next/link";
import { ReceiptText, Banknote } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getFinanceData } from "@/lib/queries/finance";
import { getComptaData } from "@/lib/queries/compta";
import { ComptaCockpit } from "./compta-cockpit";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { TrendChart, DonutChart } from "@/components/dashboard/charts";
import { createTransaction, createQuickIncome } from "@/lib/actions/finance-actions";
import { FINANCE_CATEGORY, FINANCE_DIRECTION, FINANCE_METHOD, FINANCE_STATUS } from "@/lib/labels";
import { getMyCompanies, companyOptions } from "@/lib/company";
import { formatCurrency } from "@/lib/utils";
import { LedgerTable } from "./ledger-table";
import { RecettesDepensesChart } from "./finance-charts";
import { ImportTransactionsButton } from "./import-transactions";
import { OpeningBalancesButton } from "./opening-balances";
import { TreasuryUpdateRequestButton } from "./treasury-update-request";

const DONUT_COLORS = ["#dc2626", "#d97706", "#7c3aed", "#2563eb", "#0891b2", "#db2777", "#65a30d", "#0d9488", "#9333ea", "#475569"];

export default async function FinancesPage() {
  const user = await requireModule("FINANCES");
  const canCreate = userCan(user, "FINANCES", "CREATE");
  const canUpdate = userCan(user, "FINANCES", "UPDATE");
  const canDelete = userCan(user, "FINANCES", "DELETE");
  const [data, compta] = await Promise.all([getFinanceData(user.id), getComptaData(user.id)]);
  const pendingOrders = await prisma.expenseOrder.count({ where: { status: "PENDING" } });
  const companies = await getMyCompanies(user.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Finances" description="Cockpit du DAF : règlements à effectuer, recettes à encaisser, trésorerie et livre comptable. La paie est tenue par les Ressources humaines.">
        {/* Les deux écrans du module vivent ICI, pas dans le menu latéral : la page Finances
            reste la porte unique, et l'on y trouve ce qui reste à payer d'un coup d'œil. */}
        <Link href="/finances/ordres-de-depense">
          <Button variant="outline">
            <Banknote className="h-4 w-4" /> Règlements à effectuer
            {pendingOrders > 0 && <span className="ml-1 rounded-full bg-warning/20 px-1.5 text-xs font-semibold text-warning">{pendingOrders}</span>}
          </Button>
        </Link>
        {/* Les DEMANDES DE PAIEMENT se déposent depuis les Demandes de validations, et le CENTRE
            DE PAIEMENT est un module à part (menu latéral, PDG + Super Admin) : les Finances ne
            voient un paiement qu'une fois autorisé — il arrive alors dans les Règlements. */}
        <Link href="/finances/factures">
          <Button variant="outline"><ReceiptText className="h-4 w-4" /> Factures</Button>
        </Link>
        {canUpdate && <OpeningBalancesButton items={data.openingBalances} openingTotal={data.openingTotal} />}
        {/* L'administration DEMANDE l'actualisation ; les Finances la font. */}
        {(user.role === "SUPER_ADMIN" || hasGlobalView(user)) && <TreasuryUpdateRequestButton />}
        {canCreate && (
          <>
            {/* ENCAISSEMENT SIMPLE — cinq champs. Le formulaire complet reste à côté pour la
                saisie comptable soignée ; encaisser un règlement client ne doit pas l'exiger. */}
            <CreateRecordButton
              label="Encaissement"
              title="Nouvel encaissement"
              description="Un règlement reçu : date, référence, libellé, montant, client. Le reste est implicite (recette réglée, virement bancaire)."
              action={createQuickIncome}
              fields={[
                { type: "date", name: "date", label: "Date", required: true },
                { type: "text", name: "reference", label: "Référence", placeholder: "Reçu / virement — laissez vide pour une référence automatique" },
                { type: "text", name: "label", label: "Libellé", required: true, full: true },
                { type: "number", name: "amount", label: "Montant (DZD)", required: true },
                { type: "text", name: "client", label: "Client" },
                { type: "select", name: "companyId", label: "Entité", options: companyOptions(companies), placeholder: "— Entité —" },
              ]}
            />
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
                { type: "select", name: "companyId", label: "Entité", options: companyOptions(companies), placeholder: "— Entité —" },
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
        <div className="flex flex-wrap items-center gap-3">
          {data.accounts.map((a) => (
            <div key={a.account} className="surface flex items-center gap-3 px-4 py-2.5">
              <span className="text-sm text-muted-foreground">{a.account}</span>
              <span className={`font-semibold ${a.balance >= 0 ? "text-foreground" : "text-destructive"}`}>{formatCurrency(a.balance)}</span>
            </div>
          ))}
          {data.openingTotal !== 0 && (
            <span className="text-xs text-muted-foreground">dont {formatCurrency(data.openingTotal)} de solde d'ouverture + flux réglés</span>
          )}
        </div>
      )}

      {/* Espace comptable intégré : ce que le DAF doit traiter */}
      <ComptaCockpit d={compta} />

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
        <LedgerTable rows={data.rows} canUpdate={canUpdate} canDelete={canDelete} />
      </section>
    </div>
  );
}
