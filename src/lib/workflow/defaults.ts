import type { StepInput, WorkflowCategory } from "./types";
import { CATEGORY_LABELS } from "./types";
import { ROLE_DIRECTION_MARKETING, SLUG_DIRECTION, SLUG_MARKETING, SLUG_PRELIMINAIRE } from "./parcours";

/**
 * Définitions **par défaut** du circuit Ad & Pro : préliminaire National Sales → arbitrage et
 * budget de Direction Marketing → validation définitive de la Direction. Semées à la volée
 * (lazy) si aucune définition n'existe pour la catégorie ; le Super Admin peut ensuite tout
 * modifier depuis Administration.
 *
 * ── CE QUE CETTE GRAINE NE FAIT PAS, ET C'EST ESSENTIEL ─────────────────────────────────
 *
 * Elle ne s'applique QUE là où rien n'existe. Les quatre définitions déjà en base ne sont pas
 * réécrites — c'est ce qui protège les circuits que le Super Admin a remodelés. La bascule de
 * l'existant vers Direction Marketing est donc une MIGRATION
 * (`20261106090000_adpro_direction_marketing`), pas un changement de graine : changer la graine
 * seule aurait laissé la production sur l'ancien circuit, en silence.
 *
 * ── LES DEUX PARCOURS, ET POURQUOI TROIS ÉTAPES SUFFISENT ───────────────────────────────
 *
 * Une demande de KAM parcourt les étapes 1 → 2 (Direction Marketing tranche) ; celle de tout
 * autre demandeur, 2 → 3 (la Direction tranche). Deux tranches CONTIGUËS d'une seule colonne
 * vertébrale : `parcours.ts` porte les bornes, la définition reste unique. Deux définitions
 * auraient divergé au premier réglage (§118.5).
 */

/** Les trois étapes « colonne vertébrale » communes aux 4 catégories. */
function defaultSpine(): StepInput[] {
  return [
    {
      slug: SLUG_PRELIMINAIRE,
      title: "Approbation préliminaire (National Sales)",
      description:
        "Le National Sales approuve ou refuse la demande de son KAM avant qu'elle n'atteigne Direction Marketing.",
      actorScope: "ROLE",
      actorRoles: ["NATIONAL_SALES"],
      // PLUS DE DÉSIGNATION : l'étape suivante est portée par un RÔLE et non par une personne
      // désignée. Garder le pouvoir ASSIGN ferait refuser toute approbation tant que personne
      // n'est désigné, pour remplir un champ que plus rien ne lit.
      powers: ["APPROVE", "REJECT", "COMMENT"],
      notifyRoles: ["NATIONAL_SALES", "SUPER_ADMIN"],
      legacyStatus: "AWAITING_PRELIMINARY",
    },
    {
      slug: SLUG_MARKETING,
      title: "Arbitrage et budget (Direction Marketing)",
      description:
        "Direction Marketing arbitre la demande : montant accordé + (sous-)catégorie budgétaire obligatoires. "
        + "Avis confidentiel tant que la Direction n'a pas tranché ; pour une demande de KAM, c'est ICI que la "
        + "décision est prise et le budget accordé devient visible du demandeur.",
      // UNE DIRECTION, PAS UNE PERSONNE DÉSIGNÉE. Le parcours de tout demandeur non-KAM
      // COMMENCE à cette étape : une portée `ASSIGNEE` y laisserait une demande que personne ne
      // peut faire avancer, morte à sa première étape et sans une seule ligne d'échec.
      actorScope: "ROLE",
      actorRoles: [ROLE_DIRECTION_MARKETING],
      powers: ["APPROVE", "REJECT", "SET_AMOUNT", "SET_CATEGORY", "COMMENT"],
      requireAmount: true,
      requireCategory: true,
      notifyRoles: [ROLE_DIRECTION_MARKETING],
      // Confidentiel TANT QUE ce n'est pas cette étape qui tranche : quand elle tranche (demande
      // de KAM), sa décision EST la décision, et un budget accordé se lit (voir `parcours.ts`).
      confidential: true,
      legacyStatus: "PRELIMINARY_APPROVED",
    },
    {
      slug: SLUG_DIRECTION,
      title: "Validation définitive (Direction)",
      description:
        "La Direction tranche : accord ou refus sur le budget arbitré par Direction Marketing. La validation "
        + "lance l'information médicale (PRIM) puis l'ordre de dépense.",
      actorScope: "GLOBAL_VIEW",
      actorRoles: ["DIRECTION"],
      // LE BUDGET N'EST PLUS ICI. La Direction accorde ou refuse ce que Direction Marketing a
      // arbitré ; le montant accordé est celui de l'instance, et l'émission le lit là.
      powers: ["APPROVE", "REJECT", "COMMENT"],
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
