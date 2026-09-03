/**
 * TOUT PAIEMENT DE LA PLATEFORME PASSE PAR LES FINANCES.
 *
 * La règle est simple à énoncer et facile à trahir : dès qu'une somme sort de la société ou y
 * entre, une écriture doit apparaître au module Finances. Sans cela, la trésorerie et le budget
 * décrivent une entreprise qui n'existe pas — et personne ne s'en aperçoit, puisque l'écran qui
 * mentirait est justement celui qu'on consulte pour vérifier.
 *
 * LES CHEMINS DE PAIEMENT, ET CE QU'ILS FONT (registre ci-dessous, testé) :
 *
 *   • ORDRE DE DÉPENSE payé → écriture. Déjà en place.
 *   • DEMANDE DE PAIEMENT réglée → écriture. Déjà en place.
 *   • PAIE, au transfert budgétaire → une écriture par salarié, au COÛT EMPLOYEUR. Déjà en place.
 *   • ENCAISSEMENT / DÉCAISSEMENT direct → c'est le module lui-même.
 *   • FACTURE réglée → écriture. C'EST CE QUI MANQUAIT : marquer une facture réglée posait une
 *     date, et rien d'autre.
 *   • CAISSE D'AVANCE remise → écriture au moment où l'argent quitte la banque.
 *   • DÉPENSE SUR CAISSE D'AVANCE → **pas** d'écriture : l'argent a déjà quitté la société quand
 *     la caisse a été remise. En inscrire une seconde compterait le même dinar deux fois — c'est
 *     l'erreur classique, et elle gonfle les dépenses du mois sans que rien ne le signale.
 *
 * Module PUR — testé, sans base de données.
 */

/** Sens de l'argent, tel que le module Finances l'enregistre. */
export type MoneyDirection = "IN" | "OUT";

/** Un chemin par lequel de l'argent bouge dans la plateforme. */
export interface PaymentPath {
  key: string;
  label: string;
  /** Le module d'où part le geste. */
  module: string;
  /** Une écriture Finances est-elle créée ? */
  settles: boolean;
  /** Pourquoi — surtout quand la réponse est « non ». */
  why: string;
}

/**
 * LE REGISTRE DES CHEMINS DE PAIEMENT — la liste qu'on relit quand on ajoute un geste d'argent.
 *
 * Il n'est pas décoratif : le test associé vérifie qu'aucun chemin ne reste sans justification,
 * et qu'un chemin qui ne solde pas dit POURQUOI. Ajouter un bouton « payer » quelque part sans
 * l'inscrire ici, c'est rouvrir le trou qu'on vient de fermer.
 */
export const PAYMENT_PATHS: PaymentPath[] = [
  {
    key: "expense-order", label: "Ordre de dépense payé", module: "Finances",
    settles: true, why: "Écriture au paiement, liée à l'ordre (`payExpenseOrder`).",
  },
  {
    key: "payment-request", label: "Demande de paiement réglée", module: "Finances",
    settles: true, why: "Écriture au règlement, liée à la demande.",
  },
  {
    key: "payroll", label: "Paie transférée au budget", module: "RH → Finances",
    settles: true, why: "Une écriture par salarié, au COÛT EMPLOYEUR (charges comprises).",
  },
  {
    key: "finance-direct", label: "Encaissement / décaissement direct", module: "Finances",
    settles: true, why: "C'est le module lui-même : l'écriture EST le geste.",
  },
  {
    key: "invoice", label: "Facture marquée réglée", module: "Legal — document de nature facture",
    settles: true,
    why: "Écriture au sens de la facture (reçue = sortie, émise = entrée), retirée si l'on dé-marque — SEULEMENT si la facture n'est pas partie au circuit de règlement, qui écrit déjà.",
  },
  {
    key: "petty-cash-allotment", label: "Caisse d'avance remise", module: "Moyens généraux",
    settles: true, why: "L'argent quitte la banque à ce moment-là : c'est là que l'écriture se pose.",
  },
  {
    key: "petty-cash-expense", label: "Achat payé sur la caisse d'avance", module: "Moyens généraux",
    settles: false,
    why: "L'argent a DÉJÀ quitté la société lors de la remise de la caisse. Une seconde écriture compterait le même dinar deux fois.",
  },
];

/** Le chemin correspondant à une clé — `undefined` si la clé est inconnue. */
export function paymentPath(key: string): PaymentPath | undefined {
  return PAYMENT_PATHS.find((p) => p.key === key);
}

/** Les chemins qui NE créent pas d'écriture — chacun doit porter sa raison. */
export function nonSettlingPaths(): PaymentPath[] {
  return PAYMENT_PATHS.filter((p) => !p.settles);
}

/**
 * Le sens de l'écriture d'une facture.
 *
 * `OUT` : facture REÇUE, la société paie. `IN` : facture ÉMISE, elle encaisse. On ne DEVINE
 * jamais à partir des noms du payeur ou du destinataire : ce sont des chaînes libres, et une
 * écriture posée à l'envers est pire qu'une écriture absente — elle se voit moins.
 */
export function invoiceDirection(raw: string | null | undefined): MoneyDirection {
  return raw === "IN" ? "IN" : "OUT";
}

/** Le libellé de l'écriture d'une facture — reconnaissable dans le journal des Finances. */
export function invoiceSettlementLabel(invoice: { reference?: string | null; title: string }): string {
  const ref = invoice.reference?.trim();
  return ref ? `Facture ${ref} — ${invoice.title}` : `Facture — ${invoice.title}`;
}

/**
 * Faut-il créer, retirer, ou ne rien faire ?
 *
 * `paidDate` posée et aucune écriture → CREATE. `paidDate` retirée et une écriture existe →
 * REMOVE (on ne laisse pas traîner l'écriture d'un règlement annulé). Le reste → NOOP, y compris
 * une facture déjà réglée qu'on ré-enregistre : re-créer l'écriture la doublerait.
 *
 * ── LE CIRCUIT A LA PRIORITÉ, ET C'EST ARITHMÉTIQUE ─────────────────────────────────────────
 *
 * Une facture a DEUX chemins vers l'argent : l'envoi au règlement (`expenseOrderId` → centre de
 * paiement → ordre payé, qui écrit son écriture) et la saisie directe d'une date de paiement
 * (la facture déjà réglée qu'on enregistre après coup). Les laisser tourner tous les deux sur la
 * même pièce inscrirait le même décaissement DEUX FOIS : le total du mois gonflerait sans que
 * rien ne le signale, et c'est exactement le défaut qu'on vient de fermer ailleurs.
 *
 * Dès qu'une facture est partie au circuit, la saisie directe se tait. Elle ne « échoue » pas :
 * elle n'a plus rien à faire — l'écriture viendra du paiement de l'ordre.
 */
export function settlementAction(input: {
  paidDate: Date | null;
  transactionId: string | null;
  /** L'ordre de dépense né de cette facture. Non nul = le circuit possède le règlement. */
  expenseOrderId?: string | null;
}): "CREATE" | "REMOVE" | "NOOP" {
  // Le retrait reste possible même sous circuit : une écriture directe posée AVANT l'envoi doit
  // pouvoir être défaite, sinon elle resterait au livre sans plus rien pour la corriger.
  if (input.expenseOrderId && !input.transactionId) return "NOOP";
  if (input.paidDate && !input.transactionId) return "CREATE";
  if (!input.paidDate && input.transactionId) return "REMOVE";
  return "NOOP";
}

export type SettlementCheck = { ok: true } | { ok: false; error: string };

/**
 * PEUT-ON ENVOYER CETTE FACTURE AU RÈGLEMENT ?
 *
 * Le refus NOMME ce qui bloque : « envoi impossible » fait rouvrir la fiche trois fois avant de
 * comprendre que la facture est déjà partie. Et il ferme le double comptage par l'autre bout —
 * une facture déjà réglée en direct n'a plus rien à envoyer au centre de paiement.
 */
export function canSendToSettlement(input: {
  kind: string;
  amount: number | null;
  paidDate: Date | null;
  expenseOrderId: string | null;
}): SettlementCheck {
  if (input.kind !== "INVOICE") {
    return { ok: false, error: "Seul un document de nature « facture » s'envoie au règlement." };
  }
  if (input.expenseOrderId) return { ok: false, error: "Cette facture est déjà partie au règlement." };
  if (input.paidDate) {
    return {
      ok: false,
      error: "Cette facture porte déjà une date de règlement : l'envoyer au paiement décaisserait une seconde fois. Effacez la date si le règlement n'a pas eu lieu.",
    };
  }
  if (!input.amount || input.amount <= 0) return { ok: false, error: "Renseignez d'abord le montant de la facture." };
  return { ok: true };
}

/**
 * PEUT-ON POSER À LA MAIN LA DATE DE RÈGLEMENT ?
 *
 * Non, si la facture est partie au circuit : son paiement la soldera, et la marquer réglée
 * d'avance écrirait la date d'un virement qui n'a pas encore eu lieu. L'écran dirait « réglée »
 * sur un dossier que les Finances tiennent encore ouvert — et personne ne rouvre ce qui a l'air
 * fini. EFFACER la date reste toujours possible : défaire une erreur ne doit jamais se bloquer.
 */
export function canMarkPaidDirectly(input: {
  paidDate: Date | null;
  expenseOrderId: string | null;
}): SettlementCheck {
  if (input.paidDate && input.expenseOrderId) {
    return {
      ok: false,
      error: "Cette facture est partie au règlement : son paiement la soldera. Suivez-la depuis le centre de paiement.",
    };
  }
  return { ok: true };
}
