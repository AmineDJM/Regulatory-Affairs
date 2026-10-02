/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA REMISE DE CAISSE D'AVANCE PASSE PAR LE CENTRE DE PAIEMENT (§118.176).
 *
 * « La caisse qui est donnée mensuellement aux moyens généraux […] doit dorénavant aussi passer
 * par le centre de paiement et attendre la validation » — la Direction, 01/10/2026.
 *
 * ── CE QUE ÇA CHANGE POUR UNE REMISE ────────────────────────────────────────────────────────
 *
 * Remettre une somme ne SORT plus l'argent : la remise naît avec son ORDRE DE DÉPENSE, en attente
 * du centre. Le centre l'autorise (ou la refuse), les Finances la versent, et c'est AU VERSEMENT
 * que l'écriture de trésorerie se pose — là où l'argent quitte réellement la banque. La détentrice
 * ne confirme sa réception qu'ensuite : confirmer avoir reçu une somme que personne n'a encore
 * autorisée, c'est attester un fait qui n'a pas eu lieu (§118.15).
 *
 * ── UNE REMISE QUI ATTEND N'EST PAS DANS LE FOND ────────────────────────────────────────────
 *
 * « Remis (non soldé) » compte ce qui a été REMIS. Une somme demandée au centre ne l'a pas été :
 * la compter ferait annoncer « 20 000 DZD remis, à confirmer » à une détentrice qui n'a rien vu
 * venir — et qu'on relancerait pour une confirmation impossible. Elle est montrée À PART, avec ce
 * qu'elle attend, et elle ne se solde pas avec le fond : la solder ferait payer par le centre une
 * remise déjà close, que personne ne pourrait plus recevoir.
 *
 * ── L'HISTORIQUE RESTE LISIBLE ──────────────────────────────────────────────────────────────
 *
 * Une remise d'AVANT la règle n'a pas d'ordre : elle est versée, et se confirme comme avant.
 *
 * Module PUR — testé, sans base de données.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Où en est une remise, côté argent. */
export type EtatRemise = "EN_ATTENTE" | "A_VERSER" | "VERSEE" | "REFUSEE" | "ANNULEE";

export interface RemiseBrute {
  /** La remise porte-t-elle un ordre de dépense ? Non = remise d'avant la règle. */
  aUnOrdre: boolean;
  /** L'ordre, quand il existe encore. */
  ordre: { status: string; centralStatus: string } | null;
  /** L'écriture de la remise — posée au versement. */
  transactionId: string | null;
}

/**
 * L'ÉTAT D'UNE REMISE.
 *
 * Une écriture posée vaut versement, quoi que dise l'ordre : c'est le livre qui fait foi sur
 * l'argent sorti. Un ordre réglé dont le crochet n'a pas encore posé l'écriture est versé aussi —
 * le croire « à verser » ferait relancer les Finances pour un paiement qu'elles ont fait.
 */
export function etatRemise(r: RemiseBrute): EtatRemise {
  if (!r.aUnOrdre) return "VERSEE";
  if (r.transactionId) return "VERSEE";
  const o = r.ordre;
  // Un ordre disparu sans écriture n'a rien versé.
  if (!o) return "ANNULEE";
  if (o.status === "PAID") return "VERSEE";
  if (o.status === "CANCELLED") return "ANNULEE";
  if (o.centralStatus === "REFUSED") return "REFUSEE";
  if (o.centralStatus === "APPROVED" || o.centralStatus === "NOT_REQUIRED") return "A_VERSER";
  return "EN_ATTENTE";
}

export const ETAT_REMISE_LABEL: Record<EtatRemise, { label: string; tone: "warning" | "success" | "neutral" | "danger" }> = {
  EN_ATTENTE: { label: "En attente du centre de paiement", tone: "warning" },
  A_VERSER: { label: "Autorisée — à verser par les Finances", tone: "warning" },
  VERSEE: { label: "Versée", tone: "success" },
  REFUSEE: { label: "Refusée par le centre", tone: "danger" },
  ANNULEE: { label: "Annulée", tone: "neutral" },
};

/** La remise attend-elle encore l'argent ? Elle n'est alors ni dans le fond, ni à solder. */
export function remiseEnAttente(etat: EtatRemise): boolean {
  return etat === "EN_ATTENTE" || etat === "A_VERSER";
}

/**
 * POURQUOI LA DÉTENTRICE NE PEUT PAS ENCORE CONFIRMER — ou `null` quand elle le peut.
 *
 * Chaque refus nomme ce qu'on attend, et de qui : « impossible » ferait chercher une panne là où
 * il n'y a qu'une étape en cours.
 */
export function refusConfirmationRemise(etat: EtatRemise): string | null {
  switch (etat) {
    case "VERSEE": return null;
    case "EN_ATTENTE":
      return "Cette remise attend encore l'autorisation du centre de paiement : la somme n'est pas partie, vous ne pouvez pas confirmer l'avoir reçue.";
    case "A_VERSER":
      return "Le centre de paiement a autorisé cette remise ; les Finances doivent encore la verser. Vous confirmerez sa réception une fois la somme en main.";
    case "REFUSEE":
      return "Le centre de paiement a refusé cette remise : il n'y a rien à recevoir.";
    case "ANNULEE":
      return "Cette remise a été annulée : il n'y a rien à recevoir.";
  }
}
