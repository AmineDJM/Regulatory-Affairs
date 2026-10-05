import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Un bouton décisif armé consomme Échap (preventDefault) : le panneau qui le contient ne doit pas se fermer (§118.215). */
describe("Sheet — Échap consommé par un bouton décisif", () => {
  const src = readFileSync("src/components/ui/sheet.tsx", "utf8").replace(/\/\/.*$/gm, "");
  it("ne ferme pas sur un Échap déjà consommé", () => {
    expect(src).toMatch(/key === "Escape" && !e\.defaultPrevented/);
  });
});
