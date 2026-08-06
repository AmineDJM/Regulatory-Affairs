import type { AdProItemKind } from "@prisma/client";

/**
 * POSTES D'UNE OPÉRATION AD & PRO — la ventilation de l'enveloppe.
 *
 * Sert le **sponsoring** et les **congrès nationaux** : la question posée est la même (de quoi
 * est fait le montant, et à qui va l'argent), la réponse doit donc l'être aussi. Deux
 * implémentations parallèles finiraient par diverger sur un détail qui compte — un garde-fou
 * financier corrigé d'un côté et pas de l'autre.
 *
 * Ce fichier ne contient QUE des fonctions pures : il est importé par des composants client
 * (l'écran de ventilation) autant que par le serveur. Rien qui lise un fichier ou la base —
 * sans quoi la compilation de production échouerait sur un `fs` introuvable.
 */

/** Les opérations Ad & Pro qui portent des postes. */
export type AdProParent = "SPONSORING" | "CONGRESS_NATIONAL";

/** Libellés métier. `PROMO_MATERIAL` est distingué : il renvoie vers un autre circuit. */
export const ITEM_KIND_LABELS: Record<AdProItemKind, string> = {
  STAND: "Stand",
  SYMPOSIUM: "Symposium",
  PROMO_MATERIAL: "Matériel promotionnel",
  SERVICE: "Prestation",
  TRAVEL: "Déplacement / hébergement",
  OTHER: "Autre",
};

/** Ordre d'affichage : ce qui coûte le plus cher et se décide en premier, en tête. */
export const ITEM_KINDS: AdProItemKind[] = ["STAND", "SYMPOSIUM", "PROMO_MATERIAL", "SERVICE", "TRAVEL", "OTHER"];

export interface ItemAmounts {
  amountEstimated?: number | null;
  amountGranted?: number | null;
  addedAfterDecision?: boolean;
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
  const estimatedDzd = round2(sum(items.map((i) => i.amountEstimated)));
  const allocatedDzd = round2(sum(items.map((i) => i.amountGranted)));

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
    balanced: envelopeDzd != null && unallocatedDzd === 0 && overrunDzd === 0 && items.length > 0,
    hasLateAdditions: items.some((i) => i.addedAfterDecision === true),
    itemCount: items.length,
  };
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
  item: { amountGranted?: number | null; expenseOrderId?: string | null },
  sponsoringDecided: boolean,
): { ok: boolean; reason?: string } {
  if (item.expenseOrderId) return { ok: false, reason: "Un ordre de dépense a déjà été émis pour ce poste." };
  if (!sponsoringDecided) return { ok: false, reason: "Le sponsoring n'a pas encore été accordé." };
  const amount = item.amountGranted;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "Affectez d'abord un montant à ce poste." };
  }
  return { ok: true };
}
