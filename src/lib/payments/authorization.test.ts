import { describe, it, expect } from "vitest";
import {
  CENTRAL_AUTH_THRESHOLD_DZD, needsCentralAuthorization, initialCentralStatus, canDisburse,
  visibleToFinance, awaitsCentre, awaitsRequester, sitsOnPaymentCentre, applyDecision,
  canResubmit, applyResubmission, blockedReason, type CentralStatus,
} from "./authorization";

describe("Le seuil — ce qui passe tout seul, ce qui monte au centre", () => {
  it("au-dessous de 50 000 DZD, le circuit habituel suffit", () => {
    expect(needsCentralAuthorization({ amount: 49_999 })).toBe(false);
    expect(initialCentralStatus({ amount: 3_000 })).toBe("NOT_REQUIRED");
  });

  it("À PARTIR de 50 000 DZD, l'autorisation du centre est requise — le seuil est inclus", () => {
    // Un fournisseur qui facture exactement le seuil n'est pas un cas limite qu'on laisse filer.
    expect(needsCentralAuthorization({ amount: CENTRAL_AUTH_THRESHOLD_DZD })).toBe(true);
    expect(needsCentralAuthorization({ amount: 2_400_000 })).toBe(true);
    expect(initialCentralStatus({ amount: 50_000 })).toBe("AWAITING");
  });

  it("les moyens généraux sont exemptés, quel que soit le montant", () => {
    expect(needsCentralAuthorization({ amount: 900_000, module: "GENERAL_MEANS" })).toBe(false);
    expect(initialCentralStatus({ amount: 900_000, module: "GENERAL_MEANS" })).toBe("NOT_REQUIRED");
  });

  it("un autre module n'est PAS exempté — l'exemption est nominative", () => {
    expect(needsCentralAuthorization({ amount: 80_000, module: "REGULATORY" })).toBe(true);
    expect(needsCentralAuthorization({ amount: 80_000, module: "SPONSORING" })).toBe(true);
  });

  it("un montant illisible ne passe jamais tout seul", () => {
    // Le doute profite au contrôle, pas au décaissement.
    expect(needsCentralAuthorization({ amount: Number.NaN })).toBe(true);
    expect(needsCentralAuthorization({ amount: Number.POSITIVE_INFINITY })).toBe(true);
  });
});

describe("Le verrou de décaissement", () => {
  it("ne laisse payer QUE l'autorisé et le non-requis", () => {
    expect(canDisburse("APPROVED")).toBe(true);
    expect(canDisburse("NOT_REQUIRED")).toBe(true);
  });

  it("bloque tout le reste, y compris les allers-retours en cours", () => {
    for (const s of ["AWAITING", "CHANGES_REQUESTED", "INFO_REQUESTED", "REFUSED"] as CentralStatus[]) {
      expect(canDisburse(s), s).toBe(false);
    }
  });

  it("dit POURQUOI c'est bloqué — « non autorisé » seul fait ouvrir un ticket", () => {
    expect(blockedReason("AWAITING")).toContain("attend l'autorisation");
    expect(blockedReason("CHANGES_REQUESTED")).toContain("révision du montant");
    expect(blockedReason("INFO_REQUESTED")).toContain("argumentation");
    expect(blockedReason("REFUSED")).toContain("refusé");
    expect(blockedReason("APPROVED")).toBeNull();
    expect(blockedReason("NOT_REQUIRED")).toBeNull();
  });
});

describe("Ce que les Finances reçoivent", () => {
  it("ne reçoivent RIEN tant que le centre n'a pas tranché", () => {
    expect(visibleToFinance("AWAITING")).toBe(false);
    expect(visibleToFinance("CHANGES_REQUESTED")).toBe(false);
    expect(visibleToFinance("INFO_REQUESTED")).toBe(false);
  });

  it("reçoivent les petits montants sans attendre", () => {
    expect(visibleToFinance("NOT_REQUIRED")).toBe(true);
  });

  it("voient aussi les REFUSÉS — il faut savoir qu'il ne faut pas payer, et pourquoi", () => {
    expect(visibleToFinance("REFUSED")).toBe(true);
    expect(visibleToFinance("APPROVED")).toBe(true);
  });
});

describe("Qui siège au centre", () => {
  it("le PDG et le Super Admin, chacun suffisant", () => {
    expect(sitsOnPaymentCentre({ role: "DIRECTION" })).toBe(true);
    expect(sitsOnPaymentCentre({ role: "SUPER_ADMIN" })).toBe(true);
  });

  it("personne d'autre — pas même le Directeur Général ni les Finances", () => {
    // Élargir le centre à la direction opérationnelle recréerait le circuit qu'il remplace.
    for (const role of ["GENERAL_MANAGER", "OPERATIONS_DIRECTOR", "FINANCE_BUDGET_MANAGER", "DIRECTION_ASSISTANT", "VIEWER"]) {
      expect(sitsOnPaymentCentre({ role }), role).toBe(false);
    }
  });
});

describe("Les allers-retours — un refus sec bloque le travail", () => {
  it("autorise et refuse depuis l'attente", () => {
    expect(applyDecision("AWAITING", "APPROVE")).toBe("APPROVED");
    expect(applyDecision("AWAITING", "REFUSE")).toBe("REFUSED");
  });

  it("rend la main au demandeur pour une révision ou une argumentation", () => {
    expect(applyDecision("AWAITING", "REQUEST_CHANGES")).toBe("CHANGES_REQUESTED");
    expect(applyDecision("AWAITING", "REQUEST_INFO")).toBe("INFO_REQUESTED");
    expect(awaitsRequester("CHANGES_REQUESTED")).toBe(true);
    expect(awaitsCentre("CHANGES_REQUESTED")).toBe(false);
  });

  it("le demandeur resoumet, et la balle repasse au centre — autant de fois qu'il faut", () => {
    let s: CentralStatus = "AWAITING";
    s = applyDecision(s, "REQUEST_CHANGES")!;
    s = applyResubmission(s)!;
    expect(s).toBe("AWAITING");
    s = applyDecision(s, "REQUEST_INFO")!;
    s = applyResubmission(s)!;
    expect(s).toBe("AWAITING");
    expect(applyDecision(s, "APPROVE")).toBe("APPROVED");
  });

  it("on ne resoumet pas un dossier que le centre n'a pas encore regardé", () => {
    expect(canResubmit("AWAITING")).toBe(false);
    expect(applyResubmission("AWAITING")).toBeNull();
  });

  it("un dossier tranché ne se re-décide pas — deux administrateurs ne se contrediront pas sans trace", () => {
    expect(applyDecision("APPROVED", "REFUSE")).toBeNull();
    expect(applyDecision("REFUSED", "APPROVE")).toBeNull();
  });

  it("on ne décide pas d'un paiement qui n'avait pas à passer par le centre", () => {
    expect(applyDecision("NOT_REQUIRED", "APPROVE")).toBeNull();
  });
});
