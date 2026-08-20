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
    key: "invoice", label: "Facture marquée réglée", module: "Finances — Factures",
    settles: true, why: "Écriture au sens de la facture (reçue = sortie, émise = entrée), retirée si l'on dé-marque.",
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
export function invoiceSettlementLabel(invoice: { number?: string | null; title: string }): string {
  const ref = invoice.number?.trim();
  return ref ? `Facture ${ref} — ${invoice.title}` : `Facture — ${invoice.title}`;
}

/**
 * Faut-il créer, retirer, ou ne rien faire ?
 *
 * `paidDate` posée et aucune écriture → CREATE. `paidDate` retirée et une écriture existe →
 * REMOVE (on ne laisse pas traîner l'écriture d'un règlement annulé). Le reste → NOOP, y compris
 * une facture déjà réglée qu'on ré-enregistre : re-créer l'écriture la doublerait.
 */
export function settlementAction(input: {
  paidDate: Date | null;
  transactionId: string | null;
}): "CREATE" | "REMOVE" | "NOOP" {
  if (input.paidDate && !input.transactionId) return "CREATE";
  if (!input.paidDate && input.transactionId) return "REMOVE";
  return "NOOP";
}
