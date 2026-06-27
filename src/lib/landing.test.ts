import { describe, expect, it } from "vitest";
import { firstAccessibleHref } from "./labels";
import type { Module } from "./rbac";

/**
 * Anti-boucle de redirection (`ERR_TOO_MANY_REDIRECTS`) : l'atterrissage de secours
 * après un refus ne doit JAMAIS pointer vers une page que l'utilisateur ne peut pas
 * voir — en particulier ne pas renvoyer un refus de DASHBOARD vers /dashboard.
 */
describe("firstAccessibleHref — atterrissage sûr après refus", () => {
  const allow = (...mods: Module[]) => (m: Module) => mods.includes(m);

  it("renvoie /dashboard quand c'est la première destination visible", () => {
    expect(firstAccessibleHref(allow("DASHBOARD"))).toBe("/dashboard");
  });

  it("ne renvoie PAS /dashboard si DASHBOARD est refusé (pas de boucle)", () => {
    const href = firstAccessibleHref(allow("WORKSPACE"));
    expect(href).not.toBe("/dashboard");
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
