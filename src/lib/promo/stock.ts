/**
 * LE STOCK DE MATÉRIEL PROMOTIONNEL — ce qu'on a, et pourquoi on l'a.
 *
 * On commande 5 000 blocs-notes et 300 présentoirs, on en distribue aux délégués, on en perd à
 * un congrès, on en retrouve au fond d'un carton. Sans registre, la seule réponse à « en
 * reste-t-il ? » est « je crois ». On recommande alors ce qu'on avait déjà, ou l'on part en
 * tournée sans support.
 *
 * DEUX FAÇONS DE TENIR UN STOCK, et une seule tient dans la durée :
 *
 *   • écrire une quantité et la corriger à chaque fois — le nombre est faux dès la première
 *     distribution non saisie, et rien ne dit quand ni pourquoi ;
 *   • n'écrire que des MOUVEMENTS et calculer la quantité — c'est ce qui est fait ici. Le stock
 *     est une conséquence, jamais une saisie. On peut donc toujours répondre à « pourquoi
 *     600 ? » en relisant les lignes.
 *
 * Module PUR — testé.
 */

/** Nature d'un mouvement — elle dit le SENS, et sert de motif dans le registre. */
export type MovementKind =
  /** Entrée : livraison de l'agence, retour de stock. */
  | "RECEIPT"
  /** Sortie : remise à un délégué, dotation d'un événement. */
  | "DISTRIBUTION"
  /** Sortie sans contrepartie : casse, perte, péremption d'un support daté. */
  | "LOSS"
  /** Correction d'inventaire — dans les deux sens, et assumée comme telle. */
  | "CORRECTION";

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  RECEIPT: "Entrée",
  DISTRIBUTION: "Distribution",
  LOSS: "Perte / casse",
  CORRECTION: "Correction d'inventaire",
};

/** Le sens imposé par la nature du mouvement. `null` = les deux sens sont légitimes. */
export function signOf(kind: MovementKind): 1 | -1 | null {
  if (kind === "RECEIPT") return 1;
  if (kind === "DISTRIBUTION" || kind === "LOSS") return -1;
  return null; // CORRECTION
}

export interface StockMovement {
  kind: MovementKind;
  /** Variation signée : + entrée, − sortie. C'est la seule valeur qui compte. */
  delta: number;
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Ce qu'il reste : la somme des mouvements, et rien d'autre. */
export function stockOf(movements: readonly StockMovement[]): number {
  return round3(movements.reduce((a, m) => a + (Number.isFinite(m.delta) ? m.delta : 0), 0));
}

/**
 * Une quantité saisie à la main : virgule française, espaces, champ vide.
 * Rend `null` sur ce qui n'est pas un nombre — jamais NaN, qui se propagerait dans le stock.
 */
export function parseQuantity(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw ?? "").replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * La variation à enregistrer, depuis une nature et une quantité saisie POSITIVE.
 *
 * L'écran demande « combien ? », jamais « +600 ou −600 » : c'est la nature choisie qui donne le
 * sens. Faire saisir un signe garantit qu'un jour, une distribution sera enregistrée en entrée.
 * Seule la correction accepte un signe, puisqu'elle peut aller dans les deux sens.
 */
export function deltaFor(kind: MovementKind, quantity: number): number {
  const sign = signOf(kind);
  if (sign === null) return round3(quantity); // correction : le signe saisi fait foi
  return round3(sign * Math.abs(quantity));
}

export interface StockGate {
  ok: boolean;
  reason?: string;
}

/**
 * Peut-on sortir cette quantité ?
 *
 * Un stock NÉGATIF est refusé, et c'est délibéré : il ne veut rien dire physiquement, et il
 * masque le vrai problème — une entrée jamais saisie. Le refus dit ce qui reste, pour qu'on
 * puisse soit corriger l'inventaire, soit sortir ce qui existe.
 */
export function canWithdraw(current: number, quantity: number): StockGate {
  const q = Math.abs(quantity);
  if (q <= 0) return { ok: false, reason: "Indiquez une quantité supérieure à zéro." };
  if (q > current) {
    return {
      ok: false,
      reason: current <= 0
        ? "Il ne reste rien de cet article : enregistrez d'abord une entrée, ou corrigez l'inventaire."
        : `Il ne reste que ${current} en stock : sortez au plus cette quantité, ou corrigez l'inventaire.`,
    };
  }
  return { ok: true };
}

/** Le mouvement est-il enregistrable ? (garde commune à toutes les natures) */
export function validateMovement(kind: MovementKind, current: number, quantity: number): StockGate {
  if (!Number.isFinite(quantity) || quantity === 0) {
    return { ok: false, reason: "Indiquez une quantité." };
  }
  const delta = deltaFor(kind, quantity);
  if (delta < 0) return canWithdraw(current, delta);
  return { ok: true };
}

export type StockLevel = "OUT" | "LOW" | "OK";

/**
 * L'état d'un article, pour le signaler AVANT la rupture.
 *
 * Le seuil d'alerte est propre à chaque article — 50 présentoirs, ce n'est pas 50 stylos — et
 * il se règle. À défaut de seuil, on ne crie pas au loup : seule la rupture est signalée.
 */
export function stockLevel(current: number, threshold: number | null | undefined): StockLevel {
  if (current <= 0) return "OUT";
  if (threshold != null && threshold > 0 && current <= threshold) return "LOW";
  return "OK";
}

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  OUT: "En rupture",
  LOW: "Stock bas",
  OK: "Disponible",
};
