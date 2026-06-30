import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getStockData, getProductOptions } from "@/lib/queries/stock";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { PCH_OPS_TABS } from "@/lib/labels";
import { formatNumber, formatDate } from "@/lib/utils";
import { StockMovements } from "./stock-movements";
import { StockOpeningLevels } from "./stock-openings";

export default async function StocksPage() {
  const user = await requireModule("STOCKS");
  const canCreate = userCan(user, "STOCKS", "CREATE");
  const canEdit = userCan(user, "STOCKS", "UPDATE");
  const canDelete = userCan(user, "STOCKS", "DELETE");
  const [{ movements, levels, openings, stats }, products] = await Promise.all([getStockData(), getProductOptions()]);

  return (
    <div className="space-y-5">
      <PageHeader title="Stocks PCH" description="Suivi des niveaux de stock de nos produits à la PCH : entrées, sorties et niveau courant par produit." />

      <ModuleTabs tabs={PCH_OPS_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Produits suivis" value={stats.products} icon="Boxes" />
        <KpiCard label="Unités en stock" value={formatNumber(stats.totalUnits)} icon="Package" tone="info" />
        <KpiCard label="Niveaux négatifs" value={stats.negative} icon="AlertTriangle" tone={stats.negative > 0 ? "danger" : "default"} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Niveau courant par produit</h2>
        {levels.length === 0 ? (
          <EmptyState icon="Boxes" title="Aucun stock suivi" description={canCreate ? "Ajoutez un mouvement (entrée) pour commencer le suivi." : "Les niveaux de stock apparaîtront ici."} />
        ) : (
          <div className="surface overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead><TableHead>DCI</TableHead><TableHead>Lieu</TableHead>
                  <TableHead className="text-right">Niveau</TableHead><TableHead>Dernier mouvement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((l) => (
                  <TableRow key={`${l.product}-${l.location}`}>
                    <TableCell className="font-medium">{l.product}</TableCell>
                    <TableCell className="text-muted-foreground">{l.dci || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{l.location}</TableCell>
                    <TableCell className={`text-right font-semibold ${l.balance < 0 ? "text-destructive" : ""}`}>{formatNumber(l.balance)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(l.lastDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <StockOpeningLevels openings={openings} products={products} canEdit={canEdit} />

      <StockMovements movements={movements} products={products} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
    </div>
  );
}
