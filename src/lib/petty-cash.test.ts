import { describe, it, expect } from "vitest";
import {
  pettyCashBalance, canSpendFromPettyCash, currentPeriod, periodLabel, LOW_CASH_RATIO,
  type PettyCashState, type PettyCashLine,
} from "./petty-cash";

const cash = (over: Partial<PettyCashState> = {}): PettyCashState => ({
  id: "c1", period: "2026-08", amount: 100_000, status: "RECEIVED", ...over,
});
const line = (amount: number, id = "l1"): PettyCashLine => ({ id, label: "Fournitures", amount, date: "2026-08-05" });

describe("pettyCashBalance", () => {
  it("ne compte RIEN tant que la réception n'est pas confirmée", () => {
    // La somme est décidée, pas détenue : afficher un solde disponible ferait engager des
    // dépenses qu'on ne peut pas payer.
    const b = pettyCashBalance(cash({ status: "ALLOTTED" }), []);
    expect(b.received).toBe(0);
    expect(b.remaining).toBe(0);
  });

  it("déduit chaque dépense de la somme reçue", () => {
    const b = pettyCashBalance(cash(), [line(30_000, "a"), line(20_000, "b")]);
    expect(b.received).toBe(100_000);
    expect(b.spent).toBe(50_000);
    expect(b.remaining).toBe(50_000);
    expect(b.usedPercent).toBe(50);
  });

  it("prévient AVANT d'être à sec", () => {
    const almost = pettyCashBalance(cash(), [line(100_000 * (1 - LOW_CASH_RATIO))]);
    expect(almost.lowOnCash).toBe(true);
    const comfortable = pettyCashBalance(cash(), [line(10_000)]);
    expect(comfortable.lowOnCash).toBe(false);
  });

  it("signale le dépassement plutôt que d'afficher un solde négatif comme normal", () => {
    const b = pettyCashBalance(cash(), [line(120_000)]);
    expect(b.overspent).toBe(true);
    expect(b.remaining).toBe(-20_000);
    expect(b.lowOnCash).toBe(false); // à découvert, ce n'est plus « bientôt vide »
  });

  it("rend des zéros sans caisse, plutôt que NaN", () => {
    const b = pettyCashBalance(null, []);
    expect(b).toMatchObject({ received: 0, spent: 0, remaining: 0, usedPercent: 0, overspent: false });
  });

  it("une caisse SOLDÉE garde son historique lisible", () => {
    const b = pettyCashBalance(cash({ status: "CLOSED" }), [line(90_000)]);
    expect(b.received).toBe(100_000);
    expect(b.remaining).toBe(10_000);
  });
});

describe("canSpendFromPettyCash", () => {
  it("refuse tant que la réception n'est pas confirmée, en disant quoi faire", () => {
    const c = cash({ status: "ALLOTTED" });
    const r = canSpendFromPettyCash(c, pettyCashBalance(c, []), 5_000);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/réception/i);
  });

  it("refuse sans caisse ouverte", () => {
    expect(canSpendFromPettyCash(null, pettyCashBalance(null, []), 1_000).ok).toBe(false);
  });

  it("refuse sur une caisse soldée", () => {
    const c = cash({ status: "CLOSED" });
    expect(canSpendFromPettyCash(c, pettyCashBalance(c, []), 1_000).reason).toMatch(/soldée/i);
  });

  it("refuse une dépense qui dépasse le fond, et oriente vers la rallonge", () => {
    const c = cash({ amount: 10_000 });
    const b = pettyCashBalance(c, [line(8_000)]);
    const r = canSpendFromPettyCash(c, b, 5_000);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/rallonge/i);
  });

  it("accepte une dépense couverte, jusqu'au dernier dinar", () => {
    const c = cash({ amount: 10_000 });
    const b = pettyCashBalance(c, [line(8_000)]);
    expect(canSpendFromPettyCash(c, b, 2_000).ok).toBe(true);
    expect(canSpendFromPettyCash(c, b, 2_001).ok).toBe(false);
  });

  it("refuse un montant nul ou négatif", () => {
    const c = cash();
    const b = pettyCashBalance(c, []);
    expect(canSpendFromPettyCash(c, b, 0).ok).toBe(false);
    expect(canSpendFromPettyCash(c, b, -100).ok).toBe(false);
  });
});

describe("currentPeriod / periodLabel", () => {
  it("forme la clé du mois sur deux chiffres", () => {
    expect(currentPeriod(new Date("2026-03-09T10:00:00Z"))).toBe("2026-03");
    expect(currentPeriod(new Date("2026-12-31T10:00:00Z"))).toBe("2026-12");
  });

  it("écrit le mois en toutes lettres", () => {
    expect(periodLabel("2026-08")).toBe("août 2026");
    expect(periodLabel("2026-01")).toBe("janvier 2026");
  });

  it("laisse passer ce qu'elle ne sait pas lire plutôt que d'inventer un mois", () => {
    expect(periodLabel("n'importe quoi")).toBe("n'importe quoi");
    expect(periodLabel("2026-13")).toBe("2026-13");
  });
});
