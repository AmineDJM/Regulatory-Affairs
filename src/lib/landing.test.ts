import { describe, expect, it } from "vitest";
import { firstAccessibleHref } from "./labels";
import type { Module } from "./rbac";

/**
 * Anti-boucle de redirection (`ERR_TOO_MANY_REDIRECTS`) : l'atterrissage de secours
 * après un refus ne doit JAMAIS pointer vers une page que l'utilisateur ne peut pas
 * voir — en particulier ne pas renvoyer le refus d'un module vers l'écran de ce module.
 */
describe("firstAccessibleHref — atterrissage sûr après refus", () => {
  const allow = (...mods: Module[]) => (m: Module) => mods.includes(m);

  it("renvoie l'espace personnel quand c'est la première destination visible", () => {
    // Le premier onglet de l'espace personnel — « Aujourd'hui » aujourd'hui. On vérifie que
    // c'est bien UN écran de cet espace, pas lequel : l'ordre des onglets est un choix d'UI.
    expect(firstAccessibleHref(allow("WORKSPACE"))).toMatch(/^\/(aujourdhui|mon-espace)$/);
  });

  it("ne renvoie jamais un écran que la personne ne voit pas (pas de boucle)", () => {
    const href = firstAccessibleHref(allow("REGULATORY"));
    expect(href).not.toBe("/mon-espace");
    expect(href).toBeTruthy();
  });

  it("ignore les sous-pages d'admin (gardées plus strictement que VIEW)", () => {
    // Un utilisateur qui ne peut voir QUE le module ADMIN atterrit sur /admin
    // (VIEW), jamais sur /admin/ai ou /admin/adoption (Super Admin only) → pas de boucle.
    expect(firstAccessibleHref(allow("ADMIN"))).toBe("/admin");
  });

  it("renvoie null quand aucune destination n'est visible (→ /no-access côté serveur)", () => {
    expect(firstAccessibleHref(() => false)).toBeNull();
  });
});
