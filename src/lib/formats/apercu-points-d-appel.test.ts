import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Points d'appel (§118.49) : les écrans lisent la table UNIQUE des aperçus, ils n'ont plus leur propre liste. */
const lire = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("l'aperçu universel — une table, tous les écrans", () => {
  it("la fenêtre des documents et la visionneuse du Drive montent le MÊME composant", () => {
    expect(lire("src/components/documents/document-preview.tsx")).toContain("<ApercuUniversel");
    expect(lire("src/app/(app)/drive/[id]/file-viewer.tsx")).toContain("<ApercuUniversel");
  });

  it("plus aucune liste d'extensions locale dans ces écrans", () => {
    expect(lire("src/components/documents/document-preview.tsx")).not.toMatch(/const (IMAGE|TEXTLIKE) = \[/);
    expect(lire("src/components/documents/document-preview.tsx")).not.toContain("kindFromName");
    expect(lire("src/components/documents/zip-viewer.tsx")).not.toMatch(/\["png", "jpg"/);
  });

  it("les anciens formats passent par une route d'aperçu PDF, gardée par les droits du fichier", () => {
    for (const rel of ["src/app/api/documents/[id]/apercu/route.ts", "src/app/api/drive/[id]/apercu/route.ts"]) {
      expect(existsSync(join(process.cwd(), rel)), rel).toBe(true);
      const src = lire(rel);
      expect(src, rel).toContain("getCurrentUser()");
      expect(src.indexOf("getCurrentUser()"), rel).toBeLessThan(src.indexOf("pdfDApercu("));
      expect(src, rel).toMatch(/canAccessEntity|canViewDrive/);
    }
  });

  it("Word, Excel et PowerPoint passent par le serveur d'abord ; la visionneuse du navigateur n'est que le secours", () => {
    const src = lire("src/components/documents/apercu-universel.tsx");
    for (const v of ["DocxView", "XlsxView", "PptxView"]) {
      expect(src, v).toMatch(new RegExp(`<VueConvertie[^>]*secours=\\{<${v} `));
    }
    expect(lire("src/app/api/drive/[id]/apercu/route.ts")).toContain("apercuParServeur(");
    expect(lire("src/app/api/documents/[id]/apercu/route.ts")).toContain("apercuParServeur(");
  });

  it("le dossier envoyé en messagerie est archivé par le serveur : plus de JSZip dans le navigateur", () => {
    expect(lire("src/app/(app)/messages/composer.tsx")).not.toContain("jszip");
    expect(lire("src/app/(app)/messages/composer.tsx")).toContain("/api/messaging/upload-dossier");
    const route = lire("src/app/api/messaging/upload-dossier/route.ts");
    expect(route).toContain("ecrireZip(");
    expect(route).toContain("getCurrentUserPourEcrire()");
    expect(route).toContain("canAccessConversation(");
  });

  it("l'HTML d'un tiers ne s'exécute jamais dans l'application (cadre isolé)", () => {
    expect(lire("src/components/documents/apercu-universel.tsx")).toContain('sandbox=""');
  });

  it("le lien de téléchargement d'une entrée de ZIP vise la route de l'archive, pas le nom du fichier", () => {
    const zip = lire("src/components/documents/zip-viewer.tsx");
    expect(zip).not.toContain("title={base}");
    expect(zip).toContain("const nom = e.path.split");
  });
});
