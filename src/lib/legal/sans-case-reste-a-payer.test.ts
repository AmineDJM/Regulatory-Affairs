import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Legal : la case « Reste à payer » du haut de page est retirée (06/10). */
const code = readFileSync(join(process.cwd(), "src/app/(app)/legal/page.tsx"), "utf8")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("Legal : plus de case « Reste à payer »", () => {
  it("la page n'affiche plus la case ni ne lit le total", () => {
    expect(code).not.toContain('label="Reste à payer"');
    expect(code).not.toContain("unpaidTotal");
  });

  it("garde les autres cases (factures à régler, échéance dépassée)", () => {
    expect(code).toContain('label="Factures à régler"');
    expect(code).toContain('label="Échéance dépassée"');
  });
});
