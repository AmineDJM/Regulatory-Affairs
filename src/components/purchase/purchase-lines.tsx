import * as React from "react";
import { estimatedTotal, type PurchaseLine } from "@/lib/general-means/purchase-request";
import { formatCurrency } from "@/lib/utils";

/**
 * LES ARTICLES D'UNE DEMANDE D'ACHAT, tels que le N+1 les valide et que l'assistante les achète
 * (§118.185 — audit 360°, I14).
 *
 * Deux formes, et un seul rendu des prix : `compact` pour la carte de validation (une ligne par
 * article, sans coupe — un titre « (+2) » cachait justement ce qu'on validait), la table pour la
 * fiche. Le total est INDICATIF : il vient des prix du catalogue, et le dire évite qu'on le lise
 * comme un engagement (`estimatedTotal` rend `null` quand aucun prix n'est connu — jamais « 0 »).
 */
export function PurchaseLines({ lines, compact = false }: { lines: PurchaseLine[]; compact?: boolean }) {
  if (lines.length === 0) return null;
  const total = estimatedTotal(lines);
  const prix = (l: PurchaseLine) => (l.unitPrice != null ? formatCurrency(l.unitPrice * l.quantity) : "—");

  if (compact) {
    return (
      <ul className="space-y-0.5 text-sm text-muted-foreground">
        {lines.map((l, i) => (
          <li key={`${l.articleId ?? "libre"}-${i}`}>
            <span className="font-medium text-foreground">{l.quantity}×</span> {l.label}
          </li>
        ))}
        {total != null && <li className="text-xs">Total indicatif (prix du catalogue) : {formatCurrency(total)}</li>}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-1.5 pr-3 font-medium">Article</th>
            <th className="py-1.5 pr-3 text-right font-medium">Quantité</th>
            <th className="py-1.5 pr-3 text-right font-medium">Prix unitaire indicatif</th>
            <th className="py-1.5 text-right font-medium">Total indicatif</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={`${l.articleId ?? "libre"}-${i}`} className="border-b border-border/60 last:border-0">
              <td className="py-1.5 pr-3">
                {l.label}
                {!l.articleId && <span className="ml-1 text-xs text-muted-foreground">(hors catalogue)</span>}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{l.quantity}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{l.unitPrice != null ? formatCurrency(l.unitPrice) : "—"}</td>
              <td className="py-1.5 text-right tabular-nums">{prix(l)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="pt-2 text-right text-xs text-muted-foreground">
              {total != null ? "Total indicatif — prix du catalogue, la facture fera foi" : "Aucun prix connu : le total viendra de la facture"}
            </td>
            <td className="pt-2 text-right font-semibold tabular-nums">{total != null ? formatCurrency(total) : "—"}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
