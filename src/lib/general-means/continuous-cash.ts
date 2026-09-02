/**
 * LA CAISSE D'AVANCE EST CONTINUE — elle ne se ferme pas au changement de mois.
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * La caisse était modélisée comme UNE BOÎTE PAR MOIS : une remise ouvrait la caisse d'août, la
 * suivante celle de septembre, et l'argent d'août sortait de l'écran. Rien n'était pourtant
 * soldé — le liquide était toujours dans le tiroir. On voyait donc un solde faux, et le mois
 * précédent devenait introuvable sans connaître le paramètre d'URL qui le ramène.
 *
 * Un premier correctif avait fait ouvrir l'écran sur la dernière caisse ENCORE OUVERTE. Il
 * traitait le symptôme : on regardait un mois à la fois, alors que l'argent, lui, ne connaît pas
 * les mois.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────────────────────
 *
 * Il n'y a qu'UNE caisse par département, et elle est CONTINUE. Une remise d'argent ajoute au
 * fond, elle ne clôt rien et n'en ouvre pas un second. Ce qui est dépensable vaut :
 *
 *     Σ (remises ouvertes ET CONFIRMÉES REÇUES) − Σ (dépenses payées dessus)
 *
 * Une somme *décidée* n'est pas une somme *détenue* : tant que la personne n'a pas confirmé
 * l'avoir reçue, elle compte dans le « remis » et pas dans le « en main ». Afficher un solde
 * disponible avant d'avoir l'argent, c'est engager des dépenses qu'on ne peut pas payer.
 *
 * ── CE QU'ON GARDE, ET C'EST L'ESSENTIEL ────────────────────────────────────────────────────
 *
 * Chaque REMISE garde sa date et sa période, chaque DÉPENSE garde la sienne. On peut donc
 * toujours répondre à « combien a-t-on remis en août ? » et « qu'a-t-on dépensé en août ? » —
 * ce qui disparaît, c'est seulement l'idée qu'un mois SOLDE le précédent.
 *
 * ── SOLDER RESTE POSSIBLE, MAIS C'EST UN GESTE ──────────────────────────────────────────────
 *
 * Une remise `CLOSED` sort du fond AVEC ses dépenses : cette tranche est arrêtée, comptée,
 * rendue. C'est un geste qu'on pose — jamais une conséquence du calendrier — et il porte sur le
 * fond ENTIER, sans quoi solder une vieille remise retirerait son montant en laissant derrière
 * lui des dépenses imputées ailleurs.
 *
 * ── CE MODULE EST LE SEUL CALCULATEUR ───────────────────────────────────────────────────────
 *
 * Il remplace le solde par mois de `petty-cash.ts`. Garder les deux aurait laissé deux
 * arithmétiques qui se contredisent dès la deuxième remise : l'écran aurait affiché le fond,
 * et la saisie aurait refusé la dépense au motif que « la remise de septembre ne la couvre pas ».
 *
 * Module PUR — testé sans base.
 */

/** Une dépense imputée sur une remise. Le détail suffit : libellé et date vivent ailleurs. */
export interface CashExpense {
  id: string;
  amount: number;
}

/** Une remise d'argent : une somme, une date, une période, et son sort. */
export interface CashRemittance {
  id: string;
  /** « AAAA-MM » — la période où l'argent a été remis. Conservée, mais elle ne cloisonne plus. */
  period: string;
  /** L'instant de la remise (ISO). C'est lui qui ordonne, pas la période : deux remises peuvent
   *  tomber le même mois, et « la plus récente » doit rester décidable. */
  remittedAt: string;
  amount: number;
  /** `ALLOTTED` (remise, réception non confirmée), `RECEIVED` (en main), `CLOSED` (soldée). */
  status: string;
  expenses: readonly CashExpense[];
}

export interface ContinuousCash {
  /** Tout ce qui a été REMIS et pas encore soldé — y compris ce qui attend confirmation. */
  remitted: number;
  /** Ce qui est réellement EN MAIN : les remises confirmées reçues. */
  received: number;
  spent: number;
  /** Ce qui reste à dépenser : `received − spent`. */
  remaining: number;
  /** Part consommée, bornée à 100 % — le dépassement se dit par le signe du solde. */
  usedPercent: number;
  /** Combien de remises composent le fond en cours — « une caisse », pas « trois mois ». */
  remittanceCount: number;
  /** La remise sur laquelle une nouvelle dépense s'impute : la plus récente en main. */
  currentId: string | null;
  /** Reste-t-il moins d'un cinquième de ce qui est en main ? C'est le moment de demander. */
  lowOnCash: boolean;
  /** A-t-on dépensé plus qu'on n'a reçu ? Cela ne se corrige pas tout seul : il faut le voir. */
  overspent: boolean;
  /** Une remise attend-elle encore sa confirmation de réception ? */
  awaitingReceipt: boolean;
  /** Le montant qui attend cette confirmation — décidé, pas encore détenu. */
  awaitingAmount: number;
}

/** En dessous d'un cinquième du fond, on prévient : la rallonge se demande AVANT la panne. */
export const LOW_CASH_RATIO = 0.2;

const ouverte = (r: CashRemittance): boolean => r.status !== "CLOSED";
const enMain = (r: CashRemittance): boolean => r.status === "RECEIVED";
const sortie = (r: CashRemittance): number => r.expenses.reduce((a, e) => a + e.amount, 0);

/** Ce qui est sorti d'une remise — exporté parce que l'historique l'affiche ligne à ligne. */
export function remittanceSpent(r: CashRemittance): number {
  return sortie(r);
}

/**
 * LE FOND DE LA CAISSE, toutes remises ouvertes confondues.
 *
 * Les remises SOLDÉES sortent avec leurs dépenses : les compter d'un côté sans l'autre ferait
 * apparaître ou disparaître de l'argent au moment où l'on clôt une tranche.
 */
export function continuousCash(remittances: readonly CashRemittance[]): ContinuousCash {
  const ouvertes = remittances.filter(ouverte);
  const remitted = ouvertes.reduce((a, r) => a + r.amount, 0);
  const received = ouvertes.filter(enMain).reduce((a, r) => a + r.amount, 0);
  // LES DÉPENSES COMPTENT TOUTES, même celles imputées sur une remise encore à confirmer :
  // l'argent est sorti du tiroir, et l'ignorer donnerait un solde plus riche que le tiroir.
  const spent = ouvertes.reduce((a, r) => a + sortie(r), 0);
  const remaining = received - spent;
  const enMainTriees = [...ouvertes.filter(enMain)].sort((a, b) => b.remittedAt.localeCompare(a.remittedAt));
  return {
    remitted,
    received,
    spent,
    remaining,
    usedPercent: received > 0 ? Math.min(100, Math.round((spent / received) * 100)) : 0,
    remittanceCount: ouvertes.length,
    currentId: enMainTriees[0]?.id ?? null,
    lowOnCash: received > 0 && remaining > 0 && remaining <= received * LOW_CASH_RATIO,
    overspent: remaining < 0,
    awaitingReceipt: ouvertes.some((r) => !enMain(r)),
    awaitingAmount: remitted - received,
  };
}

/**
 * LE FOND EN METTANT DE CÔTÉ UNE DÉPENSE — celle qu'on est en train de corriger.
 *
 * Sans cette mise à l'écart, corriger une dépense de 8 000 DZD sur un fond de 10 000 comparerait
 * le nouveau montant à un solde qui compte encore l'ancien : une simple correction de libellé
 * serait refusée « faute d'argent », alors que la place existe — elle est occupée par la ligne
 * qu'on modifie.
 */
export function fundExcluding(remittances: readonly CashRemittance[], expenseId: string): ContinuousCash {
  return continuousCash(remittances.map((r) => ({ ...r, expenses: r.expenses.filter((e) => e.id !== expenseId) })));
}

/**
 * LA CAISSE, TELLE QUE LA VOIT LE CHOIX DU MOYEN DE PAIEMENT.
 *
 * Une dépense s'impute sur UNE remise — celle qu'on a en main. Mais quand rien n'est confirmé,
 * il faut pouvoir distinguer « aucune caisse » de « une somme attend votre confirmation » : les
 * deux se réparent par des gestes différents, et un message unique renverrait à la mauvaise porte.
 * On rend donc la remise en main si elle existe, sinon la plus récente encore à confirmer.
 */
export function fundHandle(remittances: readonly CashRemittance[]): { id: string; status: string } | null {
  const ouvertes = [...remittances.filter(ouverte)].sort((a, b) => b.remittedAt.localeCompare(a.remittedAt));
  return ouvertes.find(enMain) ?? ouvertes[0] ?? null;
}

export interface SpendCheck {
  ok: boolean;
  reason?: string;
}

/**
 * PEUT-ON PAYER SUR LA CAISSE ?
 *
 * Quatre refus, et ils ne disent pas la même chose : rien n'a été remis, l'argent n'est pas
 * encore confirmé reçu, le montant manque, ou le fond ne le couvre pas. Le message doit le dire —
 * « impossible » n'indique à personne quoi faire ensuite, et l'on repose la question.
 */
export function canSpendFromFund(fund: ContinuousCash | null, amount: number): SpendCheck {
  if (!fund || fund.remittanceCount === 0) {
    return { ok: false, reason: "Aucune somme n'a été remise en caisse pour ce département." };
  }
  if (fund.received <= 0) {
    return { ok: false, reason: "Confirmez d'abord la réception de la somme : on ne dépense pas un argent qu'on n'a pas encore." };
  }
  if (!(amount > 0)) return { ok: false, reason: "Indiquez le montant de la dépense." };
  if (amount > fund.remaining) {
    return {
      ok: false,
      reason: `Il ne reste que ${Math.max(0, fund.remaining)} DZD dans la caisse : demandez une rallonge avant d'engager cette dépense.`,
    };
  }
  return { ok: true };
}

/**
 * CE QUE L'ÉCRAN DIT DU FOND — ou `null` quand tout va bien.
 *
 * Un solde qui descend n'est une information que s'il arrive AVANT la panne : une caisse vide
 * découverte au moment de payer, c'est un achat qui sort de l'ERP.
 */
export function cashWarning(cash: ContinuousCash | null, formatAmount: (n: number) => string): string | null {
  if (!cash) return null;
  if (cash.overspent) {
    return `La caisse est dépassée de ${formatAmount(Math.abs(cash.remaining))} : les dépenses saisies excèdent ce qui a été reçu. Vérifiez les tickets, ou faites remettre le complément.`;
  }
  if (cash.lowOnCash) {
    return `Il reste ${formatAmount(cash.remaining)} en caisse, soit moins d'un cinquième de ce qui a été remis. Demandez une rallonge avant la rupture.`;
  }
  if (cash.awaitingReceipt) {
    return `${formatAmount(cash.awaitingAmount)} attendent votre confirmation de réception : tant qu'elle n'est pas donnée, cette somme n'est pas dépensable.`;
  }
  return null;
}
