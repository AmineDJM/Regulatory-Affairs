"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { saveForecast } from "@/lib/actions/sales-planning-actions";

interface Row {
  productId: string;
  productName: string;
  buName: string;
  buColor: string | null;
  targetFte: number;
  coverageTargetPct: number | null;
  plannedVisits: number | null;
  budget: number | null;
  note: string | null;
}

type Draft = { targetFte: string; coverageTargetPct: string; plannedVisits: string; budget: string; note: string };

const toDraft = (r: Row): Draft => ({
  targetFte: String(r.targetFte ?? ""),
  coverageTargetPct: r.coverageTargetPct != null ? String(r.coverageTargetPct) : "",
  plannedVisits: r.plannedVisits != null ? String(r.plannedVisits) : "",
  budget: r.budget != null ? String(r.budget) : "",
  note: r.note ?? "",
});

const nOr0 = (s: string) => { const n = Number(s.replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const fmtDZD = (n: number) => new Intl.NumberFormat("fr-DZ").format(Math.round(n));

/**
 * Grille de prévision par produit (façon tableur) — regroupée par BU, avec sous-totaux et total.
 * Chaque ligne s'enregistre automatiquement à la sortie d'un champ (auto-save).
 */
export function ForecastGrid({ cycleId, rows, canEdit }: { cycleId: string; rows: Row[]; canEdit: boolean }) {
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>(() =>
    Object.fromEntries(rows.map((r) => [r.productId, toDraft(r)])),
  );
  const [saving, setSaving] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);

  function set(productId: string, field: keyof Draft, value: string) {
    setDrafts((d) => ({ ...d, [productId]: { ...d[productId], [field]: value } }));
  }

  async function save(productId: string) {
    if (!canEdit) return;
    const d = drafts[productId];
    setSaving(productId);
    const fd = new FormData();
    fd.set("cycleId", cycleId);
    fd.set("productId", productId);
    fd.set("targetFte", d.targetFte || "0");
    fd.set("coverageTargetPct", d.coverageTargetPct);
    fd.set("plannedVisits", d.plannedVisits);
    fd.set("budget", d.budget);
    fd.set("note", d.note);
    await saveForecast(fd);
    setSaving(null);
    setSaved(productId);
    setTimeout(() => setSaved((s) => (s === productId ? null : s)), 1500);
  }

  // Regroupement par BU (l'ordre des lignes est déjà trié par BU côté serveur).
  const groups: { buName: string; buColor: string | null; items: Row[] }[] = [];
  for (const r of rows) {
    const g = groups[groups.length - 1];
    if (g && g.buName === r.buName) g.items.push(r);
    else groups.push({ buName: r.buName, buColor: r.buColor, items: [r] });
  }

  const sum = (items: Row[], f: (d: Draft) => number) => items.reduce((s, r) => s + f(drafts[r.productId]), 0);
  const grandFte = sum(rows, (d) => nOr0(d.targetFte));
  const grandVisits = sum(rows, (d) => nOr0(d.plannedVisits));
  const grandBudget = sum(rows, (d) => nOr0(d.budget));

  const cell = "border-b border-border px-2 py-1.5 text-sm";
  const input = "h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-border bg-secondary/40 text-left text-xs font-medium text-muted-foreground">
            <th className="px-3 py-2">Produit</th>
            <th className="px-2 py-2 w-24">FTE cible</th>
            <th className="px-2 py-2 w-24">Couv. %</th>
            <th className="px-2 py-2 w-28">Visites</th>
            <th className="px-2 py-2 w-36">Budget (DZD)</th>
            <th className="px-2 py-2">Note</th>
            <th className="px-2 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const subFte = sum(g.items, (d) => nOr0(d.targetFte));
            const subVisits = sum(g.items, (d) => nOr0(d.plannedVisits));
            const subBudget = sum(g.items, (d) => nOr0(d.budget));
            return (
              <React.Fragment key={g.buName}>
                <tr className="bg-accent/40">
                  <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.buColor ?? "#94a3b8" }} />
                      {g.buName}
                    </span>
                  </td>
                </tr>
                {g.items.map((r) => {
                  const d = drafts[r.productId];
                  return (
                    <tr key={r.productId} className="hover:bg-secondary/30">
                      <td className={`${cell} font-medium`}>{r.productName}</td>
                      {(["targetFte", "coverageTargetPct", "plannedVisits", "budget"] as (keyof Draft)[]).map((f) => (
                        <td key={f} className={cell}>
                          {canEdit ? (
                            <input inputMode="decimal" className={input} value={d[f]} onChange={(e) => set(r.productId, f, e.target.value)} onBlur={() => save(r.productId)} />
                          ) : (
                            <span>{f === "budget" && d[f] ? fmtDZD(nOr0(d[f])) : d[f] || "—"}</span>
                          )}
                        </td>
                      ))}
                      <td className={cell}>
                        {canEdit ? (
                          <input className={input} value={d.note} onChange={(e) => set(r.productId, "note", e.target.value)} onBlur={() => save(r.productId)} placeholder="…" />
                        ) : (
                          <span>{d.note || "—"}</span>
                        )}
                      </td>
                      <td className={`${cell} text-center`}>
                        {saving === r.productId ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : saved === r.productId ? <Check className="h-4 w-4 text-success" /> : null}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-secondary/30 text-sm font-medium">
                  <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">Sous-total {g.buName}</td>
                  <td className="px-2 py-1.5">{subFte.toFixed(2)}</td>
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5">{subVisits}</td>
                  <td className="px-2 py-1.5">{fmtDZD(subBudget)}</td>
                  <td colSpan={2} />
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-primary/5 text-sm font-bold">
            <td className="px-3 py-2 text-right">Total</td>
            <td className="px-2 py-2">{grandFte.toFixed(2)}</td>
            <td className="px-2 py-2" />
            <td className="px-2 py-2">{grandVisits}</td>
            <td className="px-2 py-2">{fmtDZD(grandBudget)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
