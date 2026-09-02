import { describe, it, expect } from "vitest";
import {
  continuousCash, fundExcluding, canSpendFromFund, cashWarning, remittanceSpent, LOW_CASH_RATIO,
  type CashRemittance,
} from "./continuous-cash";

let seq = 0;
const remise = (o: Partial<CashRemittance> & { amount: number }): CashRemittance => ({
  id: o.id ?? `r${++seq}`,
  period: o.period ?? "2026-09",
  remittedAt: o.remittedAt ?? `2026-09-0${(seq % 9) + 1}T09:00:00.000Z`,
  status: o.status ?? "RECEIVED",
  expenses: o.expenses ?? [],
  amount: o.amount,
});

const depense = (amount: number, id = `e${++seq}`) => ({ id, amount });
const dzd = (n: number) => `${n} DZD`;

describe("la caisse est CONTINUE — le mois ne la ferme pas", () => {
  it("DEUX REMISES DE MOIS DIFFÉRENTS FONT UN SEUL FOND", () => {
    // C'est tout le défaut : remettre 50 000 en septembre sortait les 30 000 d'août de l'écran,
    // alors que l'argent était toujours dans le tiroir.
    const cash = continuousCash([
      remise({ period: "2026-08", remittedAt: "2026-08-03T09:00:00Z", amount: 30_000, expenses: [depense(12_000)] }),
      remise({ period: "2026-09", remittedAt: "2026-09-02T09:00:00Z", amount: 50_000, expenses: [depense(5_000)] }),
    ]);
    expect(cash.remitted).toBe(80_000);
    expect(cash.received).toBe(80_000);
    expect(cash.spent).toBe(17_000);
    expect(cash.remaining).toBe(63_000);
    expect(cash.remittanceCount).toBe(2);
  });

  it("une caisse sans remise n'est pas une erreur, c'est un fond à zéro", () => {
    const cash = continuousCash([]);
    expect(cash).toMatchObject({ remitted: 0, received: 0, spent: 0, remaining: 0, remittanceCount: 0 });
    expect(cash.lowOnCash).toBe(false);
    expect(cash.overspent).toBe(false);
    expect(cash.currentId).toBeNull();
  });

  it("SOLDER SORT LA REMISE AVEC SES DÉPENSES", () => {
    // Compter l'un sans l'autre ferait apparaître ou disparaître de l'argent à la clôture : la
    // tranche soldée a été comptée et rendue, elle n'a plus rien à dire du solde en cours.
    const cash = continuousCash([
      remise({ period: "2026-07", amount: 20_000, expenses: [depense(20_000)], status: "CLOSED" }),
      remise({ period: "2026-09", amount: 50_000, expenses: [depense(5_000)] }),
    ]);
    expect(cash.remitted).toBe(50_000);
    expect(cash.spent).toBe(5_000);
    expect(cash.remaining).toBe(45_000);
    expect(cash.remittanceCount).toBe(1);
  });

  it("solder une tranche NON DÉPENSÉE ne fait pas bouger ce qui reste ailleurs", () => {
    const avant = continuousCash([remise({ amount: 50_000, expenses: [depense(5_000)] })]);
    const apres = continuousCash([
      remise({ amount: 50_000, expenses: [depense(5_000)] }),
      remise({ amount: 10_000, status: "CLOSED" }),
    ]);
    expect(apres.remaining).toBe(avant.remaining);
  });
});

describe("décidé n'est pas détenu", () => {
  it("UNE REMISE NON CONFIRMÉE COMPTE DANS LE REMIS, PAS DANS LE DÉPENSABLE", () => {
    const cash = continuousCash([
      remise({ amount: 30_000, status: "RECEIVED" }),
      remise({ amount: 50_000, status: "ALLOTTED" }),
    ]);
    expect(cash.remitted).toBe(80_000);
    expect(cash.received).toBe(30_000);
    expect(cash.remaining).toBe(30_000);
    expect(cash.awaitingReceipt).toBe(true);
    expect(cash.awaitingAmount).toBe(50_000);
  });

  it("la dépense imputée sur une remise à confirmer compte quand même : l'argent est sorti", () => {
    const cash = continuousCash([
      remise({ amount: 30_000, status: "RECEIVED" }),
      remise({ amount: 10_000, status: "ALLOTTED", expenses: [depense(4_000)] }),
    ]);
    expect(cash.spent).toBe(4_000);
    expect(cash.remaining).toBe(26_000);
  });

  it("LA DÉPENSE S'IMPUTE SUR LA REMISE LA PLUS RÉCENTE EN MAIN", () => {
    const cash = continuousCash([
      remise({ id: "vieille", remittedAt: "2026-07-01T09:00:00Z", amount: 10_000 }),
      remise({ id: "recente", remittedAt: "2026-09-01T09:00:00Z", amount: 20_000 }),
      remise({ id: "attente", remittedAt: "2026-09-20T09:00:00Z", amount: 40_000, status: "ALLOTTED" }),
    ]);
    // Pas « attente » : on n'impute pas sur un argent dont personne n'a dit l'avoir reçu.
    expect(cash.currentId).toBe("recente");
  });

  it("l'ordre d'arrivée du tableau ne change rien : c'est la DATE qui décide", () => {
    const rows = [
      remise({ id: "b", remittedAt: "2026-09-01T09:00:00Z", amount: 1 }),
      remise({ id: "a", remittedAt: "2026-08-01T09:00:00Z", amount: 1 }),
    ];
    expect(continuousCash(rows).currentId).toBe("b");
    expect(continuousCash([...rows].reverse()).currentId).toBe("b");
  });
});

describe("les signaux du fond", () => {
  it("PRÉVIENT SOUS UN CINQUIÈME — la rallonge se demande AVANT la rupture", () => {
    const cash = continuousCash([remise({ amount: 100_000, expenses: [depense(85_000)] })]);
    expect(cash.remaining).toBe(15_000);
    expect(cash.lowOnCash).toBe(true);
    expect(cash.usedPercent).toBe(85);
    expect(LOW_CASH_RATIO).toBe(0.2);
  });

  it("un fond dépassé n'est pas « bas » : c'est un autre message", () => {
    const cash = continuousCash([remise({ amount: 10_000, expenses: [depense(14_000)] })]);
    expect(cash.overspent).toBe(true);
    expect(cash.lowOnCash).toBe(false);
    expect(cash.remaining).toBe(-4_000);
    expect(cash.usedPercent).toBe(100);
  });

  it("ce qui est sorti d'une remise se lit remise par remise", () => {
    expect(remittanceSpent(remise({ amount: 10, expenses: [depense(3), depense(4)] }))).toBe(7);
  });
});

describe("corriger une dépense ne la compte pas deux fois", () => {
  it("LA PLACE QU'ELLE OCCUPE LUI RESTE OUVERTE", () => {
    const rows = [remise({ amount: 10_000, expenses: [depense(8_000, "x")] })];
    expect(continuousCash(rows).remaining).toBe(2_000);
    // On corrige la dépense « x » : son ancien montant ne doit plus barrer la route au nouveau.
    const sansElle = fundExcluding(rows, "x");
    expect(sansElle.remaining).toBe(10_000);
    expect(canSpendFromFund(sansElle, 9_000).ok).toBe(true);
    expect(canSpendFromFund(continuousCash(rows), 9_000).ok).toBe(false);
  });

  it("ne modifie pas le tableau reçu", () => {
    const rows = [remise({ amount: 10_000, expenses: [depense(8_000, "x")] })];
    fundExcluding(rows, "x");
    expect(rows[0].expenses).toHaveLength(1);
  });
});

describe("payer sur la caisse", () => {
  const fond = continuousCash([remise({ amount: 50_000, expenses: [depense(5_000)] })]);

  it("REFUSÉ QUAND RIEN N'A ÉTÉ REMIS — et le motif le dit", () => {
    const r = canSpendFromFund(null, 1_000);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/remise en caisse/i);
    expect(canSpendFromFund(continuousCash([]), 1_000).ok).toBe(false);
  });

  it("refusé tant que la réception n'est pas confirmée", () => {
    const attente = continuousCash([remise({ amount: 50_000, status: "ALLOTTED" })]);
    expect(canSpendFromFund(attente, 1_000).reason).toMatch(/réception/i);
  });

  it("refusé sans montant", () => {
    expect(canSpendFromFund(fond, 0).reason).toMatch(/montant/i);
  });

  it("REFUSÉ AU-DELÀ DU FOND, en chiffrant ce qui reste", () => {
    const r = canSpendFromFund(fond, 46_000);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("45000");
  });

  it("ACCEPTE CE QUE LE FOND ENTIER COUVRE, même si aucune remise seule ne suffirait", () => {
    // Le cœur du chantier : trois remises de 20 000 paient un achat de 55 000. Le calcul par
    // mois l'aurait refusé au motif que « la remise de septembre ne couvre pas ce montant ».
    const trois = continuousCash([
      remise({ amount: 20_000 }), remise({ amount: 20_000 }), remise({ amount: 20_000 }),
    ]);
    expect(canSpendFromFund(trois, 55_000).ok).toBe(true);
  });
});

describe("ce que l'écran dit du fond", () => {
  it("SE TAIT QUAND TOUT VA BIEN — un avertissement permanent ne se lit plus", () => {
    expect(cashWarning(continuousCash([remise({ amount: 100_000, expenses: [depense(1_000)] })]), dzd)).toBeNull();
    expect(cashWarning(null, dzd)).toBeNull();
  });

  it("le dépassement passe avant tout le reste, et chiffre le trou", () => {
    const msg = cashWarning(continuousCash([remise({ amount: 10_000, expenses: [depense(14_000)] })]), dzd);
    expect(msg).toContain("4000 DZD");
    expect(msg).toMatch(/dépassée/i);
  });

  it("le fond bas chiffre ce qui reste", () => {
    expect(cashWarning(continuousCash([remise({ amount: 100_000, expenses: [depense(90_000)] })]), dzd)).toContain("10000 DZD");
  });

  it("la réception en attente chiffre ce qui n'est pas encore dépensable", () => {
    const msg = cashWarning(continuousCash([
      remise({ amount: 100_000 }), remise({ amount: 25_000, status: "ALLOTTED" }),
    ]), dzd);
    expect(msg).toMatch(/réception/i);
    expect(msg).toContain("25000 DZD");
  });
});
