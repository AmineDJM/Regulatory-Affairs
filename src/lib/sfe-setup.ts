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

export type BuStepKey = "SUPERVISEUR" | "CANAL" | "KAM" | "SECTEURS" | "PRODUITS";

export interface BuSetupInput {
  supervisorId: string | null;
  channel: string;
  repCount: number;
  productCount: number;
  /**
   * LES TERRITOIRES DE LA BU — combien de secteurs nommés elle porte, combien sont VIDES, et
   * combien de ses KAM en ont au moins un.
   *
   * Trois nombres et non un seul, parce que trois pannes différentes se cachent derrière « la BU
   * a des secteurs », et les trois sont SILENCIEUSES — elles ne produisent pas d'erreur, elles
   * produisent un KAM dont le panel est VIDE, qui ne peut planifier aucune tournée, sans qu'une
   * seule ligne le dise :
   *   · aucun secteur : personne ne sait quels hôpitaux la BU couvre ;
   *   · un secteur SANS établissement : un nom de territoire sans territoire — le KAM qu'on y
   *     affecte a exactement le même panel vide qu'un KAM sans secteur ;
   *   · des KAM SANS secteur : la BU est « configurée » et ces personnes-là ne voient rien.
   *
   * Le dernier point est celui qui trompe : une BU avec un secteur et cinq KAM dont quatre n'en
   * ont aucun se lit comme montée. C'est la forme exacte du circuit sans étape rendu comme un
   * circuit configuré (§118.113).
   */
  sectorCount: number;
  sectorsWithoutInstitution: number;
  repsWithSector: number;
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
 * CE QU'ON PERD, DANS LE CAS QU'ON A. Un motif unique (« les secteurs sont incomplets ») ferait
 * chercher soi-même laquelle des trois pannes on tient ; c'est le défaut d'un refus qui nomme la
 * faute sans nommer le remède (§118.30).
 */
function secteursWhy(bu: BuSetupInput): string {
  if (bu.sectorCount === 0) {
    return "Sans secteur, aucun KAM ne sait quels établissements il couvre : son panel est vide et il ne peut soumettre aucun plan de tournée.";
  }
  if (bu.sectorsWithoutInstitution > 0) {
    const n = bu.sectorsWithoutInstitution;
    return `${n} secteur${n > 1 ? "s" : ""} ne contient aucun établissement : un nom de territoire sans territoire donne exactement le même panel vide qu'un KAM sans secteur.`;
  }
  if (bu.repCount > 0 && bu.repsWithSector < bu.repCount) {
    const n = bu.repCount - bu.repsWithSector;
    return `${n} KAM sur ${bu.repCount} n'est affecté à aucun secteur : la BU a l'air montée et ces personnes-là ne voient aucun médecin.`;
  }
  return "Un secteur est une sélection d'établissements qui porte un nom (« Est », « Oranais ») : c'est lui qui donne au KAM son panel de médecins et ouvre sa planification sur la bonne ville.";
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
      key: "SECTEURS",
      label: "Découper les secteurs",
      // `repCount > 0` est nécessaire : sans KAM, il n'y a pas de territoire COUVERT, et annoncer
      // l'étape franchie sur une BU vide ferait mentir la jauge par son numérateur (§118.51).
      // L'étape KAM vient avant et reste la « suivante » dans ce cas — celle-ci dit simplement la
      // vérité : rien n'est couvert.
      done: bu.repCount > 0 && bu.sectorsWithoutInstitution === 0 && bu.repsWithSector >= bu.repCount,
      why: secteursWhy(bu),
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
