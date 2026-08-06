import type { UserRole } from "@prisma/client";
import { hasGlobalView, hasRole } from "@/lib/rbac";

/**
 * Routage « intelligent » à la création d'une demande Ad & Pro (sponsoring, congrès,
 * événement). On **saute** toute étape d'approbation située **au niveau ou en dessous**
 * du rang de son créateur — personne n'a à approuver une demande qu'il émet lui-même :
 *
 *  - un **délégué** part de l'étape préliminaire (National Sales) → analyse → Direction ;
 *  - le **National Sales** n'a pas à faire l'approbation préliminaire de sa propre
 *    demande : il désigne directement le chef de produit → l'analyse suit → Direction ;
 *  - un **chef de produit** (ou la **Direction** / le **Super Admin**) n'a à passer ni
 *    par le National Sales ni par l'analyse chef de produit → la demande va directement
 *    à la validation définitive (Direction).
 *
 * La colonne vertébrale du circuit (préliminaire → analyse → définitive) reste éditable
 * par le Super Admin ; ce helper ne fait que choisir l'étape de DÉPART d'après le rang.
 */

type OriginUser = { role: UserRole; secondaryRole?: UserRole | null };

/** Rôles « chef de produit » (peuvent instruire l'analyse Ad & Pro). */
const PRODUCT_MANAGER_ROLES: UserRole[] = ["PRODUCT_MANAGER", "MEDICAL_PROMOTION_MANAGER"];

/**
 * Rang du créateur dans la hiérarchie d'approbation Ad & Pro :
 * 0 = délégué / autre demandeur · 1 = National Sales · 2 = chef de produit ·
 * 3 = Direction / Super Admin (vue globale).
 */
export function adProOriginRank(user: OriginUser): number {
  if (hasGlobalView(user)) return 3;
  if (PRODUCT_MANAGER_ROLES.some((r) => hasRole(user, r))) return 2;
  if (hasRole(user, "NATIONAL_SALES")) return 1;
  return 0;
}

/**
 * Le créateur peut-il désigner lui-même le chef de produit à la création ?
 *
 * Deux cas, pour deux raisons différentes :
 *   • le **National Sales** (rang 1) le désigne parce que c'est précisément SON étape — il
 *     remplace ainsi son propre préliminaire ;
 *   • la **Direction** (rang 3) peut vouloir un avis produit avant de trancher. Elle n'y est pas
 *     tenue — c'est un CHOIX, offert par `canChooseAnalysisAtCreation`.
 */
export function canDesignateProductManagerAtCreation(user: OriginUser): boolean {
  const rank = adProOriginRank(user);
  return rank === 1 || rank === 3;
}

/**
 * Le créateur peut-il CHOISIR de passer par l'analyse du chef de produit plutôt que de trancher
 * directement ?
 *
 * Réservé à la Direction et au Super Admin (rang 3), et à eux seuls : ce sont les seuls dont la
 * demande irait sinon droit à la décision finale — la leur. Leur laisser le choix, c'est
 * pouvoir demander un avis produit sans être obligé de le faire.
 *
 * Le National Sales, lui, n'a pas ce choix : l'analyse chef de produit reste son étape suivante
 * obligatoire. Et un chef de produit ne s'envoie pas la demande à lui-même.
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
  /** Chef de produit désigné dès la création (uniquement quand le National Sales en choisit un). */
  productManagerId: string | null;
  /** Le créateur a-t-il (implicitement) réalisé l'étape préliminaire lui-même ? */
  preliminaryBySelf: boolean;
}

/**
 * Étape de départ d'une demande Ad & Pro selon le rang de son créateur.
 *
 * `productManagerId` n'est pris en compte que là où désigner un chef de produit a un sens :
 *   • **National Sales** (rang 1) — c'est son étape, la désignation remplace son préliminaire ;
 *   • **Direction / Super Admin** (rang 3) **et seulement si `viaProductManager`** — elle peut
 *     vouloir un avis produit avant de trancher, sans y être tenue.
 *
 * Un chef de produit (rang 2) va toujours droit à la décision finale : il ne s'envoie pas sa
 * propre demande en analyse.
 */
export function adProInit(
  user: OriginUser,
  productManagerId?: string | null,
  opts?: { viaProductManager?: boolean },
): AdProInit {
  const rank = adProOriginRank(user);

  // Direction / Super Admin qui DEMANDE l'avis d'un chef de produit avant de trancher.
  // Sans chef de produit désigné, le choix n'a pas d'objet : on retombe sur la décision directe
  // plutôt que d'envoyer la demande dans une étape sans destinataire.
  if (rank === 3 && opts?.viaProductManager && productManagerId) {
    return { stage: "ANALYSIS", status: "PRELIMINARY_APPROVED", productManagerId, preliminaryBySelf: true };
  }

  // Chef de produit / Direction / Super Admin : aucune étape préliminaire ni analyse.
  if (rank >= 2) return { stage: "FINAL", status: "AWAITING_FINAL", productManagerId: null, preliminaryBySelf: true };
  // National Sales qui désigne le chef de produit à la création : on saute le préliminaire.
  if (rank === 1 && productManagerId) return { stage: "ANALYSIS", status: "PRELIMINARY_APPROVED", productManagerId, preliminaryBySelf: true };
  // Délégué (ou National Sales n'ayant pas désigné) : circuit complet depuis le préliminaire.
  return { stage: "PRELIMINARY", status: "AWAITING_PRELIMINARY", productManagerId: null, preliminaryBySelf: false };
}

export { PRODUCT_MANAGER_ROLES };
