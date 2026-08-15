"use client";

import * as React from "react";
import type { BudgetTarget } from "@/lib/budget/target";

/**
 * « DANS QUEL BUDGET ? » — la seule question que le module Budget pose à celui qui achète.
 *
 * L'assistante de direction classe ses dépenses dans les catégories de la Direction sans avoir
 * accès au module Budget : elle n'y voit ni montants, ni consommation, ni enveloppes — juste une
 * liste de destinations. C'est ce qui permet de tout tracer sans ouvrir un module entier à
 * quelqu'un dont ce n'est pas le métier.
 *
 * Quand aucune enveloppe n'est rattachée aux moyens généraux, le champ ne s'affiche pas : une
 * liste vide est plus déroutante qu'un champ absent.
 */
export function BudgetTargetField({
  targets,
  defaultValue = "",
  name = "budgetCategoryId",
  label = "Classement budgétaire",
}: {
  targets: BudgetTarget[];
  defaultValue?: string | null;
  name?: string;
  label?: string;
}) {
  if (targets.length === 0) return null;
  return (
    <label className="text-xs sm:col-span-3">
      {label}
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
      >
        <option value="">— À classer plus tard —</option>
        {targets.map((t) => (
          <option key={t.id} value={t.id}>{t.isSub ? `   ↳ ${t.label}` : t.label}</option>
        ))}
      </select>
      <span className="mt-1 block font-normal text-muted-foreground">
        Chaque article peut être classé à part, juste en dessous.
      </span>
    </label>
  );
}
