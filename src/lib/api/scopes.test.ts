import { describe, it, expect } from "vitest";
import { SCOPES, READ_ONLY_SCOPES, WRITE_SCOPES, hasScope, hasAllScopes, isReadOnly, normalizeScopes, isScope } from "./scopes";

describe("portées de l'API", () => {
  it("le profil LECTURE SEULE ne contient aucune portée d'écriture", () => {
    expect(READ_ONLY_SCOPES.some((s) => WRITE_SCOPES.includes(s))).toBe(false);
    expect(isReadOnly(READ_ONLY_SCOPES)).toBe(true);
  });

  it("une seule portée d'écriture suffit à ne plus être en lecture seule", () => {
    for (const w of WRITE_SCOPES) expect(isReadOnly([...READ_ONLY_SCOPES, w])).toBe(false);
  });

  it("`erp.admin` n'est PAS un joker : il n'ouvre pas l'approbation métier", () => {
    expect(hasScope(["erp.admin"], "erp.approve")).toBe(false);
    expect(hasScope(["erp.admin"], "erp.write")).toBe(false);
  });

  it("exige TOUTES les portées d'une opération, pas une seule", () => {
    expect(hasAllScopes(["erp.read"], ["erp.read", "erp.write"])).toBe(false);
    expect(hasAllScopes(["erp.read", "erp.write"], ["erp.read", "erp.write"])).toBe(true);
  });

  it("écarte une portée inventée plutôt que de l'accepter", () => {
    expect(normalizeScopes(["erp.read", "erp.tout", "erp.admin"])).toEqual(["erp.read", "erp.admin"]);
    expect(normalizeScopes("pas un tableau")).toEqual([]);
    expect(isScope("erp.superpouvoir")).toBe(false);
  });

  it("chaque portée est documentée — un agent doit savoir ce qu'il demande", () => {
    expect(SCOPES.length).toBeGreaterThanOrEqual(8);
  });
});
