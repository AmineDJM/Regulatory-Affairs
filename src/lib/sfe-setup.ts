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

/**
 * UNE BU EST HOSPITALIÈRE quand son terrain est l'hôpital, ou les deux (04/10/2026). C'est ce qui
 * décide si le territoire de chaque KAM se choisit dans l'annuaire des établissements (sur sa ligne)
 * ou reste un texte libre. Une valeur inconnue n'est PAS hospitalière : ouvrir un territoire
 * d'hôpitaux sur un terrain qu'on ne sait pas lire choisirait à la place de qui règle la BU.
 */
export function estBuHospitaliere(channel: string): boolean {
  return channel === "HOSPITAL" || channel === "BOTH";
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

export type BuStepKey = "SUPERVISEUR" | "CANAL" | "SPECIALITES" | "KAM" | "TERRITOIRES" | "PRODUITS" | "REFERENTS";

export interface BuSetupInput {
  supervisorId: string | null;
  channel: string;
  repCount: number;
  productCount: number;
  /**
   * LES TERRITOIRES DES KAM (04/10/2026) — dans une BU hospitalière, chaque KAM choisit SUR SA LIGNE
   * les établissements qu'il couvre. Deux faits et non un seul, parce que deux pannes se cachent
   * derrière « les KAM ont un territoire », toutes deux SILENCIEUSES — elles produisent un KAM dont
   * le panel est VIDE, qui ne peut planifier aucune tournée, sans qu'une ligne le dise :
   *   · aucun KAM ACTIF : il n'y a rien de couvert, et la jauge ne doit pas s'en féliciter ;
   *   · des KAM actifs SANS territoire (ou dont le territoire n'a aucun établissement) : la BU a
   *     l'air montée et ces personnes-là ne voient aucun médecin. On les NOMME : la raison dit sur
   *     quelle ligne agir, pas « des territoires manquent ».
   * Un KAM inactif ne bloque rien : il ne planifie pas.
   */
  kamsActifs: number;
  kamsSansTerritoire: string[];
  /**
   * LES RÉFÉRENTS DIRECTION MARKETING de la gamme (22/09/2026).
   *
   * Deux nombres et non un, pour la même raison que les territoires : « la gamme a un référent »
   * cache DEUX pannes distinctes, toutes deux silencieuses. Aucun référent — les demandes Ad &
   * Pro de cette gamme ne préviennent personne nommément, elles repartent sur le rôle entier et
   * chacun suppose que quelqu'un d'autre s'en occupe. Un référent qui ne PORTE pas le rôle — il
   * est prévenu et ne peut rien trancher, une attente sans pouvoir.
   */
  referentCount: number;
  referentsSansRole: number;
  /**
   * LES SPÉCIALITÉS QUE LA BU VISE (§118.183) — « BU ≠ spécialité ». Un nombre suffit : la principale
   * est facultative, et une BU qui vise trois spécialités sans en désigner une est MONTÉE.
   */
  specialtyCount: number;
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
 * CE QU'ON PERD, DANS LE CAS QU'ON A. Un motif unique (« des territoires manquent ») ferait chercher
 * soi-même quel KAM n'a rien ; c'est le défaut d'un refus qui nomme la faute sans nommer le remède
 * (§118.30).
 */
function territoiresWhy(bu: BuSetupInput): string {
  if (!estBuHospitaliere(bu.channel)) {
    return "BU de ville : pas d'établissement à choisir — le secteur de chaque KAM se saisit en texte sur sa ligne, et cette étape n'est pas exigée.";
  }
  if (bu.kamsActifs === 0) {
    return "Aucun KAM actif dans la BU : il n'y a encore aucun territoire à choisir, donc rien de couvert.";
  }
  const n = bu.kamsSansTerritoire.length;
  if (n > 0) {
    const noms = bu.kamsSansTerritoire.slice(0, 3).join(", ") + (n > 3 ? ` et ${n - 3} autre(s)` : "");
    return `Sans territoire, ${noms} ${n > 1 ? "n'ont" : "n'a"} aucun médecin dans ${n > 1 ? "leur" : "son"} panel et ne ${n > 1 ? "peuvent" : "peut"} soumettre aucun plan de tournée : choisissez les établissements sur ${n > 1 ? "leur" : "sa"} ligne (« Territoire »).`;
  }
  return "Chaque KAM choisit sur sa ligne les établissements qu'il couvre — tous leurs services, ou certains : c'est ce qui lui donne son panel de médecins.";
}

/** Même principe que `territoiresWhy` : la raison DANS LE CAS qu'on tient, jamais « incomplet ». */
function referentsWhyBu(bu: BuSetupInput): string {
  if (bu.referentCount === 0) {
    return "Aucun référent Direction Marketing : les demandes Ad & Pro de cette gamme ne préviennent personne "
      + "nommément — elles repartent sur le rôle entier, et chacun suppose que quelqu'un d'autre s'en occupe.";
  }
  if (bu.referentsSansRole > 0) {
    const n = bu.referentsSansRole;
    return `${n} référent${n > 1 ? "s" : ""} ne porte pas le rôle Direction Marketing : ${n > 1 ? "ils seront prévenus" : "il sera prévenu"} `
      + "et ne pourra rien trancher — une désignation cible la notification, elle n'accorde aucun droit.";
  }
  return "Les demandes Ad & Pro de cette gamme préviennent nommément ses référents, en plus du rôle "
    + "— c'est ainsi que la direction du département les reçoit également.";
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
      key: "SPECIALITES",
      label: "Choisir les spécialités",
      done: bu.specialtyCount > 0,
      why: "Une BU vise une ou plusieurs spécialités (« neurologie, dermatologie, urologie ») : sans elles, rien ne dit à quels médecins s'adressent ses produits.",
    },
    {
      key: "KAM",
      label: "Rattacher les KAM",
      done: bu.repCount > 0,
      why: "Une BU sans KAM n'apparaît pas au pilotage : ni panel, ni visites, ni couverture.",
    },
    {
      key: "TERRITOIRES",
      label: "Choisir les territoires des KAM",
      // Une BU de VILLE n'a pas d'hôpital à cocher : l'étape n'est pas exigée, et sa raison le DIT.
      // Dans une BU hospitalière, `kamsActifs > 0` est nécessaire : sans KAM actif il n'y a pas de
      // territoire COUVERT, et annoncer l'étape franchie sur une BU vide ferait mentir la jauge par
      // son numérateur (§118.51). L'étape KAM vient avant et reste la « suivante » dans ce cas.
      done: !estBuHospitaliere(bu.channel) || (bu.kamsActifs > 0 && bu.kamsSansTerritoire.length === 0),
      why: territoiresWhy(bu),
    },
    {
      key: "REFERENTS",
      label: "Désigner les référents Direction Marketing",
      done: bu.referentCount > 0 && bu.referentsSansRole === 0,
      why: referentsWhyBu(bu),
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
