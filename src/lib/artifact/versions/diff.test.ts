import { describe, expect, it } from "vitest";
import { alignerSequences, comparer, fragmentModifie } from "@/lib/artifact/versions/diff";
import { adaptateurDocx } from "@/lib/artifact/adapters/docx/adapter";
import { adaptateurPptx } from "@/lib/artifact/adapters/pptx/adapter";
import { adaptateurPdf } from "@/lib/artifact/adapters/pdf/adapter";
import { docxDeParagraphes, pdfNumerote, pptxDiapos } from "@/lib/artifact/adapters/fixtures";
import { cibleIndex, commande } from "@/lib/artifact/commands/ir";

/**
 * LA COMPARAISON ALIGNÉE — un paragraphe inséré au milieu de deux cents est UN changement, pas
 * deux cents « textes modifiés ». Vérifié sur de vrais fichiers, avant et après édition par les
 * adaptateurs eux-mêmes.
 */
describe("comparer deux versions d'un document", () => {
  it("aligne les paragraphes par leur contenu : insertion + modification + suppression → trois changements", async () => {
    const textes = Array.from({ length: 200 }, (_, i) => `Paragraphe ${i + 1} du contrat, avec ses conditions particulières.`);
    const doc = await adaptateurDocx.ouvrir(await docxDeParagraphes(textes));
    const avant = doc.modele();
    doc.appliquer(commande("docx.inserer_paragraphe", { cible: cibleIndex(50), texte: "Clause insérée après le 50.", position: "apres" }));
    doc.appliquer(commande("docx.texte", { cible: cibleIndex(120), texte: "Paragraphe 119 du contrat, avec ses conditions générales." }));
    doc.appliquer(commande("docx.supprimer_paragraphe", { cible: cibleIndex(180) }));
    const c = comparer(avant, doc.modele());
    expect(c.ok).toBe(true);
    expect(c.changements.map((x) => [x.nature, x.objet, x.quoi])).toEqual([
      ["suppression", "¶179", "paragraphe supprimé"],
      ["ajout", "¶51 (page 2)", "paragraphe ajouté"],
      ["texte", "¶120 (page 4)", "texte modifié : « particulières. » → « générales. »"],
    ]);
    expect(c.resume).toBe("1 suppression, 1 ajout, 1 texte modifié.");
  });

  it("aligne les diapositives : une insérée au milieu, une déplacée, un texte changé", async () => {
    const doc = await adaptateurPptx.ouvrir(await pptxDiapos(6));
    const avant = doc.modele();
    doc.appliquer(commande("pptx.ajouter_diapo", { diapo: 2, nom: "Nouvelle idée", texte: "un point" }));
    doc.appliquer(commande("pptx.texte", { diapo: 6, cible: cibleIndex(1), texte: "Diapositive 5 revue" }));
    const c = comparer(avant, doc.modele());
    expect(c.changements.map((x) => [x.nature, x.objet])).toEqual([
      ["ajout", "présentation"],
      ["ajout", "diapo 3"],
      ["texte", "diapo 6 · Text 0"],
    ]);
    expect(c.changements[2].quoi).toBe("texte modifié : « ∅ » → « revue »");
  });

  it("dit QUELLES pages d'un PDF ont été retirées, alignées par leur texte", async () => {
    const doc = await adaptateurPdf.ouvrir(await pdfNumerote(30));
    const avant = doc.modele();
    doc.appliquer(commande("pdf.supprimer_pages", { pages: [3, 17, 28] }));
    const c = comparer(avant, doc.modele());
    expect(c.changements.map((x) => x.quoi)).toEqual(["30 → 27 pages", "pages retirées : 3, 17, 28"]);
  });

  it("outils : l'alignement patience et le fragment modifié", () => {
    expect(alignerSequences(["a", "b", "c", "d"], ["a", "x", "b", "c", "d"])).toEqual({ paires: [[0, 0], [1, 2], [2, 3], [3, 4]], seulsA: [], seulsB: [1] });
    expect(alignerSequences(["a", "b", "c"], ["a", "c"])).toEqual({ paires: [[0, 0], [2, 1]], seulsA: [1], seulsB: [] });
    expect(alignerSequences(["", "", ""], ["", ""])).toEqual({ paires: [[0, 0], [1, 1]], seulsA: [2], seulsB: [] });
    expect(fragmentModifie("Article 2 — Durée", "Article 2 — Durée et renouvellement")).toEqual({ avant: "", apres: "et renouvellement" });
    expect(fragmentModifie("Le prix est de 100 DZD.", "Le prix est de 120 DZD.")).toEqual({ avant: "100", apres: "120" });
  });
});
