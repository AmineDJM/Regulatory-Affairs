import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { adaptateurPptx } from "@/lib/artifact/adapters/pptx/adapter";
import { pptxDiapos } from "@/lib/artifact/adapters/fixtures";
import { commande } from "@/lib/artifact/commands/ir";
import type { PptxModel } from "@/lib/artifact/object-model/model";

/**
 * AJOUTER UNE DIAPOSITIVE « une idée » — dans la disposition de ses voisines, avec la charte du
 * masque, sans regénérer la présentation. Vérifié sur le fichier RELU : la pièce, ses relations,
 * sa déclaration de type et sa place dans la liste.
 */
describe("pptx.ajouter_diapo", () => {
  it("insère un titre + des puces après la diapo 2, et la présentation se relit avec 5 diapos dans le bon ordre", async () => {
    const doc = await adaptateurPptx.ouvrir(await pptxDiapos(4));
    const e = doc.appliquer(commande("pptx.ajouter_diapo", { diapo: 2, nom: "Une idée par diapositive", texte: "- Premier point\n- Deuxième point\n- Troisième point" }));
    expect(e.ok, e.motif ?? "").toBe(true);
    expect(e.resume).toMatch(/ajoutée en position 3 \(3 puces\)/);
    const m = doc.modele() as PptxModel;
    expect(m.slides).toHaveLength(5);
    expect(m.slides[2].title).toBe("Une idée par diapositive");
    expect(m.slides[2].shapes.map((s) => s.text)).toEqual(["Une idée par diapositive", "Premier point\nDeuxième point\nTroisième point"]);
    expect(m.slides[3].title).toBe("Diapositive 3");

    const octets = await doc.serialiser();
    const relu = await adaptateurPptx.ouvrir(octets);
    const rm = relu.modele() as PptxModel;
    expect(rm.slides.map((s) => s.title)).toEqual(["Diapositive 1", "Diapositive 2", "Une idée par diapositive", "Diapositive 3", "Diapositive 4"]);
    const zip = new PizZip(octets);
    expect(zip.file("ppt/slides/slide5.xml")).toBeTruthy();
    expect(zip.file("ppt/slides/_rels/slide5.xml.rels")!.asText()).toMatch(/slideLayout/);
    expect(zip.file("[Content_Types].xml")!.asText()).toMatch(/\/ppt\/slides\/slide5\.xml/);
    expect((await relu.valider()).ok).toBe(true);
  });

  it("sans référence, ajoute à la fin ; « avant » la première la met en tête ; une centaine d'ajouts reste rapide", async () => {
    const doc = await adaptateurPptx.ouvrir(await pptxDiapos(2));
    doc.appliquer(commande("pptx.ajouter_diapo", { nom: "Fin", texte: "conclusion" }));
    doc.appliquer(commande("pptx.ajouter_diapo", { diapo: 1, position: "avant", nom: "Début", texte: null }));
    let m = doc.modele() as PptxModel;
    expect(m.slides.map((s) => s.title)).toEqual(["Début", "Diapositive 1", "Diapositive 2", "Fin"]);
    const t = performance.now();
    for (let i = 1; i <= 100; i++) {
      const e = doc.appliquer(commande("pptx.ajouter_diapo", { nom: `Idée ${i}`, texte: `Point A de ${i}\nPoint B de ${i}` }));
      expect(e.ok).toBe(true);
    }
    const ms = performance.now() - t;
    m = doc.modele() as PptxModel;
    expect(m.slides).toHaveLength(104);
    expect(m.slides[103].title).toBe("Idée 100");
    expect(ms).toBeLessThan(5_000);
    const relu = await adaptateurPptx.ouvrir(await doc.serialiser());
    expect((relu.modele() as PptxModel).slides).toHaveLength(104);
  });

  it("refuse une diapositive de référence inexistante et une commande sans titre ni contenu", async () => {
    const doc = await adaptateurPptx.ouvrir(await pptxDiapos(2));
    expect(doc.appliquer(commande("pptx.ajouter_diapo", { diapo: 9, nom: "x" })).ok).toBe(false);
    const { verifierCommande } = await import("@/lib/artifact/commands/compile");
    expect(verifierCommande(commande("pptx.ajouter_diapo", {}), "PPTX")).toMatch(/au moins un titre/);
    expect(verifierCommande(commande("pptx.ajouter_diapo", { nom: "x" }), "DOCX")).toMatch(/ne s'applique pas/);
  });
});
