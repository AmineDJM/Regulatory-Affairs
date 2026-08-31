import { describe, it, expect } from "vitest";
import {
  CENTRAL_AUTH_THRESHOLD_DZD, needsCentralAuthorization, initialCentralStatus, canDisburse,
  visibleToFinance, awaitsCentre, awaitsRequester, sitsOnPaymentCentre, applyDecision,
  canResubmit, applyResubmission, blockedReason, type CentralStatus,
  isHighValue,
} from "./authorization";

describe("LE GUICHET UNIQUE — plus rien ne contourne le centre", () => {
  it("un petit montant passe par le centre comme un gros — le seuil ne filtre plus", () => {
    // C'était le trou : sous 50 000 DZD, l'ordre filait aux Finances et le centre n'avait aucune
    // vue de ce que la société décaissait réellement.
    expect(needsCentralAuthorization({ amount: 3_000 })).toBe(true);
    expect(initialCentralStatus({ amount: 3_000 })).toBe("AWAITING");
    expect(initialCentralStatus({ amount: 49_999 })).toBe("AWAITING");
    expect(initialCentralStatus({ amount: 2_400_000 })).toBe("AWAITING");
  });

  it("AUCUN module n'est exempté — la petite caisse non plus", () => {
    expect(needsCentralAuthorization({ amount: 900_000, module: "GENERAL_MEANS" })).toBe(true);
    expect(initialCentralStatus({ amount: 4_000, module: "GENERAL_MEANS" })).toBe("AWAITING");
    expect(needsCentralAuthorization({ amount: 80_000, module: "REGULATORY" })).toBe(true);
  });

  it("un montant illisible entre au centre comme les autres", () => {
    expect(needsCentralAuthorization({ amount: Number.NaN })).toBe(true);
    expect(initialCentralStatus({ amount: Number.NaN })).toBe("AWAITING");
  });

  it("le seuil survit comme MARQUEUR d'importance, pas comme filtre", () => {
    // Il sert à trier la file du centre. Il ne décide plus de qui y entre.
    expect(isHighValue(CENTRAL_AUTH_THRESHOLD_DZD)).toBe(true);
    expect(isHighValue(2_400_000)).toBe(true);
    expect(isHighValue(49_999)).toBe(false);
    // Un montant illisible se regarde en premier : le doute profite au contrôle.
    expect(isHighValue(Number.NaN)).toBe(true);
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
