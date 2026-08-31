import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getFinanceData } from "@/lib/queries/finance";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createTransaction, createQuickIncome } from "@/lib/actions/finance-actions";
import { FINANCE_CATEGORY, FINANCE_DIRECTION, FINANCE_METHOD, FINANCE_STATUS, FINANCES_TABS } from "@/lib/labels";
import { getMyCompanies, companyOptions } from "@/lib/company";
import { LedgerTable } from "../ledger-table";
import { ImportTransactionsButton } from "../import-transactions";
import { OpeningBalancesButton } from "../opening-balances";

export const dynamic = "force-dynamic";

/**
 * COMPTABILITÉ — le livre, et rien d'autre.
 *
 * Tenir les comptes et régler les fournisseurs sont deux métiers, faits par deux personnes, à
 * deux moments : les avoir mis sur la même page obligeait le comptable à défiler sous les
 * règlements pour atteindre ses écritures, et le payeur à défiler sous le livre pour atteindre
 * sa file. On garde ici ce qui S'ÉCRIT : les écritures, l'import, les soldes d'ouverture.
 */
export default async function ComptabilitePage() {
  const user = await requireModule("FINANCES");
  const canCreate = userCan(user, "FINANCES", "CREATE");
  const canUpdate = userCan(user, "FINANCES", "UPDATE");
  const canDelete = userCan(user, "FINANCES", "DELETE");
  const [data, companies, tabs] = await Promise.all([
    getFinanceData(user.id),
    getMyCompanies(user.id),
    visibleTabs(user, FINANCES_TABS),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Finances — Comptabilité" description="Le livre comptable : écritures, import de relevés et soldes d'ouverture.">
        {canUpdate && <OpeningBalancesButton items={data.openingBalances} openingTotal={data.openingTotal} />}
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
      <ModuleTabs tabs={tabs} arrows />

      <LedgerTable rows={data.rows} canUpdate={canUpdate} canDelete={canDelete} />
    </div>
  );
}
