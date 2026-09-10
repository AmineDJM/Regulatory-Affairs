import type { UserRole } from "@prisma/client";
import { hasGlobalView, hasRole } from "@/lib/rbac";
import { estKam, parcoursAdPro, SLUG_MARKETING, SLUG_PRELIMINAIRE } from "./parcours";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PAR OÙ ENTRE UNE DEMANDE Ad & Pro — le RANG de son créateur, lu au moment de la création.
 *
 * Personne n'approuve une demande qu'il émet lui-même : on saute toute étape située au niveau
 * ou en dessous du rang de son auteur. Ce module apporte ce que `parcours.ts` ne peut pas
 * savoir — le rang, qui se lit dans le RBAC — et lit la RÈGLE chez lui : la table des deux
 * bornes vit à UN seul endroit, sinon l'entrée et la sortie finissent par ne plus se
 * correspondre (§118.5), et le symptôme est une demande posée sur une étape que l'écran masque.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

type OriginUser = { role: UserRole; secondaryRole?: UserRole | null };

/** Rôles « Direction Marketing » (peuvent arbitrer le budget d'une demande Ad & Pro). */
const PRODUCT_MANAGER_ROLES: UserRole[] = ["PRODUCT_MANAGER", "MEDICAL_PROMOTION_MANAGER"];

/**
 * LES DIRECTIONS, au sens du circuit d'approbation — rang le plus haut.
 *
 * Distinct de `hasGlobalView`, et il fallait qu'il le soit : celui-ci répond à « qui voit les
 * données de tout le groupe », question de cloisonnement ; celui-là répond à « qui n'a personne
 * au-dessus de soi pour approuver sa demande », question de hiérarchie. Le Directeur Général et
 * le Directeur des Opérations n'ont PAS la vue globale — c'est voulu — mais leur demande n'a
 * évidemment pas à passer par l'accord d'un superviseur national ou de Direction Marketing.
 *
 * Sans cette liste, ces deux rôles retombaient au rang 0, celui du délégué : un directeur
 * attendait l'approbation préliminaire de quelqu'un qu'il dirige.
 */
const DIRECTOR_ROLES: UserRole[] = ["GENERAL_MANAGER", "OPERATIONS_DIRECTOR"];

/**
 * Rang du créateur dans la hiérarchie d'approbation Ad & Pro :
 * 0 = demandeur ordinaire (dont le KAM) · 1 = National Sales · 2 = Direction Marketing ·
 * 3 = Direction / Super Admin / Directeur Général / Directeur des Opérations.
 */
export function adProOriginRank(user: OriginUser): number {
  if (hasGlobalView(user) || DIRECTOR_ROLES.some((r) => hasRole(user, r))) return 3;
  if (PRODUCT_MANAGER_ROLES.some((r) => hasRole(user, r))) return 2;
  if (hasRole(user, "NATIONAL_SALES")) return 1;
  return 0;
}

/**
 * Le créateur peut-il nommer un RÉFÉRENT Direction Marketing à la création ?
 *
 * Ce n'est plus une désignation dont dépend l'étape suivante — l'arbitrage est porté par le
 * RÔLE Direction Marketing tout entier — mais l'enregistrement de la personne qui suit la
 * gamme. Il est offert à ceux dont la demande entre RÉELLEMENT chez Direction Marketing : le
 * National Sales (rang 1) et la Direction quand elle demande un arbitrage (rang 3). Un KAM ne
 * le voit pas — sa demande passe d'abord par son superviseur national — et Direction Marketing
 * ne se nomme pas référente de sa propre demande.
 *
 * Que ce champ ne CONDITIONNE plus rien est la moitié qui compte : l'étape d'arbitrage était
 * portée par « la personne désignée », or le parcours de tout demandeur non-KAM COMMENCE là.
 * Une désignation absente y aurait laissé une demande que personne ne peut faire avancer,
 * morte à sa première étape et sans une seule ligne d'échec.
 */
export function canDesignateProductManagerAtCreation(user: OriginUser): boolean {
  const rank = adProOriginRank(user);
  return rank === 1 || rank === 3;
}

/**
 * Le créateur peut-il CHOISIR de passer par l'arbitrage de Direction Marketing plutôt que de
 * trancher directement ?
 *
 * Réservé à la Direction et au Super Admin (rang 3), et à eux seuls : ce sont les seuls dont la
 * demande irait sinon droit à la décision finale — la leur. Leur laisser le choix, c'est pouvoir
 * demander un arbitrage budgétaire sans y être tenu.
 *
 * Le National Sales n'a pas ce choix : l'arbitrage de Direction Marketing est son étape suivante
 * obligatoire, la Direction tranchant ensuite.
 */
export function canChooseAnalysisAtCreation(user: OriginUser): boolean {
  return adProOriginRank(user) === 3;
}

export type AdProStage = "PRELIMINARY" | "ANALYSIS" | "FINAL";
export type AdProStatus = "AWAITING_PRELIMINARY" | "PRELIMINARY_APPROVED" | "AWAITING_FINAL";

export interface AdProInit {
  stage: AdProStage;
  /** Statut « legacy » de départ (les vues existantes + le moteur s'y calent). */
  status: AdProStatus;
  /** Référent Direction Marketing enregistré à la création, quand il a un sens. */
  productManagerId: string | null;
  /** Le créateur a-t-il (implicitement) réalisé l'étape préliminaire lui-même ? */
  preliminaryBySelf: boolean;
}

/**
 * Étape de DÉPART d'une demande Ad & Pro, et son statut legacy.
 *
 * Les deux parcours tenus par `parcoursAdPro` :
 *   • KAM → préliminaire (National Sales) puis Direction Marketing, qui TRANCHE ;
 *   • tout autre demandeur → Direction Marketing puis Direction.
 *
 * Le rang l'emporte sur le métier : un délégué médical qui porte aussi Direction Marketing ne
 * s'arbitre pas sa propre demande — elle part à la Direction.
 */
export function adProInit(
  user: OriginUser,
  productManagerId?: string | null,
  opts?: { viaProductManager?: boolean },
): AdProInit {
  const rang = adProOriginRank(user);
  const { entree } = parcoursAdPro({ rang, kam: estKam(user), viaMarketing: opts?.viaProductManager === true });
  const referent = productManagerId?.trim() || null;

  if (entree === SLUG_PRELIMINAIRE) {
    return { stage: "PRELIMINARY", status: "AWAITING_PRELIMINARY", productManagerId: null, preliminaryBySelf: false };
  }
  if (entree === SLUG_MARKETING) {
    return { stage: "ANALYSIS", status: "PRELIMINARY_APPROVED", productManagerId: referent, preliminaryBySelf: true };
  }
  return { stage: "FINAL", status: "AWAITING_FINAL", productManagerId: null, preliminaryBySelf: true };
}

export { PRODUCT_MANAGER_ROLES, DIRECTOR_ROLES };
