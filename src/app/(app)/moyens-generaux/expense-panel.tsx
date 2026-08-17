"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Receipt, Loader2, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { DEPT_BUDGET_LABEL } from "@/lib/department-budget";
import { addDepartmentExpense } from "@/lib/actions/department-budget-actions";
import { ReceiptLines, type CatalogArticle } from "./receipt-lines";
import { BudgetTargetField } from "./budget-target-field";
import type { BudgetTarget } from "@/lib/budget/target";

/**
 * AJOUTER UN ACHAT — le geste quotidien, à portée de clic.
 *
 * Il n'existait que par la caisse d'avance : un achat réglé autrement (virement, carte, facture
 * fournisseur payée par les Finances) n'avait aucun endroit où être saisi, et le budget restait
 * donc faux. Ce bouton-ci enregistre la dépense **directement sur le budget** — c'est le même
 * enregistrement, sans passer par l'argent liquide.
 *
 * La pièce est obligatoire, et le formulaire le dit avant qu'on ne clique : une dépense sans
 * facture ni bon de paiement n'est qu'une affirmation, et un budget bâti sur des affirmations
 * ne sert à rien.
 */
export function ExpensePanel({
  departmentId, year, remaining, articles, budgetTargets = [],
}: { departmentId: string; year: number; remaining: number; articles: CatalogArticle[]; budgetTargets?: BudgetTarget[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  // Le montant vient du DÉTAIL du ticket : il se calcule, il ne se saisit pas à côté.
  const [total, setTotal] = React.useState(0);

  const overBudget = total > 0 && total > remaining;

  return (
    <div className="space-y-2">
      {!open ? (
        <Button size="sm" onClick={() => { setOpen(true); setMsg(null); }}>
          <Plus className="h-4 w-4" /> Ajouter une dépense
        </Button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("departmentId", departmentId);
            fd.set("year", String(year));
            setBusy(true); setMsg(null);
            void addDepartmentExpense(fd).then((r) => {
              setBusy(false);
              setMsg({ ok: r.ok, text: r.ok ? "Dépense enregistrée et déduite du budget." : (r.error ?? "Échec.") });
              if (r.ok) { setOpen(false); setTotal(0); router.refresh(); }
            });
          }}
          className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3"
        >
          <p className="text-sm font-medium">Achat à imputer sur le budget</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs sm:col-span-2">
              Objet de l&apos;achat
              <Input name="label" placeholder="Facultatif — résumé depuis les articles si vide" className="mt-1 h-9" />
            </label>
            <label className="text-xs">
              Budget imputé
              <select name="kind" defaultValue="OPERATING" className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm">
                <option value="OPERATING">{DEPT_BUDGET_LABEL.OPERATING}</option>
                <option value="ACTIVITY">{DEPT_BUDGET_LABEL.ACTIVITY}</option>
              </select>
            </label>
            <BudgetTargetField targets={budgetTargets} />
            <label className="text-xs sm:col-span-3">
              Précisions
              <Input name="notes" placeholder="Facultatif — fournisseur, n° de facture…" className="mt-1 h-9" />
            </label>
          </div>

          <div className="rounded-lg border border-border bg-background p-2">
            <p className="mb-1.5 text-xs font-medium">
              Articles de la facture <span className="text-destructive">*</span>
              <span className="ml-1 font-normal text-muted-foreground">— le total en découle</span>
            </p>
            <ReceiptLines articles={articles} onTotalChange={setTotal} budgetTargets={budgetTargets} />
          </div>

          <label className="block text-xs">
            Scan de la facture ou du bon de paiement <span className="text-destructive">*</span>
            <input
              type="file" name="files" multiple required
              className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </label>

          {overBudget && (
            <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <span>
                Ce montant dépasse ce qu&apos;il reste sur la caisse de l&apos;exercice ({formatCurrency(remaining)}). La dépense
                sera enregistrée — mais le budget passera en dépassement, et cela se verra.
              </span>
            </p>
          )}

          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />} Enregistrer la dépense
            </Button>
            <Button size="sm" type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          </div>
        </form>
      )}

      {msg && (
        <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
