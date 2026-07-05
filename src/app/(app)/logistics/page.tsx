import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createLogistics } from "@/lib/actions/logistics-actions";
import { LOGISTICS_STATUS } from "@/lib/labels";
import { LogisticsTable, type LogisticsRow } from "./logistics-table";

export default async function LogisticsPage() {
  const user = await requireModule("LOGISTICS");
  const canCreate = userCan(user, "LOGISTICS", "CREATE");
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86400000);

  const [orders, inProgress, arriving, late] = await Promise.all([
    prisma.logisticsOrder.findMany({ orderBy: { estimatedArrival: "asc" } }),
    prisma.logisticsOrder.count({ where: { status: { notIn: ["DELIVERED", "BLOCKED"] } } }),
    prisma.logisticsOrder.count({ where: { estimatedArrival: { gte: now, lte: weekAhead }, status: { not: "DELIVERED" } } }),
    prisma.logisticsOrder.count({ where: { estimatedArrival: { lt: now }, status: { notIn: ["DELIVERED"] } } }),
  ]);

  const rows: LogisticsRow[] = orders.map((o) => ({
    id: o.id, reference: o.reference, product: o.product, dci: o.dci ?? "",
    supplier: o.supplier ?? "", country: o.country ?? "", quantityOrdered: o.quantityOrdered,
    status: o.status, estimatedArrival: o.estimatedArrival?.toISOString() ?? null,
    actualArrival: o.actualArrival?.toISOString() ?? null,
    orderValue: o.orderValue ? toNumber(o.orderValue) : null, currency: o.currency,
  }));

  return (
    <div className="space-y-5">
      <PageHeader title="Logistique PCH" description="Suivi des commandes PCH : dates estimées vs réelles, dédouanement et livraison.">
        {canCreate && (
          <CreateRecordButton
            label="Nouvelle commande"
            title="Nouvelle commande PCH"
            action={createLogistics}
            fields={[
              { type: "text", name: "product", label: "Produit", required: true },
              { type: "text", name: "dci", label: "DCI" },
              { type: "text", name: "dosage", label: "Dosage" },
              { type: "text", name: "supplier", label: "Fournisseur" },
              { type: "text", name: "country", label: "Pays" },
              { type: "number", name: "quantityOrdered", label: "Quantité commandée" },
              { type: "date", name: "orderDate", label: "Date de commande" },
              { type: "date", name: "estimatedDeparture", label: "Départ estimé" },
              { type: "date", name: "estimatedArrival", label: "Arrivée estimée" },
              { type: "select", name: "status", label: "Statut", options: optionsFromMap(LOGISTICS_STATUS), defaultValue: "ORDERED" },
              { type: "text", name: "carrier", label: "Transporteur" },
              { type: "text", name: "incoterm", label: "Incoterm" },
              { type: "number", name: "orderValue", label: "Valeur commande" },
              { type: "text", name: "currency", label: "Devise", defaultValue: "EUR" },
            ]}
          />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Commandes en cours" value={inProgress} icon="Package" />
        <KpiCard label="Arrivées cette semaine" value={arriving} icon="PackageCheck" tone="info" />
        <KpiCard label="En retard" value={late} icon="PackageX" tone="danger" />
        <KpiCard label="Total commandes" value={rows.length} icon="Boxes" />
      </div>

      <LogisticsTable rows={rows} />
    </div>
  );
}
