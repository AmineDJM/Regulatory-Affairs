"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilterX, Loader2, RefreshCw, Ban, Paperclip, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { LEGAL_DOC_KIND, LEGAL_DOC_STATUS, LEGAL_EXPIRY_LEVEL } from "@/lib/labels";
import { renewLegalDocument, cancelLegalDocument } from "@/lib/actions/legal-actions";

/**
 * LES ENGAGEMENTS DE LA SOCIÉTÉ, EN TABLEAU FILTRABLE.
 *
 * Ce qu'on vient chercher ici, à 90 %, c'est « qu'est-ce qui arrive à échéance ? ». La colonne
 * ÉCHÉANCE porte donc son urgence en couleur, et le filtre « à surveiller » isole en un clic ce
 * qui expire dans les trois mois. Les documents SANS date ne sont jamais rangés dans l'urgence :
 * ils n'expirent pas, et les faire clignoter apprendrait à ignorer les vrais.
 */

export interface LegalRow {
  id: string;
  reference: string | null;
  title: string;
  kind: string;
  counterparty: string | null;
  startDate: string | null;
  endDate: string | null;
  /** Statut EFFECTIF (échéance comprise), calculé côté serveur par le module pur. */
  status: string;
  expiry: string;
  daysLeft: number | null;
  amount: number | null;
  driveNodeId: string | null;
  driveName: string | null;
  renewedFromTitle: string | null;
}

const cellInput = "h-8 w-full rounded-md border border-input bg-card px-2 text-xs font-normal normal-case tracking-normal outline-none focus:ring-1 focus:ring-ring";

const URGENT = new Set(["SOON", "IMMINENT", "OVERDUE"]);

export function LegalTable({ rows, canEdit }: { rows: LegalRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [f, setF] = React.useState({ title: "", kind: "", counterparty: "", status: "", reference: "" });
  const [watchOnly, setWatchOnly] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const has = (hay: string | null, needle: string) => (hay ?? "").toLowerCase().includes(needle.toLowerCase());

  const shown = rows.filter((r) => {
    if (f.title && !has(r.title, f.title)) return false;
    if (f.reference && !has(r.reference, f.reference)) return false;
    if (f.kind && r.kind !== f.kind) return false;
    if (f.counterparty && !has(r.counterparty, f.counterparty)) return false;
    if (f.status && r.status !== f.status) return false;
    if (watchOnly && !URGENT.has(r.expiry)) return false;
    return true;
  });

  const active = watchOnly || Object.values(f).some(Boolean);
  const watchCount = rows.filter((r) => URGENT.has(r.expiry)).length;

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (r.ok) router.refresh();
    else window.alert(r.error ?? "Échec.");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{shown.length} / {rows.length} document{rows.length > 1 ? "s" : ""}</span>
        <button
          type="button" onClick={() => setWatchOnly((v) => !v)}
          className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium",
            watchOnly ? "border-warning/60 bg-warning/10 text-warning" : "border-input hover:bg-secondary")}
        >
          À surveiller ({watchCount})
        </button>
        {active && (
          <button
            type="button"
            onClick={() => { setF({ title: "", kind: "", counterparty: "", status: "", reference: "" }); setWatchOnly(false); }}
            className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 font-medium hover:bg-secondary"
          >
            <FilterX className="h-3.5 w-3.5" /> Réinitialiser
          </button>
        )}
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <thead className="border-b border-border">
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 pt-2 text-left font-medium">Référence</th>
              <th className="px-3 pt-2 text-left font-medium">Titre exact</th>
              <th className="px-3 pt-2 text-left font-medium">Nature</th>
              <th className="px-3 pt-2 text-left font-medium">Partie</th>
              <th className="px-3 pt-2 text-left font-medium">Début</th>
              <th className="px-3 pt-2 text-left font-medium">Échéance</th>
              <th className="px-3 pt-2 text-right font-medium">Montant</th>
              <th className="px-3 pt-2 text-left font-medium">État</th>
              <th className="px-3 pt-2 text-left font-medium">Pièce</th>
              {canEdit && <th className="px-3 pt-2 text-left font-medium">Actions</th>}
            </tr>
            <tr>
              <th className="px-2 pb-2 pt-1"><input value={f.reference} onChange={set("reference")} placeholder="Filtrer" className={cellInput} /></th>
              <th className="px-2 pb-2 pt-1"><input value={f.title} onChange={set("title")} placeholder="Filtrer" className={cellInput} /></th>
              <th className="px-2 pb-2 pt-1">
                <select value={f.kind} onChange={set("kind")} className={cellInput}>
                  <option value="">Toutes</option>
                  {Object.entries(LEGAL_DOC_KIND).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </th>
              <th className="px-2 pb-2 pt-1"><input value={f.counterparty} onChange={set("counterparty")} placeholder="Filtrer" className={cellInput} /></th>
              <th className="px-2 pb-2 pt-1" />
              <th className="px-2 pb-2 pt-1" />
              <th className="px-2 pb-2 pt-1" />
              <th className="px-2 pb-2 pt-1">
                <select value={f.status} onChange={set("status")} className={cellInput}>
                  <option value="">Tous</option>
                  {Object.entries(LEGAL_DOC_STATUS).map(([v, d]) => <option key={v} value={v}>{d.label}</option>)}
                </select>
              </th>
              <th className="px-2 pb-2 pt-1" />
              {canEdit && <th className="px-2 pb-2 pt-1" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.length === 0 ? (
              <tr><td colSpan={canEdit ? 10 : 9} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucun document ne correspond à ces filtres.</td></tr>
            ) : shown.map((r) => {
              const exp = LEGAL_EXPIRY_LEVEL[r.expiry];
              const st = LEGAL_DOC_STATUS[r.status];
              return (
                <tr key={r.id} className="align-middle hover:bg-secondary/30">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.reference || "—"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/legal/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                    {r.renewedFromTitle && (
                      <span className="block text-[0.6875rem] text-muted-foreground">renouvelle « {r.renewedFromTitle} »</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{LEGAL_DOC_KIND[r.kind] ?? r.kind}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.counterparty || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.startDate ? formatDate(r.startDate) : "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.endDate ? (
                      <span className="flex flex-col">
                        <span>{formatDate(r.endDate)}</span>
                        {URGENT.has(r.expiry) && (
                          <Badge tone={exp?.tone ?? "neutral"} dot={false}>
                            {r.daysLeft !== null && r.daysLeft >= 0 ? `dans ${r.daysLeft} j` : "dépassée"}
                          </Badge>
                        )}
                      </span>
                    ) : (
                      // SANS ÉCHÉANCE : dit explicitement, pour qu'on ne croie pas à un oubli de saisie.
                      <span className="text-xs text-muted-foreground">sans échéance</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.amount !== null ? formatCurrency(r.amount) : "—"}</td>
                  <td className="px-3 py-2"><Badge tone={st?.tone ?? "neutral"} dot={false}>{st?.label ?? r.status}</Badge></td>
                  <td className="px-3 py-2">
                    {r.driveNodeId ? (
                      // Le fichier vit dans le DRIVE : on y renvoie, on n'en sert pas une copie.
                      <Link href={`/drive?node=${r.driveNodeId}`} title={r.driveName ?? undefined}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <Paperclip className="h-3 w-3" /> Drive <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1">
                        {(r.status === "ACTIVE" || r.status === "EXPIRED") && (
                          <>
                            <Button size="sm" variant="outline" disabled={busy === `r:${r.id}`}
                              onClick={() => { const fd = new FormData(); fd.set("id", r.id); void run(`r:${r.id}`, () => renewLegalDocument(fd)); }}>
                              {busy === `r:${r.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Renouveler
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busy === `c:${r.id}`}
                              onClick={() => {
                                const reason = window.prompt("Motif de l'annulation ?") ?? "";
                                const fd = new FormData(); fd.set("id", r.id); fd.set("reason", reason);
                                void run(`c:${r.id}`, () => cancelLegalDocument(fd));
                              }}>
                              <Ban className="h-3.5 w-3.5" /> Annuler
                            </Button>
                          </>
                        )}
                      </span>
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
