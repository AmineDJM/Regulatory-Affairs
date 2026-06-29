"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Input, Label } from "@/components/ui/input";

/**
 * Saisie de la DCI : une molécule unique OU une association (double, triple…).
 * Chaque ligne est une molécule (champ `molecule` répété) ; l'action serveur
 * recompose la DCI canonique (« A + B + C ») et stocke la liste structurée.
 * Volontairement très simple : un champ, un bouton « + Ajouter une molécule ».
 */
export function DciAssociationField({ defaultMolecules }: { defaultMolecules?: string[] }) {
  const init = defaultMolecules && defaultMolecules.length ? defaultMolecules : [""];
  const [rows, setRows] = React.useState<string[]>(init);

  function update(i: number, v: string) {
    setRows((r) => r.map((x, idx) => (idx === i ? v : x)));
  }
  function add() {
    setRows((r) => (r.length >= 5 ? r : [...r, ""]));
  }
  function remove(i: number) {
    setRows((r) => (r.length <= 1 ? r : r.filter((_, idx) => idx !== i)));
  }

  const filled = rows.filter((r) => r.trim()).length;
  const kindLabel = filled <= 1 ? "Molécule unique" : filled === 2 ? "Association double" : filled === 3 ? "Association triple" : `Association (${filled} molécules)`;

  return (
    <div className="col-span-2 space-y-1.5">
      <Label htmlFor="molecule-0">
        DCI (molécule ou association)
        <span className="ml-0.5 text-destructive">*</span>
      </Label>
      <div className="space-y-2">
        {rows.map((val, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-center text-xs font-medium text-muted-foreground">{i + 1}</span>
            <Input
              id={`molecule-${i}`}
              name="molecule"
              value={val}
              onChange={(e) => update(i, e.target.value)}
              required={i === 0}
              placeholder={i === 0 ? "Ex. Amoxicilline" : "Ex. Acide clavulanique"}
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                aria-label={`Retirer la molécule ${i + 1}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        {rows.length < 5 ? (
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter une molécule
          </button>
        ) : (
          <span />
        )}
        <span className="text-xs text-muted-foreground">{kindLabel}</span>
      </div>
      <p className="text-xs text-muted-foreground">Pour une association, ajoutez chaque molécule sur une ligne.</p>
    </div>
  );
}
