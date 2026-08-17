import type { FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { LEGAL_DOC_KIND } from "@/lib/labels";

/**
 * LES CHAMPS D'UN DOCUMENT LÉGAL — une seule définition pour la création ET la modification.
 *
 * Deux listes séparées finiraient par diverger : on ajouterait un champ à la création, la fiche
 * ne saurait plus le corriger, et l'on aurait un engagement qu'on ne peut plus rectifier.
 */
export function legalFields(values: Partial<Record<string, string>> = {}): FieldDef[] {
  const v = (k: string) => values[k] ?? undefined;
  return [
    { type: "text", name: "title", label: "Titre exact du document", required: true, full: true, defaultValue: v("title") },
    { type: "text", name: "reference", label: "Référence / n°", defaultValue: v("reference") },
    { type: "select", name: "kind", label: "Nature", options: optionsFromMap(LEGAL_DOC_KIND), defaultValue: v("kind") ?? "CONTRACT" },
    { type: "text", name: "counterparty", label: "Partie (fournisseur, client, prestataire)", full: true, defaultValue: v("counterparty") },
    { type: "date", name: "startDate", label: "Date de début (facultative)", defaultValue: v("startDate") },
    { type: "date", name: "endDate", label: "Date de fin — vide = sans échéance", defaultValue: v("endDate") },
    { type: "number", name: "amount", label: "Montant (DZD)", defaultValue: v("amount") },
    { type: "textarea", name: "notes", label: "Notes", full: true, defaultValue: v("notes") },
  ];
}

/** Une date pour un `<input type="date">`, dans le fuseau du serveur (celui qui la relira). */
export function dateInput(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
