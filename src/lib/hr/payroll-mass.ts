/**
 * LA MASSE SALARIALE — par ENTITÉ, par DÉPARTEMENT, et ACTUALISÉE plutôt qu'ajoutée.
 *
 * ── DEUX DÉFAUTS, UN MÊME SUJET ─────────────────────────────────────────────────────────────
 *
 * 1. **LE BUDGET S'AJOUTAIT AU LIEU DE S'ACTUALISER.** Transférer la paie au budget écrivait des
 *    écritures de trésorerie, mais la ligne « masse salariale » du département, elle, restait un
 *    montant SAISI À LA MAIN. On la remontait à chaque embauche, on l'oubliait à chaque départ, et
 *    six mois plus tard le budget annonçait une masse salariale que personne ne reconnaissait.
 *    Or elle se LIT : c'est la somme des coûts employeur réellement payés. Un chiffre calculable
 *    qu'on saisit à la main est un chiffre faux en attente.
 *
 * 2. **ELLE MÉLANGEAIT LES ENTITÉS.** Le groupe compte plusieurs sociétés ; chacune paie ses
 *    salaires et rend ses comptes. Une masse salariale consolidée sans distinction n'est le
 *    chiffre d'aucune d'elles — et c'est pourtant celui qu'on lisait.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────────────────────
 *
 * La masse salariale d'un département, pour une année, vaut **la somme des coûts employeur de ses
 * salariés payés cette année-là**. Elle se REMPLACE à chaque transfert — jamais elle ne s'ajoute.
 * Le coût employeur, et non le brut : c'est ce que la société décaisse réellement, charges
 * comprises ; imputer le brut sous-évalue la masse du montant des charges.
 *
 * ── POURQUOI REMPLACER, ET NON INCRÉMENTER ──────────────────────────────────────────────────
 *
 * Incrémenter suppose de ne jamais transférer deux fois, de ne jamais corriger une ligne, de ne
 * jamais annuler un paiement. Chacune de ces trois choses arrive. Recalculer depuis les lignes
 * PAYÉES rend l'opération idempotente : la rejouer donne le même chiffre, et une correction se
 * répercute sans qu'on ait à défaire quoi que ce soit.
 *
 * Module PUR : ni base, ni session. Testé.
 */

/** Une ligne de paie, réduite à ce qui fait la masse. */
export interface PayrollCostLine {
  departmentId: string | null;
  companyId: string | null;
  /** Le COÛT EMPLOYEUR — ce que la société décaisse, charges comprises. */
  cost: number;
}

/**
 * LA MASSE PAR DÉPARTEMENT.
 *
 * Les lignes sans département sont ÉCARTÉES, et c'est délibéré : les imputer à un département
 * arbitraire fausserait son budget, et les répartir au prorata inventerait un chiffre. Elles
 * comptent dans le total du groupe, jamais dans un budget de département — `unassigned` les
 * chiffre pour qu'on puisse les rattacher.
 */
export function massByDepartment(lines: readonly PayrollCostLine[]): {
  byDepartment: Map<string, number>;
  unassigned: number;
  total: number;
} {
  const byDepartment = new Map<string, number>();
  let unassigned = 0;
  let total = 0;
  for (const l of lines) {
    total += l.cost;
    if (!l.departmentId) { unassigned += l.cost; continue; }
    byDepartment.set(l.departmentId, (byDepartment.get(l.departmentId) ?? 0) + l.cost);
  }
  return { byDepartment, unassigned, total };
}

/** La masse par ENTITÉ — le chiffre que chaque société doit reconnaître comme le sien. */
export function massByEntity(lines: readonly PayrollCostLine[]): Map<string | null, number> {
  const out = new Map<string | null, number>();
  for (const l of lines) out.set(l.companyId, (out.get(l.companyId) ?? 0) + l.cost);
  return out;
}

export interface BudgetRefresh {
  departmentId: string;
  /** Le montant à ÉCRIRE — un remplacement, jamais une addition. */
  amount: number;
  /** Ce qu'il y avait avant, pour que le journal dise le mouvement et pas seulement l'arrivée. */
  was: number;
}

/**
 * CE QU'IL FAUT ÉCRIRE POUR ACTUALISER LES BUDGETS — et rien d'autre.
 *
 * On ne rend que les départements dont le chiffre CHANGE : réécrire à l'identique produirait un
 * journal d'audit illisible, où la seule ligne qui compte se noierait dans trente qui ne disent
 * rien.
 *
 * Un département qui n'a plus aucun salarié payé revient à ZÉRO, il ne disparaît pas : laisser
 * l'ancien montant en place afficherait une masse salariale sur une équipe dissoute.
 */
export function budgetRefreshes(
  computed: ReadonlyMap<string, number>,
  current: ReadonlyMap<string, number>,
): BudgetRefresh[] {
  const out: BudgetRefresh[] = [];
  const ids = new Set<string>([...computed.keys(), ...current.keys()]);
  for (const departmentId of ids) {
    const amount = computed.get(departmentId) ?? 0;
    const was = current.get(departmentId) ?? 0;
    if (amount === was) continue;
    out.push({ departmentId, amount, was });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/** Ce que le journal retient d'une actualisation — le mouvement, pas seulement l'arrivée. */
export function refreshSummary(rows: readonly BudgetRefresh[], format: (n: number) => string): string {
  if (rows.length === 0) return "Masse salariale inchangée.";
  const total = rows.reduce((a, r) => a + r.amount, 0);
  return `Masse salariale actualisée sur ${rows.length} département(s) — ${format(total)} au total (remplacement, pas addition).`;
}
