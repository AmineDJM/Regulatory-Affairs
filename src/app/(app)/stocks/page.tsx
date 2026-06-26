import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getStockData } from "@/lib/queries/stock";
import { createStockMovement } from "@/lib/actions/stock-actions";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { STOCK_DIRECTION } from "@/lib/labels";
import { formatNumber, formatDate } from "@/lib/utils";
import { DeleteMovementButton } from "./delete-button";

export default async function StocksPage() {
  const user = await requireModule("STOCKS");
  const canCreate = userCan(user, "STOCKS", "CREATE");
  const canDelete = userCan(user, "STOCKS", "DELETE");
  const { movements, levels, stats } = await getStockData();

  return (
    <div className="space-y-5">
      <PageHeader title="Stocks PCH" description="Suivi des niveaux de stock de nos produits à la PCH : entrées, sorties et niveau courant par produit.">
        {canCreate && (
          <CreateRecordButton
            label="Nouveau mouvement"
            title="Mouvement de stock"
            width="md"
            action={createStockMovement}
            fields={[
              { type: "text", name: "product", label: "Produit", required: true, full: true },
              { type: "text", name: "dci", label: "DCI" },
              { type: "select", name: "direction", label: "Type", options: optionsFromMap(STOCK_DIRECTION), defaultValue: "IN" },
              { type: "number", name: "quantity", label: "Quantité", required: true },
              { type: "date", name: "date", label: "Date" },
              { type: "text", name: "location", label: "Lieu", defaultValue: "PCH" },
              { type: "textarea", name: "notes", label: "Notes", full: true },
            ]}
          />
        )}
      </PageHeader>

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

      {movements.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Historique des mouvements ({movements.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Produit</TableHead><TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantité</TableHead><TableHead>Lieu</TableHead><TableHead>Notes</TableHead>{canDelete && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">{formatDate(m.date)}</TableCell>
                    <TableCell className="font-medium">{m.product}{m.dci && <span className="text-xs text-muted-foreground"> · {m.dci}</span>}</TableCell>
                    <TableCell><StatusBadge map={STOCK_DIRECTION} value={m.direction} dot={false} /></TableCell>
                    <TableCell className="text-right">{formatNumber(m.quantity)}</TableCell>
                    <TableCell className="text-muted-foreground">{m.location}</TableCell>
                    <TableCell className="text-muted-foreground">{m.notes || "—"}</TableCell>
                    {canDelete && <TableCell className="text-right"><DeleteMovementButton id={m.id} /></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
