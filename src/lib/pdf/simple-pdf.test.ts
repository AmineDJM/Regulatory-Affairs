import { describe, it, expect } from "vitest";
import { buildSimplePdf, parsePdfBody, wrapText } from "./simple-pdf";

/**
 * Le générateur PDF est PUR : on vérifie la structure du fichier produit (en-tête, xref, EOF),
 * la césure aux largeurs réelles, et l'interprétation du corps structuré — sans moteur de rendu.
 */
describe("simple-pdf — PDF propres sans dépendance", () => {
  it("produit un PDF structurellement valide (en-tête, xref exacte, EOF)", () => {
    const pdf = buildSimplePdf("Note de synthèse", parsePdfBody("# Objet\nRésumé du dossier.\n- premier point\n- second point"));
    const txt = pdf.toString("latin1");
    expect(txt.startsWith("%PDF-1.4")).toBe(true);
    expect(txt.trimEnd().endsWith("%%EOF")).toBe(true);
    // Chaque offset de la table xref pointe exactement sur « N 0 obj ».
    const xref = txt.slice(txt.indexOf("xref"));
    const offsets = [...xref.matchAll(/^(\d{10}) 00000 n /gm)].map((m) => Number(m[1]));
    offsets.forEach((off, i) => {
      expect(txt.slice(off, off + 12)).toMatch(new RegExp(`^${i + 1} 0 obj`));
    });
  });

  it("les accents français passent en WinAnsi (é è à ç)", () => {
    const pdf = buildSimplePdf("Réponse aux réserves — Dolutégravir", [{ type: "paragraph", text: "Validation de la méthode : exactitude, fidélité, spécificité, LOD/LOQ chiffrées." }]);
    const latin = pdf.toString("latin1");
    expect(latin).toContain("R\xE9ponse aux r\xE9serves");
    expect(latin).toContain("sp\xE9cificit\xE9");
  });

  it("wrapText coupe au mot, jamais au milieu, et remplit sans déborder", () => {
    const lines = wrapText("La validation complète de la méthode de dosage des solvants résiduels a été reprise conformément à ICH Q2.", 10.5, 200);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l).not.toMatch(/^\S{0,2}-/); // pas de césure interne
    expect(lines.join(" ")).toContain("solvants résiduels");
  });

  it("parsePdfBody : # → intertitre, - → puce, texte → paragraphe", () => {
    const blocks = parsePdfBody("# Titre A\nUn paragraphe.\n- une puce\n\n# Titre B");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "bullet", "heading"]);
  });

  it("un contenu long pagine (plusieurs pages, pied « n / N » sur chacune)", () => {
    const paras = Array.from({ length: 80 }, (_, i) => `Paragraphe ${i + 1} — texte de remplissage suffisamment long pour occuper une pleine largeur de page et forcer la pagination du document.`);
    const pdf = buildSimplePdf("Document long", paras.map((text) => ({ type: "paragraph" as const, text })));
    const txt = pdf.toString("latin1");
    const pages = (txt.match(/\/Type \/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThan(1);
    expect(txt).toContain(`(1 / ${pages})`);
    expect(txt).toContain(`(${pages} / ${pages})`);
  });
});
