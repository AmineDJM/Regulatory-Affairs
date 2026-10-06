import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NAVIGATION, MARKETING_COCKPIT_TABS, MODULE_LABELS } from "@/lib/labels";
import { MODULES, PERMISSIONS } from "@/lib/rbac";

/** Marketing cockpit : sous-module de Sales & Marketing qui reçoit Messages et Spécialités (06/10). */
describe("Marketing cockpit", () => {
  const entree = NAVIGATION.find((n) => n.label === "Marketing cockpit");

  it("est une entrée du pôle Sales & Marketing, avec les onglets Messages et Spécialités", () => {
    expect(entree?.pole).toBe("SALES_MARKETING");
    expect(entree?.tabs).toBe(MARKETING_COCKPIT_TABS);
    expect(MARKETING_COCKPIT_TABS.map((t) => t.label)).toEqual(["Messages", "Spécialités"]);
    expect(entree?.match).toContain("/marketing-cockpit");
  });

  it("chaque onglet a son écran, et l'entrée mène au premier", () => {
    for (const t of MARKETING_COCKPIT_TABS) {
      expect(existsSync(join(process.cwd(), "src/app/(app)", t.href, "page.tsx")), t.href).toBe(true);
    }
    expect(entree?.href).toBe(MARKETING_COCKPIT_TABS[0].href);
  });

  it("est un MODULE À PART, réglable dans la console (Administration › Accès)", () => {
    expect((MODULES as readonly string[]).includes("MARKETING_COCKPIT")).toBe(true);
    expect(MODULE_LABELS.MARKETING_COCKPIT).toBe("Marketing cockpit");
    expect(entree?.module).toBe("MARKETING_COCKPIT");
    for (const t of MARKETING_COCKPIT_TABS) expect(t.module, t.label).toBe("MARKETING_COCKPIT");
  });

  it("par défaut, les mêmes personnes qu'hier : chaque rôle qui avait la Force de vente a le cockpit", () => {
    for (const [role, matrice] of Object.entries(PERMISSIONS)) {
      if (role === "SUPER_ADMIN" || !matrice.SALES_PLANNING) continue;
      expect(matrice.MARKETING_COCKPIT, role).toEqual(matrice.SALES_PLANNING);
    }
  });

  it("les écrans gardent leur porte : le module du cockpit, puis la règle de chaque geste", () => {
    const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
    expect(lire("src/app/(app)/marketing-cockpit/messages/page.tsx")).toContain('requireModule("MARKETING_COCKPIT")');
    const spe = lire("src/app/(app)/marketing-cockpit/specialites/page.tsx");
    expect(spe).toContain('requireModule("MARKETING_COCKPIT")');
    expect(spe).toContain('peutGererSpecialites(user, "VIEW")');
  });

  it("Force de vente ne porte plus ces deux onglets", () => {
    const hrefs = NAVIGATION.flatMap((n) => (n.tabs ?? []).map((t) => t.href));
    expect(hrefs).not.toContain("/planning/messages");
    expect(hrefs).not.toContain("/planning/specialites");
  });
});
