import { describe, it, expect } from "vitest";
import {
  PROMO_STEPS, PROMO_TRACKS, initialStep, nextStep, canValidate, seesFullCircuit,
  visibleSteps, tracksOpen, allTracksDone, pendingTracks, progress, waitingOn,
  type PromoState,
} from "./circuit";

const ctx = { requesterId: "u-req", managerId: "u-mgr" };
const requester = { id: "u-req", role: "PRODUCT_MANAGER" };
const manager = { id: "u-mgr", role: "HEAD_OF_SALES" };
const pdg = { id: "u-pdg", role: "DIRECTION" };
const admin = { id: "u-adm", role: "SUPER_ADMIN" };
const pharmacist = { id: "u-mi", role: "MEDICAL_INFO_PHARMACIST" };
const stranger = { id: "u-x", role: "MEDICAL_DELEGATE" };

describe("Le circuit court — cinq étapes au lieu de seize", () => {
  it("enchaîne les validations dans l'ordre, puis ouvre l'exécution", () => {
    expect(nextStep("QUOTE_REQUESTED")).toBe("REVIEW_REQUESTER");
    expect(nextStep("REVIEW_REQUESTER")).toBe("REVIEW_MANAGER");
    expect(nextStep("REVIEW_MANAGER")).toBe("REVIEW_EXECUTIVE");
    expect(nextStep("REVIEW_EXECUTIVE")).toBe("REVIEW_MEDICAL_INFO");
    expect(nextStep("REVIEW_MEDICAL_INFO")).toBe("IN_EXECUTION");
    expect(nextStep("COMPLETED")).toBeNull();
  });

  it("reste court — c'était tout le problème de l'ancien", () => {
    expect(PROMO_STEPS.length).toBeLessThanOrEqual(7);
  });
});

describe("Le devis déjà en main", () => {
  it("saute la demande de devis — le cas le plus fréquent", () => {
    // On a appelé l'imprimeur avant d'ouvrir l'ERP : une prospection fictive ne trompait personne.
    expect(initialStep({ hasQuote: true })).toBe("REVIEW_REQUESTER");
  });

  it("sans devis, on commence par le demander", () => {
    expect(initialStep({ hasQuote: false })).toBe("QUOTE_REQUESTED");
  });

  it("on ne valide rien tant qu'aucun devis n'est déposé", () => {
    expect(canValidate(requester, "QUOTE_REQUESTED", ctx)).toBe(false);
  });
});

describe("Qui valide quoi", () => {
  it("le demandeur valide la première, et lui seul", () => {
    expect(canValidate(requester, "REVIEW_REQUESTER", ctx)).toBe(true);
    expect(canValidate(manager, "REVIEW_REQUESTER", ctx)).toBe(false);
    expect(canValidate(stranger, "REVIEW_REQUESTER", ctx)).toBe(false);
  });

  it("le N+1 valide la deuxième", () => {
    expect(canValidate(manager, "REVIEW_MANAGER", ctx)).toBe(true);
    expect(canValidate(requester, "REVIEW_MANAGER", ctx)).toBe(false);
  });

  it("la troisième est satisfaite par le PDG OU le Super Admin — un seul suffit", () => {
    // Exiger les deux, c'est bloquer le dossier sur un congé.
    expect(canValidate(pdg, "REVIEW_EXECUTIVE", ctx)).toBe(true);
    expect(canValidate(admin, "REVIEW_EXECUTIVE", ctx)).toBe(true);
    expect(canValidate(manager, "REVIEW_EXECUTIVE", ctx)).toBe(false);
  });

  it("l'information médicale valide la dernière", () => {
    expect(canValidate(pharmacist, "REVIEW_MEDICAL_INFO", ctx)).toBe(true);
    expect(canValidate(pdg, "REVIEW_MEDICAL_INFO", ctx)).toBe(false);
  });

  it("le Super Admin peut débloquer n'importe quelle étape", () => {
    for (const s of ["REVIEW_REQUESTER", "REVIEW_MANAGER", "REVIEW_MEDICAL_INFO"] as PromoState[]) {
      expect(canValidate(admin, s, ctx), s).toBe(true);
    }
  });

  it("rien ne se valide sur un dossier clos, refusé ou déjà en exécution", () => {
    for (const s of ["COMPLETED", "REFUSED", "IN_EXECUTION"] as PromoState[]) {
      expect(canValidate(admin, s, ctx), s).toBe(false);
    }
  });
});

describe("Qui voit le circuit complet", () => {
  it("l'administrateur et le PDG, eux seuls", () => {
    expect(seesFullCircuit(admin)).toBe(true);
    expect(seesFullCircuit(pdg)).toBe(true);
  });

  it("personne d'autre — un outil de travail n'est pas un tableau de surveillance mutuelle", () => {
    for (const u of [requester, manager, pharmacist, stranger]) {
      expect(seesFullCircuit(u), u.role).toBe(false);
    }
  });

  it("les autres ne lisent que l'étape en cours", () => {
    expect(visibleSteps(requester, "REVIEW_MANAGER")).toEqual(["REVIEW_MANAGER"]);
    expect(visibleSteps(admin, "REVIEW_MANAGER")).toHaveLength(PROMO_STEPS.length);
  });
});

describe("Les trois chemins parallèles", () => {
  it("ne s'ouvrent qu'une fois TOUTES les validations obtenues", () => {
    expect(tracksOpen("REVIEW_MEDICAL_INFO")).toBe(false);
    expect(tracksOpen("IN_EXECUTION")).toBe(true);
  });

  it("avancent indépendamment — c'est tout l'intérêt", () => {
    expect(pendingTracks(["PAYMENT"])).toEqual(["PURCHASE_ORDER", "AD_VISA"]);
    expect(allTracksDone(["PAYMENT"])).toBe(false);
  });

  it("le dossier n'est fini que lorsque le dernier l'est", () => {
    // Sinon on classerait une commande dont le visa n'est jamais arrivé.
    expect(allTracksDone([...PROMO_TRACKS])).toBe(true);
    expect(allTracksDone(["PURCHASE_ORDER", "PAYMENT"])).toBe(false);
  });
});

describe("Ce que la barre d'avancement raconte", () => {
  it("avance à chaque validation", () => {
    expect(progress("QUOTE_REQUESTED", []).step).toBe(1);
    expect(progress("REVIEW_MEDICAL_INFO", []).step).toBe(5);
    expect(progress("COMPLETED", []).step).toBe(PROMO_STEPS.length);
  });

  it("en exécution, elle suit les chantiers clos — pas un palier figé", () => {
    const none = progress("IN_EXECUTION", []).step;
    const two = progress("IN_EXECUTION", ["PAYMENT", "AD_VISA"]).step;
    expect(two).toBeGreaterThan(none);
  });

  it("un refus ne montre aucun avancement", () => {
    expect(progress("REFUSED", []).step).toBe(0);
  });
});

describe("« On attend qui ? » — la seule question qu'on pose à un circuit", () => {
  it("nomme l'étape en cours", () => {
    expect(waitingOn("REVIEW_MANAGER", [])).toContain("N+1");
    expect(waitingOn("QUOTE_REQUESTED", [])).toContain("devis");
  });

  it("en exécution, nomme les chantiers QUI RESTENT", () => {
    const w = waitingOn("IN_EXECUTION", ["PAYMENT"]);
    expect(w).toContain("Bon de commande");
    expect(w).toContain("visa");
    expect(w).not.toContain("Demande de paiement");
  });

  it("dit clairement quand il n'y a plus rien à attendre", () => {
    expect(waitingOn("COMPLETED", [])).toContain("terminé");
    expect(waitingOn("REFUSED", [])).toContain("refusé");
  });
});
