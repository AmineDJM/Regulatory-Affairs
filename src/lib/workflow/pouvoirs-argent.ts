/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES POUVOIRS D'ARGENT DE L'ÉTAPE QUI CONCLUT UNE ROUTE COUPÉE — module PUR (zéro import).
 *
 * ── LE DÉFAUT, MESURÉ PAR LES VRAIES PORTES ─────────────────────────────────────────────
 *
 * Une demande déposée par Direction Marketing ou par le Manager Promotion médicale (rang 2) ne
 * se fait pas arbitrer par son propre auteur : la Direction des opérations la TRANCHE à sa place
 * (`parcoursAdPro` : la borne est `final`). Or cette étape, par défaut, « donne son accord sur
 * l'opération » — ni montant, ni catégorie : ils appartiennent à Direction Marketing, l'étape
 * que cette route n'atteint pas. Joué par la création, l'écran de l'étape et `advanceWorkflow`,
 * sur un congrès international, un congrès national et un événement, sous et au-dessus du seuil
 * du DG : 12 demandes sur 12 sortaient APPROUVÉES sans budget accordé, sans ordre de dépense ni
 * déclaration à l'information médicale, et l'écran ne proposait ni montant ni catégorie. Le même
 * dossier déposé par un KAM émettait son ordre de dépense, 6 fois sur 6.
 *
 * L'ÉMISSION, elle, était bien héritée (§118.107a) — mais `emitFinancials` ne part jamais sans
 * montant fixé (§118.16), et personne sur cette route n'avait le moyen d'en fixer un. Un accord
 * sans montant, lu partout comme une dépense accordée : le faux succès sans une étape en échec.
 *
 * ── LA RÈGLE : L'EXÉCUTION HÉRITE, COMME POUR L'ÉMISSION ────────────────────────────────
 *
 * L'étape qui CONCLUT hérite des pouvoirs d'argent des étapes que la demande n'atteindra pas —
 * la MÊME liste que l'émission (`etapesNonAtteintes` : la queue coupée ET le tamis), parce que
 * deux listes pour la même question finiraient par diverger (§118.5) : fixer le montant, choisir
 * la (sous-)catégorie, et les EXIGER s'ils étaient exigés. On ne réécrit pas la définition — le
 * Super Admin a posé ses pouvoirs où il les voulait ; c'est l'exécution qui hérite, au seul moment
 * où il est sûr que rien d'autre ne viendra.
 *
 * Le moteur (qui JUGE l'approbation) et l'écran (qui PROPOSE les champs) lisent la même réponse :
 * un champ exigé que l'écran ne montre pas serait un bouton offert puis refusé (§118.83), et un
 * champ montré que le moteur ignore serait une saisie perdue.
 *
 * ── CE QUI N'HÉRITE PAS — et chaque cas a son témoin ────────────────────────────────────
 *
 *   · une étape qui NE conclut PAS : elle propose, elle ne décide pas l'argent ;
 *   · une étape qui porte DÉJÀ une configuration d'argent à elle (un pouvoir ou une exigence posé
 *     par le Super Admin) : elle GARDE la sienne, exactement. Y fusionner l'exigence d'une autre
 *     étape ajouterait une contrainte que personne n'a choisie pour elle (§118.16) ;
 *   · le sponsoring par défaut : son étape décisive pré-valide la TENUE et ne fixe aucun argent
 *     (§118.151) — il n'y a rien à hériter, et la route d'un rang 2 conclut toujours sur une tenue
 *     pré-validée, l'argent se fixant à la clôture.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les trois faits d'une étape qui disent ce qu'elle décide de l'argent. */
export interface ConfigArgent {
  powers: readonly string[];
  requireAmount: boolean;
  requireCategory: boolean;
}

/** Les pouvoirs qui fixent l'argent — les deux seuls qu'une étape qui conclut peut hériter. */
export const POUVOIRS_D_ARGENT = ["SET_AMOUNT", "SET_CATEGORY"] as const;

/** L'étape porte-t-elle une configuration d'argent À ELLE — un pouvoir, ou une exigence ? */
export function porteUnPouvoirDArgent(etape: ConfigArgent): boolean {
  return etape.requireAmount || etape.requireCategory || POUVOIRS_D_ARGENT.some((p) => etape.powers.includes(p));
}

/**
 * L'ÉTAPE TELLE QU'ELLE DÉCIDE — elle-même, ou augmentée des pouvoirs d'argent qu'elle hérite.
 *
 * `nonAtteintes` : les étapes que la demande n'atteindra pas (`etapesNonAtteintes`), vide quand
 * l'étape ne conclut pas. Rend l'étape INCHANGÉE (même objet) dans tous les cas où rien n'est
 * hérité : un appelant peut comparer par identité pour savoir si l'héritage a joué.
 */
export function argentEffectif<T extends ConfigArgent>(etape: T, conclut: boolean, nonAtteintes: readonly ConfigArgent[]): T {
  if (!conclut || porteUnPouvoirDArgent(etape)) return etape;
  const sources = nonAtteintes.filter(porteUnPouvoirDArgent);
  if (sources.length === 0) return etape;
  const herites = POUVOIRS_D_ARGENT.filter((p) => sources.some((s) => s.powers.includes(p)));
  return {
    ...etape,
    powers: [...etape.powers, ...herites],
    requireAmount: sources.some((s) => s.requireAmount),
    requireCategory: sources.some((s) => s.requireCategory),
  } as T;
}
