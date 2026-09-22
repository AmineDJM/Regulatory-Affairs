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

/*
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * `canDesignateProductManagerAtCreation` A ÉTÉ RETIRÉ (§118.142).
 *
 * Décision de la Direction (22/09/2026) : « on n'a pas besoin d'un référent Direction Marketing,
 * ça va DIRECT chez le directeur/directrice du département marketing. » Ce prédicat n'avait
 * qu'un seul rôle — décider si le MENU du référent s'affichait sur une nouvelle demande. Le menu
 * retiré, il n'avait plus aucun appelant de production, et un prédicat qu'aucun code n'interroge
 * est du code mort qui a l'air d'une règle (§118.14).
 *
 * Le champ `productManagerId` lui SURVIT : il reste lu (droits de la fiche, déclaration
 * d'information médicale) et accepté par les actions serveur. Le référent se configurera par
 * BUSINESS UNIT (« chaque BU aura son ou ses référents de la direction marketing depuis la
 * configuration des BU ») ; d'ici là rien ne l'écrit, et ses lecteurs se dégradent dans le sens
 * sûr — un droit de moins, jamais un droit de plus.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */


/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * IL N'Y A PLUS DE CHOIX DE CIRCUIT — et c'est la conséquence directe du nouvel ordre.
 *
 * `canChooseAnalysisAtCreation` offrait à la Direction de demander l'arbitrage de Direction
 * Marketing AVANT de trancher elle-même. Direction Marketing tranchant désormais TOUTE demande
 * Ad & Pro (décision de la Direction, 09/2026), ce choix n'a plus d'objet : la case aurait été
 * un réglage d'écran qui ne change rien, c'est-à-dire un mensonge fait à la personne qui la
 * coche (§118.14, §118.50). Elle est retirée, avec le champ `viaProductManager` qu'elle posait.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

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
 *   • KAM → préliminaire (National Sales), puis la chaîne entière ;
 *   • Direction / DG / Super Admin → directement Direction Marketing, qui TRANCHE ;
 *   • tout autre demandeur → porte du DG (franchie sous le seuil), Direction, Direction Marketing.
 *
 * Le rang l'emporte sur le métier : un délégué médical qui porte aussi Direction Marketing ne
 * s'arbitre pas sa propre demande — c'est la Direction qui tranche la sienne.
 */
export function adProInit(
  user: OriginUser,
  productManagerId?: string | null,
): AdProInit {
  const rang = adProOriginRank(user);
  const { entree } = parcoursAdPro({ rang, kam: estKam(user) });
  const referent = productManagerId?.trim() || null;

  // LE KAM entre par son superviseur national.
  if (entree === SLUG_PRELIMINAIRE) {
    return { stage: "PRELIMINARY", status: "AWAITING_PRELIMINARY", productManagerId: null, preliminaryBySelf: false };
  }
  // LA DIRECTION (et le rang qui l'accompagne) entre directement chez Direction Marketing, qui
  // TRANCHE : tout ce qui précède est soit son propre accord, soit une porte dont elle est la
  // clé. `FINAL` nomme ici l'étape DÉCISIVE, et c'est bien Direction Marketing.
  if (entree === SLUG_MARKETING) {
    return { stage: "FINAL", status: "AWAITING_FINAL", productManagerId: referent, preliminaryBySelf: true };
  }
  // TOUS LES AUTRES entrent par la porte du Directeur Général, franchie automatiquement sous le
  // seuil : le statut legacy est celui de la chaîne « préliminaire faite, décision à venir ».
  return { stage: "ANALYSIS", status: "PRELIMINARY_APPROVED", productManagerId: referent, preliminaryBySelf: true };
}

export { PRODUCT_MANAGER_ROLES, DIRECTOR_ROLES };
