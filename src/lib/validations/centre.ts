/**
 * LE CENTRE DE VALIDATIONS — le pendant du centre de paiement, côté décisions.
 *
 * ── POURQUOI UN MODULE À PART ───────────────────────────────────────────────────────────────
 *
 * Le Directeur Général et le Super Admin reçoivent des demandes de validation de tous les
 * modules : un contrat ici, une dépense là, une pièce ailleurs. Elles se noyaient dans l'écran
 * commun des validations, entre leurs propres demandes et les blocs de suivi — au point qu'on
 * découvrait une signature attendue depuis six jours en cherchant autre chose.
 *
 * Le centre de paiement a réglé le même problème pour l'argent : un écran qui ne contient QUE ce
 * qu'on attend de vous, et rien de ce que vous attendez des autres. Celui-ci fait la même chose
 * pour les décisions.
 *
 * ── QUI Y SIÈGE ─────────────────────────────────────────────────────────────────────────────
 *
 * Le **Directeur Général** et le **Super Admin**. Pas le PDG : le centre de PAIEMENT est le sien,
 * et donner les deux à la même personne referait l'écran fourre-tout qu'on vient de découper.
 * C'est une décision d'organisation, écrite ici pour qu'on sache qu'elle a été prise.
 *
 * Module PUR — testé, sans base ni session : cette règle décide de qui voit passer les décisions
 * de toute l'entreprise, elle doit pouvoir se lire sans rien exécuter.
 */

/** Siège au centre de validations : le Directeur Général et le Super Admin, personne d'autre. */
export function sitsOnValidationCentre(user: { role: string }): boolean {
  return user.role === "SUPER_ADMIN" || user.role === "GENERAL_MANAGER";
}

export interface CentreValidationLike {
  actionable: boolean;
  deadline: string | null;
  createdAt: string;
}

export interface CentreCounters {
  /** Décidables MAINTENANT — c'est ce qui bloque quelqu'un. */
  aDecider: number;
  /** Assignées, mais en attente du validateur précédent. */
  aVenir: number;
  /** Échéance dépassée parmi les décidables : le chiffre qu'on regarde en premier. */
  enRetard: number;
  /** Décidables depuis plus de `dormantDays` jours, échéance ou non. */
  dormantes: number;
}

const DORMANT_DAYS = 7;

const jours = (depuis: string, maintenant: Date): number =>
  Math.floor((maintenant.getTime() - new Date(depuis).getTime()) / 86_400_000);

/**
 * CE QUE LE CENTRE AFFICHE EN TÊTE.
 *
 * « En retard » ne compte QUE les décidables : une demande qui attend le validateur précédent
 * n'est pas en retard de MON fait, et la compter ferait porter le chapeau à celui qui n'a pas
 * encore la main. « Dormantes » attrape l'autre moitié du problème — celles qui n'ont pas
 * d'échéance et que rien ne signale donc jamais.
 */
export function centreCounters(rows: readonly CentreValidationLike[], now: Date): CentreCounters {
  const decidables = rows.filter((r) => r.actionable);
  return {
    aDecider: decidables.length,
    aVenir: rows.length - decidables.length,
    enRetard: decidables.filter((r) => r.deadline !== null && new Date(r.deadline) < now).length,
    dormantes: decidables.filter((r) => jours(r.createdAt, now) >= DORMANT_DAYS).length,
  };
}

/**
 * L'ORDRE D'AFFICHAGE : ce qui bloque en premier, ce qui attend quelqu'un d'autre en dernier.
 *
 * Entre deux décidables, l'échéance tranche — et une demande SANS échéance ne passe pas devant
 * une demande datée : ne pas avoir donné de date n'est pas une urgence. À échéance égale, la
 * plus ancienne d'abord : c'est celle qui attend depuis le plus longtemps.
 */
export function sortForCentre<T extends CentreValidationLike>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;
    const da = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
    const db = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
