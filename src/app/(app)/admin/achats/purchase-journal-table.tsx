"use client";

import * as React from "react";
import Link from "next/link";
import { Search, ChevronRight, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, cn } from "@/lib/utils";

export interface JournalRow {
  id: string;
  requestId: string;
  reference: string;
  event: string;
  eventLabel: string;
  title: string;
  requesterName: string;
  actorName: string;
  departmentName: string | null;
  estimatedTotal: number | null;
  note: string | null;
  createdAt: string;
  /** La copie complète de la demande à cet instant — dépliée à la demande. */
  snapshot: Record<string, unknown>;
}

const TON: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  APPROVED: "success",
  REJECTED: "danger",
  CHANGES_REQUESTED: "warning",
  WITHDRAWN: "warning",
  SUBMITTED: "neutral",
};

/**
 * LE JOURNAL, LU COMME ON LE LIT VRAIMENT.
 *
 * Une ligne par GESTE, la plus récente d'abord — et la copie complète sous le clic. On ne
 * l'affiche pas d'emblée : quarante lignes d'articles dépliées rendraient le journal
 * inconsultable, alors que la question courante est « qui a demandé quoi, et qui a tranché ».
 *
 * La recherche porte sur ce qu'on a en tête quand on ouvre cet écran : une référence lue sur un
 * bon, un nom de personne, un article, un département.
 */
export function PurchaseJournal({ rows, tronque }: { rows: JournalRow[]; tronque: number }) {
  const [query, setQuery] = React.useState("");
  const [ouvert, setOuvert] = React.useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visibles = React.useMemo(() => {
    if (!q) return rows;
    return rows.filter((r) =>
      [r.reference, r.title, r.requesterName, r.actorName, r.departmentName, r.note, JSON.stringify(r.snapshot)]
        .some((c) => c && String(c).toLowerCase().includes(q)));
  }, [rows, q]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8"
            placeholder="Une référence, un nom, un article, un département…" />
        </div>
        <span className="text-xs text-muted-foreground">{visibles.length} / {rows.length} geste(s)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Quand</th>
              <th className="px-3 py-2 text-left font-medium">Référence</th>
              <th className="px-3 py-2 text-left font-medium">Geste</th>
              <th className="px-3 py-2 text-left font-medium">Objet</th>
              <th className="px-3 py-2 text-left font-medium">Demandeur</th>
              <th className="px-3 py-2 text-left font-medium">Par</th>
              <th className="px-3 py-2 text-right font-medium">Estimé</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <React.Fragment key={r.id}>
                <tr className="border-b border-border/60 align-top hover:bg-secondary/40">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.reference}</td>
                  <td className="px-3 py-2"><Badge tone={TON[r.event] ?? "neutral"} dot={false}>{r.eventLabel}</Badge></td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{r.title}</span>
                    {r.departmentName && <span className="block text-xs text-muted-foreground">{r.departmentName}</span>}
                    {r.note && <span className="block text-xs text-muted-foreground">« {r.note} »</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.requesterName}</td>
                  <td className="px-3 py-2 text-xs">{r.actorName}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                    {r.estimatedTotal != null ? `${r.estimatedTotal.toLocaleString("fr-FR")} DZD` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button type="button" onClick={() => setOuvert((o) => (o === r.id ? null : r.id))}
                      title="Voir la copie complète enregistrée"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
                      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", ouvert === r.id && "rotate-90")} /> Détail
                    </button>
                  </td>
                </tr>
                {ouvert === r.id && (
                  <tr className="border-b border-border/60 bg-secondary/30">
                    <td colSpan={8} className="px-3 py-3">
                      {/* LA COPIE COMPLÈTE, telle qu'elle a été enregistrée. On la montre brute :
                          la remettre en forme reviendrait à la réinterpréter, et le journal doit
                          pouvoir être opposé à quelqu'un. */}
                      <p className="mb-2 text-xs text-muted-foreground">
                        Copie enregistrée le {formatDateTime(r.createdAt)} — telle quelle, jamais retouchée.
                        {" "}
                        <Link href={`/demandes/${r.requestId}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                          Ouvrir la demande <ExternalLink className="h-3 w-3" />
                        </Link>
                        {" "}(elle a pu être retirée depuis — la trace, elle, reste ici).
                      </p>
                      <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-background p-2.5 text-xs">
                        {JSON.stringify(r.snapshot, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {tronque > 0 && (
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          Les plus récents sont affichés ; {tronque.toLocaleString("fr-FR")} geste(s) plus ancien(s) restent au journal.
        </p>
      )}
    </div>
  );
}
