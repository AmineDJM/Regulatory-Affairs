"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, Trash2, Loader2, LineChart as LineChartIcon, Table2 } from "lucide-react";
import { createStockAnnex, deleteStockAnnex, recordStockSnapshot, deleteStockSnapshot } from "@/lib/actions/stock-snapshot-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatDate } from "@/lib/utils";

export interface ProductOpt { id: string; label: string }
export interface AnnexDTO { id: string; name: string }
export interface SnapshotDTO {
  id: string;
  scope: string; // PCH | HOSPITAL | ANNEX
  annexId: string | null;
  productId: string;
  date: string; // ISO, trié ascendant côté serveur
  quantity: number;
  mine: boolean; // enregistré par l'utilisateur courant (droit de correction)
}

const TABS = [
  { key: "PCH", label: "Stock PCH" },
  { key: "HOSPITAL", label: "Stock hospitalier" },
  { key: "ANNEX", label: "Annexes PCH" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const todayInput = () => new Date().toISOString().slice(0, 10);

export function StocksView({
  products, annexes, snapshots, canCreate, canEdit, canDelete,
}: {
  products: ProductOpt[];
  annexes: AnnexDTO[];
  snapshots: SnapshotDTO[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const canRecord = canCreate || canEdit;
  const [tab, setTab] = React.useState<TabKey>("PCH");
  const [annexId, setAnnexId] = React.useState<string>(annexes[0]?.id ?? "");
  const [view, setView] = React.useState<"chart" | "table">("chart");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Produits ayant au moins un état dans la portée courante → sélection par défaut utile.
  const scopedAll = React.useMemo(
    () => snapshots.filter((s) => s.scope === tab && (tab !== "ANNEX" || s.annexId === annexId)),
    [snapshots, tab, annexId],
  );
  const withData = React.useMemo(() => {
    const seen = new Set<string>();
    for (const s of scopedAll) seen.add(s.productId);
    return seen;
  }, [scopedAll]);

  const [productId, setProductId] = React.useState<string>(() => {
    const first = snapshots.find((s) => s.scope === "PCH");
    return first?.productId ?? products[0]?.id ?? "";
  });

  // L'annexe sélectionnée peut disparaître (suppression) ou apparaître (1ʳᵉ création).
  React.useEffect(() => {
    if (!annexes.find((a) => a.id === annexId)) setAnnexId(annexes[0]?.id ?? "");
  }, [annexes, annexId]);

  function switchTab(k: TabKey) {
    setTab(k); setError(null);
    // Si le produit courant n'a pas de relevé ici mais qu'un autre en a, on bascule dessus.
    const scoped = snapshots.filter((s) => s.scope === k && (k !== "ANNEX" || s.annexId === annexId));
    if (scoped.length > 0 && !scoped.some((s) => s.productId === productId)) setProductId(scoped[0].productId);
  }

  const series = React.useMemo(() => {
    const rows = scopedAll.filter((s) => s.productId === productId);
    return rows.map((s, i) => ({
      ...s,
      label: formatDate(s.date),
      delta: i > 0 ? s.quantity - rows[i - 1].quantity : null,
    }));
  }, [scopedAll, productId]);
  const last = series[series.length - 1];
  const productLabel = products.find((p) => p.id === productId)?.label ?? "";

  async function removeSnapshot(id: string) {
    if (!window.confirm("Supprimer cet état de stock ?")) return;
    const fd = new FormData(); fd.set("id", id);
    const r = await deleteStockSnapshot(fd);
    if (!r.ok) setError(r.error ?? "Échec de la suppression.");
    router.refresh();
  }

  async function removeAnnex(a: AnnexDTO) {
    if (!window.confirm(`Supprimer l'annexe « ${a.name} » et tous ses états de stock ?`)) return;
    const fd = new FormData(); fd.set("id", a.id);
    const r = await deleteStockAnnex(fd);
    if (!r.ok) setError(r.error ?? "Échec de la suppression.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Onglets internes : PCH / Hospitalier / Annexes */}
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${tab === t.key ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Gestion des annexes PCH */}
      {tab === "ANNEX" && (
        <div className="surface space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Annexes PCH ({annexes.length})</h2>
          </div>
          {annexes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              Aucune annexe pour l&apos;instant.{canCreate ? " Créez la première ci-dessous." : ""}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {annexes.map((a) => (
                <span
                  key={a.id}
                  className={`inline-flex items-center gap-1 rounded-full border px-1 py-1 text-sm ${annexId === a.id ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground"}`}
                >
                  <button onClick={() => { setAnnexId(a.id); setError(null); }} className="rounded-full px-2 py-0.5 hover:text-foreground">{a.name}</button>
                  {canDelete && (
                    <button onClick={() => removeAnnex(a)} title="Supprimer l'annexe" className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {canCreate && (
            <form
              action={async (fd) => {
                setBusy(true); setError(null);
                const r = await createStockAnnex(fd);
                setBusy(false);
                if (r.ok) router.refresh(); else setError(r.error ?? "Échec.");
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <div className="min-w-48 flex-1 space-y-1.5 sm:max-w-xs">
                <Label htmlFor="annex-name">Nouvelle annexe</Label>
                <Input id="annex-name" name="name" placeholder="Ex. Annexe Oran" required />
              </div>
              <Button type="submit" size="sm" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter</Button>
            </form>
          )}
        </div>
      )}

      {/* Vue par produit (graphique / tableau) */}
      {tab === "ANNEX" && !annexId ? null : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-56 flex-1 space-y-1.5 sm:max-w-md">
              <Label htmlFor="stock-product">Produit</Label>
              <Select id="stock-product" value={productId} onChange={(e) => { setProductId(e.target.value); setError(null); }}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}{withData.has(p.id) ? "" : " — aucun relevé ici"}</option>
                ))}
              </Select>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
              <button onClick={() => setView("chart")} title="Vue graphique" className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm ${view === "chart" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <LineChartIcon className="h-4 w-4" /> Graphique
              </button>
              <button onClick={() => setView("table")} title="Vue tableau" className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm ${view === "table" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Table2 className="h-4 w-4" /> Tableau
              </button>
            </div>
          </div>

          {/* Mise à jour simple : « à cette date, il reste X » */}
          {canRecord && productId && (
            <form
              action={async (fd) => {
                setBusy(true); setError(null);
                fd.set("scope", tab);
                if (tab === "ANNEX") fd.set("annexId", annexId);
                fd.set("productId", productId);
                const r = await recordStockSnapshot(fd);
                setBusy(false);
                if (r.ok) router.refresh(); else setError(r.error ?? "Échec.");
              }}
              className="surface flex flex-wrap items-end gap-3 p-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="snap-date">Date de l&apos;état</Label>
                <Input id="snap-date" name="date" type="date" defaultValue={todayInput()} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="snap-qty">Quantité restante</Label>
                <Input id="snap-qty" name="quantity" type="number" min="0" step="1" placeholder="Ex. 1200" required className="w-36" />
              </div>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Enregistrer l&apos;état
              </Button>
              <p className="basis-full text-xs text-muted-foreground sm:basis-auto sm:flex-1">
                Un seul état par jour et par produit : ressaisir la même date corrige la valeur.
              </p>
            </form>
          )}

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          {series.length === 0 ? (
            <EmptyState
              icon="Boxes"
              title="Aucun état de stock pour ce produit ici"
              description={canRecord ? "Enregistrez un premier état (date + quantité restante) : la courbe se construira au fil des relevés." : "Les états de stock apparaîtront ici."}
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="surface px-3 py-2">
                  Dernier état : <span className="font-semibold">{formatNumber(last.quantity)}</span> u. le {formatDate(last.date)}
                </div>
                <div className="surface px-3 py-2 text-muted-foreground">{series.length} relevé·s — {productLabel}</div>
              </div>

              {view === "chart" ? (
                <div className="surface p-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={series} margin={{ top: 10, right: 14, left: -4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" width={52} allowDecimals={false}
                        tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                        formatter={(v: number) => [v.toLocaleString("fr-FR"), "Quantité"]} />
                      <Line type="monotone" dataKey="quantity" name="Quantité" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="surface overflow-x-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Quantité restante</TableHead>
                        <TableHead className="text-right">Évolution</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...series].reverse().map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-muted-foreground">{formatDate(s.date)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatNumber(s.quantity)}</TableCell>
                          <TableCell className={`text-right ${s.delta === null ? "text-muted-foreground" : s.delta < 0 ? "text-destructive" : "text-emerald-600"}`}>
                            {s.delta === null ? "—" : `${s.delta > 0 ? "+" : ""}${formatNumber(s.delta)}`}
                          </TableCell>
                          <TableCell className="text-right">
                            {(canDelete || s.mine) && (
                              <button onClick={() => removeSnapshot(s.id)} title="Supprimer cet état" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
