/**
 * QUELLE CAISSE D'AVANCE L'ÉCRAN OUVRE — et pourquoi ce n'est pas « le mois courant ».
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * L'écran des Moyens généraux ouvrait sur `currentPeriod()` : le mois du calendrier. Le 1er du
 * mois à minuit, il basculait donc sur un mois pour lequel AUCUNE caisse n'existe encore — et
 * tout se bloquait d'un coup : plus de solde, plus de dépense possible, et le message « Aucune
 * caisse d'avance ouverte pour cette période » alors que la caisse du mois précédent est encore
 * ouverte, alimentée, et contient de l'argent qu'on n'a pas fini de dépenser.
 *
 * Le trou est PIRE que le message ne le laisse croire : la caisse d'août n'était pas soldée, elle
 * était devenue INVISIBLE. Il fallait connaître l'existence du paramètre `?period=2026-08` pour
 * la retrouver. Personne ne le devine.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────────────────────
 *
 * Une caisse d'avance ne se ferme pas au changement de mois : elle se ferme quand on la SOLDE.
 * L'écran ouvre donc sur :
 *
 *   1. le mois EXPLICITEMENT demandé, quand la personne en a choisi un — on ne la contredit pas ;
 *   2. sinon le mois courant, s'il a une caisse ;
 *   3. sinon la caisse OUVERTE la plus récente — c'est celle où l'argent se trouve ;
 *   4. sinon le mois courant, qui devient l'invitation à en ouvrir une.
 *
 * ── CE QU'ON NE FAIT PAS ────────────────────────────────────────────────────────────────────
 *
 * On ne reporte RIEN et on n'ouvre rien tout seul. Créer d'office la caisse du mois suivant
 * reviendrait à inventer une dotation que personne n'a remise — et le solde afficherait un argent
 * qui n'est pas dans le tiroir. La caisse d'août reste la caisse d'août ; on cesse simplement de
 * la cacher.
 *
 * Module PUR : cette règle décide quel argent une personne voit, elle doit se lire sans base.
 */

export interface PeriodCash {
  period: string;
  /** `ALLOTTED` (remise, pas encore confirmée), `RECEIVED` (en main), `CLOSED` (soldée). */
  status: string;
}

export interface ActivePeriod {
  /** Le mois à afficher, au format « AAAA-MM ». */
  period: string;
  /** Vrai quand ce n'est pas le mois courant — l'écran doit alors le DIRE. */
  carriedOver: boolean;
}

/** Une caisse encore vivante : ni soldée, ni inexistante. */
const ouverte = (c: PeriodCash): boolean => c.status !== "CLOSED";

/**
 * LE MOIS QUE L'ÉCRAN OUVRE.
 *
 * `requested` est le choix explicite de la personne (paramètre d'URL) : il l'emporte toujours,
 * même sur un mois vide — on ne peut pas ouvrir une caisse pour un mois qu'on refuse d'afficher.
 */
export function activePeriod(
  requested: string | null | undefined,
  current: string,
  caisses: readonly PeriodCash[],
): ActivePeriod {
  if (requested) return { period: requested, carriedOver: requested !== current };
  if (caisses.some((c) => c.period === current)) return { period: current, carriedOver: false };

  // La plus RÉCENTE encore ouverte. Le tri est lexicographique, ce qui suffit : « AAAA-MM » se
  // compare comme une date tant que le mois est sur deux chiffres — et il l'est, par construction.
  const derniere = caisses
    .filter(ouverte)
    .map((c) => c.period)
    .filter((p) => p < current)
    .sort()
    .pop();

  return derniere ? { period: derniere, carriedOver: true } : { period: current, carriedOver: false };
}

/**
 * CE QU'ON DIT quand l'écran n'ouvre pas sur le mois courant — ou `null` s'il n'y a rien à dire.
 *
 * Sans cette phrase, on lit un solde en croyant qu'il est celui du mois en cours, et l'on impute
 * une dépense de septembre à la caisse d'août sans s'en apercevoir.
 */
export function carriedOverMessage(active: ActivePeriod, currentLabel: string, activeLabel: string): string | null {
  if (!active.carriedOver) return null;
  return `Aucune caisse d'avance n'est ouverte pour ${currentLabel} : voici celle de ${activeLabel}, encore ouverte. Les dépenses que vous saisissez ici s'imputent à ${activeLabel}.`;
}
