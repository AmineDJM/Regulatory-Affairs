/**
 * LE MARCHÉ COMPTE EN UNITÉS, NOUS VENDONS EN BOÎTES — et les deux doivent coexister sans mentir.
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * Un appel d'offres PCH demande « 8 000 comprimés ». Nous, nous soumissionnons une BOÎTE de 30 à
 * un prix, et nous la payons un autre prix à notre fournisseur. Le module ne connaissait que le
 * prix À L'UNITÉ : on divisait de tête avant de saisir, on arrondissait, et le chiffre que
 * l'équipe avait négocié — le prix de la boîte — n'existait nulle part. Personne ne pouvait
 * répondre à « on la vend combien, la boîte ? » sans rouvrir un tableur.
 *
 * Notre COÛT, lui, n'était pas saisi du tout : on soumissionnait sans que la plateforme sache si
 * l'on gagnait ou perdait de l'argent sur le lot.
 *
 * ── LA RÈGLE : LA BOÎTE EST LA SOURCE, L'UNITÉ EST SA PROJECTION ────────────────────────────
 *
 * Quand une ligne est chiffrée À LA BOÎTE, c'est le prix de la boîte qui fait foi : c'est lui
 * qu'on a négocié, lui qui figure sur l'offre. Le prix unitaire s'en DÉDUIT (`box / unitsPerBox`)
 * et sert au reste de la chaîne — contrat, bons de commande, livraisons — qui, elle, compte en
 * unités parce que le marché compte en unités.
 *
 * L'inverse aurait été un piège : stocker l'unité et recalculer la boîte ferait de 1 000 DZD la
 * boîte de 30 un prix unitaire de 33,33 puis une boîte à 999,90. Un centime perdu à chaque
 * aller-retour sur le seul chiffre que l'équipe reconnaît.
 *
 * Une ligne SANS prix de boîte garde son prix unitaire tel quel : les lignes anciennes, et celles
 * d'un marché réellement chiffré à l'unité, ne sont pas réécrites.
 *
 * ── CE QU'ON NE STOCKE PAS ──────────────────────────────────────────────────────────────────
 *
 * Le nombre de BOÎTES et le MONTANT de la ligne. Ils se calculent (`boxCount`, `lineAmount`) et
 * les stocker en ferait des chiffres à tenir à jour — donc faux le jour où l'on corrige une
 * quantité sans y penser.
 *
 * Module PUR : ni base, ni session. Testé.
 */

/**
 * ARRONDI SYMÉTRIQUE — la moitié s'éloigne toujours de zéro.
 *
 * `Math.round` arrondit vers +∞ : 187,5 donne 188, mais −187,5 donne −187. Sur une marge, cette
 * asymétrie SOUS-ESTIME systématiquement les pertes d'un dixième de point. C'est peu, et c'est
 * exactement le genre de biais qu'on ne remarque jamais et qui va toujours dans le sens rassurant.
 */
function arrondi(v: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.sign(v) * Math.round(Math.abs(v) * f) / f;
}

/**
 * COMBIEN DE BOÎTES POUR CETTE QUANTITÉ — arrondi AU SUPÉRIEUR.
 *
 * On ne livre pas une demi-boîte : 8 000 comprimés par 30 font 267 boîtes, pas 266,67. L'arrondi
 * au supérieur est la réalité physique de la livraison, et c'est aussi ce qu'on facture.
 *
 * `null` quand le conditionnement est inconnu : rendre 0 laisserait croire qu'il n'en faut
 * aucune, et rendre la quantité en unités ferait passer des comprimés pour des boîtes.
 */
export function boxCount(quantityUnits: number, unitsPerBox: number | null | undefined): number | null {
  if (!unitsPerBox || unitsPerBox <= 0) return null;
  if (!Number.isFinite(quantityUnits) || quantityUnits <= 0) return 0;
  return Math.ceil(quantityUnits / unitsPerBox);
}

/** L'inverse — des boîtes vers les unités, quand la saisie se fait en boîtes. */
export function unitsFromBoxes(boxes: number, unitsPerBox: number | null | undefined): number | null {
  if (!unitsPerBox || unitsPerBox <= 0) return null;
  if (!Number.isFinite(boxes) || boxes <= 0) return 0;
  return Math.round(boxes) * unitsPerBox;
}

/**
 * LE PRIX UNITAIRE DÉDUIT D'UN PRIX DE BOÎTE.
 *
 * Deux décimales, comme la colonne qui le reçoit. La perte de précision est ASSUMÉE et va dans le
 * bon sens : le chiffre exact reste celui de la boîte, celui qu'on a négocié ; l'unité n'est
 * qu'une projection pour la chaîne aval.
 */
export function unitFromBoxPrice(boxPrice: number | null | undefined, unitsPerBox: number | null | undefined): number | null {
  if (boxPrice == null || !Number.isFinite(boxPrice)) return null;
  if (!unitsPerBox || unitsPerBox <= 0) return null;
  return Math.round((boxPrice / unitsPerBox) * 100) / 100;
}

/**
 * LE PRIX DE BOÎTE À AFFICHER quand la ligne n'en porte pas — reconstruit depuis l'unité.
 *
 * C'est une COMMODITÉ de lecture, jamais une valeur qu'on réenregistre : la réenregistrer
 * figerait l'arrondi et ferait dériver le chiffre à chaque passage.
 */
export function boxFromUnitPrice(unitPrice: number | null | undefined, unitsPerBox: number | null | undefined): number | null {
  if (unitPrice == null || !Number.isFinite(unitPrice)) return null;
  if (!unitsPerBox || unitsPerBox <= 0) return null;
  return Math.round(unitPrice * unitsPerBox * 100) / 100;
}

export interface LineEconomicsInput {
  quantityUnits: number;
  unitsPerBox?: number | null;
  /** Notre prix de participation — À LA BOÎTE, s'il a été saisi ainsi. */
  boxPriceDzd?: number | null;
  /** Notre coût d'achat — à la boîte. */
  boxCostDzd?: number | null;
  /** Le prix unitaire, canonique pour la chaîne aval (dérivé du prix de boîte quand il existe). */
  unitPriceDzd?: number | null;
}

export interface LineEconomics {
  /** Nombre de boîtes — `null` si le conditionnement est inconnu. */
  boxes: number | null;
  /** Prix de participation à la boîte : saisi, ou reconstruit depuis l'unité. */
  boxPrice: number | null;
  /** Coût à la boîte, s'il a été saisi. */
  boxCost: number | null;
  /** Le prix unitaire retenu — celui de la boîte s'il existe, sinon celui saisi à l'unité. */
  unitPrice: number | null;
  /** Le montant de la ligne : prix unitaire × quantité en unités. */
  amount: number | null;
  /** Marge à la boîte (prix − coût) — `null` tant que les deux ne sont pas connus. */
  marginPerBox: number | null;
  /** Marge en pourcentage du prix de vente. */
  marginPct: number | null;
  /** On soumissionne À PERTE : le coût dépasse le prix. C'est ce qu'il faut voir avant de déposer. */
  atLoss: boolean;
}

/**
 * TOUTE L'ÉCONOMIE D'UNE LIGNE, en un seul calcul.
 *
 * Le MONTANT se calcule sur les UNITÉS et non sur les boîtes : c'est ce que l'organisme paie, et
 * une ligne de 8 000 comprimés facturée en 267 boîtes pleines coûterait au client dix comprimés
 * qu'il n'a pas commandés.
 *
 * `atLoss` n'est pas un interdit — soumissionner à perte pour entrer sur un marché est une
 * décision qui se prend. C'est un FAIT qu'on affiche avant le dépôt, pas après.
 */
export function lineEconomics(input: LineEconomicsInput): LineEconomics {
  const unitsPerBox = input.unitsPerBox ?? null;
  const boxes = boxCount(input.quantityUnits, unitsPerBox);

  const boxPriceSaisi = input.boxPriceDzd != null && Number.isFinite(input.boxPriceDzd) ? input.boxPriceDzd : null;
  const unitPrice = boxPriceSaisi != null
    ? unitFromBoxPrice(boxPriceSaisi, unitsPerBox) ?? (input.unitPriceDzd ?? null)
    : (input.unitPriceDzd ?? null);
  const boxPrice = boxPriceSaisi ?? boxFromUnitPrice(input.unitPriceDzd, unitsPerBox);
  const boxCost = input.boxCostDzd != null && Number.isFinite(input.boxCostDzd) ? input.boxCostDzd : null;

  const amount = unitPrice != null && Number.isFinite(input.quantityUnits)
    ? Math.round(unitPrice * input.quantityUnits * 100) / 100
    : null;

  const marginPerBox = boxPrice != null && boxCost != null ? arrondi(boxPrice - boxCost, 2) : null;
  const marginPct = marginPerBox != null && boxPrice != null && boxPrice > 0
    ? arrondi((marginPerBox / boxPrice) * 100, 1)
    : null;

  return {
    boxes, boxPrice, boxCost, unitPrice, amount, marginPerBox, marginPct,
    atLoss: marginPerBox != null && marginPerBox < 0,
  };
}

// ───────────────────────── L'attribution, lot par lot ─────────────────────────

export interface AwardInput {
  /** Quantité demandée par le marché. */
  quantityUnits: number;
  /** Quantité que NOUS avons soumissionnée, si elle diffère de la demandée. */
  submittedQuantityUnits?: number | null;
  /** Quantité ATTRIBUÉE. `null` = décision non encore saisie. */
  awardedQuantityUnits?: number | null;
  status: string;
}

export interface AwardResult {
  /** A-t-on gagné ce lot ? */
  won: boolean;
  /** La part attribuée, en % de ce qu'on a soumissionné. `null` = pas encore décidé. */
  pct: number | null;
  /** Attribution PARTIELLE : gagné, mais pas tout. */
  partial: boolean;
  label: string;
}

/**
 * COMBIEN AVONS-NOUS GAGNÉ SUR CE LOT — en pourcentage de CE QU'ON A DÉPOSÉ.
 *
 * Le dénominateur est la quantité SOUMISE, pas la quantité demandée par le marché. C'est la
 * différence entre « nous avons obtenu 100 % de notre offre » et « nous avons obtenu 50 % du
 * marché parce que nous n'avions déposé que sur la moitié ». Les deux phrases sont vraies et ne
 * disent pas la même chose ; celle qui juge notre performance est la première.
 *
 * À défaut de quantité soumise déclarée, on retombe sur la quantité demandée — c'est le cas
 * normal d'un dépôt total.
 *
 * Le POURCENTAGE NE SE SAISIT PAS : il se déduit des quantités. Un pourcentage saisi à la main
 * dérive de ses quantités dès la première correction, et l'on ne sait plus lequel croire.
 */
export function awardResult(input: AwardInput): AwardResult {
  const won = input.status === "WON";
  const depose = input.submittedQuantityUnits && input.submittedQuantityUnits > 0
    ? input.submittedQuantityUnits
    : input.quantityUnits;

  if (!won) {
    const labels: Record<string, string> = {
      LOST: "Perdu",
      UNSUCCESSFUL: "Infructueux — personne n'a gagné",
      CANCELLED: "Lot annulé",
      SUBMITTED: "Déposé — en attente de décision",
      QUOTED: "Chiffré",
      PENDING: "À étudier",
    };
    return { won: false, pct: null, partial: false, label: labels[input.status] ?? "À étudier" };
  }

  if (input.awardedQuantityUnits == null || depose <= 0) {
    // Gagné, mais la quantité attribuée n'a pas été saisie : on ne l'INVENTE pas à 100 %.
    return { won: true, pct: null, partial: false, label: "Gagné — quantité attribuée à renseigner" };
  }

  const pct = arrondi((input.awardedQuantityUnits / depose) * 100, 1);
  const partial = input.awardedQuantityUnits < depose;
  return {
    won: true,
    pct,
    partial,
    label: partial ? `Gagné à ${pct} %` : "Gagné en totalité",
  };
}
