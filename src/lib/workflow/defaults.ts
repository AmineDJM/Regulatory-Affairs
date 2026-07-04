import type { StepInput, WorkflowCategory } from "./types";
import { CATEGORY_LABELS } from "./types";

/**
 * Définitions **par défaut** : reproduisent à l'identique le circuit Ad & Pro
 * actuellement codé (préliminaire National Sales → analyse chef de produit →
 * validation définitive Direction → information médicale / ordre de dépense).
 * Elles sont semées à la volée (lazy) si aucune définition n'existe pour la
 * catégorie, de sorte que le comportement est inchangé tant que le Super Admin
 * n'a rien édité — il peut ensuite tout modifier depuis Administration.
 */

/** Les trois étapes « colonne vertébrale » communes aux 4 catégories. */
function defaultSpine(): StepInput[] {
  return [
    {
      slug: "preliminary",
      title: "Approbation préliminaire (National Sales)",
      description:
        "Le National Sales approuve ou refuse la demande et désigne le chef de produit qui fera l'analyse.",
      actorScope: "ROLE",
      actorRoles: ["NATIONAL_SALES"],
      powers: ["APPROVE", "REJECT", "ASSIGN", "COMMENT"],
      assignRole: "PRODUCT_MANAGER",
      notifyRoles: ["NATIONAL_SALES", "SUPER_ADMIN"],
      legacyStatus: "AWAITING_PRELIMINARY",
    },
    {
      slug: "analysis",
      title: "Analyse du chef de produit",
      description:
        "Le chef de produit désigné approuve (en proposant éventuellement un budget) ou refuse. Avis confidentiel.",
      actorScope: "ASSIGNEE",
      actorRoles: [],
      powers: ["APPROVE", "REJECT", "SET_AMOUNT", "COMMENT"],
      notifyRoles: [],
      confidential: true, // l'avis et le budget proposé du chef de produit ne sont pas visibles du demandeur
      legacyStatus: "PRELIMINARY_APPROVED",
    },
    {
      slug: "final",
      title: "Validation définitive (Direction)",
      description:
        "La Direction tranche : montant accordé + (sous-)catégorie budgétaire obligatoires. La validation lance l'information médicale (PRIM) puis l'ordre de dépense.",
      actorScope: "GLOBAL_VIEW",
      actorRoles: ["DIRECTION"],
      powers: ["APPROVE", "REJECT", "SET_AMOUNT", "SET_CATEGORY", "COMMENT"],
      requireAmount: true,
      requireCategory: true,
      emitDeclaration: true,
      emitExpenseOrder: true,
      notifyRoles: ["DIRECTION", "SUPER_ADMIN"],
      legacyStatus: "AWAITING_FINAL",
    },
  ];
}

export function defaultDefinition(category: WorkflowCategory): { name: string; description: string; steps: StepInput[] } {
  return {
    name: `Circuit ${CATEGORY_LABELS[category]}`,
    description:
      "Circuit de prise en charge Ad & Pro. Modifiable de bout en bout par le Super Admin (rôles, pouvoirs, étapes).",
    steps: defaultSpine(),
  };
}
