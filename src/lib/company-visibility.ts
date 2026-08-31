/**
 * CE QUE LE FILTRE D'ENTITÉ CACHE — dit, au lieu d'être subi.
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * Le sélecteur d'entité de la barre supérieure filtre les listes de tous les modules. C'est le
 * cloisonnement, et il est voulu. Mais il est SILENCIEUX : on ouvre les courriers et l'on compte
 * dix-neuf plis, on y revient plus tard et l'on en compte quatorze — parce qu'entre-temps la
 * portée a changé, ou qu'on l'avait laissée sur une société. Rien à l'écran ne relie les deux
 * faits, et l'on conclut que le module perd des données.
 *
 * Un filtre qui retire des lignes doit DIRE combien il en retire. C'est la différence entre un
 * cloisonnement et une disparition.
 *
 * ── POURQUOI UNE FONCTION PURE ──────────────────────────────────────────────────────────────
 *
 * Chaque écran compte ses lignes à sa façon (portée métier, filtres, droits) ; seul le MESSAGE
 * est commun. Le calcul de « combien manque-t-il » reste chez l'appelant, la phrase vit ici —
 * une seule formulation, testée, plutôt que six variantes qui divergent.
 */

export interface HiddenByScope {
  /** Lignes affichées avec le filtre d'entité. */
  shown: number;
  /** Lignes visibles par cette personne, toutes entités confondues. */
  total: number;
  /** Le nom de l'entité sélectionnée, quand il y en a une. */
  companyLabel: string | null;
}

/** Combien de lignes le filtre retire. Jamais négatif : un total incohérent ne crée pas d'alerte. */
export function hiddenCount(x: HiddenByScope): number {
  return Math.max(0, x.total - x.shown);
}

/**
 * LA PHRASE À AFFICHER, ou `null` quand il n'y a rien à dire.
 *
 * On ne parle que si des lignes MANQUENT réellement. Une bannière permanente « vous êtes sur
 * Adventum » devient un décor qu'on ne lit plus au bout de deux jours ; celle-ci n'apparaît que
 * le jour où elle explique quelque chose.
 */
export function hiddenByScopeMessage(x: HiddenByScope): string | null {
  const manquantes = hiddenCount(x);
  if (manquantes === 0) return null;
  const quoi = manquantes === 1 ? "1 ligne est masquée" : `${manquantes} lignes sont masquées`;
  return x.companyLabel
    ? `${quoi} par le filtre d'entité (${x.companyLabel}). Choisissez « Toutes les entités » en haut pour les voir.`
    : `${quoi} par votre périmètre d'entités.`;
}
