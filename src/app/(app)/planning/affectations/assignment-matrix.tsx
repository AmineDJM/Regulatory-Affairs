"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, CopyPlus } from "lucide-react";
import { saveAssignment, deleteAssignment, carryForwardAssignments } from "@/lib/actions/sales-planning-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Kam { repId: string; name: string; teamName: string; capacity: number; active: boolean }
interface Prod { id: string; name: string; buName: string; buColor: string | null }
interface Assign { repId: string; productId: string; position: number; plannedVisits: number }

const key = (repId: string, productId: string) => `${repId}::${productId}`;
const nOr0 = (s: string) => { const n = Number(String(s).replace(",", ".")); return Number.isFinite(n) ? Math.max(0, n) : 0; };
const inputCls = "h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none";

export function AssignmentMatrix({
  cycleId, canConfigure, fromYear, fromMonth, positionWeights, kams, products, assignments,
}: {
  cycleId: string; canConfigure: boolean; fromYear: number; fromMonth: number;
  positionWeights: Record<string, number>; kams: Kam[]; products: Prod[]; assignments: Assign[];
}) {
  const router = useRouter();
  const prodById = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const weight = (pos: number) => positionWeights[String(pos)] ?? (pos === 1 ? 1 : pos === 2 ? 0.5 : pos === 3 ? 0.25 : 0);

  const [drafts, setDrafts] = React.useState<Record<string, { position: number; visits: string }>>(() =>
    Object.fromEntries(assignments.map((a) => [key(a.repId, a.productId), { position: a.position, visits: String(a.plannedVisits) }])),
  );
  // Produits ajoutés manuellement (au-delà des affectations initiales), par KAM.
  const [extra, setExtra] = React.useState<Record<string, string[]>>({});
  const [saving, setSaving] = React.useState<string | null>(null);
  const [carrying, setCarrying] = React.useState(false);

  const initialByRep = React.useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const a of assignments) (m[a.repId] ??= []).push(a.productId);
    return m;
  }, [assignments]);

  function shownProducts(repId: string): string[] {
    const set = new Set([...(initialByRep[repId] ?? []), ...(extra[repId] ?? [])]);
    return products.filter((p) => set.has(p.id)).map((p) => p.id);
  }

  async function persist(repId: string, productId: string, d: { position: number; visits: string }) {
    setSaving(key(repId, productId));
    const fd = new FormData();
    fd.set("cycleId", cycleId); fd.set("repId", repId); fd.set("productId", productId);
    fd.set("position", String(d.position)); fd.set("plannedVisits", String(nOr0(d.visits)));
    const r = await saveAssignment(fd);
    setSaving(null);
    if (!r.ok) window.alert(r.error ?? "Enregistrement impossible.");
  }

  function setDraft(repId: string, productId: string, patch: Partial<{ position: number; visits: string }>) {
    setDrafts((cur) => {
      const k = key(repId, productId);
      const base = cur[k] ?? { position: 1, visits: "" };
      return { ...cur, [k]: { ...base, ...patch } };
    });
  }

  async function removeRow(repId: string, productId: string) {
    const fd = new FormData();
    fd.set("cycleId", cycleId); fd.set("repId", repId); fd.set("productId", productId);
    await deleteAssignment(fd);
    setDrafts((cur) => { const n = { ...cur }; delete n[key(repId, productId)]; return n; });
    setExtra((cur) => ({ ...cur, [repId]: (cur[repId] ?? []).filter((id) => id !== productId) }));
    router.refresh();
  }

  async function carry() {
    setCarrying(true);
    const fd = new FormData();
    fd.set("toCycleId", cycleId); fd.set("fromYear", String(fromYear)); fd.set("fromMonth", String(fromMonth));
    const r = await carryForwardAssignments(fd);
    setCarrying(false);
    if (!r.ok) { window.alert(r.error ?? "Report impossible."); return; }
    router.refresh();
  }

  const fteOf = (repId: string, productId: string, cap: number) => {
    const d = drafts[key(repId, productId)];
    if (!d) return 0;
    return cap > 0 ? (nOr0(d.visits) * weight(d.position)) / cap : 0;
  };

  // Rollup par produit (sur les KAM visibles).
  const rollup = products.map((p) => {
    let visits = 0, fte = 0;
    for (const k of kams) { const d = drafts[key(k.repId, p.id)]; if (d) { visits += nOr0(d.visits); fte += fteOf(k.repId, p.id, k.capacity); } }
    return { id: p.id, name: p.name, buName: p.buName, visits, fte };
  }).filter((r) => r.visits > 0 || r.fte > 0);

  // Groupement des KAM par équipe (déjà triés côté serveur).
  const teamGroups: { teamName: string; items: Kam[] }[] = [];
  for (const k of kams) {
    const g = teamGroups[teamGroups.length - 1];
    if (g && g.teamName === k.teamName) g.items.push(k);
    else teamGroups.push({ teamName: k.teamName, items: [k] });
  }

  return (
    <div className="space-y-5">
      {canConfigure && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={carry} disabled={carrying} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60">
            {carrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />} Reporter le mois précédent
          </button>
          <span className="text-xs text-muted-foreground">Duplique les affectations du mois précédent vers ce mois (sans écraser l'existant).</span>
        </div>
      )}

      {teamGroups.map((g) => (
        <div key={g.teamName} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.teamName}</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {g.items.map((k) => {
              const shown = shownProducts(k.repId);
              const load = shown.reduce((s, pid) => s + fteOf(k.repId, pid, k.capacity), 0);
              const visitsSum = shown.reduce((s, pid) => s + nOr0(drafts[key(k.repId, pid)]?.visits ?? "0"), 0);
              const loadPct = k.capacity > 0 ? Math.round((visitsSum / k.capacity) * 100) : 0;
              const available = products.filter((p) => !shown.includes(p.id));
              const tone = loadPct > 100 ? "bg-destructive" : loadPct > 85 ? "bg-warning" : "bg-success";
              return (
                <Card key={k.repId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                      <span>{k.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">Cap. {k.capacity} vis./mois · FTE {load.toFixed(2)}</span>
                    </CardTitle>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, loadPct)}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{visitsSum} / {k.capacity} visites planifiées ({loadPct}%)</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {shown.length === 0 && <p className="text-xs text-muted-foreground">Aucun produit affecté.</p>}
                    {shown.map((pid) => {
                      const p = prodById.get(pid)!;
                      const d = drafts[key(k.repId, pid)] ?? { position: 1, visits: "" };
                      return (
                        <div key={pid} className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.buColor ?? "#94a3b8" }} title={p.buName} />
                          <span className="min-w-0 flex-1 truncate text-sm" title={p.name}>{p.name}</span>
                          <select className="h-8 rounded-md border border-input bg-background px-1 text-xs" value={d.position}
                            onChange={(e) => { const position = Number(e.target.value); setDraft(k.repId, pid, { position }); persist(k.repId, pid, { ...d, position }); }}>
                            <option value={1}>P1</option><option value={2}>P2</option><option value={3}>P3</option>
                          </select>
                          <input inputMode="numeric" className={`${inputCls} w-16`} value={d.visits} placeholder="0"
                            onChange={(e) => setDraft(k.repId, pid, { visits: e.target.value })}
                            onBlur={() => persist(k.repId, pid, drafts[key(k.repId, pid)] ?? d)} />
                          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{fteOf(k.repId, pid, k.capacity).toFixed(2)}</span>
                          {saving === key(k.repId, pid) ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : (
                            <button type="button" onClick={() => removeRow(k.repId, pid)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                          )}
                        </div>
                      );
                    })}
                    {available.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        <select className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm" value=""
                          onChange={(e) => { const pid = e.target.value; if (!pid) return; setExtra((cur) => ({ ...cur, [k.repId]: [...(cur[k.repId] ?? []), pid] })); setDraft(k.repId, pid, { position: 1, visits: "" }); }}>
                          <option value="">Ajouter un produit…</option>
                          {available.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.buName}</option>)}
                        </select>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Rollup par produit */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Synthèse par produit (KAM visibles)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2">Produit</th>
                  <th className="px-3 py-2 w-28">Visites</th>
                  <th className="px-3 py-2 w-24">FTE affecté</th>
                </tr>
              </thead>
              <tbody>
                {rollup.length === 0 && <tr><td colSpan={3} className="px-3 py-3 text-muted-foreground">Aucune affectation.</td></tr>}
                {rollup.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="px-3 py-1.5"><span className="font-medium">{r.name}</span> <span className="text-xs text-muted-foreground">· {r.buName}</span></td>
                    <td className="px-3 py-1.5 tabular-nums">{r.visits}</td>
                    <td className="px-3 py-1.5 tabular-nums font-medium">{r.fte.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
