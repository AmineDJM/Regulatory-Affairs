"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Boxes } from "lucide-react";
import { setStockOpeningLevel, deleteStockOpeningLevel } from "@/lib/actions/stock-actions";
import type { StockOpeningDTO, ProductOption } from "@/lib/queries/stock";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatDate } from "@/lib/utils";

const d10 = (iso: string) => iso.slice(0, 10);

export function StockOpeningLevels({
  openings, products, canEdit,
}: {
  openings: StockOpeningDTO[];
  products: ProductOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [sheet, setSheet] = React.useState<null | { mode: "create" } | { mode: "edit"; o: StockOpeningDTO }>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [productId, setProductId] = React.useState<string>(products[0]?.id ?? "");

  React.useEffect(() => {
    setProductId(sheet?.mode === "edit" ? (sheet.o.productId ?? "") : (products[0]?.id ?? ""));
    setError(null);
  }, [sheet, products]);

  const selectedDci = products.find((p) => p.id === productId)?.dci ?? "";

  async function remove(id: string) {
    if (!window.confirm("Supprimer ce stock initial ? Le niveau courant sera recalculé sans cette base.")) return;
    const fd = new FormData(); fd.set("id", id);
    await deleteStockOpeningLevel(fd);
    router.refresh();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Stock initial ({openings.length})</h2>
          <p className="text-xs text-muted-foreground">Base de calcul : niveau courant = stock initial + mouvements.</p>
        </div>
        {canEdit && <Button size="sm" variant="outline" onClick={() => setSheet({ mode: "create" })}><Plus className="h-4 w-4" /> Définir un stock initial</Button>}
      </div>

      {openings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {canEdit ? "Aucun stock initial. Initialisez le stock d'un produit pour partir d'un niveau exact." : "Aucun stock initial défini."}
        </p>
      ) : (
        <div className="surface overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead><TableHead>DCI</TableHead><TableHead>Lieu</TableHead>
                <TableHead className="text-right">Quantité initiale</TableHead><TableHead>Date</TableHead><TableHead>Notes</TableHead>
                {canEdit && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {openings.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.product}</TableCell>
                  <TableCell className="text-muted-foreground">{o.dci || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{o.location}</TableCell>
                  <TableCell className="text-right font-semibold">{formatNumber(o.quantity)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(o.date)}</TableCell>
                  <TableCell className="text-muted-foreground">{o.notes || "—"}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setSheet({ mode: "edit", o })} title="Modifier" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(o.id)} title="Supprimer" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={sheet !== null} onClose={() => !busy && setSheet(null)} title={sheet?.mode === "edit" ? "Modifier le stock initial" : "Définir un stock initial"} width="md">
        {sheet && (
          <form
            action={async (fd) => {
              setBusy(true); setError(null);
              const r = await setStockOpeningLevel(undefined, fd);
              setBusy(false);
              if (r.ok) { setSheet(null); router.refresh(); } else setError(r.error ?? "Échec.");
            }}
            className="space-y-4"
          >
            <div className="surface flex items-start gap-2 bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              <Boxes className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Le stock initial sert de point de départ. Le niveau courant se calcule ensuite à partir des entrées et sorties.</span>
            </div>

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

            {productId === "" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="product">Libellé du produit <span className="text-destructive">*</span></Label>
                  <Input id="product" name="product" defaultValue={sheet.mode === "edit" ? sheet.o.product : ""} required placeholder="Nom du produit" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="dci">DCI</Label>
                  <Input id="dci" name="dci" defaultValue={sheet.mode === "edit" ? sheet.o.dci : ""} placeholder="Dénomination commune" />
                </div>
              </div>
            )}
            {productId !== "" && selectedDci && (
              <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">DCI : <span className="font-medium text-foreground">{selectedDci}</span></p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantité initiale <span className="text-destructive">*</span></Label>
                <Input id="quantity" name="quantity" type="number" min="0" required defaultValue={sheet.mode === "edit" ? sheet.o.quantity : ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Lieu</Label>
                <Input id="location" name="location" defaultValue={sheet.mode === "edit" ? sheet.o.location : "PCH"} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date d'inventaire</Label>
                <Input id="date" name="date" type="date" defaultValue={sheet.mode === "edit" ? d10(sheet.o.date) : new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" defaultValue={sheet.mode === "edit" ? sheet.o.notes : ""} placeholder="Ex. inventaire physique à la PCH" />
              </div>
            </div>

            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setSheet(null)} disabled={busy}>Annuler</Button>
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer</Button>
            </div>
          </form>
        )}
      </Sheet>
    </section>
  );
}
