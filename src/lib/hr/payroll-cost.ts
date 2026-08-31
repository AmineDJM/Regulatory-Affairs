/**
 * LA MASSE SALARIALE — ce que les salaires coûtent VRAIMENT à la société.
 *
 * Le brut est ce qui figure au bulletin ; le COÛT EMPLOYEUR est ce que la société décaisse,
 * charges patronales comprises. Deux personnes au même brut ne coûtent pas la même chose :
 * additionner des bruts donne une masse salariale fausse — et c'est pourtant celle-là qu'on
 * oppose au budget.
 *
 * On lit donc le coût employeur EN PRIORITÉ, et l'on retombe sur le brut là où il n'a pas été
 * saisi (les mois antérieurs à ce champ). Ce repli n'est jamais silencieux : `costBasis` dit
 * sur quoi le chiffre repose, et l'écran l'affiche. Un indicateur dont on ignore la base est un
 * indicateur qu'on finit par ne plus croire.
 *
 * Ce qui n'est PAS fait ici, volontairement : deviner un coût employeur en appliquant un taux
 * de charges moyen à un brut. Cela remplirait les colonnes vides de chiffres plausibles et faux,
 * dans un module qui sert à décider.
 *
 * Module PUR — testé, sans base de données.
 */

/** Une ligne de paie, réduite à ce qui compte pour le coût. */
export interface PayrollCostInput {
  /** Coût employeur du mois — `null` sur les mois saisis avant l'introduction du champ. */
  employerCost?: number | null;
  /** Brut du bulletin — repli historique. */
  gross?: number | null;
  bonuses?: number | null;
  deductions?: number | null;
}

/** Sur quoi repose le chiffre affiché. */
export type CostBasis = "EMPLOYER_COST" | "GROSS" | "BASE_SALARY" | "NONE";

const num = (v: number | null | undefined): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Le coût d'UNE ligne de paie.
 *
 * Le coût employeur, quand il est saisi, se suffit : primes et retenues sont DÉJÀ dedans —
 * c'est un total, pas une base. Y rajouter les primes les compterait deux fois.
 * À défaut : brut + primes − retenues, la formule historique.
 */
export function entryCost(e: PayrollCostInput): number {
  if (e.employerCost != null && Number.isFinite(e.employerCost)) return e.employerCost;
  return num(e.gross) + num(e.bonuses) - num(e.deductions);
}

/** La base réellement utilisée pour une ligne — pour le dire à l'écran. */
export function entryBasis(e: PayrollCostInput): CostBasis {
  if (e.employerCost != null && Number.isFinite(e.employerCost)) return "EMPLOYER_COST";
  return num(e.gross) > 0 ? "GROSS" : "NONE";
}

/**
 * La masse salariale d'un lot de lignes de paie, et sa base.
 *
 * La base est celle du LOT : « coût employeur » seulement si TOUTES les lignes en portent un.
 * Dès qu'une seule retombe sur son brut, le total est mixte, et l'annoncer « coût employeur »
 * serait faux. C'est le cas normal d'un mois de transition — on le dit plutôt que de le lisser.
 */
export function payrollMass(entries: PayrollCostInput[]): { total: number; basis: CostBasis } {
  if (entries.length === 0) return { total: 0, basis: "NONE" };
  let total = 0;
  let allEmployerCost = true;
  for (const e of entries) {
    total += entryCost(e);
    if (entryBasis(e) !== "EMPLOYER_COST") allEmployerCost = false;
  }
  return { total, basis: allEmployerCost ? "EMPLOYER_COST" : "GROSS" };
}

/**
 * LA COUVERTURE — combien de salariés le chiffre couvre RÉELLEMENT.
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * « Comment ça se fait que la masse salariale mensuelle c'est environ 400 000 DZD ? » Le total
 * n'était pas faux : c'était la somme des lignes de paie du dernier mois SAISI. Mais si l'on n'a
 * marqué « payé » que quatre salariés sur trente, on lit la masse salariale de quatre personnes
 * sous un libellé qui promet celle de la société. Le chiffre est juste, la phrase est fausse.
 *
 * C'est le même piège que la ventilation par entité, déjà documenté juste à côté : un agrégat
 * sans sa portée se dit avec aplomb et répond à une autre question que celle posée. On rend donc
 * TOUJOURS la couverture avec le total, et l'écran la montre.
 *
 * `partial` est vrai dès qu'il manque une ligne : c'est ce qui décide de l'alerte à l'écran.
 * Un mois de paie en cours de saisie n'est pas une anomalie — le présenter comme un mois complet
 * en est une.
 */
export interface MassCoverage {
  /** Lignes de paie retenues pour le total. */
  lines: number;
  /** Salariés actifs sur le périmètre affiché. */
  activeEmployees: number;
  /** Il manque au moins une ligne : le total ne couvre pas tout le monde. */
  partial: boolean;
}

export function massCoverage(lines: number, activeEmployees: number): MassCoverage {
  const n = Math.max(0, Math.trunc(lines));
  const actifs = Math.max(0, Math.trunc(activeEmployees));
  // Plus de lignes que d'actifs n'est pas « partiel » : c'est le cas normal d'un salarié parti
  // en cours de mois, payé puis désactivé. Signaler une alerte là serait crier au loup.
  return { lines: n, activeEmployees: actifs, partial: n > 0 && n < actifs };
}

/** La phrase de couverture, ou `null` quand il n'y a rien d'utile à dire. */
export function coverageLabel(c: MassCoverage): string | null {
  if (c.lines === 0 || c.activeEmployees === 0) return null;
  const salaries = c.lines === 1 ? "1 salaire" : `${c.lines} salaires`;
  return `${salaries} sur ${c.activeEmployees} actifs`;
}

/** Libellé de la base, tel qu'il s'écrit sous l'indicateur. */
export function basisLabel(basis: CostBasis): string {
  switch (basis) {
    case "EMPLOYER_COST": return "coût employeur";
    case "GROSS": return "brut (coût employeur non saisi sur certaines lignes)";
    case "BASE_SALARY": return "salaires de base — aucune paie saisie";
    case "NONE": return "aucune donnée";
  }
}

/**
 * Le coût employeur DE RÉFÉRENCE d'un employé, pour préremplir sa paie du mois.
 *
 * Ordre : ce que porte sa fiche, à défaut son brut, à défaut son salaire de base. On ne renvoie
 * jamais 0 « par défaut » : un zéro préinscrit dans un champ obligatoire se valide sans qu'on
 * le relise, et la masse salariale du mois s'en trouve amputée d'un salaire entier.
 */
export function defaultEmployerCost(employee: {
  employerCost?: number | null;
  grossSalary?: number | null;
  baseSalary?: number | null;
}): number | null {
  for (const v of [employee.employerCost, employee.grossSalary, employee.baseSalary]) {
    if (v != null && Number.isFinite(v) && v > 0) return v;
  }
  return null;
}
