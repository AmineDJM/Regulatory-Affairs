/**
 * LE MONTAGE D'UNE BUSINESS UNIT — ce qui est fait, ce qui manque, et dans quel ordre.
 *
 * ── POURQUOI CE MODULE EXISTE ───────────────────────────────────────────────────────────────
 *
 * Une force de vente se montait en quatre allers-retours entre deux onglets : la BU au
 * « Catalogue », l'équipe et son superviseur aux « Équipes », les produits au Catalogue encore,
 * les KAM aux Équipes. Rien ne disait où l'on en était. Une BU sans superviseur ne prévient
 * personne quand le terrain décroche ; une BU sans KAM n'apparaît nulle part au cockpit ; une BU
 * sans produit ne peut porter aucune affectation. Ces trois pannes sont SILENCIEUSES — elles ne
 * produisent pas d'erreur, elles produisent un module vide qu'on croit configuré.
 *
 * L'écran énonce donc l'ordre du montage et dit, pour chaque BU, l'étape qui manque. Ce module
 * est ce qui le décide : PUR, sans base, sans import lourd, testé.
 *
 * ── LE CANAL EST UNE PROPRIÉTÉ DE LA FRANCHISE ──────────────────────────────────────────────
 *
 * Il se saisissait produit par produit ; c'est la BU qui opère en ville, à l'hôpital ou sur les
 * deux. Le produit hérite donc du canal de sa BU, et l'incohérence (un produit de ville dans une
 * BU hospitalière) se DIT plutôt que de se corriger toute seule : c'est peut-être l'exception
 * qu'on voulait.
 */

import { PRODUCT_CHANNEL } from "@/lib/labels";

export type Channel = "RETAIL" | "HOSPITAL" | "BOTH";

export const CHANNELS: Channel[] = ["BOTH", "RETAIL", "HOSPITAL"];

/**
 * Les libellés viennent du référentiel commun (`lib/labels.ts`) : le canal d'un PRODUIT et le
 * terrain d'une BU sont le même énuméré, et deux jeux de mots auraient divergé à la première
 * retouche. `labels.ts` est du formatage pur — l'importer ici garde ce module léger.
 */
export const CHANNEL_LABELS: Record<Channel, string> = {
  BOTH: PRODUCT_CHANNEL.BOTH.label,
  RETAIL: PRODUCT_CHANNEL.RETAIL.label,
  HOSPITAL: PRODUCT_CHANNEL.HOSPITAL.label,
};

export function isChannel(v: string): v is Channel {
  return v === "RETAIL" || v === "HOSPITAL" || v === "BOTH";
}

export function channelLabel(v: string): string {
  return isChannel(v) ? CHANNEL_LABELS[v] : v;
}

/**
 * Le canal de la BU couvre-t-il celui du produit ? « Les deux » couvre tout ; sinon il faut
 * l'égalité. Un produit « les deux » dans une BU de ville n'est PAS couvert : la BU ne va pas à
 * l'hôpital, la moitié du produit ne serait promue nulle part.
 */
export function channelCovers(bu: string, product: string): boolean {
  if (!isChannel(bu) || !isChannel(product)) return true;
  return bu === "BOTH" || bu === product;
}

export type BuStepKey = "SUPERVISEUR" | "CANAL" | "KAM" | "PRODUITS";

export interface BuSetupInput {
  supervisorId: string | null;
  channel: string;
  repCount: number;
  productCount: number;
}

export interface BuStep {
  key: BuStepKey;
  /** Le geste, à l'infinitif — c'est un bouton, pas un constat. */
  label: string;
  done: boolean;
  /** Ce qu'on perd tant que l'étape manque. Jamais « obligatoire » : la raison, ou rien. */
  why: string;
}

/**
 * LES ÉTAPES, DANS L'ORDRE DU MONTAGE. Le canal est toujours « fait » (il a une valeur par
 * défaut qui n'exclut rien) — il figure dans la liste parce qu'on veut le VOIR, pas parce qu'il
 * bloque.
 */
export function buSetupSteps(bu: BuSetupInput): BuStep[] {
  return [
    {
      key: "SUPERVISEUR",
      label: "Désigner le superviseur",
      done: Boolean(bu.supervisorId),
      why: "Sans superviseur, les alertes terrain de cette BU remontent à la Direction au lieu de la personne qui peut agir le jour même.",
    },
    {
      key: "CANAL",
      label: "Choisir le terrain",
      done: true,
      why: "Ville, hôpital ou les deux : le canal de la BU s'applique à ses produits, qui n'ont plus à le redire un par un.",
    },
    {
      key: "KAM",
      label: "Rattacher les KAM",
      done: bu.repCount > 0,
      why: "Une BU sans KAM n'apparaît pas au pilotage : ni panel, ni visites, ni couverture.",
    },
    {
      key: "PRODUITS",
      label: "Ajouter les produits",
      done: bu.productCount > 0,
      why: "Les produits viennent des dossiers Regulatory ; sans eux, aucune affectation ni prévision n'est possible.",
    },
  ];
}

/** L'étape suivante à faire, ou `null` si la BU est complète. */
export function nextBuStep(bu: BuSetupInput): BuStep | null {
  return buSetupSteps(bu).find((s) => !s.done) ?? null;
}

export function buSetupComplete(bu: BuSetupInput): boolean {
  return nextBuStep(bu) === null;
}

/** Combien d'étapes sont franchies — pour la jauge de l'écran. */
export function buSetupProgress(bu: BuSetupInput): { done: number; total: number } {
  const steps = buSetupSteps(bu);
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}
