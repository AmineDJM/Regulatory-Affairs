/**
 * LES DEVIS RETRANSCRITS — ce qu'ils valent, ce que le demandeur retient, ce que le BC portera (§118.152).
 *
 * L'assistante de direction recopie chaque devis d'agence dans un tableau interne : référence,
 * unité, quantité, prix unitaire. Le demandeur retient ensuite un devis entier, ou des lignes de
 * plusieurs devis ; c'est ce MONTANT RETENU que la Direction Marketing valide, que le seuil du
 * Directeur Général juge, et que les bons de commande porteront.
 *
 * ── LES TROIS RÈGLES QUI TIENNENT CE MODULE ────────────────────────────────────────────────
 *
 * 1. UN TOTAL NE SE SAISIT PAS, IL SE CALCULE (§118.59). Le prix total d'une ligne est quantité ×
 *    prix unitaire ; le total d'un devis est la somme de ses lignes. Le total IMPRIMÉ sur le
 *    papier se saisit à part, et seulement pour CONTRÔLER : l'écart entre les deux est ce qui
 *    attrape une ligne oubliée ou un zéro de trop dans la retranscription. Il est EXIGÉ pour
 *    terminer : un contrôle qu'on peut sauter en laissant un champ vide ne contrôle rien.
 * 2. ON COMPTE EN CENTIMES. Chaque ligne est arrondie au centime une fois, puis les centimes
 *    s'additionnent : additionner des flottants ferait apparaître 0,30000000000000004 DZD dans un
 *    total, et deux écrans qui arrondissent à des moments différents finiraient par annoncer deux
 *    montants validés différents pour le même choix.
 * 3. LE MONTANT ENGAGÉ EST TOUTES TAXES COMPRISES. TVA et taxe additionnelle (« Taxe Pub 2 % »,
 *    hors base de TVA, §118.135) sont ce que la société paiera : juger le seuil du DG sur le HT
 *    laisserait passer sans lui un devis de 950 000 DZD HT qui en coûte 1 150 000.
 *
 * Module PUR — aucune base, aucun import de domaine : le chargeur passe des nombres.
 */

import { designationAvecAction, type PromoAction } from "@/lib/promo-material/actions-fournisseur";

export interface LigneDevisLue {
  id: string;
  position: number;
  reference: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  selected: boolean;
  /** L'action que la ligne chiffre (conception, impression…) — nulle sur les lignes d'avant (§118.165). */
  action?: PromoAction | null;
  /** L'article demandé auquel la ligne se rapproche — nul = ligne « en plus » (§118.165). */
  requestItemId?: string | null;
}

export interface DevisLu {
  id: string;
  supplierId: string | null;
  supplierName: string;
  reference: string | null;
  /** TVA en POUR CENT (19), comme on la lit sur le devis. */
  tvaRate: number;
  extraTaxLabel: string | null;
  /** Taxe additionnelle en POUR CENT, hors base de TVA. Nulle = aucune. */
  extraTaxRate: number | null;
  announcedTotal: number | null;
  documentId: string | null;
  lines: LigneDevisLue[];
}

export interface Totaux {
  ht: number;
  tva: number;
  taxe: number;
  ttc: number;
  lignes: number;
}

const cents = (x: number): number => Math.round(x * 100);
const dzd = (c: number): number => c / 100;

/** Le prix total d'une ligne, HT, arrondi au centime. */
export function totalLigneHT(l: Pick<LigneDevisLue, "quantity" | "unitPrice">): number {
  return dzd(cents(Number(l.quantity) * Number(l.unitPrice)));
}

/**
 * LES TOTAUX DE LIGNES TAXÉES — la seule arithmétique des montants du matériel promotionnel :
 * le devis, la sélection, et la FACTURE la lisent (§118.165). Deux calculs du même TTC finiraient
 * par annoncer deux montants pour les mêmes lignes, et c'est celui de la facture qu'on paierait.
 */
export function totauxTaxes(
  taxes: { tvaRate: number; extraTaxRate: number | null },
  lignes: readonly { quantity: number; unitPrice: number }[],
): Totaux {
  return totauxDeLignes(taxes, lignes);
}

function totauxDeLignes(d: Pick<DevisLu, "tvaRate" | "extraTaxRate">, lignes: readonly { quantity: number; unitPrice: number }[]): Totaux {
  const htC = lignes.reduce((s, l) => s + cents(Number(l.quantity) * Number(l.unitPrice)), 0);
  const tvaC = Math.round((htC * Number(d.tvaRate ?? 0)) / 100);
  const taxeC = d.extraTaxRate ? Math.round((htC * Number(d.extraTaxRate)) / 100) : 0;
  return { ht: dzd(htC), tva: dzd(tvaC), taxe: dzd(taxeC), ttc: dzd(htC + tvaC + taxeC), lignes: lignes.length };
}

/** Ce que vaut le devis ENTIER, tel que retranscrit. */
export function totauxDuDevis(d: DevisLu): Totaux {
  return totauxDeLignes(d, d.lines);
}

/** Ce que vaut ce que le demandeur a RETENU dans ce devis. */
export function totauxRetenus(d: DevisLu): Totaux {
  return totauxDeLignes(d, d.lines.filter((l) => l.selected));
}

/**
 * LE MONTANT RETENU SUR TOUS LES DEVIS — c'est lui que la Direction Marketing valide et que le
 * seuil du Directeur Général juge. Chaque devis garde SA TVA et SA taxe : les additionner d'abord
 * puis appliquer un taux unique serait faux dès qu'un devis est exonéré.
 */
export function totauxDeLaSelection(devis: readonly DevisLu[]): Totaux & { devis: number } {
  const parDevis = devis.map(totauxRetenus).filter((t) => t.lignes > 0);
  const somme = (k: keyof Totaux) => dzd(parDevis.reduce((s, t) => s + cents(t[k]), 0));
  return {
    ht: somme("ht"), tva: somme("tva"), taxe: somme("taxe"), ttc: somme("ttc"),
    lignes: parDevis.reduce((s, t) => s + t.lignes, 0), devis: parDevis.length,
  };
}

/**
 * LA RETRANSCRIPTION TOMBE-T-ELLE JUSTE ? Le total imprimé sur le devis contre la somme des lignes
 * recopiées. `null` quand aucun total n'a été saisi : on ne déclare pas d'écart sur ce qu'on n'a
 * pas lu (§118.16) — c'est `manquesDeRetranscription` qui exige ce total, en le NOMMANT, au lieu
 * que son absence passe pour un accord. Tolérance d'un dinar : les devis arrondissent leurs lignes,
 * pas toujours pareil.
 */
export function ecartDeRetranscription(d: DevisLu): { annonce: number; calcule: number; ecart: number } | null {
  if (d.announcedTotal == null) return null;
  const calcule = totauxDuDevis(d).ht;
  const ecart = dzd(cents(d.announcedTotal) - cents(calcule));
  return Math.abs(ecart) <= 1 ? null : { annonce: d.announcedTotal, calcule, ecart };
}

/**
 * LA RETRANSCRIPTION PEUT-ELLE ÊTRE DÉCLARÉE TERMINÉE ? Tout ce qui manque, en UNE fois (§118.18) :
 * un refus par défaut fait revenir six fois.
 *
 * - au moins un devis, et chacun a au moins une ligne ;
 * - chaque devis a son FOURNISSEUR choisi dans l'annuaire (c'est lui qui donne son identité au BC) ;
 * - chaque devis a son SCAN : une retranscription sans sa source ne se vérifie pas ;
 * - chaque devis a son TOTAL HT IMPRIMÉ : le contrôle à un dinar près se SAUTAIT quand le champ
 *   restait vide, et « Retranscription terminée » passait sans que rien ait été comparé — alors
 *   que la règle se disait toujours appliquée. Un zéro de trop ne s'attrape que contre le papier ;
 * - aucune ligne à quantité nulle ou à prix négatif ;
 * - aucun écart entre le total annoncé et la somme des lignes — l'écart est dit, avec son montant.
 */
export function manquesDeRetranscription(devis: readonly DevisLu[]): string[] {
  if (devis.length === 0) return ["aucun devis n'est retranscrit"];
  const manques: string[] = [];
  for (const d of devis) {
    const nom = d.supplierName?.trim() || "devis sans fournisseur";
    if (d.lines.length === 0) manques.push(`« ${nom} » n'a aucune ligne`);
    if (!d.supplierId) manques.push(`« ${nom} » : choisissez le fournisseur dans l'annuaire (il donne son adresse, son RC et son NIF au bon de commande)`);
    if (!d.documentId) manques.push(`« ${nom} » : joignez le scan du devis — une retranscription sans sa source ne se vérifie pas`);
    if (d.announcedTotal == null) {
      manques.push(`« ${nom} » : saisissez le total HT imprimé sur le devis — c'est contre lui que la retranscription se contrôle, à un dinar près`);
    }
    const fausses = d.lines.filter((l) => !(Number(l.quantity) > 0) || Number(l.unitPrice) < 0 || !l.reference.trim());
    if (fausses.length > 0) manques.push(`« ${nom} » : ${fausses.length} ligne(s) sans référence, à quantité nulle ou à prix négatif`);
    const ecart = ecartDeRetranscription(d);
    if (ecart) {
      manques.push(`« ${nom} » : les lignes font ${formatDzd(ecart.calcule)} HT, le devis annonce ${formatDzd(ecart.annonce)} — vérifiez la retranscription`);
    }
  }
  return manques;
}

/**
 * Les lignes que le bon de commande de CE devis portera : les retenues, rien d'autre — et chacune
 * avec son ACTION devant la désignation (« Impression — Fiche posologique »), parce que le BC est
 * la pièce que le fournisseur lit (§118.165).
 */
export function lignesDuBonDeCommande(d: DevisLu): { designation: string; quantite: number; unite: string | null; prixUnitaire: number }[] {
  return d.lines
    .filter((l) => l.selected)
    .sort((a, b) => a.position - b.position)
    .map((l) => ({ designation: designationAvecAction(l.reference, l.action), quantite: Number(l.quantity), unite: l.unit?.trim() || null, prixUnitaire: Number(l.unitPrice) }));
}

/**
 * 1 234 567,5 → « 1 234 567,50 DZD » — pour les phrases de refus, lues par une personne. TOUJOURS deux
 * décimales : c'est la forme d'un devis ou d'une facture, et elle n'arrondit rien.
 */
export function formatDzd(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD`;
}
