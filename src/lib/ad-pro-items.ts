import type { AdProItemKind, AdProItemStatus, AdProItemBudgetKind, AdProItemOrderStage } from "@prisma/client";

/**
 * POSTES D'UNE OPÉRATION AD & PRO — la ventilation de l'enveloppe.
 *
 * Sert le **sponsoring** et les **prises en charge nationales** : la question posée est la même (de quoi
 * est fait le montant, et à qui va l'argent), la réponse doit donc l'être aussi. Deux
 * implémentations parallèles finiraient par diverger sur un détail qui compte — un garde-fou
 * financier corrigé d'un côté et pas de l'autre.
 *
 * Ce fichier ne contient QUE des fonctions pures : il est importé par des composants client
 * (l'écran de ventilation) autant que par le serveur. Rien qui lise un fichier ou la base —
 * sans quoi la compilation de production échouerait sur un `fs` introuvable.
 */

/** Les opérations Ad & Pro qui portent des postes — les quatre du pôle. */
export type AdProParent = "SPONSORING" | "CONGRESS_NATIONAL" | "CONGRESS_INTERNATIONAL" | "EVENT";

export const AD_PRO_PARENTS: AdProParent[] = ["SPONSORING", "CONGRESS_NATIONAL", "CONGRESS_INTERNATIONAL", "EVENT"];

/** Libellés métier. `PROMO_MATERIAL` est distingué : il renvoie vers un autre circuit. */
export const ITEM_KIND_LABELS: Record<AdProItemKind, string> = {
  STAND: "Stand",
  SYMPOSIUM: "Symposium",
  PROMO_MATERIAL: "Matériel promotionnel",
  SERVICE: "Prestation",
  CONSULTING: "Consulting",
  CATERING: "Traiteur",
  VENUE: "Location de salle",
  TRAVEL: "Déplacement / hébergement",
  OTHER: "Autre",
};

/** Ordre d'affichage : ce qui coûte le plus cher et se décide en premier, en tête. */
export const ITEM_KINDS: AdProItemKind[] = ["STAND", "SYMPOSIUM", "PROMO_MATERIAL", "VENUE", "CATERING", "CONSULTING", "SERVICE", "TRAVEL", "OTHER"];

export const ITEM_STATUS_LABELS: Record<AdProItemStatus, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  PENDING: { label: "En attente de la Direction", tone: "info" },
  REVISION: { label: "Budget à revoir", tone: "warning" },
  APPROVED: { label: "Accordé", tone: "success" },
  REJECTED: { label: "Refusé", tone: "danger" },
};

export const ITEM_BUDGET_KIND_LABELS: Record<AdProItemBudgetKind, string> = {
  INCLUDED: "Inclus dans le budget accordé",
  ADDITIONAL: "Budget supplémentaire",
};

export const ITEM_ORDER_STAGE_LABELS: Record<AdProItemOrderStage, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  NONE: { label: "Aucun bon de commande", tone: "neutral" },
  REQUESTED: { label: "BC demandé — visa Direction attendu", tone: "info" },
  DIRECTION_OK: { label: "Visa Direction — en attente des Finances", tone: "warning" },
  ISSUED: { label: "Bon de commande émis", tone: "success" },
  REFUSED: { label: "Émission refusée", tone: "danger" },
};

export interface ItemAmounts {
  amountEstimated?: number | null;
  amountGranted?: number | null;
  addedAfterDecision?: boolean;
  /** Un poste REFUSÉ ne pèse plus rien ; un poste supplémentaire ne pèse pas sur l'enveloppe. */
  status?: AdProItemStatus;
  budgetKind?: AdProItemBudgetKind;
}

export interface Breakdown {
  /** Ce que la Direction a accordé. `null` tant qu'elle n'a pas tranché. */
  envelopeDzd: number | null;
  /** Somme des estimations du demandeur — sert avant décision. */
  estimatedDzd: number;
  /** Somme des montants affectés aux postes. */
  allocatedDzd: number;
  /** Reste à affecter (0 si l'enveloppe est entièrement ventilée ou dépassée). */
  unallocatedDzd: number;
  /** Ce qui dépasse l'enveloppe accordée. C'est CE chiffre qu'il faut montrer, pas cacher. */
  overrunDzd: number;
  /** La ventilation tombe juste : ni reste, ni dépassement. */
  balanced: boolean;
  /** Au moins un poste a été ajouté après la décision — explique un éventuel dépassement. */
  hasLateAdditions: boolean;
  itemCount: number;
  /**
   * Postes demandés EN PLUS de l'enveloppe (rallonge). Comptés à part : les mêler au reste
   * ferait passer une rallonge assumée pour un dépassement subi — deux situations qui
   * n'appellent pas la même décision.
   */
  additionalDzd: number;
  /** Postes encore soumis à la Direction (ni accordés ni refusés) — l'argent n'est pas arbitré. */
  pendingDzd: number;
  /** Total engagé si tout était accordé : enveloppe ventilée + rallonges demandées. */
  totalRequestedDzd: number;
}

const sum = (xs: (number | null | undefined)[]): number =>
  xs.reduce<number>((a, x) => a + (typeof x === "number" && Number.isFinite(x) ? x : 0), 0);

/** Arrondi au centime — les décimaux flottants ne doivent pas faire apparaître un écart fantôme. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * L'état de la ventilation, tel qu'il sera affiché.
 *
 * La règle métier retenue : la Direction accorde **un montant global**, les postes se le
 * répartissent. Mais un poste peut être ajouté **après** la décision (on découvre qu'il faut un
 * stand) — c'est autorisé et simplement tracé. La ventilation peut donc légitimement dépasser
 * l'enveloppe : on ne bloque pas, on **affiche le dépassement**. Un dépassement caché est un
 * dépassement qu'on découvre à la facture.
 *
 * Fonction PURE — testée.
 */
export function breakdown(items: ItemAmounts[], amountGranted: number | null | undefined): Breakdown {
  const envelopeDzd = typeof amountGranted === "number" && Number.isFinite(amountGranted) ? amountGranted : null;

  // Un poste REFUSÉ ne pèse plus sur rien : le garder dans les totaux ferait porter à l'opération
  // le poids d'une dépense que la Direction a précisément écartée.
  const live = items.filter((i) => i.status !== "REJECTED");
  const additional = live.filter((i) => i.budgetKind === "ADDITIONAL");
  const included = live.filter((i) => i.budgetKind !== "ADDITIONAL");

  const estimatedDzd = round2(sum(live.map((i) => i.amountEstimated)));
  // La ventilation de l'ENVELOPPE ne compte que les postes qui s'y imputent : un poste
  // « supplémentaire » est une RALLONGE demandée, pas une part du montant déjà accordé.
  const allocatedDzd = round2(sum(included.map((i) => i.amountGranted)));
  const additionalDzd = round2(sum(additional.map((i) => i.amountGranted ?? i.amountEstimated)));
  const pendingDzd = round2(sum(live.filter((i) => i.status === "PENDING" || i.status === "REVISION").map((i) => i.amountGranted ?? i.amountEstimated)));

  const diff = envelopeDzd == null ? 0 : round2(envelopeDzd - allocatedDzd);
  const unallocatedDzd = diff > 0 ? diff : 0;
  const overrunDzd = diff < 0 ? -diff : 0;

  return {
    envelopeDzd,
    estimatedDzd,
    allocatedDzd,
    unallocatedDzd,
    overrunDzd,
    // Sans enveloppe, rien n'est « équilibré » : il n'y a pas encore de cible.
    balanced: envelopeDzd != null && unallocatedDzd === 0 && overrunDzd === 0 && live.length > 0,
    hasLateAdditions: live.some((i) => i.addedAfterDecision === true),
    itemCount: live.length,
    additionalDzd,
    pendingDzd,
    totalRequestedDzd: round2(allocatedDzd + additionalDzd),
  };
}

// ───────────────────────────── Cycle de validation d'un poste ─────────────────────────────

/**
 * Un poste peut-il PARTIR EN VALIDATION ? On ne soumet ni un poste vide de chiffre (la Direction
 * déciderait sur rien), ni un poste déjà tranché. Un poste en RÉVISION se resoumet — c'est tout
 * l'intérêt de l'aller-retour. Fonction PURE — testée.
 */
export function canSubmitItem(item: {
  status: AdProItemStatus;
  amountEstimated?: number | null;
  amountGranted?: number | null;
}): { ok: boolean; reason?: string } {
  if (item.status === "PENDING") return { ok: false, reason: "Ce poste est déjà en attente de la Direction." };
  if (item.status === "APPROVED") return { ok: false, reason: "Ce poste est déjà accordé." };
  const amount = item.amountGranted ?? item.amountEstimated;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "Chiffrez le poste (montant estimé) avant de le soumettre." };
  }
  return { ok: true };
}

/**
 * Une demande d'ÉMISSION DE BON DE COMMANDE ne se fait que sur un poste ACCORDÉ, CHIFFRÉ, dont
 * le budget a été choisi, et une seule fois — sauf refus, qui rouvre le droit de redemander.
 * Fonction PURE — testée.
 */
export function canRequestPurchaseOrder(item: {
  status: AdProItemStatus;
  amountGranted?: number | null;
  budgetCategoryId?: string | null;
  orderStage: AdProItemOrderStage;
}): { ok: boolean; reason?: string } {
  if (item.status !== "APPROVED") return { ok: false, reason: "Le poste doit d'abord être accordé par la Direction." };
  const amount = item.amountGranted;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "Affectez d'abord un montant à ce poste." };
  }
  if (!item.budgetCategoryId) return { ok: false, reason: "Choisissez d'abord le budget (enveloppe) qui portera ce poste." };
  if (item.orderStage === "REQUESTED" || item.orderStage === "DIRECTION_OK") {
    return { ok: false, reason: "Une demande d'émission est déjà en cours." };
  }
  if (item.orderStage === "ISSUED") return { ok: false, reason: "Le bon de commande de ce poste a déjà été émis." };
  return { ok: true };
}

/**
 * CE QUI EST ANNONCÉ MAIS QUE PERSONNE N'A CHIFFRÉ.
 *
 * Un congrès déclare `hasBooth` / `hasSymposium` : on sait donc qu'il y aura un stand ou un
 * symposium. Ces intentions n'ont jamais porté d'argent — on annonçait un stand et le budget
 * n'en disait pas un mot. Le rapprochement est le seul endroit où l'écart devient visible avant
 * la facture.
 *
 * Ce n'est pas un blocage : un stand peut être offert par l'organisateur. C'est une question
 * posée à la bonne personne au bon moment. Fonction PURE — testée.
 */
export interface PlannedGaps {
  boothUnbudgeted: boolean;
  symposiumUnbudgeted: boolean;
  any: boolean;
}

export function plannedGaps(
  items: { kind: AdProItemKind }[],
  plan: { hasBooth?: boolean | null; hasSymposium?: boolean | null },
): PlannedGaps {
  const has = (k: AdProItemKind) => items.some((i) => i.kind === k);
  const boothUnbudgeted = plan.hasBooth === true && !has("STAND");
  const symposiumUnbudgeted = plan.hasSymposium === true && !has("SYMPOSIUM");
  return { boothUnbudgeted, symposiumUnbudgeted, any: boothUnbudgeted || symposiumUnbudgeted };
}

/**
 * Un poste peut-il émettre son ordre de dépense ?
 *
 * Trois conditions, et elles sont toutes des garde-fous financiers : le sponsoring doit être
 * **accordé** (on ne paie pas ce qui n'est pas décidé), le poste doit porter un **montant**
 * (on ne paie pas un chiffre vide), et il ne doit pas **déjà** avoir sa pièce (on ne paie pas
 * deux fois). Fonction PURE — testée.
 */
export function canEmitOrder(
  item: { amountGranted?: number | null; expenseOrderId?: string | null; status?: AdProItemStatus },
  sponsoringDecided: boolean,
): { ok: boolean; reason?: string } {
  if (item.expenseOrderId) return { ok: false, reason: "Un ordre de dépense a déjà été émis pour ce poste." };
  if (!sponsoringDecided) return { ok: false, reason: "L'opération n'a pas encore été accordée." };
  // Depuis que chaque poste se valide à part, un poste refusé ou encore en attente ne se paie
  // pas — même si l'opération, elle, est accordée.
  if (item.status && item.status !== "APPROVED") {
    return { ok: false, reason: "Ce poste n'a pas été accordé par la Direction." };
  }
  const amount = item.amountGranted;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "Affectez d'abord un montant à ce poste." };
  }
  return { ok: true };
}
