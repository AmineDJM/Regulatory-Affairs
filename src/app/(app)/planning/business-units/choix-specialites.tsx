"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cleDeSpecialite } from "@/lib/annuaires/specialites";

/**
 * CHOISIR LES SPÉCIALITÉS D'UNE BU (§118.183) — plusieurs, dont une principale FACULTATIVE.
 *
 * Contrôlé : la création d'une BU et l'édition d'une BU existante lisent le même choix. Deux pickers
 * auraient divergé sur la seule règle qui compte ici — la principale fait partie des spécialités cochées.
 * Décocher la principale la retire comme principale : on ne garde jamais une principale qui n'est plus
 * cochée (l'action la refuserait, et le bouton aurait menti).
 */
export interface ChoixSpecialitesValeur {
  ids: string[];
  principaleId: string | null;
}

export function ChoixSpecialites({
  referentiel, valeur, onChange, disabled,
}: {
  referentiel: { id: string; name: string }[];
  valeur: ChoixSpecialitesValeur;
  onChange: (v: ChoixSpecialitesValeur) => void;
  disabled?: boolean;
}) {
  const [filtre, setFiltre] = React.useState("");
  // LA MÊME CLÉ que la résolution d'un texte (`cleDeSpecialite`) : un filtre qui plierait autrement les
  // accents trouverait « pediatrie » ici et pas là.
  const visibles = referentiel.filter((s) => !filtre.trim() || cleDeSpecialite(s.name).includes(cleDeSpecialite(filtre)));
  const coche = new Set(valeur.ids);

  function basculer(id: string) {
    const ids = coche.has(id) ? valeur.ids.filter((x) => x !== id) : [...valeur.ids, id];
    onChange({ ids, principaleId: valeur.principaleId && ids.includes(valeur.principaleId) ? valeur.principaleId : null });
  }

  if (referentiel.length === 0) {
    // UN MENU VIDE EST UN CUL-DE-SAC : on dit où le référentiel se remplit.
    return (
      <p className="text-xs text-muted-foreground">
        Le référentiel des spécialités est vide : ajoutez-les dans Marketing cockpit › Spécialités (le même écran qu'Annuaires › Spécialités), puis revenez les cocher.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <input
        type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} disabled={disabled}
        // DANS LE TIROIR DE CRÉATION, ce champ vit dans un formulaire : Entrée y soumettrait la BU à
        // moitié remplie. Filtrer n'envoie rien.
        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
        placeholder="Filtrer les spécialités…" aria-label="Filtrer les spécialités"
        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
      />
      <ul className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5" aria-label="Spécialités du référentiel">
        {visibles.map((s) => {
          const estCochee = coche.has(s.id);
          const estPrincipale = valeur.principaleId === s.id;
          return (
            <li key={s.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-secondary/60">
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <input type="checkbox" checked={estCochee} onChange={() => basculer(s.id)} disabled={disabled} />
                <span className="truncate">{s.name}</span>
              </label>
              {estCochee && (
                <button
                  type="button" disabled={disabled}
                  onClick={() => onChange({ ...valeur, principaleId: estPrincipale ? null : s.id })}
                  aria-pressed={estPrincipale}
                  title={estPrincipale ? "Retirer comme principale" : "Faire la spécialité principale"}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] ${estPrincipale ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "text-muted-foreground hover:bg-secondary"}`}
                >
                  <Star className={`h-3 w-3 ${estPrincipale ? "fill-current" : ""}`} aria-hidden />
                  {estPrincipale ? "Principale" : "Principale ?"}
                </button>
              )}
            </li>
          );
        })}
        {visibles.length === 0 && <li className="px-1.5 py-1 text-xs text-muted-foreground">Aucune spécialité ne correspond à « {filtre} ».</li>}
      </ul>
      <p className="text-xs text-muted-foreground">
        {valeur.ids.length === 0
          ? "Aucune spécialité cochée."
          : `${valeur.ids.length} spécialité(s) cochée(s)${valeur.principaleId ? "" : " — aucune principale (facultative)"}.`}
      </p>
    </div>
  );
}
