/**
 * UNE FACTURE EST UN DOCUMENT LÉGAL DE NATURE « FACTURE ».
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * Les factures avaient leur écran à elles, leur table et leur vocabulaire. Legal tenait pourtant
 * déjà la chaîne d'achat entière — devis → bon de commande → FACTURE → règlement : la nature
 * `INVOICE` existait, le chaînage la prévoyait, l'envoi au règlement ne marchait QUE sur elle, et
 * le circuit des pièces réclamées y versait déjà les factures acceptées. Deux registres pour le
 * même objet, donc deux réponses à « quelles factures de ce fournisseur ? », sans qu'on sache
 * laquelle est complète (§17 : pas de second registre).
 *
 * ── CE QUE CE MODULE PORTE, ET POURQUOI IL EST PUR ──────────────────────────────────────────
 *
 * Ce que la fusion ne doit rien faire perdre : savoir d'un coup d'œil ce qui reste à payer, et
 * combien. L'écran dédié le donnait dans son bandeau ; il se calcule ici, sans base, pour que la
 * liste Legal, la fiche et les compteurs répondent tous à partir du MÊME calcul.
 *
 * Module PUR : ni base, ni session (il n'importe que le vocabulaire). Testé.
 */

import { isInvoice } from "@/lib/labels";

/**
 * LA NATURE « FACTURE » ET SON ÉTAT DE RÈGLEMENT vivent dans le VOCABULAIRE (`lib/labels`) :
 * `INVOICE_KIND`, `isInvoice`, `settlementState`, `INVOICE_SETTLEMENT`. Ce ne sont pas des
 * règles du registre, ce sont deux champs qu'on lit — et TOUT le monde les lit : l'écran Legal,
 * la fiche marché, la recherche, la frise, Adam. Les enfermer ici les aurait fait recopier par
 * la moitié des appelants, et deux copies d'une même règle divergent au premier changement.
 *
 * Ce module-ci porte ce qui appartient VRAIMENT au registre : ce qui reste à payer, qui voit
 * quoi, et qui écrit quoi.
 */

export interface InvoiceTallyRow {
  kind: string;
  amount: number | null;
  /** L'échéance de règlement (`endDate` du document légal). */
  endDate: string | null;
  paidDate: string | null;
  expenseOrderId: string | null;
  /** Un document annulé ne se règle plus — il ne compte dans aucun total. */
  status: string;
}

export interface InvoiceTally {
  /** Combien de factures dans l'ensemble examiné. */
  count: number;
  /** Combien restent à régler — circuit compris : elles ne sont pas encore payées. */
  unpaid: number;
  /** Ce que ces factures-là représentent, en DZD. */
  unpaidTotal: number;
  /** Combien ont dépassé leur échéance sans être réglées. */
  overdue: number;
}

/**
 * CE QUI RESTE À PAYER, ET COMBIEN — sur l'ensemble QU'ON REGARDE.
 *
 * Le total suit la liste affichée, jamais un chiffre global : filtrer sur un fournisseur puis
 * additionner est le geste attendu, et un bandeau qui répondrait pour toute la base pendant que
 * le tableau montre autre chose fait douter des deux.
 *
 * Une facture ANNULÉE ne compte nulle part : elle ne sera jamais payée, et la laisser dans le
 * reste à payer gonflerait une dette qui n'existe pas.
 */
export function invoiceTally(rows: readonly InvoiceTallyRow[], today: Date = new Date()): InvoiceTally {
  const factures = rows.filter((r) => isInvoice(r.kind) && r.status !== "CANCELLED");
  const dues = factures.filter((r) => !r.paidDate);
  const jour = today.getTime();
  return {
    count: factures.length,
    unpaid: dues.length,
    unpaidTotal: dues.reduce((a, r) => a + (r.amount ?? 0), 0),
    overdue: dues.filter((r) => r.endDate !== null && new Date(r.endDate).getTime() < jour).length,
  };
}

// ───────────────────── Qui voit quoi, une fois les deux registres fondus ─────────────────────

/**
 * CE QU'UNE PERSONNE VOIT DU REGISTRE.
 *
 * ── LE PIÈGE DE LA CENTRALISATION ───────────────────────────────────────────────────────────
 *
 * Fondre les factures dans Legal aurait pu, sans qu'on y pense, FERMER LA PORTE à la
 * comptabilité : elle venait lire ce qui reste à payer dans un écran Finances, et le registre
 * des engagements ne lui est pas ouvert. Centraliser ne doit rien retirer à personne.
 *
 * L'ouvrir en grand aurait été pire : le registre porte des baux, des contrats de cadre, des
 * protocoles d'accord — des pièces qu'on ne lit pas parce qu'on tient la trésorerie.
 *
 * D'où trois portées, et pas deux. Elle est appliquée PAR LE SERVEUR, dans la requête, et non
 * par un filtre d'écran : un filtre d'écran se retire dans le navigateur.
 */
export type LegalViewScope = "ALL" | "INVOICES_ONLY" | "NONE";

export function legalViewScope(rights: { onLegal: boolean; onFinances: boolean }): LegalViewScope {
  if (rights.onLegal) return "ALL";
  if (rights.onFinances) return "INVOICES_ONLY";
  return "NONE";
}

/**
 * PEUT-ON ÉCRIRE CETTE PIÈCE ?
 *
 * La comptabilité tient les FACTURES — les enregistrer, les corriger, marquer leur règlement.
 * Elle ne tient pas le reste du registre. La règle vit ici, elle est donc la même pour l'écran,
 * pour l'action serveur et pour Adam ; trois copies auraient fini par diverger, et la divergence
 * d'un contrôle d'accès s'appelle une faille.
 */
export function legalWriteAllowed(input: { onLegal: boolean; onFinances: boolean; kind: string }): boolean {
  if (input.onLegal) return true;
  return input.onFinances && isInvoice(input.kind);
}

/**
 * LA NATURE DEMANDÉE PAR L'URL — `?nature=INVOICE`.
 *
 * C'est ce qui remplace l'écran dédié : « les factures » est une VUE de la liste des documents
 * légaux, pas un autre endroit. Une valeur inconnue ne filtre rien plutôt que de rendre une liste
 * vide : un lien mal recopié doit montrer les documents, pas faire croire qu'il n'y en a plus.
 */
export function natureFromParam(raw: string | null | undefined, known: readonly string[]): string {
  const v = (raw ?? "").trim().toUpperCase();
  return known.includes(v) ? v : "";
}
