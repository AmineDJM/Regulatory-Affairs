import { describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { adProInit, adProOriginRank, canDesignateProductManagerAtCreation } from "./origin";

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

  it("le rang tient compte du rôle secondaire (ex. délégué avec National Sales en secondaire)", () => {
    expect(adProOriginRank(u("MEDICAL_DELEGATE", "NATIONAL_SALES"))).toBe(1);
    expect(adProOriginRank(u("MEDICAL_DELEGATE", "DIRECTION"))).toBe(3);
    expect(adProOriginRank(u("NATIONAL_SALES", "PRODUCT_MANAGER"))).toBe(2);
  });
});
