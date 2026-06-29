"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { createStockMovement, updateStockMovement, deleteStockMovement } from "@/lib/actions/stock-actions";
import type { StockMovementDTO, ProductOption } from "@/lib/queries/stock";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STOCK_DIRECTION } from "@/lib/labels";
import { formatNumber, formatDate } from "@/lib/utils";

const DIRS = Object.entries(STOCK_DIRECTION).map(([value, d]) => ({ value, label: d.label }));
const d10 = (iso: string) => iso.slice(0, 10);

export function StockMovements({
  movements, products, canCreate, canEdit, canDelete,
}: {
  movements: StockMovementDTO[];
  products: ProductOption[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [sheet, setSheet] = React.useState<null | { mode: "create" } | { mode: "edit"; m: StockMovementDTO }>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Produit sélectionné dans le formulaire (pour pré-remplir la DCI) ; "" = saisie libre.
  const initialProductId = sheet?.mode === "edit" ? (sheet.m.productId ?? "") : (products[0]?.id ?? "");
  const [productId, setProductId] = React.useState<string>(initialProductId);

  React.useEffect(() => {
    setProductId(sheet?.mode === "edit" ? (sheet.m.productId ?? "") : (products[0]?.id ?? ""));
    setError(null);
  }, [sheet, products]);

  const selectedDci = products.find((p) => p.id === productId)?.dci ?? "";

  async function remove(id: string) {
    if (!window.confirm("Supprimer ce mouvement de stock ?")) return;
    const fd = new FormData(); fd.set("id", id);
    await deleteStockMovement(fd);
    router.refresh();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Historique des mouvements ({movements.length})</h2>
        {canCreate && <Button size="sm" onClick={() => setSheet({ mode: "create" })}><Plus className="h-4 w-4" /> Nouveau mouvement</Button>}
      </div>

      {movements.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Aucun mouvement. Ajoutez une entrée pour démarrer le suivi.</p>
      ) : (
        <div className="surface overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Produit</TableHead><TableHead>Type</TableHead>
                <TableHead className="text-right">Quantité</TableHead><TableHead>Lieu</TableHead><TableHead>Notes</TableHead>
                {(canEdit || canDelete) && <TableHead></TableHead>}
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
                  {(canEdit || canDelete) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canEdit && <button onClick={() => setSheet({ mode: "edit", m })} title="Modifier" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>}
                        {canDelete && <button onClick={() => remove(m.id)} title="Supprimer" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={sheet !== null} onClose={() => !busy && setSheet(null)} title={sheet?.mode === "edit" ? "Modifier le mouvement" : "Nouveau mouvement de stock"} width="md">
        {sheet && (
          <form
            action={async (fd) => {
              setBusy(true); setError(null);
              let r;
              if (sheet.mode === "edit") { fd.set("id", sheet.m.id); r = await updateStockMovement(fd); }
              else r = await createStockMovement(undefined, fd);
              setBusy(false);
              if (r.ok) { setSheet(null); router.refresh(); } else setError(r.error ?? "Échec.");
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="productId">Produit <span className="text-destructive">*</span></Label>
              {products.length > 0 ? (
                <Select id="productId" name="productId" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  <option value="">— Autre (saisie libre) —</option>
                </Select>
              ) : (
                <input type="hidden" name="productId" value="" />
              )}
              <p className="text-xs text-muted-foreground">Issu du catalogue produits (Regulatory).</p>
            </div>

            {/* Saisie libre lorsque le produit n'est pas (encore) au catalogue */}
            {productId === "" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="product">Libellé du produit <span className="text-destructive">*</span></Label>
                  <Input id="product" name="product" defaultValue={sheet.mode === "edit" ? sheet.m.product : ""} required placeholder="Nom du produit" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="dci">DCI</Label>
                  <Input id="dci" name="dci" defaultValue={sheet.mode === "edit" ? sheet.m.dci : ""} placeholder="Dénomination commune" />
                </div>
              </div>
            )}
            {productId !== "" && selectedDci && (
              <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">DCI : <span className="font-medium text-foreground">{selectedDci}</span></p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="direction">Type</Label>
                <Select id="direction" name="direction" defaultValue={sheet.mode === "edit" ? sheet.m.direction : "IN"}>
                  {DIRS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantité <span className="text-destructive">*</span></Label>
                <Input id="quantity" name="quantity" type="number" min="0" required defaultValue={sheet.mode === "edit" ? sheet.m.quantity : ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" defaultValue={sheet.mode === "edit" ? d10(sheet.m.date) : ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Lieu</Label>
                <Input id="location" name="location" defaultValue={sheet.mode === "edit" ? sheet.m.location : "PCH"} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" defaultValue={sheet.mode === "edit" ? sheet.m.notes : ""} />
              </div>
            </div>

            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setSheet(null)} disabled={busy}>Annuler</Button>
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {sheet.mode === "edit" ? "Enregistrer" : "Créer le mouvement"}</Button>
            </div>
          </form>
        )}
      </Sheet>
    </section>
  );
}
