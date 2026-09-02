"use client";

import * as React from "react";
import { FileText, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DEPT_BUDGET_LABEL } from "@/lib/department-budget";
import { ExpenseRowActions } from "./expense-row-actions";
import type { BudgetTarget } from "@/lib/budget/target";
import type { CatalogArticle } from "./receipt-lines";
import type { GeneralMeansExpense } from "@/lib/queries/general-means";

/**
 * TOUTES LES DÉPENSES, EN UN TABLEAU QUI SE FILTRE.
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * Il y avait DEUX listes : « Dépenses de la caisse (10) » et « Toutes les dépenses 2026 (11) ».
 * La première était un sous-ensemble de la seconde — les mêmes achats, à deux endroits, avec deux
 * compteurs qui ne se recoupaient pas tout à fait (la caisse montrait un mois, l'année montrait
 * l'année). On ne savait plus laquelle lire, ni laquelle corriger, et l'on comptait deux fois.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────────────────────
 *
 * Une seule liste. Ce qui séparait les deux — « payé sur la caisse d'avance » — devient un
 * FILTRE : la question reste posable, sans qu'aucune dépense n'existe en double. Le filtre
 * affiche le total de ce qu'il montre, sans quoi il ne servirait qu'à masquer des lignes.
 *
 * Un tableau plutôt qu'une liste : la date, le montant et le classement se comparent d'une
 * ligne à l'autre, ce qu'un empilement de paragraphes ne permet pas.
 */

type Filtre = "ALL" | "CASH" | "OFF_CASH";

const FILTRES: { key: Filtre; label: string }[] = [
  { key: "ALL", label: "Toutes" },
  { key: "CASH", label: "Caisse d'avance" },
  { key: "OFF_CASH", label: "Hors caisse" },
];

export function ExpenseTable({
  expenses, canSpend, canAmendCash, articles, budgetTargets, cashUsable,
}: {
  expenses: GeneralMeansExpense[];
  canSpend: boolean;
  /** Peut-on corriger une dépense payée en LIQUIDE ? (détenteur de la caisse, ou direction) */
  canAmendCash: boolean;
  articles: CatalogArticle[];
  budgetTargets: BudgetTarget[];
  cashUsable: boolean;
}) {
  const [filtre, setFiltre] = React.useState<Filtre>("ALL");

  const rows = React.useMemo(() => (
    filtre === "ALL" ? expenses
      : expenses.filter((e) => (filtre === "CASH" ? e.fromPettyCash : !e.fromPettyCash))
  ), [expenses, filtre]);
  const total = rows.reduce((a, e) => a + e.amount, 0);
  const cashCount = expenses.filter((e) => e.fromPettyCash).length;

  if (expenses.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Aucune dépense imputée cette année. Les achats enregistrés ici alimentent la consommation de la caisse —
        c&apos;est ce qui permet de confronter la caisse de l&apos;exercice à ce qui en a réellement été dépensé.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-1">
        <div className="flex flex-wrap gap-1">
          {FILTRES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltre(f.key)}
              aria-pressed={filtre === f.key}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                filtre === f.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f.label}
              {f.key === "CASH" && cashCount > 0 && <span className="ml-1 tabular-nums opacity-70">({cashCount})</span>}
            </button>
          ))}
        </div>
        {/* LE TOTAL DE CE QUI EST AFFICHÉ. Un filtre qui ne recalcule rien ne fait que cacher
            des lignes : c'est justement le total filtré qu'on vient chercher. */}
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} dépense{rows.length > 1 ? "s" : ""} · <strong className="tabular-nums text-foreground">{formatCurrency(total)}</strong>
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">
          Aucune dépense {filtre === "CASH" ? "payée sur la caisse d'avance" : "payée hors caisse"} cette année.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-y border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Dépense</th>
                <th scope="col" className="px-3 py-2 font-medium">Classement</th>
                <th scope="col" className="px-3 py-2 font-medium">Paiement</th>
                <th scope="col" className="px-3 py-2 font-medium">Date</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Montant</th>
                <th scope="col" className="px-3 py-2 font-medium">Pièces</th>
                {canSpend && <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{e.label}</span>
                    {e.notes && <span className="block text-xs text-muted-foreground">{e.notes}</span>}
                    {/* LE DÉTAIL DU TICKET. Sans lui, on relit « courses — 12 400 DZD » six mois
                        plus tard sans savoir ce qui a été acheté. */}
                    {e.lines.length > 0 && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {e.lines.map((l) => `${l.quantity > 1 ? `${l.quantity}× ` : ""}${l.label} (${formatCurrency(l.amount)})`).join(" · ")}
                      </span>
                    )}
                    {e.createdBy && <span className="block text-[0.6875rem] text-muted-foreground">{e.createdBy}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className="text-muted-foreground">{DEPT_BUDGET_LABEL[e.kind]}</span>
                    {e.budgetLabel && <span className="block text-muted-foreground">{e.budgetLabel}</span>}
                    {/* « À classer » se dit ICI, là où la dépense se corrige — pas dans le module
                        Budget, que la personne qui achète n'ouvre jamais. */}
                    {budgetTargets.length > 0 && e.toClassify && <Badge tone="warning" dot={false}>à classer</Badge>}
                  </td>
                  <td className="px-3 py-2.5">
                    {e.fromPettyCash
                      ? <Badge tone="info" dot={false}>caisse d&apos;avance</Badge>
                      : <span className="text-xs text-muted-foreground">hors caisse</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{formatDate(e.date)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(e.amount)}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap items-center gap-1">
                      {e.documents.length === 0 ? (
                        <Badge tone="danger" dot={false}>sans pièce</Badge>
                      ) : e.documents.map((d) => (
                        <a
                          key={d.id}
                          href={`/api/documents/${d.id}?dl=1`}
                          title={d.name}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[0.6875rem] hover:bg-secondary"
                        >
                          <FileText className="h-3 w-3" /> <Download className="h-3 w-3" />
                        </a>
                      ))}
                    </span>
                  </td>
                  {canSpend && (
                    <td className="px-3 py-2.5">
                      {/* Corriger ou supprimer se fait ICI, là où l'erreur se voit. Le serveur
                          revérifie le droit : sur une dépense payée en liquide, seule la personne
                          qui détient la caisse (ou la direction) y touche. */}
                      {(!e.fromPettyCash || canAmendCash) && (
                        <ExpenseRowActions
                          expense={{
                            id: e.id, label: e.label, amount: e.amount, kind: e.kind, notes: e.notes,
                            fromPettyCash: e.fromPettyCash, budgetCategoryId: e.budgetCategoryId, lines: e.lines,
                          }}
                          articles={articles}
                          budgetTargets={budgetTargets}
                          cashUsable={cashUsable}
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
