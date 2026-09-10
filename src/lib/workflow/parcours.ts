/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PARCOURS D'UNE DEMANDE Ad & Pro — module PUR (sa seule dépendance est le SOCLE).
 *
 * ── CE QUE LA DIRECTION A TRANCHÉ ────────────────────────────────────────────────────────
 *
 * Une demande de sponsoring, de prise en charge ou autre ne suit pas la même chaîne selon QUI
 * la pose :
 *
 *   • un **KAM** (délégué médical) : National Sales → **Direction Marketing**, qui TRANCHE ;
 *   • **tout autre demandeur** — le National Sales compris : **Direction Marketing** → **Direction**.
 *
 * Les deux parcours passent par Direction Marketing, à qui appartiennent désormais le budget et
 * le choix de la sous-catégorie budgétaire. Ce qui change est ce qu'il y a AUTOUR : le KAM a son
 * superviseur national en amont et personne en aval ; celui qui n'a pas de superviseur national
 * a la Direction en aval.
 *
 * ── POURQUOI CE MODULE EXISTE, ET POURQUOI IL EST PUR ───────────────────────────────────
 *
 * Trois couches se posent la même question et aucune n'a le droit d'importer les deux autres
 * (§118.16, §118.72, §118.97) : `origin.ts` la pose à la CRÉATION (par où l'on entre),
 * `engine.ts` à chaque AVANCE (y a-t-il une étape après celle-ci ?), et la vue caviardée à
 * l'AFFICHAGE (cet avis est-il encore confidentiel ?). Trois réponses écrites séparément
 * auraient divergé, et le symptôme aurait été le pire de tous : une demande qui s'arrête là où
 * l'écran annonce qu'elle continue.
 *
 * ── LA PROPRIÉTÉ QUI PORTE TOUT LE RESTE ────────────────────────────────────────────────
 *
 * Le parcours est une TRONCATURE, pas un tamis : les deux chaînes sont des tranches CONTIGUËS
 * de la même colonne vertébrale. On n'a donc besoin que de deux bornes — l'entrée (déjà tenue
 * par `adProInit`) et la SORTIE, qui manquait. C'est ce qui permet de tout faire tenir dans
 * `nextStepAfter` : dès que « l'étape suivante » connaît la borne, la terminalité, la projection
 * de l'accord définitif, le refus de franchir automatiquement la décision finale et la levée du
 * caviardage suivent SANS être écrits une seconde fois. Un tamis à trous aurait demandé de
 * reprendre chacun de ces quatre endroits.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LES RÔLES viennent du SOCLE (`personnes/roles-vente.ts`) et sont RÉEXPORTÉS ici.
 *
 * « Est-ce un KAM ? » est une lecture de ce qu'une personne EST : la déduction de la Business
 * Unit en a besoin autant que ce circuit, et `ad-pro/` n'a pas le droit d'importer `workflow/`
 * — `domains.test.ts` l'a compté et refusé (70 traversées pour un plafond de 69). La lecture est
 * donc au socle, à côté de `designation.ts` et `joignabilite.ts`, et ce module la réexporte pour
 * que ses appelants n'aient pas à savoir d'où elle vient.
 */
import { estKam, ROLE_DIRECTION_MARKETING, ROLE_KAM, type RolesPersonne } from "@/lib/personnes/roles-vente";

export { ROLE_KAM, ROLE_DIRECTION_MARKETING, estKam };
export type DemandeurParcours = RolesPersonne;

/** Les slugs de la colonne vertébrale Ad & Pro. */
export const SLUG_PRELIMINAIRE = "preliminary" as const;
export const SLUG_MARKETING = "marketing" as const;
export const SLUG_DIRECTION = "final" as const;

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PARCOURS, EN UNE SEULE TABLE — entrée ET sortie décidées au même endroit.
 *
 * Écrire l'entrée dans `origin.ts` et la sortie ici aurait suffi à produire le défaut suivant,
 * qui a été trouvé en raisonnant sur un cas réel avant de l'écrire : un délégué médical qui
 * porte AUSSI la casquette Direction Marketing (rôle secondaire) est un KAM au sens du texte,
 * mais sa demande ne peut pas être arbitrée par lui-même — elle part donc à la Direction. Une
 * sortie décidée sur le seul fait « c'est un KAM » l'aurait bornée à Direction Marketing, donc
 * à une étape SITUÉE AVANT celle où la demande se trouve : la vue aurait masqué l'étape courante
 * et l'écran n'aurait plus montré aucune action à prendre. Le rang et le métier ne se confondent
 * pas ; ils sont lus ensemble, ici.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface Parcours {
  /** Le slug de l'étape d'ENTRÉE — celle où la demande se pose en naissant. */
  entree: string;
  /**
   * Le slug de l'étape qui TRANCHE, ou `null` quand c'est la dernière de la définition.
   * `null` est le repli délibéré : rien à borner, donc exactement le comportement d'avant.
   */
  sortie: string | null;
}

export function parcoursAdPro(args: {
  /** Rang dans la hiérarchie d'approbation : 0 demandeur ordinaire · 1 National Sales · 2 Direction Marketing · 3 Direction. */
  rang: number;
  /** Le demandeur exerce-t-il comme KAM (délégué médical) ? */
  kam: boolean;
  /** La Direction demande-t-elle l'arbitrage de Direction Marketing avant de trancher ? */
  viaMarketing?: boolean;
}): Parcours {
  // LA DIRECTION tranche. Elle peut demander l'arbitrage de Direction Marketing d'abord — c'est
  // un CHOIX, jamais une obligation : sa demande irait sinon droit à sa propre décision.
  if (args.rang >= 3) {
    return args.viaMarketing
      ? { entree: SLUG_MARKETING, sortie: null }
      : { entree: SLUG_DIRECTION, sortie: null };
  }
  // DIRECTION MARKETING elle-même : on ne fait pas arbitrer à quelqu'un sa propre demande.
  if (args.rang === 2) return { entree: SLUG_DIRECTION, sortie: null };
  // LE NATIONAL SALES : son propre préliminaire n'a pas d'objet ; Direction Marketing arbitre,
  // la Direction tranche.
  if (args.rang === 1) return { entree: SLUG_MARKETING, sortie: null };
  // LE KAM : son superviseur national filtre, Direction Marketing TRANCHE — la Direction n'est
  // pas dans son parcours.
  if (args.kam) return { entree: SLUG_PRELIMINAIRE, sortie: SLUG_MARKETING };
  // TOUT AUTRE DEMANDEUR : aucun superviseur national au-dessus de lui, donc pas de
  // préliminaire ; Direction Marketing arbitre, la Direction tranche.
  return { entree: SLUG_MARKETING, sortie: null };
}

/**
 * LA BORNE DE SORTIE, telle que le MOTEUR et la VUE la lisent — depuis le seul demandeur.
 *
 * Le drapeau « arbitrage demandé » de la Direction ne change PAS la sortie (elle tranche dans
 * les deux cas), ce qui est exactement ce qui permet de recalculer la borne sans lui : le moteur
 * ouvre l'instance parfois des jours après la création, et ce drapeau n'est nulle part en base.
 *
 * On n'exige pas que l'étape existe dans la définition : on la nomme si elle est là, et on se
 * taît sinon. Un circuit remodelé par le Super Admin qui n'a plus d'étape « marketing » retombe
 * donc sur le comportement d'avant — une garde qui refuse ce qu'elle ne comprend pas est
 * désactivée dans la semaine (§118.16).
 */
export function slugDecisionnaire(
  demandeur: DemandeurParcours | null | undefined,
  slugsDeLaDefinition: readonly string[],
  rang: number,
): string | null {
  const { sortie } = parcoursAdPro({ rang, kam: estKam(demandeur) });
  if (sortie === null) return null;
  return slugsDeLaDefinition.includes(sortie) ? sortie : null;
}

/**
 * CETTE ÉTAPE EST-ELLE CELLE QUI TRANCHE ? Une seule lecture de la borne, pour les quatre
 * questions qui en dépendent — y a-t-il une suite, faut-il projeter l'accord définitif, faut-il
 * émettre, et l'avis est-il encore confidentiel.
 */
export function estDecisionnaire(slugEtape: string, borne: string | null): boolean {
  return borne !== null && slugEtape === borne;
}

/**
 * LES ÉTAPES QUE CETTE INSTANCE N'ATTEINDRA JAMAIS — la queue coupée par la borne.
 *
 * Sert à UNE chose, et elle est nécessaire : une émission financière déclarée sur une étape de
 * la queue doit être HONORÉE par l'étape qui tranche. Sans cela, une demande de KAM sort
 * APPROUVÉE, avec son budget accordé écrit en base, et Finance ne reçoit RIEN — l'argent est
 * accordé et rien n'est engagé, sans une seule étape en échec. Le faux succès parfait, sur la
 * seule chose que la dépense attend.
 *
 * On ne DÉPLACE pas les drapeaux dans la définition : le Super Admin les a posés là où il les
 * voulait, et une définition réécrite par le code serait une seconde vérité (§118.5). C'est
 * l'exécution qui hérite, et seulement quand la queue est réellement coupée.
 */
export function queueCoupee(
  slugsOrdonnes: readonly string[],
  borne: string | null,
): string[] {
  if (borne === null) return [];
  const i = slugsOrdonnes.indexOf(borne);
  if (i < 0) return [];
  return slugsOrdonnes.slice(i + 1);
}
