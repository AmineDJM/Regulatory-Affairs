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
 * Chaque demande traverse CETTE colonne vertébrale, filtrée par son parcours (`parcours.ts`) :
 * une BORNE — où la chaîne s'arrête — et un TAMIS — les étapes qu'elle ne traverse pas —, figés à
 * la naissance de l'instance (`finalSlug`, `skippedSlugs`, §118.142). Ce n'est plus une tranche
 * contiguë : un KAM traverse le préliminaire sans la Direction des opérations, un National Sales
 * l'inverse. La définition, elle, reste UNIQUE : deux définitions auraient divergé au premier
 * réglage (§118.5).
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
      title: "Validation du Directeur Général",
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
    // SUR LA ROUTE DU RANG 2 (Direction Marketing, Manager Promotion médicale), cette étape CONCLUT :
    // elle hérite alors, à l'EXÉCUTION, le montant et la sous-catégorie de l'étape qu'elle remplace
    // (`pouvoirs-argent.ts`). La définition ne change pas ; la description, elle, dit les DEUX routes.
    // Elle disait « le montant ne se décide PAS ici » — faux sur la route coupée depuis §118.197g, et
    // c'est la phrase que lit le Super Admin qui règle le circuit. Le même texte est posé en base par
    // `20270104091000_description_etape_final`, là où l'ancien est resté mot pour mot (un test exige
    // que les deux restent identiques : deux sources de la même étape feraient deux circuits).
    {
      slug: SLUG_DIRECTION,
      title: "Validation (Direction des opérations)",
      description:
        "La Direction des opérations donne son accord sur l'opération ; d'ordinaire, Direction Marketing tranche "
        + "ensuite, et le montant comme la sous-catégorie budgétaire se décident chez elle. Sur la demande d'un "
        + "membre de Direction Marketing ou du Manager Promotion médicale, qui ne tranchent pas leur propre demande, "
        + "cette étape conclut : elle prend alors la décision de Direction Marketing — montant accordé et "
        + "sous-catégorie budgétaire compris quand le circuit les exige — et lance ce qui en découle.",
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

/**
 * LE SPONSORING NE TRANCHE PAS L'ARGENT À CETTE ÉTAPE — il tranche la TENUE (§118.151).
 *
 * « Une fois validé par le National Sales et le Directeur des opérations, la Direction Marketing
 * pré-valide ou refuse la tenue de l'événement. Si elle pré-valide, on passe aux postes — devis,
 * BC, factures — puis, l'événement complété, elle valide tout, met chaque poste dans un budget,
 * et clôture » (Direction, 09/2026).
 *
 * L'étape garde son SLUG (`marketing`) : le parcours, les bornes, le caviardage, la prévention
 * des référents et les instances déjà posées dessus la désignent par lui (§118.107, §118.144).
 * Ce qui change est ce qu'elle DÉCIDE : plus de montant ni de catégorie budgétaire — l'argent se
 * décide poste par poste, puis à la clôture (`ad-pro/cloture-sponsoring.ts`) — et plus d'ordre de
 * dépense global : ce sont les postes qui portent la dépense, et un ordre global en plus la ferait
 * payer deux fois. La déclaration d'information médicale part toujours ici : c'est l'ÉVÉNEMENT
 * qui se déclare, et il est décidé ici — la clôture vient APRÈS l'événement, trop tard pour le
 * déclarer.
 *
 * Les quatre catégories partagent le reste de la colonne vertébrale ; seul le sponsoring suit
 * cette règle, parce que seule la Direction l'a énoncée pour lui. Les mêmes valeurs sont écrites
 * par la migration `20261129090000_sponsoring_pre_validation_postes_cloture` sur l'étape déjà en
 * base : un test exige qu'elles restent identiques, sinon la graine (bases neuves) et la
 * migration (production) feraient deux circuits sous le même nom (§118.5).
 */
export const ETAPE_PRE_VALIDATION_SPONSORING: StepInput = {
  slug: SLUG_MARKETING,
  title: "Pré-validation de la tenue (Direction Marketing)",
  description:
    "La Direction Marketing pré-valide ou refuse la TENUE de l'événement. Pré-validée, la demande passe aux postes "
    + "(devis, BC, factures), puis à la validation finale qui range chaque poste dans un budget et clôture la demande.",
  actorScope: "ROLE",
  actorRoles: [ROLE_DIRECTION_MARKETING],
  powers: ["APPROVE", "REJECT", "COMMENT"],
  requireAmount: false,
  requireCategory: false,
  notifyRoles: [ROLE_DIRECTION_MARKETING, "SUPER_ADMIN"],
  confidential: false,
  emitDeclaration: true,
  emitExpenseOrder: false,
  legacyStatus: "AWAITING_FINAL",
};

export function defaultDefinition(category: WorkflowCategory): { name: string; description: string; steps: StepInput[] } {
  const colonne = defaultSpine();
  return {
    name: `Circuit ${CATEGORY_LABELS[category]}`,
    description:
      "Circuit de prise en charge Ad & Pro. Modifiable de bout en bout par le Super Admin (rôles, pouvoirs, étapes).",
    steps: category === "SPONSORING"
      ? colonne.map((e) => (e.slug === SLUG_MARKETING ? ETAPE_PRE_VALIDATION_SPONSORING : e))
      : colonne,
  };
}
