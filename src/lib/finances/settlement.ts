import { blocageParLeBC, type PorteBC } from "@/lib/bons-de-commande/regle";

/**
 * TOUT PAIEMENT DE LA PLATEFORME PASSE PAR LES FINANCES — ET PAR LE CENTRE DE PAIEMENT.
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

/**
 * Le décaissement passe-t-il par le CENTRE DE PAIEMENT avant de partir ?
 *
 *   • `AUTORISE` — oui : un ordre de dépense naît « en attente du centre » et `canDisburse`
 *     refuse de le payer sans son autorisation.
 *   • `ENREGISTRE` — le geste n'est pas une décision de payer : il ENREGISTRE un mouvement déjà
 *     fait (frais bancaires, relevé importé, facture réglée avant son enregistrement). Il n'y a
 *     rien à autoriser — mais payer un fournisseur par ce chemin serait un contournement.
 *   • `HORS_CENTRE` — le décaissement est décidé DANS l'ERP sans passer par le centre. C'est une
 *     exception à la règle de la Direction (« tous passent par le centre de paiements ») : elle
 *     est écrite ici pour qu'on sache qu'elle existe, jamais tue.
 */
export type CentrePath = "AUTORISE" | "ENREGISTRE" | "HORS_CENTRE";

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
  /** Le centre de paiement voit-il passer ce décaissement AVANT qu'il parte ? */
  centre: CentrePath;
  /** Pourquoi — exigé dès que la réponse n'est pas `AUTORISE`. */
  centreWhy: string;
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
    settles: true, why: "Écriture au paiement, liée à l'ordre (`settleExpenseOrder`).",
    centre: "AUTORISE",
    centreWhy: "Tout ordre naît « en attente du centre » (`initialCentralStatus`) et `settleExpenseOrder` refuse de payer sans son autorisation (`canDisburse`).",
  },
  {
    key: "payment-request", label: "Demande de paiement réglée", module: "Finances",
    settles: true, why: "Écriture au règlement, liée à la demande.",
    centre: "AUTORISE",
    centreWhy: "Le dossier crée son ordre de dépense dès la soumission ; le bon à payer des Finances exige l'autorisation du centre.",
  },
  {
    key: "invoice-settlement", label: "Facture envoyée au règlement", module: "Legal — document de nature facture",
    settles: true, why: "L'ordre de dépense né de la facture écrit au paiement ; la facture ne se solde plus à la main.",
    centre: "AUTORISE",
    centreWhy: "La facture devient un ordre de dépense par la porte commune, en attente du centre ; celle qui découle d'un bon de commande non validé ne part pas (§118.148).",
  },
  {
    key: "payroll", label: "Paie transférée au budget", module: "RH → Finances",
    settles: true, why: "Une écriture par salarié, au COÛT EMPLOYEUR (charges comprises).",
    centre: "HORS_CENTRE",
    centreWhy: "La paie se verse sans ordre de dépense : bulletins et virements de salaires ne passent pas par le centre. Exception EXISTANTE à la règle « tous les paiements par le centre » — à trancher par la Direction : la faire autoriser par le centre, ou l'assumer comme exception écrite.",
  },
  {
    key: "finance-direct", label: "Encaissement / décaissement direct", module: "Finances",
    settles: true, why: "C'est le module lui-même : l'écriture EST le geste.",
    centre: "ENREGISTRE",
    centreWhy: "Une écriture du livre ENREGISTRE un mouvement déjà fait (frais bancaires, relevé importé, régularisation). Payer un fournisseur passe par un ordre de dépense, donc par le centre.",
  },
  {
    key: "invoice", label: "Facture marquée réglée", module: "Legal — document de nature facture",
    settles: true,
    why: "Écriture au sens de la facture (reçue = sortie, émise = entrée), retirée si l'on dé-marque — SEULEMENT si la facture n'est pas partie au circuit de règlement, qui écrit déjà.",
    centre: "ENREGISTRE",
    centreWhy: "Marquer réglée ENREGISTRE un règlement fait avant l'enregistrement de la facture. La PAYER passe par « Envoyer au règlement », donc par le centre — et une facture partie au circuit ne se marque plus réglée à la main (`canMarkPaidDirectly`).",
  },
  {
    key: "petty-cash-allotment", label: "Caisse d'avance remise", module: "Moyens généraux",
    settles: true, why: "L'argent quitte la banque à ce moment-là : c'est là que l'écriture se pose.",
    centre: "HORS_CENTRE",
    centreWhy: "La remise d'une caisse d'avance est décidée par l'administration sans ordre de dépense. Exception EXISTANTE — à trancher par la Direction.",
  },
  {
    key: "petty-cash-top-up", label: "Rallonge de caisse d'avance accordée", module: "Moyens généraux",
    settles: true, why: "La rallonge quitte la banque comme la remise : même écriture, au moment où elle est accordée.",
    centre: "HORS_CENTRE",
    centreWhy: "Accordée par les RH sans ordre de dépense, comme la remise qu'elle complète. Même exception, même décision à prendre par la Direction.",
  },
  {
    key: "petty-cash-expense", label: "Achat payé sur la caisse d'avance", module: "Moyens généraux",
    settles: false,
    why: "L'argent a DÉJÀ quitté la société lors de la remise de la caisse. Une seconde écriture compterait le même dinar deux fois.",
    centre: "ENREGISTRE",
    centreWhy: "L'argent est déjà sorti à la remise : l'achat sur caisse ne décaisse rien de plus.",
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
 * LES EXCEPTIONS À « TOUS LES PAIEMENTS PAR LE CENTRE » — celles qu'il faut trancher.
 *
 * La Direction a énoncé la règle ; ces chemins la contredisent AUJOURD'HUI. Les lister n'est pas
 * les autoriser : c'est ce qui les empêche de redevenir invisibles. Chacun porte la décision
 * qu'il attend.
 */
export function horsCentre(): PaymentPath[] {
  return PAYMENT_PATHS.filter((p) => p.centre === "HORS_CENTRE");
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
  /**
   * LE BON DE COMMANDE DONT LA FACTURE DÉCOULE (`chainFromId`), et sa porte (§118.148).
   *
   * Une facture qui suit un BC que son centre n'a pas validé ne part pas au paiement : payer
   * l'exécution d'une commande que la société n'a pas engagée, c'est le contournement exact que
   * la porte existe pour fermer. `null` (pas de BC amont, ou BC d'avant la règle) ne bloque rien.
   */
  bc?: { porte: PorteBC | null; reference: string | null } | null;
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
  const bloque = input.bc ? blocageParLeBC(input.bc.porte, input.bc.reference) : null;
  if (bloque) return { ok: false, error: bloque };
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
