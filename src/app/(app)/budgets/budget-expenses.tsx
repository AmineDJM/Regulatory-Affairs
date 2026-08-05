"use client";

import * as React from "react";
import { Pencil, Trash2, Inbox, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { attributeTransaction, deleteBudgetExpense } from "@/lib/actions/budget-envelope-actions";
import type { BudgetOverview, AttributedTx } from "@/lib/queries/budget";
import { useRun, AddExpenseRow, ExpenseEditSheet } from "./budget-forms";

/**
 * BUDGETS — écran « DÉPENSES ». C'est ici qu'on TRAVAILLE, et nulle part ailleurs.
 *
 * Une seule chose à faire en arrivant : ranger ce qui n'est pas rangé. Les dépenses non
 * imputées viennent donc EN PREMIER — elles faussent tous les chiffres tant qu'elles
 * traînent — et le reste (l'historique de ce qui est déjà imputé) vient après.
 */
export function BudgetExpenses({ overview, canAttribute }: { overview: BudgetOverview; canAttribute: boolean }) {
  const { run } = useRun();
  const [editExpense, setEditExpense] = React.useState<AttributedTx | null>(null);
  const cats = overview.categories;

  const assign = (transactionId: string, categoryId: string) => {
    const fd = new FormData();
    fd.set("transactionId", transactionId);
    if (categoryId) fd.set("budgetCategoryId", categoryId);
    run(() => attributeTransaction(fd));
  };

  return (
    <div className="space-y-5">
      {/* 1. À RANGER — la seule tâche de cet écran. */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-warning" />
          <h2 className="text-sm font-semibold">À imputer</h2>
          {overview.unattributed.total > 0 && <Badge tone="warning" dot={false}>{formatCurrency(overview.unattributed.total)}</Badge>}
        </div>
        {overview.unattributed.transactions.length === 0 ? (
          <p className="surface flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <CheckCheck className="h-4 w-4 text-success" /> Tout est rangé — chaque dépense de la période est rattachée à une catégorie.
          </p>
        ) : (
          <ul className="surface divide-y divide-border">
            {overview.unattributed.transactions.map((tx) => (
              <li key={tx.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{tx.label}</p>
                  <p className="text-xs text-muted-foreground">{tx.reference} · {formatDate(tx.date)}{tx.counterparty ? ` · ${tx.counterparty}` : ""}</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(tx.amount)}</span>
                {canAttribute ? (
                  <Select defaultValue="" onChange={(e) => assign(tx.id, e.target.value)} className="h-9 w-48 text-xs" aria-label={`Imputer ${tx.label}`}>
                    <option value="">Imputer à…</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.parentId ? `↳ ${c.name}` : c.name}</option>)}
                  </Select>
                ) : <Badge tone="neutral" dot={false}>Non imputé</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. Saisir une dépense purement budgétaire (sans impact trésorerie). */}
      {canAttribute && cats.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Ajouter une dépense</h2>
          <AddExpenseRow categories={cats} />
        </section>
      )}

      {/* 3. L'historique de ce qui est déjà imputé. */}
      {overview.attributed.transactions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Déjà imputé <span className="font-normal text-muted-foreground">({overview.attributed.count})</span>
          </h2>
          <ul className="surface divide-y divide-border">
            {overview.attributed.transactions.map((tx) => (
              <li key={`${tx.kind}-${tx.id}`} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{tx.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tx.categoryName} · {tx.reference} · {formatDate(tx.date)}{tx.counterparty ? ` · ${tx.counterparty}` : ""}
                  </p>
                </div>
                {tx.kind === "BUDGET" && <Badge tone="neutral" dot={false}>Budgétaire</Badge>}
                <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(tx.amount)}</span>
                {!canAttribute ? null : tx.kind === "FINANCE" ? (
                  // Dépense de trésorerie : ré-imputable ici, mais elle se supprime dans les Finances.
                  <Select defaultValue={tx.categoryId} onChange={(e) => assign(tx.id, e.target.value)} className="h-9 w-48 text-xs" aria-label={`Ré-imputer ${tx.label}`}>
                    <option value="">— Retirer l&apos;imputation —</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.parentId ? `↳ ${c.name}` : c.name}</option>)}
                  </Select>
                ) : (
                  <div className="flex items-center gap-0.5">
                    <button
                      title="Modifier cette ligne budgétaire" onClick={() => setEditExpense(tx)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      title="Supprimer cette ligne budgétaire"
                      onClick={() => {
                        if (window.confirm(`Supprimer la dépense « ${tx.label} » ? La consommation de la catégorie sera réajustée.`)) {
                          const fd = new FormData(); fd.set("id", tx.id); run(() => deleteBudgetExpense(fd));
                        }
                      }}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {editExpense && <ExpenseEditSheet tx={editExpense} categories={cats} onClose={() => setEditExpense(null)} />}
    </div>
  );
}
