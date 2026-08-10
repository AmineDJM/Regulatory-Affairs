import { requireModule } from "@/lib/session";
import { userCan, scopeSales } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency } from "@/lib/utils";
import { currentCompanyWhere, getCompanies, companyOptions } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { KpiCard } from "@/components/shared/kpi-card";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { SALE_TYPE, COMMERCE_TABS } from "@/lib/labels";
import { createSale } from "@/lib/actions/sales-actions";
import { SalesTable, type SaleRow } from "./sales-table";
import { ImportSalesButton } from "./import-sales";

export default async function SalesPage() {
  const user = await requireModule("SALES");
  const canCreate = userCan(user, "SALES", "CREATE");
  const where = { ...scopeSales(user), ...currentCompanyWhere() };
  const companies = await getCompanies();

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { date: "desc" },
    take: 500,
    include: { salesUser: { select: { name: true } } },
  });

  const rows: SaleRow[] = sales.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    saleType: s.saleType,
    product: s.product,
    dci: s.dci ?? "",
    client: s.client,
    institution: s.institution ?? "",
    isPch: s.isPch,
    quantity: s.quantity,
    unitPrice: toNumber(s.unitPrice),
    revenue: toNumber(s.revenue),
    paymentStatus: s.paymentStatus,
    deliveryStatus: s.deliveryStatus,
    salesUser: s.salesUser?.name ?? "",
  }));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const caMonth = rows.filter((r) => new Date(r.date) >= monthStart).reduce((a, r) => a + r.revenue, 0);
  const caYear = rows.filter((r) => new Date(r.date).getFullYear() === now.getFullYear()).reduce((a, r) => a + r.revenue, 0);
  const pchRevenue = rows.filter((r) => r.isPch).reduce((a, r) => a + r.revenue, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Ventes" description="Suivi du chiffre d'affaires pharma / PCH, import et export Excel.">
        {canCreate && (
          <>
            <ImportSalesButton />
            <CreateRecordButton
              label="Nouvelle vente"
              title="Enregistrer une vente"
              action={createSale}
              fields={[
                { type: "date", name: "date", label: "Date", required: true },
                { type: "select", name: "saleType", label: "Nature", options: optionsFromMap(SALE_TYPE), defaultValue: "PRODUCT" },
                { type: "select", name: "companyId", label: "Entité", options: companyOptions(companies), placeholder: "— Entité —" },
                { type: "text", name: "product", label: "Désignation (produit / service)", required: true, full: true },
                { type: "textarea", name: "serviceDescription", label: "Détail du service (si service)", full: true },
                { type: "text", name: "dci", label: "DCI (si produit)" },
                { type: "text", name: "dosage", label: "Dosage" },
                { type: "text", name: "pharmaceuticalForm", label: "Forme" },
                { type: "text", name: "client", label: "Client", required: true },
                { type: "text", name: "institution", label: "Institution" },
                { type: "number", name: "quantity", label: "Quantité" },
                { type: "number", name: "unitPrice", label: "Prix unitaire (DZD)" },
                { type: "number", name: "estimatedMargin", label: "Marge estimée (DZD)" },
                { type: "checkbox", name: "isPch", label: "Vente PCH" },
              ]}
            />
          </>
        )}
      </PageHeader>
      <ModuleTabs tabs={COMMERCE_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="CA mensuel" value={formatCurrency(caMonth)} icon="TrendingUp" tone="success" />
        <KpiCard label="CA annuel" value={formatCurrency(caYear)} icon="Coins" />
        <KpiCard label="Ventes PCH" value={formatCurrency(pchRevenue)} icon="Building2" tone="info" />
        <KpiCard label="Transactions" value={rows.length} icon="ShoppingCart" />
      </div>

      <SalesTable rows={rows} />
    </div>
  );
}
