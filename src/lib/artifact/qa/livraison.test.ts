import { describe, expect, it } from "vitest";
import { controlerAvantLivraison } from "@/lib/artifact/qa/checks";
import type { DocxModel, PptxModel } from "@/lib/artifact/object-model/model";
import { STYLE_NEUTRE } from "@/lib/artifact/object-model/model";

const para = (index: number, text: string, headingLevel: number | null = null, page: number | null = null) => ({
  id: `p${index}`, index, text, alignment: null, styleName: headingLevel ? `Heading${headingLevel}` : null,
  style: { ...STYLE_NEUTRE, sizePt: 11 }, runs: [], indentLeftCm: null, indentRightCm: null, spacingBeforePt: null, spacingAfterPt: null,
  inTable: false, images: [], page, headingLevel,
});
const docx = (paragraphs: ReturnType<typeof para>[]): DocxModel => ({
  kind: "DOCX", paragraphs, tables: [], images: [], pageWidthCm: 21, pageHeightCm: 29.7,
  marginTopCm: 2.5, marginBottomCm: 2.5, marginLeftCm: 2.5, marginRightCm: 2.5, hasHeader: false, hasFooter: false,
  pages: 1, paginationSource: "estimee", plan: [],
});
const forme = (i: number, text: string, extra: Partial<PptxModel["slides"][0]["shapes"][0]> = {}) => ({
  id: `sh${i}`, index: i, name: `Forme ${i}`, xCm: 1, yCm: 1 + i * 3, widthCm: 20, heightCm: 2.5, text,
  style: { ...STYLE_NEUTRE, sizePt: 18 }, alignment: null, role: "text" as const, ...extra,
});
const pptx = (diapos: { titre: string; corps?: string }[]): PptxModel => ({
  kind: "PPTX", slideWidthCm: 33.87, slideHeightCm: 19.05,
  slides: diapos.map((d, i) => ({ id: `s${i + 1}`, index: i + 1, title: d.titre, shapes: [forme(1, d.titre), ...(d.corps !== undefined ? [forme(2, d.corps)] : [])] })),
});

describe("le contrôle avant livraison", () => {
  it("bloque un reste de brouillon dans un Word, avertit d'une section vide et d'un trou de numérotation", () => {
    const c = controlerAvantLivraison(docx([
      para(1, "Article 1 — Objet", 1, 1), para(2, "Le prestataire fournit…", null, 1),
      para(3, "Article 2 — Durée", 1, 1), para(4, "Article 4 — Prix", 1, 2),
      para(5, "Le prix est de [montant] DZD, payable à réception.", null, 2),
      para(6, "Signature : XXX", null, 2),
    ]));
    expect(c.ok).toBe(false);
    expect(c.bloquants).toEqual([
      "¶5 (page 2) contient un reste de brouillon « [montant] » : Le prix est de [montant] DZD, payable à réception.",
      "¶6 (page 2) contient un reste de brouillon « XXX » : Signature : XXX",
    ]);
    expect(c.avertissements).toEqual([
      "La section « Article 2 — Durée » (¶3) n'a aucun contenu avant le titre suivant.",
      "La numérotation des articles saute de 2 à 4 (¶4).",
    ]);
  });

  it("laisse passer un Word propre", () => {
    const c = controlerAvantLivraison(docx([para(1, "Contrat", 1), para(2, "Article 1 — Objet", 2), para(3, "Texte."), para(4, "Article 2 — Durée", 2), para(5, "Un an.")]));
    expect(c).toEqual({ bloquants: [], avertissements: [], ok: true });
  });

  it("applique « une idée par diapositive » : titre obligatoire, puces bornées, espaces réservés remplis, titres uniques", () => {
    const c = controlerAvantLivraison(pptx([
      { titre: "Résultats 2026", corps: "CA +12 %\nMarge +3 pts" },
      { titre: "", corps: "Une diapo sans titre" },
      { titre: "Plan", corps: Array.from({ length: 9 }, (_, i) => `Point ${i + 1}`).join("\n") },
      { titre: "Résultats 2026", corps: "Cliquez pour ajouter du texte" },
      { titre: "Une idée qui prend vraiment beaucoup trop de mots pour tenir dans un seul titre de diapositive lisible", corps: "ok" },
      { titre: "Seule" },
    ]));
    expect(c.ok).toBe(false);
    expect(c.bloquants).toEqual([
      "Diapo 2 : pas de titre.",
      "Diapo 4 : un espace réservé n'a pas été rempli (« Cliquez pour ajouter du texte »).",
    ]);
    expect(c.avertissements).toContain("Diapo 3, « Forme 2 » : 9 lignes — au-delà de 7, personne ne lit.");
    expect(c.avertissements).toContain("Diapo 5 : le titre fait 18 mots — une idée par diapositive tient en une ligne.");
    expect(c.avertissements).toContain("Diapo 6 : rien d'autre que le titre.");
    expect(c.avertissements).toContain("Le titre « résultats 2026 » revient sur les diapos 1, 4.");
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN RESTE DE BROUILLON DANS UN TABLEAU DE DIAPOSITIVE — le trou qu'on vient de fermer.
 *
 * Le Word inspecte ses cellules de tableau depuis toujours. Le PowerPoint ne pouvait PAS : une
 * forme ordinaire porte un `p:txBody`, un tableau (`p:graphicFrame` → `a:tbl`) porte un
 * `a:txBody` par CELLULE, et l'adaptateur ne lisait que le premier. Tout tableau de diapositive
 * arrivait donc au contrôle avec `text: ""`. Un « [à compléter] » ou un « {{client}} » posé dans
 * un tableau passait la porte et partait en comité — dans le SEUL format qu'on projette devant
 * une assemblée.
 *
 * CE QUI FERAIT TOMBER CE TEST : revenir à un seul corps de texte par forme. L'assertion tombe
 * sur le tableau, pas sur le texte, exactement là où le trou était.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("le contrôle voit DANS les tableaux d'une diapositive", () => {
  const avecTableau = (texteTableau: string): PptxModel => ({
    kind: "PPTX", slideWidthCm: 33.87, slideHeightCm: 19.05,
    slides: [{
      id: "s1", index: 1, title: "Ventes 2026",
      shapes: [
        forme(1, "Ventes 2026"),
        forme(2, "Le portefeuille progresse."),
        forme(3, texteTableau, { role: "table", heightCm: 8 }),
      ],
    }],
  });

  it("bloque un « [à compléter] » qui n'est QUE dans le tableau", () => {
    const c = controlerAvantLivraison(avecTableau("Produit\nCA\nNivolex\n[à compléter]\nTrastuzex\n91000"));
    expect(c.ok, "un tableau à trous part en comité").toBe(false);
    expect(c.bloquants.join(" ")).toContain("à compléter");
  });

  it("un tableau bien rempli ne déclenche AUCUNE règle de puces", () => {
    // Douze lignes de tableau ne sont pas « douze puces que personne ne lira » : les règles
    // éditoriales parlent de corps de texte. Les confondre remplirait le rapport d'un
    // avertissement par diapositive de données — et on cesserait de le lire (§118.32).
    const lignes = Array.from({ length: 12 }, (_, i) => `Produit ${i + 1}\n${1000 + i}`).join("\n");
    const c = controlerAvantLivraison(avecTableau(`Produit\nCA\n${lignes}`));
    expect(c.ok).toBe(true);
    expect(c.avertissements.filter((a) => /puce|lignes —|illisible/.test(a))).toEqual([]);
  });
});
