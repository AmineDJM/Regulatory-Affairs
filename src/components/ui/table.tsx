import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tableaux — lisibles au bureau ET au téléphone.
 *
 * Deux modes :
 *   • par défaut : tableau classique, défilement horizontal **tactile** avec inertie ;
 *   • `mobileCards` : sur mobile (< sm) chaque LIGNE devient une CARTE empilée, chaque
 *     cellule affichant son intitulé à gauche (repris de `TableCell label="…"`). C'est le
 *     mode à privilégier pour les tableaux larges (budgets, Regulatory, marchés…) : plus
 *     aucun défilement latéral, tout se lit au pouce.
 *
 * Le mode cartes est piloté en CSS pur (classes `mobile-cards`, voir globals.css) : aucun
 * JavaScript, aucun surcoût de rendu, et le tableau reste sémantiquement un `<table>`.
 */

export function Table({
  className, mobileCards = false, ...props
}: React.TableHTMLAttributes<HTMLTableElement> & { mobileCards?: boolean }) {
  return (
    <div className={cn("relative w-full", mobileCards ? "sm:overflow-x-auto" : "overflow-x-auto [-webkit-overflow-scrolling:touch]")}>
      <table className={cn("w-full caption-bottom text-sm", mobileCards && "mobile-cards", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b bg-muted/40", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-border transition-colors hover:bg-secondary/50 data-[state=selected]:bg-secondary",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Cellule. `label` sert d'intitulé en mode cartes sur mobile (et n'a aucun effet ailleurs) :
 * `<TableCell label="Montant">…</TableCell>`.
 */
export function TableCell({
  className, label, ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { label?: string }) {
  // py-3 sur mobile : cibles tactiles confortables ; py-2.5 comme avant au-delà.
  return <td data-label={label} className={cn("px-3 py-3 align-middle sm:py-2.5", className)} {...props} />;
}
