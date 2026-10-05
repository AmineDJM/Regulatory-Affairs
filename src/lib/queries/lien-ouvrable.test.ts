import { describe, expect, it } from "vitest";
import type { Action, Module, SessionUser } from "@/lib/rbac";
import { lienDeLigne, peutOuvrirModule } from "./lien-ouvrable";

/**
 * UN LIEN N'EXISTE QUE SI L'ÉCRAN S'OUVRIRA (§118.196, lot E3) — les deux portes de `requireModule`,
 * rejouées sans base : le droit de lecture du module, puis le module en service.
 */

function personne(role: SessionUser["role"], modules: Partial<Record<Module, Action[]>>): SessionUser {
  return {
    id: `u-${role}`,
    role,
    access: {
      modules: new Map(Object.entries(modules).map(([m, a]) => [m as Module, { actions: new Set(a), scope: "ALL" as const }])),
      rowGrants: new Map(),
    },
  };
}

describe("peutOuvrirModule — les deux portes de requireModule", () => {
  const lecteur = personne("GENERAL_MANAGER", { RECRUITMENT: ["VIEW"] });

  it("le droit de lecture ET le module en service : le lien s'ouvre", () => {
    expect(peutOuvrirModule(lecteur, "RECRUITMENT", [])).toBe(true);
  });

  it("sans le droit de lecture, la page redirigerait (`?denied=`) : pas de lien", () => {
    expect(peutOuvrirModule(personne("GENERAL_MANAGER", { RECRUITMENT: ["CREATE"] }), "RECRUITMENT", [])).toBe(false);
    expect(peutOuvrirModule(personne("GENERAL_MANAGER", {}), "RECRUITMENT", [])).toBe(false);
  });

  it("un module MASQUÉ redirigerait (`?masque=`) : pas de lien — sauf pour le Super Admin, qui le voit encore", () => {
    expect(peutOuvrirModule(lecteur, "RECRUITMENT", ["RECRUITMENT"])).toBe(false);
    expect(peutOuvrirModule(personne("SUPER_ADMIN", { RECRUITMENT: ["VIEW"] }), "RECRUITMENT", ["RECRUITMENT"])).toBe(true);
  });

  it("un module RETIRÉ ne s'ouvre pour personne, Super Admin compris", () => {
    expect(peutOuvrirModule(personne("SUPER_ADMIN", { SALES: ["VIEW"] }), "SALES", [])).toBe(false);
  });
});

describe("lienDeLigne — trois issues pour une ligne qui attend quelqu'un", () => {
  it("module ouvert : le lien", () => {
    expect(lienDeLigne(personne("GENERAL_MANAGER", { RECRUITMENT: ["VIEW"] }), "RECRUITMENT", "/recrutement/x", []))
      .toEqual({ href: "/recrutement/x", sansLien: null });
  });

  it("MODULE NON OUVERT À CE COMPTE : la ligne reste, sans lien, et dit qui peut l'ouvrir", () => {
    const l = lienDeLigne(personne("MEDICAL_PROMOTION_MANAGER", {}), "RECRUITMENT", "/recrutement/x", []);
    expect(l?.href).toBeNull();
    expect(l?.sansLien).toContain("« Recrutement »");
    expect(l?.sansLien).toContain("Administration › Accès");
  });

  it("MODULE HORS SERVICE : la ligne n'a pas lieu d'être — rien ne s'y tranche plus", () => {
    expect(lienDeLigne(personne("GENERAL_MANAGER", { RECRUITMENT: ["VIEW"] }), "RECRUITMENT", "/recrutement/x", ["RECRUITMENT"])).toBeNull();
    expect(lienDeLigne(personne("MEDICAL_PROMOTION_MANAGER", {}), "RECRUITMENT", "/recrutement/x", ["RECRUITMENT"])).toBeNull();
  });

  it("MASQUÉ, LE MODULE GARDE SA FILE CHEZ LE SUPER ADMIN — il est le seul à pouvoir le rallumer ; RETIRÉ, plus pour personne", () => {
    // La même exemption que `requireModule` : le Super Admin passe un module masqué, jamais un module retiré.
    expect(lienDeLigne(personne("SUPER_ADMIN", { RECRUITMENT: ["VIEW"] }), "RECRUITMENT", "/recrutement/x", ["RECRUITMENT"]))
      .toEqual({ href: "/recrutement/x", sansLien: null });
    expect(lienDeLigne(personne("SUPER_ADMIN", { SALES: ["VIEW"] }), "SALES", "/x", [])).toBeNull();
  });
});
