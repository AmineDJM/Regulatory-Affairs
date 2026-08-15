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
        <ul className="surface divide-y divide-border">
          {shown.map((r) => {
            const spec = kindSpec(r.kind);
            const st = AD_PRO_STATE[r.state];
            return (
              <li key={`${r.kind}-${r.id}`}>
                <Link href={r.href} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-sm transition-colors hover:bg-secondary/50">
                  <Icon name={spec?.icon ?? "PartyPopper"} className="h-4 w-4 shrink-0 text-primary/80" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{r.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {spec?.label ?? r.kind} · {r.reference}
                      {r.beneficiary ? ` · ${r.beneficiary}` : ""}
                      {r.requester ? ` · demandé par ${r.requester}` : ""}
                    </span>
                  </span>
                  {r.amount !== null && <span className="tabular-nums font-semibold">{formatCurrency(r.amount)}</span>}
                  <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                  <Badge tone={st.tone} dot={false}>{st.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
