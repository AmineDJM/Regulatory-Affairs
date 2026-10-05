import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NAVIGATION, MARKETING_COCKPIT_TABS } from "@/lib/labels";

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

  it("Force de vente ne porte plus ces deux onglets", () => {
    const hrefs = NAVIGATION.flatMap((n) => (n.tabs ?? []).map((t) => t.href));
    expect(hrefs).not.toContain("/planning/messages");
    expect(hrefs).not.toContain("/planning/specialites");
  });
});
