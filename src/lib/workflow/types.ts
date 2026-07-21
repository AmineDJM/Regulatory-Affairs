import type { EntityType } from "@prisma/client";

/**
 * Types & constantes du **moteur de workflow configurable** (Ad & Pro).
 * Le Super Admin édite, dans Administration, une définition par catégorie : une
 * suite d'étapes ordonnées. Chaque étape déclare QUI agit (rôles + portée) et ses
 * POUVOIRS. Le moteur (`engine.ts`) pilote le gating et la progression au runtime.
 */

export const ACTOR_SCOPES = ["ROLE", "ASSIGNEE", "GLOBAL_VIEW", "REQUESTER"] as const;
export type ActorScope = (typeof ACTOR_SCOPES)[number];

export const SCOPE_LABELS: Record<ActorScope, string> = {
  ROLE: "Rôles listés",
  ASSIGNEE: "Personne désignée à une étape précédente",
  GLOBAL_VIEW: "Direction / Super Admin (vue globale)",
  REQUESTER: "Le demandeur",
};

export const SCOPE_HINTS: Record<ActorScope, string> = {
  ROLE: "Seuls les comptes portant l'un des rôles cochés peuvent agir (le Super Admin passe toujours).",
  ASSIGNEE: "La personne désignée à une étape amont (ex. le chef de produit choisi).",
  GLOBAL_VIEW: "Réservé à la Direction des opérations et au Super Admin.",
  REQUESTER: "L'auteur de la demande (ex. le délégué).",
};

export const WORKFLOW_POWERS = ["APPROVE", "REJECT", "ASSIGN", "SET_AMOUNT", "SET_CATEGORY", "COMMENT"] as const;
export type WorkflowPower = (typeof WORKFLOW_POWERS)[number];

export const POWER_LABELS: Record<WorkflowPower, string> = {
  APPROVE: "Approuver / faire avancer",
  REJECT: "Refuser",
  ASSIGN: "Désigner une personne",
  SET_AMOUNT: "Fixer un montant",
  SET_CATEGORY: "Choisir la (sous-)catégorie budgétaire",
  COMMENT: "Commenter",
};

export const WORKFLOW_CATEGORIES = ["SPONSORING", "CONGRESS_INTERNATIONAL", "CONGRESS_NATIONAL", "EVENTS"] as const;
export type WorkflowCategory = (typeof WORKFLOW_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<WorkflowCategory, string> = {
  SPONSORING: "Sponsoring",
  CONGRESS_INTERNATIONAL: "Congrès international",
  CONGRESS_NATIONAL: "Congrès national",
  EVENTS: "Événements",
};

/** EntityType de l'entité source portée par chaque catégorie de workflow. */
export const CATEGORY_ENTITY: Record<WorkflowCategory, EntityType> = {
  SPONSORING: "SPONSORING",
  CONGRESS_INTERNATIONAL: "CONGRESS_INTERNATIONAL",
  CONGRESS_NATIONAL: "CONGRESS_NATIONAL",
  EVENTS: "EVENT",
};

export const CATEGORY_PATH: Record<WorkflowCategory, string> = {
  SPONSORING: "/sponsoring",
  CONGRESS_INTERNATIONAL: "/congress-international",
  CONGRESS_NATIONAL: "/congress-national",
  EVENTS: "/events",
};

export function isWorkflowCategory(v: string): v is WorkflowCategory {
  return (WORKFLOW_CATEGORIES as readonly string[]).includes(v);
}

export function entityToCategory(entityType: EntityType): WorkflowCategory | null {
  const found = (Object.entries(CATEGORY_ENTITY) as [WorkflowCategory, EntityType][]).find(([, e]) => e === entityType);
  return found ? found[0] : null;
}

/** Représentation « plate » d'une étape (défauts + builder + sérialisation). */
export interface StepInput {
  slug: string;
  title: string;
  description?: string | null;
  actorRoles: string[];
  actorScope: ActorScope;
  powers: WorkflowPower[];
  assignRole?: string | null;
  requireAmount?: boolean;
  /** Seuil DZD : montant de l'instance ≤ ce seuil ⇒ étape franchie automatiquement (tracée). */
  autoSkipMaxAmount?: number | null;
  /** Si le demandeur détient déjà l'autorité de l'étape, elle est approuvée automatiquement en son nom (tracée). */
  autoApproveIfRequester?: boolean;
  requireCategory?: boolean;
  requireNote?: boolean;
  emitDeclaration?: boolean;
  emitExpenseOrder?: boolean;
  notifyRoles?: string[];
  optional?: boolean;
  confidential?: boolean;
  legacyStatus?: string | null;
}
