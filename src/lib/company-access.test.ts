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
  it("le Super Admin et la Direction voient tout le groupe", () => {
    expect(seesWholeGroup({ role: "SUPER_ADMIN" })).toBe(true);
    expect(seesWholeGroup({ role: "DIRECTION" })).toBe(true);
  });

  it("un rôle SECONDAIRE Direction compte aussi — régression classique de cet ERP", () => {
    expect(seesWholeGroup({ role: "MEDICAL_DELEGATE", secondaryRole: "DIRECTION" })).toBe(true);
  });

  it("les autres rôles non", () => {
    expect(seesWholeGroup({ role: "PRODUCT_MANAGER" })).toBe(false);
  });
});

describe("allowedCompanyIds — on n'enferme personne par omission", () => {
  it("la vue groupe accède à toutes les entités existantes", () => {
    expect(allowedCompanyIds(bearer({ role: "DIRECTION" }), ALL)).toEqual(ALL);
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
    expect(companyAccessWhere(bearer({ role: "DIRECTION" }), null, ALL)).toEqual({});
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
    expect(platformScopeWhere(bearer({ role: "DIRECTION" }), null, ALL)).toEqual({});
  });

  it("portée choisie : cette entité — et ce qui n'est rattaché à personne", () => {
    // « Je mets Adventum, je vois Adventum ». Le non-rattaché reste visible : filtré, il
    // deviendrait invisible depuis TOUTES les vues d'un salarié mono-entité.
    expect(platformScopeWhere(bearer({ role: "DIRECTION" }), "pha", ALL)).toEqual({
      OR: [{ companyId: "pha" }, { companyId: null }],
    });
  });

  it("sans portée : les entités auxquelles j'ai droit, plus le non-rattaché", () => {
    const u = bearer({ homeCompanyId: "adv", grants: [{ companyId: "pha", canEdit: false }] });
    expect(platformScopeWhere(u, null, ALL)).toEqual({
      OR: [{ companyId: { in: ["adv", "pha"] } }, { companyId: null }],
    });
  });

  it("une portée interdite retombe sur un droit réel, jamais sur l'entité demandée", () => {
    const u = bearer({ homeCompanyId: "adv" });
    expect(platformScopeWhere(u, "xyz", ALL)).toEqual({
      OR: [{ companyId: { in: ["adv"] } }, { companyId: null }],
    });
  });

  it("aucun droit : rien ne remonte, sauf ce qui n'appartient à personne", () => {
    expect(platformScopeWhere(bearer(), null, ALL)).toEqual({
      OR: [{ companyId: { in: [] } }, { companyId: null }],
    });
  });
});
