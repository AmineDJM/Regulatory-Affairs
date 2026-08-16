/**
 * AD & PRO — UNE SEULE DEMANDE.
 *
 * Sponsoring, prise en charge internationale, prise en charge nationale, événement, matériel
 * promotionnel : cinq écrans, cinq listes, cinq boutons « nouvelle demande ». Pour celui qui
 * demande, ce sont pourtant cinq façons de poser la MÊME question — « je veux engager une dépense
 * de promotion, voici pour qui et pour quoi ». Lui faire choisir d'abord le bon écran, c'est lui
 * demander de connaître notre découpage interne avant de pouvoir formuler son besoin.
 *
 * On unifie donc l'ENTRÉE et la LECTURE, pas le stockage. Chaque nature garde son modèle, ses
 * champs propres et son circuit : un congrès international a des billets et des visas qu'un
 * sponsoring n'a pas, et les fondre dans une table commune reviendrait à perdre ce qui fait leur
 * spécificité — ou à fabriquer une table de cinquante colonnes dont quarante sont vides.
 *
 * Ce que ce module apporte : un vocabulaire commun (l'ÉTAT d'une demande, quelle que soit sa
 * nature) et la liste unifiée. Chaque ligne renvoie vers son écran d'origine, qui reste maître.
 *
 * Module PUR — testé.
 */

export type AdProKind = "SPONSORING" | "CONGRESS_INTERNATIONAL" | "CONGRESS_NATIONAL" | "EVENT" | "PROMO_MATERIAL";

export interface KindSpec {
  kind: AdProKind;
  label: string;
  /** Ce que la personne veut faire, dit dans ses mots — pas dans les nôtres. */
  hint: string;
  icon: string;
  /** Écran d'origine, qui reste maître du circuit et des champs propres. */
  href: string;
  /**
   * Lien qui ouvre DIRECTEMENT le formulaire de création de cette nature.
   *
   * Sans lui, choisir « envoyer un praticien à un congrès » déposait sur une liste où il fallait
   * retrouver un bouton — soit exactement ce qu'on venait d'éviter. Le paramètre est retiré de
   * l'URL à l'ouverture, pour qu'un rafraîchissement ne rouvre pas le formulaire sans fin.
   */
  createHref: string;
  /** Module RBAC qui gouverne cette nature. */
  module: string;
}

export const AD_PRO_KINDS: KindSpec[] = [
  {
    kind: "SPONSORING", label: "Sponsoring", icon: "HandCoins", href: "/sponsoring", module: "SPONSORING", createHref: "/sponsoring?new=1",
    hint: "Soutenir une manifestation, une association, un praticien qui nous sollicite.",
  },
  {
    kind: "CONGRESS_INTERNATIONAL", label: "Prise en charge internationale", icon: "Plane", href: "/congress-international", module: "CONGRESS_INTERNATIONAL", createHref: "/congress-international?new=1",
    hint: "Envoyer un praticien à un congrès à l'étranger — billets, visa, hébergement.",
  },
  {
    kind: "CONGRESS_NATIONAL", label: "Prise en charge nationale", icon: "MapPin", href: "/congress-national", module: "CONGRESS_NATIONAL", createHref: "/congress-national?new=1",
    hint: "Prendre en charge la participation à un congrès en Algérie.",
  },
  {
    kind: "EVENT", label: "Événement", icon: "PartyPopper", href: "/events", module: "EVENTS", createHref: "/events?new=1",
    hint: "Organiser une table ronde, une soirée scientifique, un atelier.",
  },
  {
    kind: "PROMO_MATERIAL", label: "Matériel promotionnel", icon: "Package", href: "/promo-material", module: "PROMO_MATERIAL", createHref: "/promo-material?new=1",
    hint: "Faire produire une brochure, un présentoir, un objet — par une agence.",
  },
];

/**
 * L'ÉTAT COMMUN — cinq mots, les mêmes pour les cinq natures.
 *
 * Chaque module a son propre vocabulaire (« CONSIDERED », « BC_FINANCE_REVIEW », « PRELIMINARY_
 * APPROVED »…), et c'est légitime : ce sont des circuits différents. Mais dans une liste unifiée,
 * quinze statuts distincts ne se comparent plus. On les ramène à la seule question que se pose
 * celui qui a demandé : **où en est ma demande ?**
 */
export type AdProState = "DRAFT" | "AWAITING" | "APPROVED" | "DONE" | "REFUSED";

export const AD_PRO_STATE: Record<AdProState, { label: string; tone: "neutral" | "warning" | "info" | "success" | "danger" }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  AWAITING: { label: "En attente de décision", tone: "warning" },
  APPROVED: { label: "Validée", tone: "info" },
  DONE: { label: "Terminée", tone: "success" },
  REFUSED: { label: "Refusée / annulée", tone: "danger" },
};

/** Statuts refusés ou annulés, toutes natures confondues. */
const REFUSED = ["REFUSED", "CANCELLED", "REJECTED"];
/** Statuts qui closent une demande. */
const DONE = ["PAID", "CLOSED", "COMPLETED", "SETTLED", "PAYMENT_DONE", "MATERIAL_DELIVERED", "ARCHIVED"];
/** Statuts « validée, en cours d'exécution ». */
const APPROVED = [
  "ACCEPTED", "APPROVED", "VALIDATED", "PRELIMINARY_APPROVED", "ORGANIZED", "PREPARATION",
  "REGISTRATION_OPEN", "FULL", "AGENCY_CHOSEN", "BC_VALIDATED", "BC_SENT", "PAYMENT_INITIATED",
  "MATERIAL_PRODUCED",
];
/** Statuts de départ, avant toute soumission. */
const DRAFT = ["DRAFT"];

/**
 * L'état commun d'une demande, depuis son statut d'origine.
 *
 * Tout ce qui n'est ni brouillon, ni tranché, ni terminé est « en attente de décision » — et
 * c'est volontairement le défaut : une demande dont on ne sait pas quoi dire attend forcément
 * quelque chose de quelqu'un, et il vaut mieux la montrer que la ranger dans une case rassurante.
 */
export function adProState(status: string): AdProState {
  if (REFUSED.includes(status)) return "REFUSED";
  if (DONE.includes(status)) return "DONE";
  if (APPROVED.includes(status)) return "APPROVED";
  if (DRAFT.includes(status)) return "DRAFT";
  return "AWAITING";
}

/** Une demande Ad & Pro, quelle que soit sa nature — la ligne de la liste unifiée. */
export interface AdProRequest {
  id: string;
  kind: AdProKind;
  reference: string;
  title: string;
  /** Pour qui : praticien, association, agence… */
  beneficiary: string | null;
  amount: number | null;
  /** Statut d'origine, conservé — l'écran de la nature le montre tel quel. */
  status: string;
  state: AdProState;
  requester: string | null;
  createdAt: string;
  href: string;
}

/** Le libellé d'une nature, avec repli : une nature inconnue ne casse pas l'écran. */
export function kindLabel(kind: AdProKind): string {
  return AD_PRO_KINDS.find((k) => k.kind === kind)?.label ?? kind;
}

export function kindSpec(kind: AdProKind): KindSpec | undefined {
  return AD_PRO_KINDS.find((k) => k.kind === kind);
}

/**
 * Le classement de la liste unifiée : ce qui ATTEND une décision d'abord, le reste ensuite, et
 * à état égal la plus récente en tête.
 *
 * Une liste triée uniquement par date enterre les demandes bloquées depuis trois semaines sous
 * celles de ce matin — or ce sont précisément celles-là qu'il faut voir.
 */
const STATE_ORDER: Record<AdProState, number> = { AWAITING: 0, APPROVED: 1, DRAFT: 2, DONE: 3, REFUSED: 4 };

export function sortAdPro(rows: readonly AdProRequest[]): AdProRequest[] {
  return [...rows].sort((a, b) => {
    const d = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    return d !== 0 ? d : b.createdAt.localeCompare(a.createdAt);
  });
}

/** Le décompte par état — les compteurs de tête, qui servent aussi de filtres. */
export function countByState(rows: readonly AdProRequest[]): Record<AdProState, number> {
  const out: Record<AdProState, number> = { DRAFT: 0, AWAITING: 0, APPROVED: 0, DONE: 0, REFUSED: 0 };
  for (const r of rows) out[r.state] += 1;
  return out;
}
