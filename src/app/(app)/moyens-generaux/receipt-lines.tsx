"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { normalizeLines, receiptTotal, parseAmount, parseQuantity } from "@/lib/general-means/receipt";
import type { BudgetTarget } from "@/lib/budget/target";

export interface CatalogArticle {
  id: string;
  name: string;
  unit: string | null;
  estimatedPrice: number | null;
}

interface Row {
  key: number;
  articleId: string;
  label: string;
  quantity: string;
  amount: string;
  /** Case budgétaire de CET article — vide = « comme le ticket ». */
  budgetCategoryId: string;
}

const empty = (key: number): Row => ({ key, articleId: "", label: "", quantity: "1", amount: "", budgetCategoryId: "" });

/** Lignes déjà enregistrées, telles qu'on les rouvre pour corriger un ticket. */
export interface ExistingLine {
  articleId?: string | null;
  label: string;
  quantity: number;
  amount: number;
  budgetCategoryId?: string | null;
}

/**
 * LE DÉTAIL D'UN TICKET DE CAISSE — les articles achetés, leur nombre et leur montant.
 *
 * Une dépense se saisissait en une ligne : un libellé, un total. On classait le justificatif
 * sans jamais savoir ce qu'il contenait. Ici, chaque article se choisit dans le CATALOGUE
 * (ou s'écrit librement pour un achat unique) et le total de la dépense se **calcule** :
 * il ne peut donc pas contredire le ticket qu'on vient de scanner.
 *
 * Les lignes partent au serveur dans un seul champ JSON — des champs numérotés se
 * désynchronisent dès qu'on supprime une ligne du milieu. Le serveur revalide tout de toute
 * façon, avec le même module que celui qui calcule le total affiché ici.
 */
export function ReceiptLines({
  articles,
  onTotalChange,
  initial,
  budgetTargets = [],
}: {
  articles: CatalogArticle[];
  onTotalChange?: (total: number) => void;
  /** Lignes existantes, à la réouverture d'un ticket pour correction. */
  initial?: ExistingLine[];
  /**
   * Cases budgétaires proposées. Vide = la colonne disparaît : tant que l'administration n'a
   * rattaché aucune enveloppe aux moyens généraux, demander « où classer ? » n'a pas de sens.
   */
  budgetTargets?: BudgetTarget[];
}) {
  const [rows, setRows] = React.useState<Row[]>(() =>
    initial && initial.length > 0
      ? initial.map((l, i) => ({
          key: i,
          articleId: l.articleId ?? "",
          label: l.articleId ? "" : l.label,
          quantity: String(l.quantity),
          amount: String(l.amount),
          budgetCategoryId: l.budgetCategoryId ?? "",
        }))
      : [empty(0)],
  );
  const nextKey = React.useRef(initial && initial.length > 0 ? initial.length : 1);

  const payload = React.useMemo(
    () => normalizeLines(rows.map((r) => ({
      articleId: r.articleId || null,
      label: r.label || (r.articleId ? articles.find((a) => a.id === r.articleId)?.name ?? "" : ""),
      quantity: r.quantity,
      amount: r.amount,
      budgetCategoryId: r.budgetCategoryId || null,
    }))),
    [rows, articles],
  );
  const total = receiptTotal(payload);

  React.useEffect(() => { onTotalChange?.(total); }, [total, onTotalChange]);

  const patch = (key: number, next: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...next } : r)));

  /**
   * Choisir un article pré-remplit le montant au prix indicatif du catalogue — une aide, pas une
   * vérité : c'est le ticket qui fait foi, et le champ reste modifiable. On n'écrase jamais un
   * montant déjà saisi.
   */
  const pickArticle = (row: Row, articleId: string) => {
    const a = articles.find((x) => x.id === articleId);
    const qty = parseQuantity(row.quantity);
    const suggested = a?.estimatedPrice != null && !row.amount
      ? String(Math.round(a.estimatedPrice * qty * 100) / 100)
      : row.amount;
    patch(row.key, { articleId, label: "", amount: suggested });
  };

  return (
    <div className="space-y-2">
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />

      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const article = articles.find((a) => a.id === r.articleId);
          return (
            <div key={r.key} className="grid grid-cols-12 items-center gap-1.5">
              <div className="col-span-12 sm:col-span-6">
                <select
                  value={r.articleId}
                  onChange={(e) => pickArticle(r, e.target.value)}
                  aria-label={`Article ${i + 1}`}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                >
                  <option value="">— Hors catalogue (à écrire) —</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.unit ? ` (${a.unit})` : ""}</option>
                  ))}
                </select>
                {!r.articleId && (
                  <Input
                    value={r.label}
                    onChange={(e) => patch(r.key, { label: e.target.value })}
                    placeholder="Ce qui a été acheté"
                    aria-label={`Désignation de l'article ${i + 1}`}
                    className="mt-1 h-9"
                  />
                )}
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input
                  value={r.quantity}
                  onChange={(e) => patch(r.key, { quantity: e.target.value })}
                  inputMode="decimal"
                  placeholder="1"
                  aria-label={`Quantité de l'article ${i + 1}`}
                  className="h-9 text-right tabular-nums"
                />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <Input
                  value={r.amount}
                  onChange={(e) => patch(r.key, { amount: e.target.value })}
                  inputMode="decimal"
                  placeholder="Montant"
                  aria-label={`Montant de l'article ${i + 1}`}
                  className="h-9 text-right tabular-nums"
                />
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-end">
                {/* La dernière ligne ne se supprime pas : un formulaire sans aucune ligne n'aurait
                    plus de point d'entrée, et il faudrait deviner comment en rajouter une. */}
                <button
                  type="button"
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [empty(nextKey.current++)]))}
                  aria-label={`Retirer l'article ${i + 1}`}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {budgetTargets.length > 0 && (
                <div className="col-span-12 sm:col-span-11 sm:col-start-1">
                  {/* Classement de CET article. « Comme le ticket » est le défaut : la plupart
                      des lignes suivent le classement général, seules les exceptions se règlent. */}
                  <select
                    value={r.budgetCategoryId}
                    onChange={(e) => patch(r.key, { budgetCategoryId: e.target.value })}
                    aria-label={`Classement budgétaire de l'article ${i + 1}`}
                    className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs text-muted-foreground"
                  >
                    <option value="">Budget : comme le ticket</option>
                    {budgetTargets.map((t) => (
                      <option key={t.id} value={t.id}>{t.isSub ? `   ↳ ${t.label}` : t.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {article?.estimatedPrice != null && (
                <p className="col-span-12 -mt-0.5 text-[0.6875rem] text-muted-foreground sm:col-start-7 sm:col-span-6 sm:text-right">
                  Prix indicatif catalogue : {formatCurrency(article.estimatedPrice)}
                  {parseAmount(r.amount) != null && parseAmount(r.amount) !== article.estimatedPrice * parseQuantity(r.quantity)
                    ? " — le ticket fait foi"
                    : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, empty(nextKey.current++)])}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter un article
        </button>
        <p className="text-sm">
          <span className="text-muted-foreground">Total du ticket : </span>
          <strong className="tabular-nums">{formatCurrency(total)}</strong>
        </p>
      </div>
    </div>
  );
}
