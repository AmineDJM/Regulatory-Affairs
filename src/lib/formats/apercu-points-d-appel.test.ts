import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Points d'appel (§118.49) : les écrans lisent la table UNIQUE des aperçus, ils n'ont plus leur propre liste. */
const lire = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("l'aperçu universel — une table, tous les écrans", () => {
  it("la fenêtre des documents et la visionneuse du Drive montent le MÊME composant, sur leur cible", () => {
    expect(lire("src/components/documents/document-preview.tsx")).toMatch(/<ApercuUniversel[^>]*cible=\{srcOverride \? undefined : \{ type: "document", id \}\}/);
    expect(lire("src/app/(app)/drive/[id]/file-viewer.tsx")).toMatch(/<ApercuUniversel[^>]*cible=\{\{ type: "drive", id \}\}/);
  });

  it("plus aucune liste d'extensions locale dans ces écrans", () => {
    expect(lire("src/components/documents/document-preview.tsx")).not.toMatch(/const (IMAGE|TEXTLIKE) = \[/);
    expect(lire("src/components/documents/document-preview.tsx")).not.toContain("kindFromName");
    expect(lire("src/components/documents/zip-viewer.tsx")).not.toMatch(/\["png", "jpg"/);
  });

  it("Word, Excel, PowerPoint et leurs anciens formats s'ouvrent DANS L'ÉDITEUR OFFICE — la visionneuse du navigateur n'est que le secours", () => {
    const src = lire("src/components/documents/apercu-universel.tsx");
    expect(src).toContain("<EditeurEnLigne");
    for (const v of ["DocxView", "XlsxView", "PptxView"]) expect(src, v).toContain(`<${v} `);
    // Plus de conversion en PDF : on ouvre le document tel qu'il est.
    expect(src).not.toMatch(/apercuSrc|\/apercu`|VueConvertie/);
    expect(existsSync(join(process.cwd(), "src/lib/apercu-pdf.ts"))).toBe(false);
  });

  it("les droits de l'éditeur se jugent côté serveur, avant toute configuration", () => {
    const route = lire("src/app/api/onlyoffice/session/route.ts");
    expect(route).toContain("getCurrentUser()");
    expect(route.indexOf("getCurrentUser()")).toBeLessThan(route.indexOf("sessionEditeur("));
    const lib = lire("src/lib/onlyoffice-session.ts");
    expect(lib).toMatch(/canViewDrive\(acces\)/);
    expect(lib).toContain('canAccessEntity(user, doc.entityType, doc.entityId, "VIEW")');
    expect(lib).toContain('canAccessEntity(user, doc.entityType, doc.entityId, "UPLOAD")');
    // Lecture seule tant que le droit de modifier ou le format réécrivable manque.
    expect(lib).toContain('peutModifier && modifiable ? "edit" : "view"');
  });

  it("le texte se lit (GET) et s'enregistre (POST) sur le serveur : routes gardées, conflit détecté", () => {
    for (const kind of ["documents", "drive"]) {
      const lecture = lire(`src/app/api/${kind}/[id]/texte/route.ts`);
      expect(lecture, kind).toContain("export async function GET");
      expect(lecture, kind).not.toContain("getCurrentUserPourEcrire");
      const ecriture = lire(`src/app/api/${kind}/[id]/texte/enregistrer/route.ts`);
      expect(ecriture, kind).toContain("export async function POST");
      expect(ecriture, kind).toContain("getCurrentUserPourEcrire()");
      expect(ecriture, kind).toContain("status: 409");
      expect(ecriture, kind).not.toContain("getCurrentUser()");
    }
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
