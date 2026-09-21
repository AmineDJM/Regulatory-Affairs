import type { StepInput, WorkflowCategory } from "./types";
import { CATEGORY_LABELS } from "./types";
import {
  ROLE_DIRECTION_MARKETING,
  SLUG_DG, SLUG_DIRECTION, SLUG_MARKETING, SLUG_PRELIMINAIRE,
} from "./parcours";

/**
 * Définitions **par défaut** du circuit Ad & Pro : préliminaire National Sales → porte du
 * Directeur Général (au-delà du seuil) → validation de la Direction → **décision et budget de
 * Direction Marketing**, qui TRANCHE. Semées à la volée (lazy) si aucune définition n'existe
 * pour la catégorie ; le Super Admin peut ensuite tout modifier depuis Administration.
 *
 * ── CE QUE CETTE GRAINE NE FAIT PAS, ET C'EST ESSENTIEL ─────────────────────────────────
 *
 * Elle ne s'applique QUE là où rien n'existe. Les définitions déjà en base ne sont pas
 * réécrites — c'est ce qui protège les circuits que le Super Admin a remodelés. La bascule de
 * l'existant vers le nouvel ordre est donc une MIGRATION
 * (`20260921120000_adpro_ordre_marketing_final`), pas un changement de graine : changer la
 * graine seule aurait laissé la production sur l'ancien circuit, en silence (§118.107).
 *
 * ── LES PARCOURS, ET POURQUOI QUATRE ÉTAPES SUFFISENT ───────────────────────────────────
 *
 * Chaque chaîne est une tranche CONTIGUË de cette colonne vertébrale : `parcours.ts` porte les
 * deux bornes, la définition reste unique. Deux définitions auraient divergé au premier réglage
 * (§118.5).
 */

/** Les quatre étapes « colonne vertébrale » communes aux 4 catégories. */
function defaultSpine(): StepInput[] {
  return [
    {
      slug: SLUG_PRELIMINAIRE,
      title: "Approbation préliminaire (National Sales)",
      description:
        "Le National Sales approuve ou refuse la demande de son KAM avant qu'elle n'entre dans la chaîne de validation.",
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
      slug: SLUG_DG,
      title: "Validation du Directeur Général (grosses dépenses)",
      description:
        // LE CHIFFRE NE S'ÉCRIT PAS ICI : il vit dans les réglages, et le recopier dans une
        // description figerait la valeur du jour du semis dans un texte que personne ne penserait
        // à corriger — une seconde vérité, en prose (§118.5, §118.116).
        "Au-delà du seuil réglé en Administration › Réglages, le Directeur Général valide en plus. "
        + "En dessous, l'étape est franchie automatiquement et tracée — personne n'a rien à faire. "
        + "Un « Seuil DZD » écrit sur cette étape l'emporte pour ce circuit.",
      actorScope: "ROLE",
      actorRoles: ["GENERAL_MANAGER"],
      powers: ["APPROVE", "REJECT", "COMMENT"],
      // PAS de seuil écrit ici : le seuil GLOBAL des réglages gouverne cette étape (voir
      // `seuilFranchissement`). L'y recopier en ferait une seconde vérité, figée au jour du
      // semis, que personne ne penserait à remettre à jour (§118.5).
      autoSkipMaxAmount: null,
      notifyRoles: ["GENERAL_MANAGER", "SUPER_ADMIN"],
      legacyStatus: "PRELIMINARY_APPROVED",
    },
    {
      slug: SLUG_DIRECTION,
      title: "Validation (Direction des opérations)",
      description:
        "La Direction donne son accord sur l'opération. Le montant et la sous-catégorie budgétaire ne se "
        + "décident PAS ici : ils appartiennent à Direction Marketing, qui tranche ensuite.",
      actorScope: "GLOBAL_VIEW",
      actorRoles: ["DIRECTION"],
      powers: ["APPROVE", "REJECT", "COMMENT"],
      notifyRoles: ["DIRECTION", "SUPER_ADMIN"],
      legacyStatus: "PRELIMINARY_APPROVED",
    },
    {
      slug: SLUG_MARKETING,
      title: "Décision et budget (Direction Marketing)",
      description:
        "Direction Marketing TRANCHE : montant accordé + (sous-)catégorie budgétaire obligatoires. "
        + "Sa décision est définitive et lance l'information médicale (PRIM) puis l'ordre de dépense.",
      // UNE DIRECTION, PAS UNE PERSONNE DÉSIGNÉE. Une portée `ASSIGNEE` laisserait une demande
      // que personne ne peut faire avancer, morte à son étape décisive et sans une seule ligne
      // d'échec.
      actorScope: "ROLE",
      actorRoles: [ROLE_DIRECTION_MARKETING],
      powers: ["APPROVE", "REJECT", "SET_AMOUNT", "SET_CATEGORY", "COMMENT"],
      requireAmount: true,
      requireCategory: true,
      notifyRoles: [ROLE_DIRECTION_MARKETING, "SUPER_ADMIN"],
      // PLUS CONFIDENTIEL : cette étape ne rend plus un AVIS en attente d'une décision d'en
      // haut, elle EST la décision. Un budget accordé se lit par celui à qui on l'accorde.
      confidential: false,
      emitDeclaration: true,
      emitExpenseOrder: true,
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
