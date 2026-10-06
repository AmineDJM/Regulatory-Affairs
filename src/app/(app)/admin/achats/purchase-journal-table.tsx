"use client";

import * as React from "react";
import Link from "next/link";
import { Search, ChevronRight, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
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
        <div className="relative min-w-0 flex-1 basis-full sm:basis-auto">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="h-10 pl-8 sm:h-9"
            placeholder="Une référence, un nom, un article, un département…" />
        </div>
        <span className="text-xs text-muted-foreground">{visibles.length} / {rows.length} geste(s)</span>
      </div>

      {/* Une ligne par geste : au téléphone chaque geste devient une carte, sa copie complète s'ouvre dessous. */}
      <Table mobileCards className="max-sm:p-3 sm:min-w-[52rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Quand</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Geste</TableHead>
              <TableHead>Objet</TableHead>
              <TableHead>Demandeur</TableHead>
              <TableHead>Par</TableHead>
              <TableHead className="text-right">Estimé</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((r) => (
              <React.Fragment key={r.id}>
                <TableRow className="align-top">
                  <TableCell className="whitespace-nowrap py-2 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap py-2 font-mono text-xs">{r.reference}</TableCell>
                  <TableCell className="py-2"><Badge tone={TON[r.event] ?? "neutral"} dot={false}>{r.eventLabel}</Badge></TableCell>
                  <TableCell className="py-2">
                    <span>
                      <span className="font-medium">{r.title}</span>
                      {r.departmentName && <span className="block text-xs text-muted-foreground">{r.departmentName}</span>}
                      {r.note && <span className="block text-xs text-muted-foreground">« {r.note} »</span>}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 text-xs">{r.requesterName}</TableCell>
                  <TableCell className="py-2 text-xs">{r.actorName}</TableCell>
                  <TableCell className="whitespace-nowrap py-2 text-right text-xs">
                    {r.estimatedTotal != null ? `${r.estimatedTotal.toLocaleString("fr-FR")} DZD` : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-2 text-right">
                    <button type="button" onClick={() => setOuvert((o) => (o === r.id ? null : r.id))}
                      title="Voir la copie complète enregistrée"
                      className="inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground sm:min-h-0 sm:w-auto">
                      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", ouvert === r.id && "rotate-90")} /> Détail
                    </button>
                  </TableCell>
                </TableRow>
                {ouvert === r.id && (
                  <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                    <TableCell colSpan={8} data-sans-etiquette className="py-3">
                      <div className="w-full min-w-0">
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
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
      </Table>

      {tronque > 0 && (
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          Les plus récents sont affichés ; {tronque.toLocaleString("fr-FR")} geste(s) plus ancien(s) restent au journal.
        </p>
      )}
    </div>
  );
}
