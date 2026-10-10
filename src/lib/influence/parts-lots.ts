/**
 * LA PART DE NOS LOTS PAR ÉTABLISSEMENT (Intelligence terrain, Super Admin seul — Direction, 10/2026) : sur les boîtes qu'une
 * direction régionale de la PCH a livrées à un établissement pour une de nos présentations, quelle part porte UN DE NOS NUMÉROS
 * DE LOT ? Nos lots sont ceux de nos livraisons à la PCH (`PchDeliveryLine.batchNumber`) ; les lots livrés sont ceux des fichiers
 * Ventes PCH (`PchVenteLigne.lot`). Module PUR, sans base : testé tel quel.
 *
 * CE QUE LE CHIFFRE DIT, ET CE QU'IL NE DIT PAS
 *   • Les fichiers de la PCH s'arrêtent à l'ÉTABLISSEMENT : aucun volume par SERVICE n'existe — c'est la limite des données,
 *     pas un oubli. L'écran le dit.
 *   • Seules les lignes qui portent un lot comptent au dénominateur : une ligne sans lot n'est ni « à nous » ni « pas à nous ».
 *   • « n/d » plutôt qu'un 0 % trompeur : aucune ligne avec un lot, ou aucun de nos lots connu pour le produit (le numéro du BL
 *     n'est pas renseigné) — dans les deux cas on ne sait pas, on ne devine pas.
 */

/** Un numéro de lot comparable : « B-2307/A » = « b 2307 a ». Trop court (moins de 2 caractères) : inexploitable. */
export function normaliserLot(v: string | null | undefined): string | null {
  const t = (v ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return t.length >= 2 ? t : null;
}

export interface LigneLivree {
  productId: string;
  /** Le lot tel qu'écrit par la PCH — nul si la ligne n'en porte pas. */
  lot: string | null;
  /** Boîtes livrées (négatif = retour : écarté). */
  livre: number;
}

export type RaisonNd = "SANS_LOT_PCH" | "NOS_LOTS_INCONNUS";

export interface PartLotsProduit {
  productId: string;
  /** Toutes les boîtes livrées (avec ou sans lot). */
  livre: number;
  /** Celles dont la ligne porte un lot lisible — le dénominateur. */
  livreAvecLot: number;
  /** Celles dont le lot est l'un des nôtres. */
  livreNosLots: number;
  /** Part de nos lots, en % entier — `null` (n/d) si elle ne peut pas se calculer honnêtement. */
  part: number | null;
  raison: RaisonNd | null;
  /** Part des boîtes livrées dont le lot est renseigné, en % entier — dit la fiabilité du chiffre. */
  couvertureLot: number | null;
  /** Combien de nos lots distincts sont connus pour ce produit. */
  lotsConnus: number;
}

export function partDeNosLots(
  lignes: readonly LigneLivree[],
  nosLots: ReadonlyMap<string, ReadonlySet<string>>,
): PartLotsProduit[] {
  const acc = new Map<string, { livre: number; avecLot: number; nos: number }>();
  for (const l of lignes) {
    if (!(l.livre > 0)) continue; // un retour (négatif) ou une ligne vide n'est pas une livraison
    const a = acc.get(l.productId) ?? acc.set(l.productId, { livre: 0, avecLot: 0, nos: 0 }).get(l.productId)!;
    a.livre += l.livre;
    const lot = normaliserLot(l.lot);
    if (!lot) continue;
    a.avecLot += l.livre;
    if (nosLots.get(l.productId)?.has(lot)) a.nos += l.livre;
  }
  return [...acc.entries()].map(([productId, a]) => {
    const lotsConnus = nosLots.get(productId)?.size ?? 0;
    const raison: RaisonNd | null = a.avecLot === 0 ? "SANS_LOT_PCH" : lotsConnus === 0 ? "NOS_LOTS_INCONNUS" : null;
    return {
      productId, livre: a.livre, livreAvecLot: a.avecLot, livreNosLots: a.nos, lotsConnus, raison,
      part: raison ? null : Math.round((a.nos / a.avecLot) * 100),
      couvertureLot: a.livre > 0 ? Math.round((a.avecLot / a.livre) * 100) : null,
    };
  }).sort((x, y) => y.livre - x.livre);
}

export const LIBELLE_RAISON_ND: Record<RaisonNd, string> = {
  SANS_LOT_PCH: "les fichiers de la PCH ne donnent pas le lot",
  NOS_LOTS_INCONNUS: "aucun numéro de lot de nos livraisons n'est renseigné",
};

/** Nos lots par produit, depuis les lignes de livraison (BL) — le numéro est normalisé, les vides écartés. */
export function lotsParProduit(lignes: readonly { productId: string | null; batchNumber: string | null }[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const l of lignes) {
    const lot = normaliserLot(l.batchNumber);
    if (!l.productId || !lot) continue;
    (out.get(l.productId) ?? out.set(l.productId, new Set()).get(l.productId)!).add(lot);
  }
  return out;
}
