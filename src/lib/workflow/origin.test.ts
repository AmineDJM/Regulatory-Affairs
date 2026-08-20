import { describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { adProInit, adProOriginRank, canChooseAnalysisAtCreation, canDesignateProductManagerAtCreation } from "./origin";

const u = (role: UserRole, secondaryRole: UserRole | null = null) => ({ role, secondaryRole });

describe("Routage Ad & Pro selon le rang du créateur (origin)", () => {
  it("un délégué part de l'étape préliminaire (circuit complet)", () => {
    const init = adProInit(u("MEDICAL_DELEGATE"));
    expect(adProOriginRank(u("MEDICAL_DELEGATE"))).toBe(0);
    expect(init.stage).toBe("PRELIMINARY");
    expect(init.status).toBe("AWAITING_PRELIMINARY");
    expect(init.productManagerId).toBeNull();
    expect(init.preliminaryBySelf).toBe(false);
    expect(canDesignateProductManagerAtCreation(u("MEDICAL_DELEGATE"))).toBe(false);
  });

  it("le National Sales n'a pas à approuver : en désignant le chef de produit, il saute le préliminaire", () => {
    expect(adProOriginRank(u("NATIONAL_SALES"))).toBe(1);
    expect(canDesignateProductManagerAtCreation(u("NATIONAL_SALES"))).toBe(true);
    const init = adProInit(u("NATIONAL_SALES"), "pm-1");
    expect(init.stage).toBe("ANALYSIS");
    expect(init.status).toBe("PRELIMINARY_APPROVED");
    expect(init.productManagerId).toBe("pm-1");
    expect(init.preliminaryBySelf).toBe(true);
  });

  it("National Sales sans chef de produit désigné → repli sûr sur le préliminaire", () => {
    const init = adProInit(u("NATIONAL_SALES"));
    expect(init.stage).toBe("PRELIMINARY");
    expect(init.status).toBe("AWAITING_PRELIMINARY");
  });

  it("le chef de produit ne passe ni par le National Sales ni par l'analyse → directement à la Direction", () => {
    for (const role of ["PRODUCT_MANAGER", "MEDICAL_PROMOTION_MANAGER"] as UserRole[]) {
      expect(adProOriginRank(u(role))).toBe(2);
      const init = adProInit(u(role), "pm-ignored");
      expect(init.stage).toBe("FINAL");
      expect(init.status).toBe("AWAITING_FINAL");
      expect(init.productManagerId).toBeNull(); // pas d'analyse chef de produit
      expect(init.preliminaryBySelf).toBe(true);
      expect(canDesignateProductManagerAtCreation(u(role))).toBe(false);
    }
  });

  it("la Direction et le Super Admin vont directement à la validation définitive", () => {
    for (const role of ["DIRECTION", "SUPER_ADMIN"] as UserRole[]) {
      expect(adProOriginRank(u(role))).toBe(3);
      expect(adProInit(u(role)).stage).toBe("FINAL");
      expect(adProInit(u(role)).status).toBe("AWAITING_FINAL");
    }
  });

  // Le Directeur Général et le Directeur des Opérations n'ont pas la VUE GLOBALE (cloisonnement
  // voulu), mais ils n'ont personne au-dessus d'eux pour approuver : sans rang explicite, ils
  // retombaient au rang 0 et attendaient l'accord d'un superviseur qu'ils dirigent.
  it("le Directeur Général et le Directeur des Opérations vont directement à la validation définitive", () => {
    for (const role of ["GENERAL_MANAGER", "OPERATIONS_DIRECTOR"] as UserRole[]) {
      expect(adProOriginRank(u(role)), role).toBe(3);
      const init = adProInit(u(role));
      expect(init.stage, role).toBe("FINAL");
      expect(init.status, role).toBe("AWAITING_FINAL");
      expect(init.preliminaryBySelf, role).toBe(true);
    }
  });

  it("un directeur PEUT demander l'avis d'un chef de produit — sans y être tenu", () => {
    expect(canChooseAnalysisAtCreation(u("OPERATIONS_DIRECTOR"))).toBe(true);
    const init = adProInit(u("OPERATIONS_DIRECTOR"), "pm-1", { viaProductManager: true });
    expect(init.stage).toBe("ANALYSIS");
    expect(init.productManagerId).toBe("pm-1");
  });

  it("le rang tient compte du rôle secondaire (ex. délégué avec National Sales en secondaire)", () => {
    expect(adProOriginRank(u("MEDICAL_DELEGATE", "NATIONAL_SALES"))).toBe(1);
    expect(adProOriginRank(u("MEDICAL_DELEGATE", "DIRECTION"))).toBe(3);
    expect(adProOriginRank(u("NATIONAL_SALES", "PRODUCT_MANAGER"))).toBe(2);
  });
});

/**
 * LA DIRECTION CHOISIT : trancher tout de suite, ou demander d'abord un avis produit.
 *
 * Sa demande allait droit à la décision finale — la sienne — sans possibilité de solliciter le
 * chef de produit. Le choix lui est maintenant offert, sans jamais lui être imposé.
 */
describe("adProInit — la Direction peut demander l'avis du chef de produit", () => {
  const direction = { role: "DIRECTION" as const };
  const superAdmin = { role: "SUPER_ADMIN" as const };

  it("sans rien demander, la Direction tranche directement — comportement inchangé", () => {
    expect(adProInit(direction)).toMatchObject({ stage: "FINAL", status: "AWAITING_FINAL", productManagerId: null });
  });

  it("en demandant l'analyse, la demande part chez le chef de produit désigné", () => {
    expect(adProInit(direction, "pm_1", { viaProductManager: true })).toMatchObject({
      stage: "ANALYSIS", status: "PRELIMINARY_APPROVED", productManagerId: "pm_1", preliminaryBySelf: true,
    });
  });

  it("demander l'analyse SANS désigner personne retombe sur la décision directe", () => {
    // Une étape sans destinataire bloquerait la demande sans que personne ne soit prévenu.
    expect(adProInit(direction, null, { viaProductManager: true })).toMatchObject({ stage: "FINAL" });
    expect(adProInit(direction, "", { viaProductManager: true })).toMatchObject({ stage: "FINAL" });
  });

  it("désigner un chef de produit SANS demander l'analyse ne détourne pas la demande", () => {
    expect(adProInit(direction, "pm_1")).toMatchObject({ stage: "FINAL", productManagerId: null });
  });

  it("vaut aussi pour le Super Admin", () => {
    expect(adProInit(superAdmin, "pm_1", { viaProductManager: true })).toMatchObject({ stage: "ANALYSIS" });
  });

  it("un chef de produit ne s'envoie PAS sa propre demande en analyse", () => {
    expect(adProInit({ role: "PRODUCT_MANAGER" }, "pm_2", { viaProductManager: true })).toMatchObject({ stage: "FINAL" });
  });

  it("le National Sales n'a pas ce choix : l'analyse reste son étape suivante obligatoire", () => {
    expect(adProInit({ role: "NATIONAL_SALES" }, "pm_1", { viaProductManager: true })).toMatchObject({ stage: "ANALYSIS" });
    // …et sans désignation, il repart du préliminaire, pas de la décision finale.
    expect(adProInit({ role: "NATIONAL_SALES" }, null, { viaProductManager: true })).toMatchObject({ stage: "PRELIMINARY" });
  });

  it("un délégué reste au circuit complet, quoi qu'il envoie", () => {
    expect(adProInit({ role: "MEDICAL_DELEGATE" }, "pm_1", { viaProductManager: true })).toMatchObject({ stage: "PRELIMINARY" });
  });
});

describe("qui peut choisir, qui peut désigner", () => {
  it("seule la Direction (et le Super Admin) choisit le passage par l'analyse", () => {
    expect(canChooseAnalysisAtCreation({ role: "DIRECTION" })).toBe(true);
    expect(canChooseAnalysisAtCreation({ role: "SUPER_ADMIN" })).toBe(true);
    expect(canChooseAnalysisAtCreation({ role: "NATIONAL_SALES" })).toBe(false);
    expect(canChooseAnalysisAtCreation({ role: "PRODUCT_MANAGER" })).toBe(false);
  });

  it("National Sales ET Direction peuvent désigner le chef de produit, pour des raisons différentes", () => {
    expect(canDesignateProductManagerAtCreation({ role: "NATIONAL_SALES" })).toBe(true);
    expect(canDesignateProductManagerAtCreation({ role: "DIRECTION" })).toBe(true);
    expect(canDesignateProductManagerAtCreation({ role: "PRODUCT_MANAGER" })).toBe(false);
    expect(canDesignateProductManagerAtCreation({ role: "MEDICAL_DELEGATE" })).toBe(false);
  });

  it("un rôle SECONDAIRE Direction ouvre le choix", () => {
    expect(canChooseAnalysisAtCreation({ role: "MEDICAL_DELEGATE", secondaryRole: "DIRECTION" })).toBe(true);
  });
});
