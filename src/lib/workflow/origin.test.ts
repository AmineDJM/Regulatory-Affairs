import { describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { adProInit, adProOriginRank, canChooseAnalysisAtCreation, canDesignateProductManagerAtCreation } from "./origin";
import { slugDecisionnaire } from "./parcours";

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

  it("le National Sales n'a pas à approuver sa propre demande : elle part chez Direction Marketing", () => {
    expect(adProOriginRank(u("NATIONAL_SALES"))).toBe(1);
    expect(canDesignateProductManagerAtCreation(u("NATIONAL_SALES"))).toBe(true);
    const init = adProInit(u("NATIONAL_SALES"), "pm-1");
    expect(init.stage).toBe("ANALYSIS");
    expect(init.status).toBe("PRELIMINARY_APPROVED");
    expect(init.productManagerId, "le référent nommé est enregistré").toBe("pm-1");
    expect(init.preliminaryBySelf).toBe(true);
  });

  it("National Sales SANS référent nommé : la demande part QUAND MÊME chez Direction Marketing", () => {
    // CE QUI A CHANGÉ, ET POURQUOI. L'ancienne règle le renvoyait au préliminaire — le sien —
    // faute de désignation, parce que l'étape suivante était portée par « la personne désignée »
    // et qu'aucune désignation la rendait infranchissable. Elle est portée par le RÔLE Direction
    // Marketing : il n'y a plus rien à désigner, donc plus de repli à faire, et le National
    // Sales ne se voit plus demander d'approuver sa propre demande.
    const init = adProInit(u("NATIONAL_SALES"));
    expect(init.stage).toBe("ANALYSIS");
    expect(init.status).toBe("PRELIMINARY_APPROVED");
    expect(init.productManagerId).toBeNull();
    expect(init.preliminaryBySelf).toBe(true);
  });

  it("TOUT AUTRE DEMANDEUR — ni KAM, ni de la chaîne commerciale — part aussi chez Direction Marketing", () => {
    // « Si c'est le national sales ou n'importe qui d'autre, ça passe à la Direction Marketing
    // puis Direction. » Un demandeur hors force de vente n'a pas de superviseur national :
    // l'étape préliminaire serait un accord demandé à quelqu'un qui n'a pas autorité sur lui.
    for (const role of ["DIRECTION_ASSISTANT", "FINANCE_BUDGET_MANAGER", "COORDINATOR"] as UserRole[]) {
      const init = adProInit(u(role));
      expect(adProOriginRank(u(role)), role).toBe(0);
      expect(init.stage, role).toBe("ANALYSIS");
      expect(init.status, role).toBe("PRELIMINARY_APPROVED");
    }
  });

  it("SEUL le KAM passe par le préliminaire — et le RANG l'emporte sur le métier", () => {
    // Le cas qui a dicté la forme de `parcoursAdPro` : un délégué médical qui porte AUSSI la
    // casquette Direction Marketing est un KAM au sens du texte, mais sa demande ne peut pas
    // être arbitrée par lui-même. Elle part donc à la Direction, et sa borne de sortie doit
    // suivre — sinon la vue masquerait l'étape où la demande se trouve.
    expect(adProInit(u("MEDICAL_DELEGATE")).stage).toBe("PRELIMINARY");
    const double = u("MEDICAL_DELEGATE", "PRODUCT_MANAGER");
    expect(adProOriginRank(double)).toBe(2);
    expect(adProInit(double).stage).toBe("FINAL");
    expect(slugDecisionnaire(double, ["preliminary", "marketing", "final"], 2), "aucune borne : la Direction tranche").toBeNull();
    expect(slugDecisionnaire(u("MEDICAL_DELEGATE"), ["preliminary", "marketing", "final"], 0)).toBe("marketing");
  });

  it("la Direction Marketing ne passe ni par le National Sales ni par l'analyse → directement à la Direction", () => {
    for (const role of ["PRODUCT_MANAGER", "MEDICAL_PROMOTION_MANAGER"] as UserRole[]) {
      expect(adProOriginRank(u(role))).toBe(2);
      const init = adProInit(u(role), "pm-ignored");
      expect(init.stage).toBe("FINAL");
      expect(init.status).toBe("AWAITING_FINAL");
      expect(init.productManagerId).toBeNull(); // pas d'analyse Direction Marketing
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

  it("un directeur PEUT demander l'avis de la Direction Marketing — sans y être tenu", () => {
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
 * Direction Marketing. Le choix lui est maintenant offert, sans jamais lui être imposé.
 */
describe("adProInit — la Direction peut demander l'avis de la Direction Marketing", () => {
  const direction = { role: "DIRECTION" as const };
  const superAdmin = { role: "SUPER_ADMIN" as const };

  it("sans rien demander, la Direction tranche directement — comportement inchangé", () => {
    expect(adProInit(direction)).toMatchObject({ stage: "FINAL", status: "AWAITING_FINAL", productManagerId: null });
  });

  it("en demandant l'analyse, la demande part chez le référent Direction Marketing désigné", () => {
    expect(adProInit(direction, "pm_1", { viaProductManager: true })).toMatchObject({
      stage: "ANALYSIS", status: "PRELIMINARY_APPROVED", productManagerId: "pm_1", preliminaryBySelf: true,
    });
  });

  it("demander l'arbitrage SANS nommer de référent envoie QUAND MÊME chez Direction Marketing", () => {
    // CE QUI A CHANGÉ. L'ancienne règle retombait sur la décision directe : le choix « avec
    // analyse » n'avait pas d'objet sans une personne DÉSIGNÉE, l'étape étant portée par elle.
    // Elle est portée par le RÔLE Direction Marketing — l'arbitrage a donc toujours un
    // destinataire, et retomber sur la décision directe ferait le contraire de ce que la
    // Direction vient de demander.
    expect(adProInit({ role: "DIRECTION" }, null, { viaProductManager: true })).toMatchObject({ stage: "ANALYSIS", status: "PRELIMINARY_APPROVED" });
    expect(adProInit({ role: "DIRECTION" }, "   ", { viaProductManager: true })).toMatchObject({ stage: "ANALYSIS" });
  });

  it("désigner la Direction Marketing SANS demander l'analyse ne détourne pas la demande", () => {
    expect(adProInit(direction, "pm_1")).toMatchObject({ stage: "FINAL", productManagerId: null });
  });

  it("vaut aussi pour le Super Admin", () => {
    expect(adProInit(superAdmin, "pm_1", { viaProductManager: true })).toMatchObject({ stage: "ANALYSIS" });
  });

  it("la Direction Marketing ne s'envoie PAS sa propre demande en analyse", () => {
    expect(adProInit({ role: "PRODUCT_MANAGER" }, "pm_2", { viaProductManager: true })).toMatchObject({ stage: "FINAL" });
  });

  it("le National Sales n'a pas ce choix : l'arbitrage de Direction Marketing reste son étape suivante", () => {
    expect(adProInit({ role: "NATIONAL_SALES" }, "pm_1", { viaProductManager: true })).toMatchObject({ stage: "ANALYSIS" });
    // …et le drapeau n'y change RIEN, avec ou sans référent : forger « viaProductManager » ne
    // lui ouvre pas le choix réservé à la Direction, et ne le renvoie pas à son propre
    // préliminaire non plus.
    expect(adProInit({ role: "NATIONAL_SALES" }, null, { viaProductManager: true })).toMatchObject({ stage: "ANALYSIS", status: "PRELIMINARY_APPROVED" });
    expect(adProInit({ role: "NATIONAL_SALES" }, null, { viaProductManager: false })).toMatchObject({ stage: "ANALYSIS" });
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

  it("National Sales ET Direction peuvent désigner le référent Direction Marketing, pour des raisons différentes", () => {
    expect(canDesignateProductManagerAtCreation({ role: "NATIONAL_SALES" })).toBe(true);
    expect(canDesignateProductManagerAtCreation({ role: "DIRECTION" })).toBe(true);
    expect(canDesignateProductManagerAtCreation({ role: "PRODUCT_MANAGER" })).toBe(false);
    expect(canDesignateProductManagerAtCreation({ role: "MEDICAL_DELEGATE" })).toBe(false);
  });

  it("un rôle SECONDAIRE Direction ouvre le choix", () => {
    expect(canChooseAnalysisAtCreation({ role: "MEDICAL_DELEGATE", secondaryRole: "DIRECTION" })).toBe(true);
  });
});
