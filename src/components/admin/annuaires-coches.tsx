"use client";

import { ANNUAIRES_ACCORDABLES, LIBELLE_ANNUAIRE, LECTURE_POUR_TOUS } from "@/lib/annuaires/acces";

/**
 * LES ANNUAIRES D'UN ACCÈS PERSONNALISÉ — une case par annuaire (§118.147).
 *
 * Cocher un annuaire l'OUVRE à la personne, avec les gestes cochés sur la ligne « Annuaires »
 * (Créer, Modifier, Supprimer), sans lui donner le module de son référentiel. L'ouverture
 * s'AJOUTE à ce que son rôle lui donne déjà : décocher ici ne retire jamais un annuaire qu'elle
 * tient par la Promotion médicale ou les Moyens généraux — le dire évite de croire qu'on a fermé
 * une porte restée ouverte.
 *
 * Partagée : la console d'un COMPTE et l'écran « Accès par module » la montent toutes deux, pour
 * dire la même chose avec les mêmes mots — deux rédactions finiraient par diverger (§118.5).
 */
export function AnnuairesCoches({
  prefixe, sections, actif, onChange, compact = false,
}: {
  /** Le préfixe des cases dans le formulaire : `sect_<module>` ou `sect_<userId>`. */
  prefixe: string;
  sections: string[];
  /** Seul un accès PERSONNALISÉ porte des annuaires ; ailleurs les cases sont grisées. */
  actif: boolean;
  onChange: (sections: string[]) => void;
  compact?: boolean;
}) {
  const coches = new Set(sections);
  return (
    <div className="space-y-1.5">
      {!compact && (
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Annuaires ouverts par cet accès</strong> — chaque annuaire coché
          s&apos;ouvre avec les gestes cochés ci-dessus, sans donner le module de son référentiel.
          {!actif && " Choisissez « Personnalisé » pour en cocher."}
        </p>
      )}
      <div className={compact ? "flex flex-col gap-1" : "flex flex-wrap gap-x-4 gap-y-1.5"}>
        {ANNUAIRES_ACCORDABLES.map((cle) => (
          <label
            key={cle}
            className="inline-flex items-center gap-1.5 text-xs"
            title={LECTURE_POUR_TOUS.has(cle)
              ? "Tout le monde LIT déjà cet annuaire : le cocher n'ouvre que les gestes d'écriture cochés."
              : "Ouvre cet annuaire en entier — un référentiel, pas un portefeuille."}
          >
            <input
              type="checkbox"
              name={`${prefixe}_${cle}`}
              checked={actif && coches.has(cle)}
              disabled={!actif}
              onChange={(e) => {
                const next = new Set(coches);
                if (e.target.checked) next.add(cle); else next.delete(cle);
                onChange(ANNUAIRES_ACCORDABLES.filter((c) => next.has(c)));
              }}
              className="h-3.5 w-3.5 rounded border-input disabled:opacity-30"
            />
            {LIBELLE_ANNUAIRE[cle]}
            {LECTURE_POUR_TOUS.has(cle) && <span className="text-muted-foreground">(lecture pour tous)</span>}
          </label>
        ))}
      </div>
    </div>
  );
}
