"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilterX, Check, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { INVOICE_STATUS } from "@/lib/labels";
import { setInvoicePaid } from "@/lib/actions/invoice-actions";

/**
 * TOUTES LES FACTURES, EN UN TABLEAU.
 *
 * Deux questions seulement amènent ici : « cette facture est-elle payée ? » et « qu'est-ce qui
 * reste à payer ? ». Le RÈGLEMENT se pose donc dans la ligne, en un clic, et le filtre « à
 * régler » isole le reste à payer avec son total — un tableau qui oblige à additionner de tête
 * ne répond pas à la question qu'on lui pose.
 */

export interface InvoiceRow {
  id: string;
  number: string | null;
  title: string;
  issueDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  amount: number | null;
  status: string;
  recipient: string | null;
  payer: string | null;
}

const cellInput = "h-8 w-full rounded-md border border-input bg-card px-2 text-xs font-normal normal-case tracking-normal outline-none focus:ring-1 focus:ring-ring";

export function InvoiceTable({ rows, canEdit }: { rows: InvoiceRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [f, setF] = React.useState({ title: "", number: "", recipient: "", payer: "", status: "" });
  const [unpaidOnly, setUnpaidOnly] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const has = (hay: string | null, needle: string) => (hay ?? "").toLowerCase().includes(needle.toLowerCase());

  const shown = rows.filter((r) => {
    if (f.title && !has(r.title, f.title)) return false;
    if (f.number && !has(r.number, f.number)) return false;
    if (f.recipient && !has(r.recipient, f.recipient)) return false;
    if (f.payer && !has(r.payer, f.payer)) return false;
    if (f.status && r.status !== f.status) return false;
    if (unpaidOnly && (r.status === "PAID" || r.status === "CANCELLED")) return false;
    return true;
  });

  // Le total de CE QUI EST AFFICHÉ : filtrer puis additionner est le geste attendu.
  const total = shown.reduce((a, r) => a + (r.amount ?? 0), 0);
  const active = unpaidOnly || Object.values(f).some(Boolean);
  const unpaidCount = rows.filter((r) => r.status === "UNPAID" || r.status === "PARTIAL").length;

  const togglePaid = (r: InvoiceRow) => {
    setBusy(r.id);
    void setInvoicePaid({ id: r.id, paidDate: r.paidDate ? null : new Date().toISOString() })
      .then(() => { setBusy(null); router.refresh(); });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{shown.length} / {rows.length} facture{rows.length > 1 ? "s" : ""}</span>
        <span className="font-semibold text-foreground">Total affiché : {formatCurrency(total)}</span>
        <button
          type="button" onClick={() => setUnpaidOnly((v) => !v)}
          className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium",
            unpaidOnly ? "border-warning/60 bg-warning/10 text-warning" : "border-input hover:bg-secondary")}
        >
          Reste à régler ({unpaidCount})
        </button>
        {active && (
          <button type="button"
            onClick={() => { setF({ title: "", number: "", recipient: "", payer: "", status: "" }); setUnpaidOnly(false); }}
            className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 font-medium hover:bg-secondary">
            <FilterX className="h-3.5 w-3.5" /> Réinitialiser
          </button>
        )}
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <thead className="border-b border-border">
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 pt-2 text-left font-medium">N°</th>
              <th className="px-3 pt-2 text-left font-medium">Titre</th>
              <th className="px-3 pt-2 text-left font-medium">Émission</th>
              <th className="px-3 pt-2 text-left font-medium">Échéance</th>
              <th className="px-3 pt-2 text-left font-medium">Paiement</th>
              <th className="px-3 pt-2 text-right font-medium">Montant</th>
              <th className="px-3 pt-2 text-left font-medium">Destinataire</th>
              <th className="px-3 pt-2 text-left font-medium">Payeur</th>
              <th className="px-3 pt-2 text-left font-medium">État</th>
              {canEdit && <th className="px-3 pt-2 text-left font-medium">Régler</th>}
            </tr>
            <tr>
              <th className="px-2 pb-2 pt-1"><input value={f.number} onChange={set("number")} placeholder="Filtrer" className={cellInput} /></th>
              <th className="px-2 pb-2 pt-1"><input value={f.title} onChange={set("title")} placeholder="Filtrer" className={cellInput} /></th>
              <th className="px-2 pb-2 pt-1" />
              <th className="px-2 pb-2 pt-1" />
              <th className="px-2 pb-2 pt-1" />
              <th className="px-2 pb-2 pt-1" />
              <th className="px-2 pb-2 pt-1"><input value={f.recipient} onChange={set("recipient")} placeholder="Filtrer" className={cellInput} /></th>
              <th className="px-2 pb-2 pt-1"><input value={f.payer} onChange={set("payer")} placeholder="Filtrer" className={cellInput} /></th>
              <th className="px-2 pb-2 pt-1">
                <select value={f.status} onChange={set("status")} className={cellInput}>
                  <option value="">Tous</option>
                  {Object.entries(INVOICE_STATUS).map(([v, d]) => <option key={v} value={v}>{d.label}</option>)}
                </select>
              </th>
              {canEdit && <th className="px-2 pb-2 pt-1" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.length === 0 ? (
              <tr><td colSpan={canEdit ? 10 : 9} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune facture ne correspond à ces filtres.</td></tr>
            ) : shown.map((r) => {
              const st = INVOICE_STATUS[r.status];
              // Une échéance passée sans paiement : le seul retard qui compte ici.
              const late = !r.paidDate && r.dueDate && new Date(r.dueDate) < new Date();
              return (
                <tr key={r.id} className="hover:bg-secondary/30">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.number || "—"}</td>
                  <td className="px-3 py-2 font-medium">{r.title}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.issueDate ? formatDate(r.issueDate) : "—"}</td>
                  <td className={cn("px-3 py-2 whitespace-nowrap", late ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {r.dueDate ? `${formatDate(r.dueDate)}${late ? " — dépassée" : ""}` : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.paidDate ? formatDate(r.paidDate) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.amount !== null ? formatCurrency(r.amount) : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.recipient || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.payer || "—"}</td>
                  <td className="px-3 py-2"><Badge tone={st?.tone ?? "neutral"} dot={false}>{st?.label ?? r.status}</Badge></td>
                  {canEdit && (
                    <td className="px-3 py-2">
                      <button
                        type="button" disabled={busy === r.id} onClick={() => togglePaid(r)}
                        title={r.paidDate ? "Annuler le règlement" : "Marquer réglée aujourd'hui"}
                        className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
                      >
                        {r.paidDate ? <><Undo2 className="h-3.5 w-3.5" /> Rouvrir</> : <><Check className="h-3.5 w-3.5" /> Réglée</>}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
