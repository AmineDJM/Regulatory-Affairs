import { brouillonNeuf, lireBrouillon, type BrouillonBc } from "@/lib/bons-de-commande/brouillon";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'APERÇU DU BC D'UN DEVIS DE MATÉRIEL PROMOTIONNEL — « à vérifier par le demandeur » (Direction, 10/2026).
 *
 * La MÊME forme que le brouillon d'un poste Ad & Pro (`bons-de-commande/brouillon.ts`) — Référence, Contact, Modalités de
 * paiement, livraison, notes, numéro choisi —, plus la TAXE SUPPLÉMENTAIRE de la génération (« Taxe Pub 2 % ») :
 * `undefined` = celle du devis ; `null` = aucune ; sinon la taxe pour ce BC. Les LIGNES ne s'y corrigent pas : ce sont
 * les lignes retenues et validées (Direction Marketing, Directeur Général) — un BC qui s'en écarterait engagerait la
 * société sur ce que personne n'a validé, et les factures se rapprochent de ces lignes-là.
 *
 * Le champ `itemId` du brouillon porte l'identifiant du DOSSIER.
 *
 * Module PUR : lu par l'écran (composant client) comme par la génération.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type TaxeDuBrouillon = { libelle: string; taux: number } | null | undefined;

export interface BrouillonBcPromo extends BrouillonBc {
  taxe: TaxeDuBrouillon;
}

/** Le JSON gardé sur le devis → l'aperçu typé, ou `null` (pas d'aperçu, ou illisible : on n'invente rien). */
export function lireBrouillonPromo(brut: unknown): BrouillonBcPromo | null {
  const b = lireBrouillon(brut);
  if (!b) return null;
  const t = (brut as Record<string, unknown>).taxe;
  let taxe: TaxeDuBrouillon;
  if (t === null) taxe = null;
  else if (t && typeof t === "object") {
    const o = t as Record<string, unknown>;
    const libelle = typeof o.libelle === "string" && o.libelle.trim() ? o.libelle.trim() : "Taxe additionnelle";
    taxe = typeof o.taux === "number" && Number.isFinite(o.taux) && o.taux > 0 && o.taux <= 1 ? { libelle, taux: o.taux } : undefined;
  } else taxe = undefined;
  return { ...b, lignes: null, signature: null, taxe };
}

/** Un aperçu neuf : ce que la génération a reçu (livraison, notes, taxe) ; le reste vient du devis. */
export function brouillonPromoNeuf(p: {
  promoMaterialId: string; par: string; parNom: string | null; maintenant?: Date;
  livraison: { adresse: string | null; delai: string | null } | null; notes: string | null; taxe: TaxeDuBrouillon;
}): BrouillonBcPromo {
  const b = brouillonNeuf({ itemId: p.promoMaterialId, par: p.par, parNom: p.parNom, ...(p.maintenant ? { maintenant: p.maintenant } : {}) });
  const livraison = p.livraison && (p.livraison.adresse || p.livraison.delai) ? { adresse: p.livraison.adresse, date: null, delai: p.livraison.delai } : null;
  return { ...b, livraison, notes: p.notes, taxe: p.taxe };
}

/** L'aperçu en JSON : `taxe` absente = celle du devis. */
export function brouillonPromoEnJson(b: BrouillonBcPromo): Record<string, unknown> {
  const { taxe, ...reste } = b;
  return taxe === undefined ? { ...reste } : { ...reste, taxe };
}
