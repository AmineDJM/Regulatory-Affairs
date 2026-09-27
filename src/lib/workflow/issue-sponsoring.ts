/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE DÉCIDE L'ÉTAPE QUI CONCLUT UN SPONSORING (§118.151) — la tenue, ou l'argent.
 *
 * « Une fois validé par le National Sales et le Directeur des opérations, la Direction Marketing
 * pré-valide ou refuse la TENUE de l'événement. Si elle pré-valide, on passe aux postes — devis,
 * BC, factures — puis, l'événement complété, elle valide tout, met chaque poste dans un budget et
 * clôture » (Direction, 09/2026).
 *
 * Jusqu'ici, l'étape qui concluait le circuit d'un sponsoring l'APPROUVAIT : statut `APPROVED`,
 * montant accordé écrit, validation signée. Depuis la règle, l'étape de la Direction Marketing ne
 * fixe plus d'argent — elle décide que l'événement AURA LIEU. Écrire `APPROVED` à ce moment-là
 * serait un accord sans montant, lu partout comme un budget accordé : les listes le rangeraient
 * parmi les demandes « validées », les postes ajoutés ensuite passeraient pour des ajouts TARDIFS,
 * et le paiement du premier poste marquerait la demande entière « payée ».
 *
 * ── LE FAIT QUI DÉCIDE : L'ÉTAPE FIXE-T-ELLE L'ARGENT ? ─────────────────────────────────────
 *
 * Pas le nom de l'étape, pas son slug, pas la catégorie : sa CONFIGURATION. Une étape qui exige
 * un montant (ou porte le pouvoir de le fixer) accorde de l'argent → `APPROVED`, comme avant. Une
 * étape qui n'en fixe pas décide la tenue → `PRE_VALIDATED`, et l'argent se décide poste par poste
 * puis à la clôture (`ad-pro/cloture-sponsoring.ts`).
 *
 * Trois conséquences, voulues :
 *
 *   · un circuit que le Super Admin a REMODELÉ (la migration ne touche pas à une étape dont il a
 *     changé le titre) garde exactement son comportement d'avant, puisque son étape fixe encore
 *     l'argent — et il passe à la nouvelle règle en retirant ce pouvoir depuis Administration,
 *     sans une ligne de code ;
 *   · la route d'une demande de la Direction Marketing elle-même, qui s'arrête à la Direction des
 *     opérations (§118.142), concluait par un accord SANS montant — le défaut relevé au plan. Cette
 *     étape ne fixe pas d'argent : elle pré-valide, et c'est la Direction qui clôturera ;
 *   · les trois autres catégories ne passent JAMAIS par ici : congrès et événements n'ont pas
 *     d'état « tenue pré-validée », et la Direction n'a énoncé la règle que pour le sponsoring.
 *
 * Module PUR (zéro import) : le moteur l'appelle, les bancs l'éprouvent sans base.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type IssueSponsoring = "APPROVED" | "PRE_VALIDATED";

/** Les deux faits d'une étape qui disent si elle FIXE l'argent. */
export interface EtapeQuiConclut {
  requireAmount: boolean;
  powers: readonly string[];
}

/** L'étape fixe-t-elle l'argent ? Un montant exigé, ou le pouvoir de le fixer. */
export function etapeFixeLArgent(etape: EtapeQuiConclut): boolean {
  return etape.requireAmount || etape.powers.includes("SET_AMOUNT");
}

/** Le statut qu'un sponsoring prend quand CETTE étape conclut son circuit. */
export function issueTerminaleSponsoring(etape: EtapeQuiConclut): IssueSponsoring {
  return etapeFixeLArgent(etape) ? "APPROVED" : "PRE_VALIDATED";
}
