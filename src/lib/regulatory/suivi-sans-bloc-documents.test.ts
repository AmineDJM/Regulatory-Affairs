import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Regulatory › suivi de dossier : le bloc « Documents » (zone de dépôt, CTD complet, Interne) est retiré (06/10). */
const code = readFileSync(join(process.cwd(), "src/app/(app)/regulatory/[id]/page.tsx"), "utf8")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("suivi de dossier Regulatory : plus de bloc Documents", () => {
  it("ne monte plus la zone de dépôt ni la carte « Documents »", () => {
    expect(code).not.toContain("<DocumentUpload");
    expect(code).not.toContain("<CardTitle>Documents</CardTitle>");
  });

  it("garde « Dossiers & fichiers » et la CTD initiale", () => {
    expect(code).toContain("Dossiers &amp; fichiers");
    expect(code).toContain("CtdInitiale");
  });
});
