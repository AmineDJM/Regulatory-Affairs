import { describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import * as origin from "./origin";
import { adProInit, adProOriginRank } from "./origin";
import { parcoursEffectif, SLUG_DG, SLUG_DIRECTION, SLUG_MARKETING, SLUG_PRELIMINAIRE } from "./parcours";

const u = (role: UserRole, secondaryRole: UserRole | null = null) => ({ role, secondaryRole });

/** La colonne vertébrale, dans l'ordre où le circuit la traverse depuis 09/2026 (§118.138). */
const SPINE = [SLUG_PRELIMINAIRE, SLUG_DG, SLUG_DIRECTION, SLUG_MARKETING];

describe("Routage Ad & Pro selon le rang du créateur (origin)", () => {
  it("un délégué part de l'étape préliminaire (circuit complet)", () => {
    const init = adProInit(u("MEDICAL_DELEGATE"));
    expect(adProOriginRank(u("MEDICAL_DELEGATE"))).toBe(0);
    expect(init.stage).toBe("PRELIMINARY");
    expect(init.status).toBe("AWAITING_PRELIMINARY");
    expect(init.productManagerId).toBeNull();
    expect(init.preliminaryBySelf).toBe(false);
  });

  it("le National Sales n'approuve pas sa propre demande : elle entre par la porte du DG", () => {
    expect(adProOriginRank(u("NATIONAL_SALES"))).toBe(1);
    const init = adProInit(u("NATIONAL_SALES"), "pm-1");
    expect(init.stage).toBe("ANALYSIS");
    expect(init.status).toBe("PRELIMINARY_APPROVED");
    expect(init.productManagerId, "le référent nommé est enregistré").toBe("pm-1");
    expect(init.preliminaryBySelf).toBe(true);
  });

  it("National Sales SANS référent nommé : la demande part QUAND MÊME", () => {
    // Le référent est un ENREGISTREMENT, plus une condition : la décision appartient au RÔLE
    // Direction Marketing tout entier. L'exiger ferait échouer une demande légitime le jour où
    // la personne qui suit la gamme est absente de la liste.
    const init = adProInit(u("NATIONAL_SALES"));
    expect(init.stage).toBe("ANALYSIS");
    expect(init.status).toBe("PRELIMINARY_APPROVED");
    expect(init.productManagerId).toBeNull();
    expect(init.preliminaryBySelf).toBe(true);
  });

  it("TOUT AUTRE DEMANDEUR — ni KAM, ni de la chaîne commerciale — entre au même endroit", () => {
    // Un demandeur hors force de vente n'a pas de superviseur national : l'étape préliminaire
    // serait un accord demandé à quelqu'un qui n'a pas autorité sur lui.
    for (const role of ["DIRECTION_ASSISTANT", "FINANCE_BUDGET_MANAGER", "COORDINATOR"] as UserRole[]) {
      const init = adProInit(u(role));
      expect(adProOriginRank(u(role)), role).toBe(0);
      expect(init.stage, role).toBe("ANALYSIS");
      expect(init.status, role).toBe("PRELIMINARY_APPROVED");
    }
  });

  it("SEUL le KAM passe par le préliminaire — et le RANG l'emporte sur le métier", () => {
    // Un délégué médical qui porte AUSSI la casquette Direction Marketing est un KAM au sens du
    // texte, mais sa demande ne peut pas être TRANCHÉE par lui-même : sa chaîne s'arrête donc
    // une étape plus tôt, chez la Direction. Sans cette borne, elle lui reviendrait.
    expect(adProInit(u("MEDICAL_DELEGATE")).stage).toBe("PRELIMINARY");
    const double = u("MEDICAL_DELEGATE", "PRODUCT_MANAGER");
    expect(adProOriginRank(double)).toBe(2);
    expect(adProInit(double).stage).toBe("ANALYSIS");
    expect(parcoursEffectif(double, SPINE, 2).decision, "la Direction tranche à sa place").toBe(SLUG_DIRECTION);
    // Un KAM n'a AUCUNE borne (Direction Marketing est la dernière étape) et saute pourtant la
    // Direction des opérations : c'est exactement ce que la borne seule ne pouvait pas dire.
    const kam = parcoursEffectif(u("MEDICAL_DELEGATE"), SPINE, 0);
    expect(kam.decision, "Direction Marketing tranche, et c'est la dernière étape").toBeNull();
    expect(kam.ignorees, "le national sales valide, la Direction des opérations non").toEqual([SLUG_DIRECTION]);
  });

  it("Direction Marketing entre par la porte du DG et NE TRANCHE PAS sa propre demande", () => {
    for (const role of ["PRODUCT_MANAGER", "MEDICAL_PROMOTION_MANAGER"] as UserRole[]) {
      expect(adProOriginRank(u(role))).toBe(2);
      const init = adProInit(u(role), "pm-ignored");
      expect(init.stage, role).toBe("ANALYSIS");
      expect(init.status, role).toBe("PRELIMINARY_APPROVED");
      expect(init.preliminaryBySelf, role).toBe(true);
      expect(parcoursEffectif(u(role), SPINE, 2).decision, role).toBe(SLUG_DIRECTION);
    }
  });

  it("la Direction et le Super Admin vont DIRECTEMENT chez Direction Marketing, qui tranche", () => {
    // Tout ce qui précède est soit leur propre accord, soit une porte dont ils sont la clé.
    // Ce qui le ferait tomber : les faire entrer par la porte du DG — la Direction attendrait
    // l'accord d'un DG qui est à son propre rang.
    for (const role of ["DIRECTION", "SUPER_ADMIN"] as UserRole[]) {
      expect(adProOriginRank(u(role))).toBe(3);
      expect(adProInit(u(role)).stage, role).toBe("FINAL");
      expect(adProInit(u(role)).status, role).toBe("AWAITING_FINAL");
    }
  });

  // Le Directeur Général et le Directeur des Opérations n'ont pas la VUE GLOBALE (cloisonnement
  // voulu), mais ils n'ont personne au-dessus d'eux pour approuver : sans rang explicite, ils
  // retombaient au rang 0 et attendaient l'accord d'un superviseur qu'ils dirigent.
  it("le Directeur Général et le Directeur des Opérations vont eux aussi directement à la décision", () => {
    for (const role of ["GENERAL_MANAGER", "OPERATIONS_DIRECTOR"] as UserRole[]) {
      expect(adProOriginRank(u(role)), role).toBe(3);
      const init = adProInit(u(role));
      expect(init.stage, role).toBe("FINAL");
      expect(init.status, role).toBe("AWAITING_FINAL");
      expect(init.preliminaryBySelf, role).toBe(true);
    }
  });

  it("le rang tient compte du rôle secondaire (ex. délégué avec National Sales en secondaire)", () => {
    expect(adProOriginRank(u("MEDICAL_DELEGATE", "NATIONAL_SALES"))).toBe(1);
    expect(adProOriginRank(u("MEDICAL_DELEGATE", "DIRECTION"))).toBe(3);
    expect(adProOriginRank(u("NATIONAL_SALES", "PRODUCT_MANAGER"))).toBe(2);
  });
});

/**
 * PLUS PERSONNE NE DÉSIGNE DE RÉFÉRENT, ET LE CIRCUIT NE SE CHOISIT PLUS.
 *
 * Deux réglages retirés pour la même raison — ils ne changeaient plus rien.
 * `canChooseAnalysisAtCreation` est partie avec `viaProductManager` quand Direction Marketing
 * est devenue l'étape qui TRANCHE toute demande Ad & Pro (§118.138) ;
 * `canDesignateProductManagerAtCreation` est partie avec le menu du référent, sur décision de
 * la Direction (22/09/2026 : « ça va DIRECT chez le directeur/directrice du département
 * marketing »). Un réglage d'écran sans effet est un mensonge fait à qui le règle (§118.14,
 * §118.50).
 *
 * `adProInit` CONTINUE d'accepter un référent : les actions serveur le prennent encore, et le
 * référent se configurera par Business Unit. Ce qui a disparu est le MENU, pas le champ — et
 * ces deux cas tiennent la nuance.
 */
describe("le référent Direction Marketing, quand une action en fournit encore un", () => {
  it("le référent nommé est enregistré là où il a un sens, et ignoré ailleurs", () => {
    expect(adProInit({ role: "DIRECTION" }, "pm_1").productManagerId).toBe("pm_1");
    expect(adProInit({ role: "MEDICAL_DELEGATE" }, "pm_1").productManagerId, "un KAM entre par son superviseur").toBeNull();
    expect(adProInit({ role: "DIRECTION" }, "   ").productManagerId, "un nom vide ne désigne personne").toBeNull();
  });

  it("le CHOIX de circuit n'existe plus — l'export a disparu avec le champ qu'il posait", () => {
    // Ce qui le ferait tomber : réintroduire l'export sans réintroduire son effet. Une porte
    // d'écran qui ne change rien est pire que pas de porte du tout.
    expect((origin as Record<string, unknown>).canChooseAnalysisAtCreation).toBeUndefined();
  });
});

