"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  AD_PRO_KINDS, AD_PRO_STATE, kindSpec, countByState,
  type AdProRequest, type AdProState, type AdProKind,
} from "@/lib/ad-pro/unified";

/**
 * LA LISTE UNIFIÉE. Ce qui ATTEND une décision est en tête (le tri vient du module pur) — une
 * liste rangée par date seule enterre les demandes bloquées depuis trois semaines sous celles de
 * ce matin, or ce sont précisément celles-là qu'il faut voir.
 *
 * Les filtres sont les compteurs eux-mêmes : on clique sur « en attente » pour ne voir que ça.
 * Un panneau de filtres séparé s'utilise deux fois, puis plus jamais.
 */
export function AdProList({ rows }: { rows: AdProRequest[] }) {
  const [state, setState] = React.useState<AdProState | "ALL">("ALL");
  const [kind, setKind] = React.useState<AdProKind | "ALL">("ALL");
  const [q, setQ] = React.useState("");

  const counts = countByState(rows);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (state !== "ALL" && r.state !== state) return false;
    if (kind !== "ALL" && r.kind !== kind) return false;
    if (needle && !`${r.reference} ${r.title} ${r.beneficiary ?? ""} ${r.requester ?? ""}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
      active ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-secondary"
    }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une demande, un bénéficiaire…" className="w-72 pl-8" />
        </div>
        <button type="button" className={chip(state === "ALL")} onClick={() => setState("ALL")}>Toutes ({rows.length})</button>
        {(Object.keys(AD_PRO_STATE) as AdProState[]).filter((s) => counts[s] > 0).map((s) => (
          <button key={s} type="button" className={chip(state === s)} onClick={() => setState(s)}>
            {AD_PRO_STATE[s].label} ({counts[s]})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Nature :</span>
        <button type="button" className={chip(kind === "ALL")} onClick={() => setKind("ALL")}>Toutes</button>
        {AD_PRO_KINDS.filter((k) => rows.some((r) => r.kind === k.kind)).map((k) => (
          <button key={k.kind} type="button" className={chip(kind === k.kind)} onClick={() => setKind(k.kind)}>
            {k.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="surface p-6 text-center text-sm text-muted-foreground">Aucune demande ne correspond à ces filtres.</p>
      ) : (
        // EN TABLEAU : une demande, c'est une référence, un objet, un bénéficiaire, un montant et
        // une date — cinq colonnes qui se comparent d'un coup d'œil. Empilées dans une phrase,
        // ces mêmes informations obligent à relire chaque ligne en entier pour en comparer deux.
        <div className="surface overflow-x-auto">
          <table className="table-clean w-full min-w-[56rem] text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Référence</th>
                <th className="px-3 py-2 text-left font-medium">Nature</th>
                <th className="px-3 py-2 text-left font-medium">Objet</th>
                <th className="px-3 py-2 text-left font-medium">Bénéficiaire</th>
                <th className="px-3 py-2 text-right font-medium">Montant</th>
                <th className="px-3 py-2 text-left font-medium">Demandeur</th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((r) => {
                const spec = kindSpec(r.kind);
                const st = AD_PRO_STATE[r.state];
                return (
                  <tr key={`${r.kind}-${r.id}`} className="hover:bg-secondary/50">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.reference}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <Icon name={spec?.icon ?? "PartyPopper"} className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                        {spec?.label ?? r.kind}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={r.href} className="font-medium hover:underline">{r.title}</Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.beneficiary || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.amount !== null ? formatCurrency(r.amount) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.requester || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(r.createdAt)}</td>
                    <td className="px-3 py-2"><Badge tone={st.tone} dot={false}>{st.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
