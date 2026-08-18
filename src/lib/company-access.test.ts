import { describe, it, expect } from "vitest";
import {
  seesWholeGroup, allowedCompanyIds, canViewCompany, canEditCompany,
  resolveScope, companyAccessWhere, platformScopeWhere, type AccessBearer,
} from "./company-access";

const ALL = ["adv", "pha", "xyz"];

const bearer = (over: Partial<AccessBearer> = {}): AccessBearer => ({
  role: "MEDICAL_DELEGATE", grants: [], ...over,
});

/**
 * Ces fonctions décident qui voit quelle société du groupe. Une erreur ici ne plante rien :
 * elle laisse quelqu'un lire les dossiers réglementaires d'une entité qui ne le regarde pas,
 * ou enferme un salarié hors de sa propre société.
 */

describe("seesWholeGroup", () => {
  it("le Super Admin, et LUI SEUL, voit tout le groupe", () => {
    expect(seesWholeGroup({ role: "SUPER_ADMIN" })).toBe(true);
  });

  it("la DIRECTION relève de la règle commune : son entité, et ce qu'on lui a accordé", () => {
    // Elle traversait tout le groupe sans autorisation à saisir. Le cloisonnement s'élargit
    // désormais par une autorisation nominative, jamais par un rôle qui passe partout en silence.
    expect(seesWholeGroup({ role: "DIRECTION" })).toBe(false);
    expect(seesWholeGroup({ role: "MEDICAL_DELEGATE", secondaryRole: "DIRECTION" })).toBe(false);
  });

  it("les autres rôles non plus", () => {
    expect(seesWholeGroup({ role: "PRODUCT_MANAGER" })).toBe(false);
  });

  it("un rôle SECONDAIRE Super Admin compte aussi — régression classique de cet ERP", () => {
    expect(seesWholeGroup({ role: "MEDICAL_DELEGATE", secondaryRole: "SUPER_ADMIN" })).toBe(true);
  });
});

describe("allowedCompanyIds — on n'enferme personne par omission", () => {
  it("la vue groupe accède à toutes les entités existantes", () => {
    expect(allowedCompanyIds(bearer({ role: "SUPER_ADMIN" }), ALL)).toEqual(ALL);
  });

  it("l'entité d'appartenance est TOUJOURS accessible, même sans autorisation saisie", () => {
    expect(allowedCompanyIds(bearer({ homeCompanyId: "adv" }), ALL)).toEqual(["adv"]);
  });

  it("les autorisations s'ajoutent à l'appartenance", () => {
    const u = bearer({ homeCompanyId: "adv", grants: [{ companyId: "pha", canEdit: false }] });
    expect(allowedCompanyIds(u, ALL)).toEqual(["adv", "pha"]);
  });

  it("ne dédouble pas une entité à la fois d'appartenance et autorisée", () => {
    const u = bearer({ homeCompanyId: "adv", grants: [{ companyId: "adv", canEdit: true }] });
    expect(allowedCompanyIds(u, ALL)).toEqual(["adv"]);
  });

  it("ignore une autorisation vers une entité qui n'existe plus", () => {
    const u = bearer({ grants: [{ companyId: "supprimee", canEdit: true }] });
    expect(allowedCompanyIds(u, ALL)).toEqual([]);
  });

  it("garde l'ordre des entités tel qu'il est affiché", () => {
    const u = bearer({ grants: [{ companyId: "xyz", canEdit: false }, { companyId: "adv", canEdit: false }] });
    expect(allowedCompanyIds(u, ALL)).toEqual(["adv", "xyz"]);
  });

  it("sans appartenance ni autorisation : aucun accès", () => {
    expect(allowedCompanyIds(bearer(), ALL)).toEqual([]);
  });

  // Une GAMME rattachée ouvre l'entité qui la porte : sans cela, rattacher quelqu'un à une
  // gamme de Pharmagène sans lui donner Pharmagène ne lui ouvrirait rien du tout.
  it("une gamme rattachée ouvre son entité", () => {
    const u = bearer({ rangeGrants: [{ rangeId: "cardio", companyId: "pha" }] });
    expect(allowedCompanyIds(u, ALL)).toEqual(["pha"]);
  });

  it("les gammes s'ajoutent à l'appartenance, sans dédoubler", () => {
    const u = bearer({
      homeCompanyId: "adv",
      rangeGrants: [{ rangeId: "cardio", companyId: "pha" }, { rangeId: "hosp", companyId: "adv" }],
    });
    expect(allowedCompanyIds(u, ALL)).toEqual(["adv", "pha"]);
  });

  it("ignore une gamme dont l'entité n'existe plus", () => {
    const u = bearer({ rangeGrants: [{ rangeId: "x", companyId: "supprimee" }] });
    expect(allowedCompanyIds(u, ALL)).toEqual([]);
  });
});

describe("canEditCompany — appartenir n'est pas pouvoir modifier", () => {
  it("l'appartenance seule ne donne PAS l'écriture", () => {
    expect(canViewCompany(bearer({ homeCompanyId: "adv" }), "adv", ALL)).toBe(true);
    expect(canEditCompany(bearer({ homeCompanyId: "adv" }), "adv")).toBe(false);
  });

  it("l'écriture se donne explicitement", () => {
    const u = bearer({ homeCompanyId: "adv", grants: [{ companyId: "adv", canEdit: true }] });
    expect(canEditCompany(u, "adv")).toBe(true);
  });

  it("une autorisation en lecture seule ne donne pas l'écriture", () => {
    const u = bearer({ grants: [{ companyId: "pha", canEdit: false }] });
    expect(canViewCompany(u, "pha", ALL)).toBe(true);
    expect(canEditCompany(u, "pha")).toBe(false);
  });

  it("la vue groupe écrit partout", () => {
    expect(canEditCompany(bearer({ role: "SUPER_ADMIN" }), "xyz")).toBe(true);
  });
});

describe("resolveScope — le cookie n'est pas une autorisation", () => {
  const multi = bearer({ homeCompanyId: "adv", grants: [{ companyId: "pha", canEdit: false }] });

  it("respecte une portée légitime", () => {
    expect(resolveScope(multi, "pha", ALL)).toBe("pha");
  });

  it("une portée INTERDITE retombe sur une entité autorisée, elle n'ouvre rien", () => {
    expect(resolveScope(multi, "xyz", ALL)).toBe("adv");
  });

  it("un salarié mono-entité est borné à la sienne, même sans portée demandée", () => {
    expect(resolveScope(bearer({ homeCompanyId: "adv" }), null, ALL)).toBe("adv");
  });

  it("plusieurs entités autorisées et aucune portée : on ne borne pas", () => {
    expect(resolveScope(multi, null, ALL)).toBeNull();
  });

  it("aucune entité autorisée : aucune portée", () => {
    expect(resolveScope(bearer(), "adv", ALL)).toBeNull();
  });
});

describe("companyAccessWhere — « toutes » veut dire « toutes celles auxquelles j'ai droit »", () => {
  const multi = bearer({ homeCompanyId: "adv", grants: [{ companyId: "pha", canEdit: false }] });

  it("sans portée, borne aux entités autorisées — PAS à toutes celles qui existent", () => {
    expect(companyAccessWhere(multi, null, ALL)).toEqual({ companyId: { in: ["adv", "pha"] } });
  });

  it("avec une portée légitime, filtre sur elle seule", () => {
    expect(companyAccessWhere(multi, "pha", ALL)).toEqual({ companyId: "pha" });
  });

  it("une portée interdite ne fait PAS fuiter : on retombe sur l'ensemble autorisé", () => {
    expect(companyAccessWhere(multi, "xyz", ALL)).toEqual({ companyId: { in: ["adv", "pha"] } });
  });

  it("la vue groupe sans portée ne filtre rien", () => {
    expect(companyAccessWhere(bearer({ role: "SUPER_ADMIN" }), null, ALL)).toEqual({});
  });

  it("aucun droit : un filtre qui ne remonte RIEN, jamais un filtre vide", () => {
    expect(companyAccessWhere(bearer(), null, ALL)).toEqual({ companyId: { in: [] } });
  });
});

describe("platformScopeWhere", () => {
  it("ne cloisonne pas un groupe qui n'a qu'une entité", () => {
    // Cloisonner un groupe mono-société ne protège rien et ne peut que masquer des données.
    expect(platformScopeWhere(bearer({ homeCompanyId: "adv" }), "adv", ["adv"])).toEqual({});
    expect(platformScopeWhere(bearer(), null, [])).toEqual({});
  });

  it("vue groupe sans portée : aucun filtre", () => {
    expect(platformScopeWhere(bearer({ role: "SUPER_ADMIN" }), null, ALL)).toEqual({});
  });

  it("PORTÉE CHOISIE : CETTE ENTITÉ, ET RIEN D'AUTRE", () => {
    // « Je mets Adventum, je vois Adventum. » Le non-rattaché n'entre plus : l'ancienne
    // exception faisait lire le travail d'une entité depuis la vue d'une autre, sans qu'aucun
    // écran ne le signale.
    expect(platformScopeWhere(bearer({ role: "SUPER_ADMIN" }), "pha", ALL)).toEqual({ companyId: "pha" });
  });

  it("sans portée : les entités auxquelles j'ai droit", () => {
    const u = bearer({ homeCompanyId: "adv", grants: [{ companyId: "pha", canEdit: false }] });
    expect(platformScopeWhere(u, null, ALL)).toEqual({ companyId: { in: ["adv", "pha"] } });
  });

  it("une portée interdite retombe sur un droit réel, jamais sur l'entité demandée", () => {
    const u = bearer({ homeCompanyId: "adv" });
    expect(platformScopeWhere(u, "xyz", ALL)).toEqual({ companyId: { in: ["adv"] } });
  });

  it("qui n'appartient à AUCUNE entité n'est cloisonné par rien", () => {
    // Le filtrer à zéro ne protège aucune société : cela vide tous ses écrans. Un compte sans
    // fiche salarié ne doit pas devenir un compte aveugle.
    expect(platformScopeWhere(bearer(), null, ALL)).toEqual({});
    expect(platformScopeWhere(bearer(), "adv", ALL)).toEqual({});
  });

  it("le non-rattaché n'apparaît dans AUCUNE vue cloisonnée", () => {
    // Il reste lisible en vue « toutes les entités » (aucun filtre) — rien ne disparaît de la
    // plateforme, seulement des vues d'entité.
    for (const scope of ["adv", "pha", "xyz"]) {
      const w = platformScopeWhere(bearer({ role: "SUPER_ADMIN" }), scope, ALL);
      expect(JSON.stringify(w)).not.toContain("null");
    }
  });
});
