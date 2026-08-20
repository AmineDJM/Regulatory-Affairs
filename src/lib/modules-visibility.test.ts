import { describe, it, expect } from "vitest";
import {
  NEVER_HIDDEN, isHideable, normalizeHidden, isModuleHidden, visibleModules,
  canOpenModule, hiddenNotice, hiddenSummary,
} from "./modules-visibility";
import { MODULES, type Module } from "./rbac";

describe("isHideable — la console d'administration ne se masque jamais", () => {
  it("un module ordinaire se masque", () => {
    expect(isHideable("REGULATORY")).toBe(true);
    expect(isHideable("FINANCES")).toBe(true);
  });

  // La cacher fermerait la porte de l'intérieur : c'est par elle qu'on démasque.
  it("la console d'administration, jamais", () => {
    expect(isHideable("ADMIN")).toBe(false);
    expect(NEVER_HIDDEN).toContain("ADMIN");
  });

  it("un nom qui n'est pas un module est refusé", () => {
    expect(isHideable("PAS_UN_MODULE")).toBe(false);
    expect(isHideable("")).toBe(false);
  });
});

describe("normalizeHidden — un réglage partiellement obsolète reste exploitable", () => {
  it("garde ce qui est valide", () => {
    expect(normalizeHidden(["REGULATORY", "STOCKS"])).toEqual(["REGULATORY", "STOCKS"]);
  });

  // Une évolution de code (module renommé) ne doit pas rendre tout l'écran inutilisable.
  it("écarte l'inconnu et l'interdit, sans tout refuser", () => {
    expect(normalizeHidden(["REGULATORY", "ANCIEN_MODULE", "ADMIN"])).toEqual(["REGULATORY"]);
  });

  it("dédoublonne et nettoie les espaces", () => {
    expect(normalizeHidden([" STOCKS ", "STOCKS"])).toEqual(["STOCKS"]);
  });

  it("une liste vide reste vide", () => {
    expect(normalizeHidden([])).toEqual([]);
  });
});

describe("visibleModules — masquer retire du menu, pour tout le monde sauf le Super Admin", () => {
  const accessible = ["REGULATORY", "FINANCES", "STOCKS"] as Module[];

  it("retire les modules masqués", () => {
    expect(visibleModules(accessible, ["STOCKS"], { isSuperAdmin: false })).toEqual(["REGULATORY", "FINANCES"]);
  });

  // Un écran d'administration qui cacherait ce qu'on vient d'éteindre serait un piège : on ne
  // pourrait plus le rallumer.
  it("le Super Admin garde tout, y compris ce qu'il a masqué", () => {
    expect(visibleModules(accessible, ["STOCKS"], { isSuperAdmin: true })).toEqual(accessible);
  });

  it("masquer n'ajoute jamais un module auquel on n'a pas droit", () => {
    expect(visibleModules(accessible, [], { isSuperAdmin: false })).toEqual(accessible);
    expect(visibleModules([], ["STOCKS"], { isSuperAdmin: true })).toEqual([]);
  });
});

describe("canOpenModule — masqué veut dire INJOIGNABLE, pas seulement absent du menu", () => {
  // Sans cette garde, un lien envoyé par courriel il y a un mois rouvrirait l'écran retiré.
  it("refuse l'ouverture d'un module masqué", () => {
    expect(canOpenModule("STOCKS", ["STOCKS"], { isSuperAdmin: false })).toBe(false);
  });

  it("laisse passer ce qui n'est pas masqué", () => {
    expect(canOpenModule("REGULATORY", ["STOCKS"], { isSuperAdmin: false })).toBe(true);
  });

  it("le Super Admin passe toujours — il doit pouvoir vérifier et rallumer", () => {
    expect(canOpenModule("STOCKS", ["STOCKS"], { isSuperAdmin: true })).toBe(true);
  });
});

describe("messages", () => {
  it("le bandeau dit QUI voit encore le module", () => {
    const n = hiddenNotice("Stocks");
    expect(n).toContain("Stocks");
    expect(n).toContain("vous seul");
  });

  it("le décompte distingue le singulier du pluriel, et le cas zéro", () => {
    expect(hiddenSummary([])).toContain("en service");
    expect(hiddenSummary(["STOCKS"])).toContain("1 module masqué");
    expect(hiddenSummary(["STOCKS", "PCH"])).toContain("2 modules masqués");
  });

  it("le décompte ignore ce qui n'est pas masquable", () => {
    expect(hiddenSummary(["ADMIN"])).toContain("en service");
  });
});

describe("couverture — tout module réel est masquable, sauf ceux qu'on protège", () => {
  it("aucun module n'échappe à la règle par oubli", () => {
    for (const m of MODULES) {
      expect(isHideable(m), m).toBe(!(NEVER_HIDDEN as readonly string[]).includes(m));
    }
  });
});
