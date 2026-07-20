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

/** Le créateur peut-il désigner lui-même le chef de produit à la création ? (National Sales) */
export function canDesignateProductManagerAtCreation(user: OriginUser): boolean {
  return adProOriginRank(user) === 1;
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
 * `productManagerId` n'est pris en compte que pour un National Sales (rang 1) : c'est
 * lui qui désigne le chef de produit, ce qui remplace son approbation préliminaire.
 */
export function adProInit(user: OriginUser, productManagerId?: string | null): AdProInit {
  const rank = adProOriginRank(user);
  // Chef de produit / Direction / Super Admin : aucune étape préliminaire ni analyse.
  if (rank >= 2) return { stage: "FINAL", status: "AWAITING_FINAL", productManagerId: null, preliminaryBySelf: true };
  // National Sales qui désigne le chef de produit à la création : on saute le préliminaire.
  if (rank === 1 && productManagerId) return { stage: "ANALYSIS", status: "PRELIMINARY_APPROVED", productManagerId, preliminaryBySelf: true };
  // Délégué (ou National Sales n'ayant pas désigné) : circuit complet depuis le préliminaire.
  return { stage: "PRELIMINARY", status: "AWAITING_PRELIMINARY", productManagerId: null, preliminaryBySelf: false };
}

export { PRODUCT_MANAGER_ROLES };
