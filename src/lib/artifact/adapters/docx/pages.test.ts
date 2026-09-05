import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { adaptateurDocx } from "@/lib/artifact/adapters/docx/adapter";
import { docxDeParagraphes } from "@/lib/artifact/adapters/fixtures";
import { ciblePage, cibleTexte, commande } from "@/lib/artifact/commands/ir";
import type { DocxModel } from "@/lib/artifact/object-model/model";

/**
 * LA CARTE DES PAGES D'UN WORD — celle que Word a enregistrée, ou une estimation qui se dit telle.
 *
 * Un `.docx` ne connaît pas ses pages : c'est Word qui les calcule à l'affichage, et il laisse
 * des marques (`w:lastRenderedPageBreak`) à la sauvegarde. Un fichier produit par un programme
 * n'en a aucune. Les deux cas sont couverts, et le second est ANNONCÉ comme une estimation.
 */

/** Réécrit `word/document.xml` : marques Word toutes les `parPage` paragraphes, et un saut explicite avant un titre. */
async function docxPagine(nb: number, parPage: number, opts: { marquesWord?: boolean; sautAvant?: number } = {}): Promise<Buffer> {
  const textes = Array.from({ length: nb }, (_, i) => (i % 25 === 0 ? `Article ${i / 25 + 1} — Dispositions` : `Paragraphe ${i + 1} : le prestataire s'engage à fournir les services décrits en annexe dans les délais convenus.`));
  const base = await docxDeParagraphes(textes, { premierEstTitre: true });
  const zip = new PizZip(base);
  let xml = zip.file("word/document.xml")!.asText();
  let k = 0;
  xml = xml.replace(/<w:p>(<w:pPr>.*?<\/w:pPr>)?<w:r>/g, (m, pPr: string | undefined) => {
    k += 1;
    const props = pPr ?? "";
    if (opts.sautAvant && k === opts.sautAvant) return `<w:p><w:pPr>${props.replace(/<\/?w:pPr>/g, "")}<w:pageBreakBefore/></w:pPr><w:r>`;
    if (opts.marquesWord !== false && k > 1 && (k - 1) % parPage === 0) return `<w:p>${props}<w:r><w:lastRenderedPageBreak/></w:r><w:r>`;
    return m;
  });
  // Les titres reçoivent Heading1 pour le plan (le fixture ne stylise que le premier).
  xml = xml.replace(/<w:p><w:r><w:t xml:space="preserve">(Article \d+ — Dispositions)<\/w:t>/g, '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">$1</w:t>');
  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

describe("la carte des pages Word", () => {
  it("lit la pagination enregistrée par Word : page de chaque paragraphe, nombre de pages, plan", async () => {
    const doc = await adaptateurDocx.ouvrir(await docxPagine(100, 20));
    const m = doc.modele() as DocxModel;
    expect(m.paginationSource).toBe("word");
    expect(m.pages).toBe(5);
    expect(m.paragraphs[0].page).toBe(1);
    expect(m.paragraphs[19].page).toBe(1);
    expect(m.paragraphs[20].page).toBe(2);
    expect(m.paragraphs[99].page).toBe(5);
    // Le plan : les titres « Article n » avec leur page.
    expect(m.plan.map((e) => [e.texte, e.page])).toEqual([["Article 1 — Dispositions", 1], ["Article 2 — Dispositions", 2], ["Article 3 — Dispositions", 3], ["Article 4 — Dispositions", 4]]);
    expect(m.plan[1].index).toBe(26);
  });

  it("vise « le troisième paragraphe de la page 3 » et « le paragraphe qui parle de … page 4 »", async () => {
    const doc = await adaptateurDocx.ouvrir(await docxPagine(100, 20));
    // Page 3 = paragraphes 41..60 ; le 3e de la page est le ¶43.
    const e1 = doc.appliquer(commande("docx.texte", { cible: ciblePage(3, { index: 3 }), texte: "Réécrit depuis la page 3." }));
    expect(e1.ok, e1.motif ?? "").toBe(true);
    expect(e1.touches).toEqual(["p43"]);
    const m = doc.modele() as DocxModel;
    expect(m.paragraphs[42].text).toBe("Réécrit depuis la page 3.");
    // « Paragraphe 7 » existe une fois par… non : le texte « Paragraphe 61 » n'existe qu'en page 4.
    const e2 = doc.appliquer(commande("docx.align", { cible: ciblePage(4, { contient: "Paragraphe 61" }), alignement: "center" }));
    expect(e2.ok, e2.motif ?? "").toBe(true);
    expect(e2.touches).toEqual(["p61"]);
    // Une page sans ce texte : refus, pas d'à-peu-près.
    const e3 = doc.appliquer(commande("docx.align", { cible: ciblePage(2, { contient: "Paragraphe 61" }), alignement: "center" }));
    expect(e3.ok).toBe(false);
    // Une page seule est AMBIGUË : on rend ses paragraphes, on ne choisit pas.
    const e4 = doc.appliquer(commande("docx.supprimer_paragraphe", { cible: ciblePage(5) }));
    expect(e4.ok).toBe(false);
    expect(e4.candidats.length).toBe(12);
    expect(e4.motif).toMatch(/la page 5 contient 20 paragraphes/);
    // Une page qui n'existe pas.
    const e5 = doc.appliquer(commande("docx.texte", { cible: ciblePage(9, { index: 1 }), texte: "x" }));
    expect(e5.motif).toMatch(/aucun paragraphe ne commence page 9 \(le document en compte 5\)/);
    // Le ciblage par texte seul continue de marcher sans page.
    const e6 = doc.appliquer(commande("docx.align", { cible: cibleTexte("Paragraphe 99"), alignement: "right" }));
    expect(e6.ok).toBe(true);
  });

  it("estime la pagination d'un fichier produit par un programme, et le dit", async () => {
    const doc = await adaptateurDocx.ouvrir(await docxPagine(400, 20, { marquesWord: false, sautAvant: 51 }));
    const m = doc.modele() as DocxModel;
    expect(m.paginationSource).toBe("estimee");
    // 400 paragraphes d'une ligne et demie ≈ 30 lignes par page utile : entre 12 et 30 pages.
    expect(m.pages).toBeGreaterThanOrEqual(12);
    expect(m.pages).toBeLessThanOrEqual(30);
    // Le saut de page explicite avant le ¶51 est respecté : il ouvre une page.
    expect(m.paragraphs[50].page).toBe((m.paragraphs[49].page ?? 0) + 1);
    // Les pages sont croissantes.
    for (let i = 1; i < m.paragraphs.length; i++) expect(m.paragraphs[i].page! >= m.paragraphs[i - 1].page!).toBe(true);
  });

  it("garde la pagination cohérente après une insertion et une suppression", async () => {
    const doc = await adaptateurDocx.ouvrir(await docxPagine(60, 20));
    doc.appliquer(commande("docx.supprimer_paragraphe", { cible: ciblePage(2, { index: 1 }) }));
    let m = doc.modele() as DocxModel;
    expect(m.paragraphs).toHaveLength(59);
    // La marque de page vivait dans le paragraphe supprimé : le suivant hérite de la page 2 ?
    // Non — la marque est PARTIE avec lui ; Word repaginerait. On dit ce qu'on sait : la page 2
    // commence maintenant au premier paragraphe qui porte encore une marque (le ¶41 → ¶40).
    expect(m.pages).toBe(2);
    expect(m.paragraphs[39].page).toBe(2);
    doc.appliquer(commande("docx.inserer_paragraphe", { cible: ciblePage(2, { index: 1 }), texte: "Inséré.", position: "avant" }));
    m = doc.modele() as DocxModel;
    expect(m.paragraphs).toHaveLength(60);
    expect(m.paragraphs.find((p) => p.text === "Inséré.")?.page).toBe(1);
  });
});
