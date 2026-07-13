"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, Trash2, Loader2, LineChart as LineChartIcon, Table2, Send } from "lucide-react";
import { createStockHospital, deleteStockHospital, recordStockSnapshot, deleteStockSnapshot, requestStockState } from "@/lib/actions/stock-snapshot-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatDate } from "@/lib/utils";

export interface ProductOpt { id: string; label: string }
export interface HospitalDTO { id: string; name: string }
export interface UserOpt { id: string; label: string }
export interface SnapshotDTO {
  id: string;
  scope: string; // PCH | HOSPITAL
  annexId: string | null; // hôpital concerné (scope HOSPITAL)
  productId: string;
  date: string; // ISO, trié ascendant côté serveur
  quantity: number;
  mine: boolean; // enregistré par l'utilisateur courant (droit de correction)
}

const TABS = [
  { key: "PCH", label: "Stock PCH" },
  { key: "HOSPITAL", label: "Stock hôpitaux" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const todayInput = () => new Date().toISOString().slice(0, 10);

export function StocksView({
  products, hospitals, snapshots, users, canRecord, canDelete, isSuperAdmin, canRequest,
}: {
  products: ProductOpt[];
  hospitals: HospitalDTO[];
  snapshots: SnapshotDTO[];
  users: UserOpt[];
  canRecord: boolean;
  canDelete: boolean;
  isSuperAdmin: boolean;
  canRequest: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("PCH");
  const [hospitalId, setHospitalId] = React.useState<string>(hospitals[0]?.id ?? "");
  const [view, setView] = React.useState<"chart" | "table">("chart");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [showRequest, setShowRequest] = React.useState(false);

  const scopedAll = React.useMemo(
    () => snapshots.filter((s) => s.scope === tab && (tab !== "HOSPITAL" || s.annexId === hospitalId)),
    [snapshots, tab, hospitalId],
  );
  const withData = React.useMemo(() => new Set(scopedAll.map((s) => s.productId)), [scopedAll]);

  const [productId, setProductId] = React.useState<string>(() => {
    const first = snapshots.find((s) => s.scope === "PCH");
    return first?.productId ?? products[0]?.id ?? "";
  });

  React.useEffect(() => {
    if (!hospitals.find((h) => h.id === hospitalId)) setHospitalId(hospitals[0]?.id ?? "");
  }, [hospitals, hospitalId]);

  function switchTab(k: TabKey) {
    setTab(k); setError(null);
    const scoped = snapshots.filter((s) => s.scope === k && (k !== "HOSPITAL" || s.annexId === hospitalId));
    if (scoped.length > 0 && !scoped.some((s) => s.productId === productId)) setProductId(scoped[0].productId);
  }

  const series = React.useMemo(() => {
    const rows = scopedAll.filter((s) => s.productId === productId);
    return rows.map((s, i) => ({ ...s, label: formatDate(s.date), delta: i > 0 ? s.quantity - rows[i - 1].quantity : null }));
  }, [scopedAll, productId]);
  const last = series[series.length - 1];
  const productLabel = products.find((p) => p.id === productId)?.label ?? "";
  const recordable = tab === "PCH" || (tab === "HOSPITAL" && !!hospitalId);

  async function removeSnapshot(id: string) {
    if (!window.confirm("Supprimer cet état de stock ?")) return;
    const fd = new FormData(); fd.set("id", id);
    const r = await deleteStockSnapshot(fd);
    if (!r.ok) setError(r.error ?? "Échec de la suppression.");
    router.refresh();
  }

  async function removeHospital(h: HospitalDTO) {
    if (!window.confirm(`Supprimer l'hôpital « ${h.name} » et tous ses états de stock ?`)) return;
    const fd = new FormData(); fd.set("id", h.id);
    const r = await deleteStockHospital(fd);
    if (!r.ok) setError(r.error ?? "Échec de la suppression.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => switchTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${tab === t.key ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {canRequest && (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowRequest((v) => !v)}>
            <Send className="h-4 w-4" /> Demander un état de stock
          </Button>
        )}
      </div>

      {/* Demande d'état de stock à un instant T (Direction / Super Admin) */}
      {canRequest && showRequest && (
        <form
          action={async (fd) => {
            setBusy(true); setError(null);
            const r = await requestStockState(fd);
            setBusy(false);
            if (r.ok) { setShowRequest(false); router.refresh(); } else setError(r.error ?? "Échec.");
          }}
          className="surface flex flex-wrap items-end gap-3 p-4"
        >
          <div className="min-w-56 flex-1 space-y-1.5 sm:max-w-xs">
            <Label htmlFor="req-assignee">Demander à</Label>
            <Select id="req-assignee" name="assigneeId" required defaultValue="">
              <option value="" disabled>Choisir une personne…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </Select>
          </div>
          <div className="min-w-56 flex-[2] space-y-1.5">
            <Label htmlFor="req-note">Précision (produit / lieu / échéance)</Label>
            <Input id="req-note" name="note" placeholder="Ex. Stock actuel d'Amoxival 500 au CHU d'Oran" />
          </div>
          <Button type="submit" size="sm" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer la demande</Button>
        </form>
      )}

      {/* Hôpitaux : sélection + gestion (création réservée au Super Admin) */}
      {tab === "HOSPITAL" && (
        <div className="surface space-y-3 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Hôpitaux ({hospitals.length})</h2>
          {hospitals.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              Aucun hôpital pour l&apos;instant.{isSuperAdmin ? " Créez le premier ci-dessous." : " Le Super Admin doit d'abord en créer."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {hospitals.map((h) => (
                <span key={h.id} className={`inline-flex items-center gap-1 rounded-full border px-1 py-1 text-sm ${hospitalId === h.id ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground"}`}>
                  <button onClick={() => { setHospitalId(h.id); setError(null); }} className="rounded-full px-2 py-0.5 hover:text-foreground">{h.name}</button>
                  {isSuperAdmin && (
                    <button onClick={() => removeHospital(h)} title="Supprimer l'hôpital" className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {isSuperAdmin && (
            <form
              action={async (fd) => {
                setBusy(true); setError(null);
                const r = await createStockHospital(fd);
                setBusy(false);
                if (r.ok) router.refresh(); else setError(r.error ?? "Échec.");
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <div className="min-w-48 flex-1 space-y-1.5 sm:max-w-xs">
                <Label htmlFor="hospital-name">Nouvel hôpital</Label>
                <Input id="hospital-name" name="name" placeholder="Ex. CHU Oran" required />
              </div>
              <Button type="submit" size="sm" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter</Button>
            </form>
          )}
        </div>
      )}

      {/* Vue par produit (graphique / tableau) — dès qu'un lieu est sélectionnable */}
      {tab === "HOSPITAL" && !hospitalId ? null : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-56 flex-1 space-y-1.5 sm:max-w-md">
              <Label htmlFor="stock-product">Produit</Label>
              <Select id="stock-product" value={productId} onChange={(e) => { setProductId(e.target.value); setError(null); }}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.label}{withData.has(p.id) ? "" : " — aucun relevé ici"}</option>)}
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

          {canRecord && productId && recordable && (
            <form
              action={async (fd) => {
                setBusy(true); setError(null);
                fd.set("scope", tab);
                if (tab === "HOSPITAL") fd.set("annexId", hospitalId);
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
                <div className="surface px-3 py-2">Dernier état : <span className="font-semibold">{formatNumber(last.quantity)}</span> u. le {formatDate(last.date)}</div>
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
