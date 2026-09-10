/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RATTACHEMENT MARCHÉ D'UN PRODUIT — un AO, donc un marché PCH, ou un marché plus la ville.
 *
 * ── LA RÈGLE, TELLE QUE LA DIRECTION L'ÉNONCE ────────────────────────────────────────────
 *
 * « Un produit est lié à UN SEUL AO, donc UN SEUL marché PCH, ou un marché PCH + des ventes de
 * ville. » C'est une CARDINALITÉ, pas une préférence : le second membre (« donc ») est une
 * dérivation — un marché PCH naît d'un appel d'offres, il n'en naît pas deux du même produit au
 * même moment.
 *
 * ── CE QUE CE MODULE FAIT, ET CE QU'IL NE FAIT PAS ───────────────────────────────────────
 *
 * Il LIT et il NOMME. Il ne choisit pas, il ne corrige pas, il ne refuse pas.
 *
 * Deux AO vivants sur le même produit, c'est une contradiction réelle — et la seule conduite
 * honnête est de la DIRE avec ses deux candidats. En retenir un serait choisir, à la place d'un
 * humain, lequel des deux marchés compte (§118.34 : une liste de PLUSIEURS ne désigne personne).
 * `ao` reste donc `null` et l'anomalie porte les deux.
 *
 * Et il ne REFUSE rien : la garde d'écriture n'est pas ici. Un produit peut légitimement se
 * trouver un instant sur deux lignes le temps qu'une attribution se règle, et une garde qui
 * bloquerait ce moment serait désactivée dans la semaine (§118.16). Ce qui protège, c'est que
 * l'incohérence soit VISIBLE — comme le canal d'une BU qui ne couvre pas celui d'un produit se
 * DIT au lieu de se corriger tout seul (`sfe-setup.ts`) : c'est peut-être l'exception voulue.
 *
 * ── L'HISTOIRE N'EST PAS UNE ANOMALIE ────────────────────────────────────────────────────
 *
 * « Un seul AO » vaut À UN INSTANT, jamais sur toute la vie du produit. L'AO 2026 puis l'AO 2027
 * font deux AO, et les deux sont légitimes — juger sur le total ferait de chaque produit
 * reconduit une anomalie, c'est-à-dire du bruit qu'on cesse de lire (§118.32). Le partage se
 * fait donc sur des statuts TERMINAUX, et sur eux seuls.
 *
 * ── ET CE QU'ON NE SAIT PAS LIRE, ON LE DIT ──────────────────────────────────────────────
 *
 * Un statut absent des deux vocabulaires fermés ci-dessous n'est ni vivant ni clos : il sort en
 * `nonLues` et n'entre PAS dans le jugement de cardinalité. Le compter comme vivant fabriquerait
 * une anomalie sur une valeur qu'on n'a pas comprise ; le compter comme clos ferait disparaître
 * un marché réel. Rendre l'ignorance est la seule des trois qui ne mente pas (§118.26).
 *
 * PUR — zéro import. La conversation, l'écran produit et la lecture 360 en ont besoin sans avoir
 * le droit de se parler (§118.16, §118.72).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LES STATUTS D'APPEL D'OFFRES QUI FERMENT LE DOSSIER. Vocabulaire FERMÉ (`PchTenderStatus`).
 * `SUSPENDED` n'y est PAS : un AO suspendu par l'organisme reprend, et le produit y est toujours
 * engagé — le déclarer clos ferait disparaître l'engagement en cours.
 */
export const AO_STATUTS_CLOS = ["COMPLETED", "CANCELLED", "LOST"] as const;

/**
 * LES STATUTS DE LIGNE QUI FERMENT LE LOT. Vocabulaire FERMÉ (`PchLineStatus`).
 * `UNSUCCESSFUL` (lot déclaré infructueux : personne n'a gagné) ferme bien le lot, et c'est le
 * schéma lui-même qui dit que ce n'est PAS « perdu » — les deux ferment, pour deux raisons.
 * `WON` ne ferme RIEN : un lot gagné est précisément celui qui engage le produit.
 */
export const LIGNE_STATUTS_CLOS = ["LOST", "UNSUCCESSFUL", "CANCELLED"] as const;

/** Tous les statuts d'AO connus — ce qui n'est ni clos ni ici n'est pas lu. */
export const AO_STATUTS_CONNUS = ["NOT_STARTED", "IN_PROGRESS", "SUSPENDED", ...AO_STATUTS_CLOS] as const;
/** Tous les statuts de ligne connus. */
export const LIGNE_STATUTS_CONNUS = ["PENDING", "QUOTED", "SUBMITTED", "WON", ...LIGNE_STATUTS_CLOS] as const;

export interface LigneAoDuProduit {
  ligneId: string;
  aoId: string;
  /** La référence du marché — ce qu'on cite (« AO-2026-ONCO-04 »). */
  aoReference: string;
  aoTitre: string | null;
  /** `PchTenderStatus`. */
  aoStatut: string;
  /** `PchLineStatus`. */
  ligneStatut: string;
  designation: string;
}

export interface LigneMarcheDuProduit {
  ligneId: string;
  /** Le contrat RACINE — la pièce Legal qui EST le marché PCH. */
  contratId: string;
  contratTitre: string;
  contratReference: string | null;
  /** La ligne d'AO dont elle découle. `null` = le fil est rompu, et on le dit. */
  aoLigneId: string | null;
  designation: string;
}

/** Un total de ventes — compté et sommé par la BASE, jamais en mémoire (voir ci-dessous). */
export interface TotalVentes {
  nombre: number;
  quantite: number;
  montantDzd: number;
}

/**
 * LA RÈGLE DU PARTAGE, ET ELLE VIT ICI SEULE : une vente rattachée à une ligne d'appel d'offres
 * passe par le MARCHÉ ; sans rattachement, c'est une vente de VILLE.
 *
 * `Sale.tenderLineId` porte ce fait depuis toujours et personne ne le lisait. La règle est
 * exportée plutôt que recopiée chez l'appelant parce que deux endroits qui partagent les ventes
 * finiraient par les partager autrement (§118.5) — et le symptôme serait un chiffre d'affaires
 * de ville qui ne concorde pas avec celui du marché, sans qu'on sache lequel croire.
 */
export const venteEstSousMarche = (tenderLineId: string | null | undefined): boolean =>
  typeof tenderLineId === "string" && tenderLineId.length > 0;

export type GenreAnomalie =
  | "PLUSIEURS_AO"
  | "PLUSIEURS_MARCHES"
  | "MARCHE_SANS_AO"
  | "VILLE_HORS_CANAL"
  | "MARCHE_HORS_CANAL";

export interface AnomalieRattachement {
  genre: GenreAnomalie;
  /** La phrase que l'écran affiche — elle NOMME les pièces, jamais « incohérence détectée ». */
  message: string;
  /** Les identifiants concernés, pour que l'écran puisse y mener. */
  cibles: string[];
}

/** Les formes légitimes que la Direction énonce, plus celles qu'on constate sans les juger. */
export type Couverture =
  | "AUCUNE"
  | "AO_EN_COURS"
  | "MARCHE_SEUL"
  | "MARCHE_ET_VILLE"
  | "VILLE_SEULE";

export const COUVERTURE_LABELS: Record<Couverture, string> = {
  AUCUNE: "Aucun rattachement marché",
  AO_EN_COURS: "Appel d'offres en cours, pas encore de marché",
  MARCHE_SEUL: "Marché PCH seul",
  MARCHE_ET_VILLE: "Marché PCH + ventes de ville",
  VILLE_SEULE: "Ventes de ville seules",
};

export interface RattachementProduit {
  /** L'AO VIVANT — un seul, ou `null` quand il n'y en a pas, ou quand il y en a PLUSIEURS. */
  ao: LigneAoDuProduit | null;
  /** LE marché PCH — même règle : `null` s'il n'y en a pas, ou s'il y en a plusieurs. */
  marche: LigneMarcheDuProduit | null;
  /** Les AO CLOS — l'historique, qui n'est jamais une anomalie. */
  aoClos: LigneAoDuProduit[];
  /** Les lignes dont le statut n'est dans aucun vocabulaire connu : on ne les a pas jugées. */
  nonLues: LigneAoDuProduit[];
  ventesSousMarche: TotalVentes;
  ventesDeVille: TotalVentes;
  couverture: Couverture;
  anomalies: AnomalieRattachement[];
}

/** Un statut est LU quand il figure dans le vocabulaire fermé de son axe. */
const aoStatutLu = (s: string) => (AO_STATUTS_CONNUS as readonly string[]).includes(s);
const ligneStatutLue = (s: string) => (LIGNE_STATUTS_CONNUS as readonly string[]).includes(s);

/**
 * LE RATTACHEMENT MARCHÉ D'UN PRODUIT.
 *
 * `canal` est celui du produit (`Product.channel` : RETAIL / HOSPITAL / BOTH) — il sert à
 * CONFRONTER ce qui est déclaré à ce qui se passe. Passer une valeur inconnue ne déclenche
 * aucune anomalie de canal : on ne juge pas ce qu'on ne lit pas.
 */
export function rattachementProduit(input: {
  lignesAo: readonly LigneAoDuProduit[];
  lignesMarche: readonly LigneMarcheDuProduit[];
  /**
   * LES DEUX TOTAUX, DÉJÀ AGRÉGÉS. Ce module ne reçoit PAS la liste des ventes, et c'est
   * délibéré : le détail remonté par la lecture 360 est BORNÉ, donc additionner cette liste
   * rendrait un chiffre d'affaires faux dès la cinquante-et-unième vente — faux sans le dire,
   * ce qui est le pire des deux mondes. Le partage se fait par `venteEstSousMarche` dans la
   * clause de la base, sur la TOTALITÉ des lignes.
   */
  ventes: { sousMarche: TotalVentes; ville: TotalVentes };
  canal: string;
}): RattachementProduit {
  const { lignesAo, lignesMarche, ventes, canal } = input;

  const nonLues = lignesAo.filter((l) => !aoStatutLu(l.aoStatut) || !ligneStatutLue(l.ligneStatut));
  const lues = lignesAo.filter((l) => aoStatutLu(l.aoStatut) && ligneStatutLue(l.ligneStatut));
  const clos = (l: LigneAoDuProduit) =>
    (AO_STATUTS_CLOS as readonly string[]).includes(l.aoStatut)
    || (LIGNE_STATUTS_CLOS as readonly string[]).includes(l.ligneStatut);

  const aoClos = lues.filter(clos);
  const aoVivants = lues.filter((l) => !clos(l));

  // DEUX AO VIVANTS SUR LE MÊME PRODUIT SE COMPTENT PAR MARCHÉ, pas par LIGNE : un même appel
  // d'offres peut légitimement porter deux lots du même produit (deux dosages, deux
  // conditionnements). Compter les lignes ferait de ce cas normal une anomalie permanente.
  const aoVivantsParMarche = new Map<string, LigneAoDuProduit[]>();
  for (const l of aoVivants) aoVivantsParMarche.set(l.aoId, [...(aoVivantsParMarche.get(l.aoId) ?? []), l]);

  const anomalies: AnomalieRattachement[] = [];
  let ao: LigneAoDuProduit | null = null;
  if (aoVivantsParMarche.size === 1) {
    ao = aoVivants[0] ?? null;
  } else if (aoVivantsParMarche.size > 1) {
    const refs = [...aoVivantsParMarche.values()].map((g) => g[0].aoReference);
    anomalies.push({
      genre: "PLUSIEURS_AO",
      message: `Ce produit est engagé sur ${aoVivantsParMarche.size} appels d'offres à la fois (${refs.join(", ")}). `
        + "Un produit est lié à un seul AO : vérifiez lequel fait foi — aucun n'est retenu ici, et rien n'a été modifié.",
      cibles: [...aoVivantsParMarche.keys()],
    });
  }

  // LE MARCHÉ PCH se compte par CONTRAT RACINE, pour la même raison : un contrat porte plusieurs
  // lots, et ses avenants sont des pièces du MÊME marché.
  const marchesParContrat = new Map<string, LigneMarcheDuProduit[]>();
  for (const l of lignesMarche) marchesParContrat.set(l.contratId, [...(marchesParContrat.get(l.contratId) ?? []), l]);

  let marche: LigneMarcheDuProduit | null = null;
  if (marchesParContrat.size === 1) {
    marche = lignesMarche[0] ?? null;
  } else if (marchesParContrat.size > 1) {
    const titres = [...marchesParContrat.values()].map((g) => g[0].contratReference ?? g[0].contratTitre);
    anomalies.push({
      genre: "PLUSIEURS_MARCHES",
      message: `Ce produit figure sur ${marchesParContrat.size} marchés PCH (${titres.join(", ")}). `
        + "Un AO donne un marché : vérifiez lequel est en vigueur — aucun n'est retenu ici.",
      cibles: [...marchesParContrat.keys()],
    });
  }

  // LE FIL AO → CONTRAT ROMPU. Le schéma autorise `tenderLineId` nul (le libellé du contrat fait
  // foi juridiquement), donc ce n'est pas une faute — c'est une lacune de traçabilité, et sans
  // elle personne ne peut dire de quel appel d'offres le marché découle.
  const sansAo = lignesMarche.filter((l) => l.aoLigneId === null);
  if (sansAo.length > 0) {
    anomalies.push({
      genre: "MARCHE_SANS_AO",
      message: `${sansAo.length} ligne(s) de marché ne renvoient à aucune ligne d'appel d'offres : `
        + "on ne peut pas dire de quel AO ce marché découle. Rattachez-les depuis la pièce contractuelle.",
      cibles: sansAo.map((l) => l.ligneId),
    });
  }

  const ventesSousMarche = ventes.sousMarche;
  const ventesDeVille = ventes.ville;

  // LE CANAL DÉCLARÉ CONFRONTÉ AUX FAITS. On ne corrige jamais : un produit hospitalier qui
  // enregistre des ventes de ville est peut-être l'exception voulue, et la seule chose fausse
  // serait de la taire ou de la réécrire.
  if (canal === "HOSPITAL" && ventesDeVille.nombre > 0) {
    anomalies.push({
      genre: "VILLE_HORS_CANAL",
      message: `Le produit est déclaré hospitalier, et porte ${ventesDeVille.nombre} vente(s) de ville `
        + `(${Math.round(ventesDeVille.montantDzd).toLocaleString("fr-FR")} DZD). Corrigez le canal, ou le rattachement de ces ventes.`,
      cibles: [],
    });
  }
  if (canal === "RETAIL" && (marchesParContrat.size > 0 || aoVivantsParMarche.size > 0)) {
    anomalies.push({
      genre: "MARCHE_HORS_CANAL",
      message: "Le produit est déclaré « gamme de ville » et figure pourtant sur un marché PCH. "
        + "Corrigez le canal, ou retirez-le du marché.",
      cibles: [...marchesParContrat.keys(), ...aoVivantsParMarche.keys()],
    });
  }

  // LA COUVERTURE se lit sur ce qui EXISTE, dans cet ordre : le marché d'abord, parce que c'est
  // lui qui engage ; l'AO ensuite, qui n'est qu'une promesse ; la ville enfin.
  const aUnMarche = marchesParContrat.size > 0;
  const aUnAo = aoVivantsParMarche.size > 0;
  const aDeLaVille = ventesDeVille.nombre > 0;
  const couverture: Couverture = aUnMarche
    ? (aDeLaVille ? "MARCHE_ET_VILLE" : "MARCHE_SEUL")
    : aUnAo ? "AO_EN_COURS"
      : aDeLaVille ? "VILLE_SEULE" : "AUCUNE";

  return { ao, marche, aoClos, nonLues, ventesSousMarche, ventesDeVille, couverture, anomalies };
}
