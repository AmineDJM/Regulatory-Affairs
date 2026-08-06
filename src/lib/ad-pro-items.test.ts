import { describe, it, expect } from "vitest";
import { breakdown, canEmitOrder, plannedGaps } from "./ad-pro-items";

/**
 * La ventilation décide de ce que la Direction voit et de ce que les Finances paient. Une
 * erreur ici ne plante rien : elle fait simplement passer un dépassement pour un équilibre,
 * et on le découvre à la facture.
 */

describe("breakdown — ventiler l'enveloppe accordée", () => {
  it("sans enveloppe accordée, rien n'est équilibré : il n'y a pas encore de cible", () => {
    const b = breakdown([{ amountEstimated: 50_000 }], null);
    expect(b.envelopeDzd).toBeNull();
    expect(b.estimatedDzd).toBe(50_000);
    expect(b.balanced).toBe(false);
    expect(b.overrunDzd).toBe(0);
  });

  it("additionne estimations et affectations séparément — ce sont deux moments différents", () => {
    const b = breakdown(
      [
        { amountEstimated: 60_000, amountGranted: 50_000 },
        { amountEstimated: 40_000, amountGranted: 30_000 },
      ],
      100_000,
    );
    expect(b.estimatedDzd).toBe(100_000);
    expect(b.allocatedDzd).toBe(80_000);
  });

  it("signale ce qui reste à affecter", () => {
    const b = breakdown([{ amountGranted: 70_000 }], 100_000);
    expect(b.unallocatedDzd).toBe(30_000);
    expect(b.overrunDzd).toBe(0);
    expect(b.balanced).toBe(false);
  });

  it("une ventilation qui tombe juste est équilibrée", () => {
    const b = breakdown([{ amountGranted: 60_000 }, { amountGranted: 40_000 }], 100_000);
    expect(b.balanced).toBe(true);
    expect(b.unallocatedDzd).toBe(0);
    expect(b.overrunDzd).toBe(0);
  });

  it("EXPOSE le dépassement au lieu de le masquer — c'est tout l'intérêt de l'écran", () => {
    const b = breakdown([{ amountGranted: 90_000 }, { amountGranted: 40_000 }], 100_000);
    expect(b.overrunDzd).toBe(30_000);
    expect(b.unallocatedDzd).toBe(0);
    expect(b.balanced).toBe(false);
  });

  it("dit qu'un poste a été ajouté après décision — ce qui explique le dépassement", () => {
    const b = breakdown(
      [{ amountGranted: 100_000 }, { amountGranted: 25_000, addedAfterDecision: true }],
      100_000,
    );
    expect(b.overrunDzd).toBe(25_000);
    expect(b.hasLateAdditions).toBe(true);
  });

  it("aucun poste : l'enveloppe entière reste à affecter, et ce n'est pas « équilibré »", () => {
    const b = breakdown([], 100_000);
    expect(b.unallocatedDzd).toBe(100_000);
    expect(b.balanced).toBe(false);
    expect(b.itemCount).toBe(0);
  });

  it("ignore les montants absents plutôt que de produire NaN", () => {
    const b = breakdown([{ amountGranted: null }, { amountGranted: 40_000 }, {}], 100_000);
    expect(b.allocatedDzd).toBe(40_000);
    expect(Number.isNaN(b.unallocatedDzd)).toBe(false);
  });

  it("n'invente pas d'écart à cause des décimaux flottants", () => {
    const b = breakdown([{ amountGranted: 33_333.33 }, { amountGranted: 33_333.33 }, { amountGranted: 33_333.34 }], 100_000);
    expect(b.allocatedDzd).toBe(100_000);
    expect(b.balanced).toBe(true);
  });
});

describe("canEmitOrder — trois garde-fous financiers", () => {
  it("émet quand le sponsoring est accordé et le poste chiffré", () => {
    expect(canEmitOrder({ amountGranted: 50_000 }, true).ok).toBe(true);
  });

  it("refuse de payer ce qui n'est pas décidé", () => {
    const r = canEmitOrder({ amountGranted: 50_000 }, false);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("pas encore été accordé");
  });

  it("refuse de payer un poste sans montant", () => {
    expect(canEmitOrder({ amountGranted: null }, true).ok).toBe(false);
    expect(canEmitOrder({ amountGranted: 0 }, true).ok).toBe(false);
  });

  it("refuse de payer deux fois", () => {
    const r = canEmitOrder({ amountGranted: 50_000, expenseOrderId: "od_1" }, true);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("déjà été émis");
  });

  it("le double paiement prime sur toute autre objection — c'est le risque le plus coûteux", () => {
    expect(canEmitOrder({ amountGranted: null, expenseOrderId: "od_1" }, false).reason).toContain("déjà été émis");
  });
});

/**
 * Un congrès annonce un stand ou un symposium via `hasBooth` / `hasSymposium`. Ces intentions
 * n'ont jamais porté d'argent : on annonçait un stand et le budget n'en disait pas un mot.
 * Ce rapprochement est le seul endroit où l'écart se voit avant la facture.
 */
describe("plannedGaps — annoncé mais pas chiffré", () => {
  it("un stand annoncé sans poste STAND est signalé", () => {
    const g = plannedGaps([{ kind: "SERVICE" }], { hasBooth: true });
    expect(g.boothUnbudgeted).toBe(true);
    expect(g.any).toBe(true);
  });

  it("un stand annoncé ET chiffré ne déclenche rien", () => {
    expect(plannedGaps([{ kind: "STAND" }], { hasBooth: true }).boothUnbudgeted).toBe(false);
  });

  it("le symposium a sa propre nature — un poste « prestation » ne le couvre pas", () => {
    expect(plannedGaps([{ kind: "SERVICE" }], { hasSymposium: true }).symposiumUnbudgeted).toBe(true);
    expect(plannedGaps([{ kind: "SYMPOSIUM" }], { hasSymposium: true }).symposiumUnbudgeted).toBe(false);
  });

  it("rien d'annoncé, rien à signaler — y compris quand le drapeau est absent", () => {
    expect(plannedGaps([], {}).any).toBe(false);
    expect(plannedGaps([], { hasBooth: false, hasSymposium: null }).any).toBe(false);
  });

  it("les deux manques se cumulent", () => {
    const g = plannedGaps([], { hasBooth: true, hasSymposium: true });
    expect(g.boothUnbudgeted && g.symposiumUnbudgeted).toBe(true);
  });
});
