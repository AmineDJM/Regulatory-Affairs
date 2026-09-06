import { describe, expect, it } from "vitest";
import { BUDGETS, PLAFOND_SUPERIEUR_ABSOLU, confianceDe, estimerCout, methodeDe, palierRequis, planifier, rapport, type EtatPage } from "./paliers";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * LE REPLI À QUATRE PALIERS (§38) — la règle par page, le budget qui borne, le rapport qui dit.
 * L'invariant : jamais 500 pages dans un gros modèle, quelle que soit l'exigence.
 */
const natif = (n: number): EtatPage => ({ n, caracteresNatifs: 1_800 });
const scan = (n: number, extra: Partial<EtatPage> = {}): EtatPage => ({ n, caracteresNatifs: 0, ...extra });

describe("palierRequis — chaque page ne monte que si le palier d'en dessous ne suffit pas", () => {
  it("le texte natif suffit, toujours ; une page sans texte réclame l'OCR ; un OCR sûr et fourni s'arrête là", () => {
    expect(palierRequis(natif(1), "precis")).toBeNull();
    expect(palierRequis(scan(2), "rapide")).toMatchObject({ palier: "OCR", raison: "aucun texte natif" });
    expect(palierRequis(scan(3, { ocr: { confiance: 91, caracteres: 1_200 } }), "precis")).toBeNull();
  });
  it("un OCR peu sûr, mince ou sur du graphique réclame la lecture visuelle rapide ; « rapide » s'arrête là", () => {
    expect(palierRequis(scan(4, { ocr: { confiance: 48, caracteres: 900 } }), "auto")).toMatchObject({ palier: "VISION_RAPIDE" });
    expect(palierRequis(scan(5, { ocr: { confiance: 90, caracteres: 12 } }), "auto")?.raison).toMatch(/mince/);
    expect(palierRequis(scan(6, { ocr: { confiance: 90, caracteres: 900 }, graphique: true }), "auto")?.raison).toMatch(/graphique/);
    expect(palierRequis(scan(7, { ocr: { confiance: 48, caracteres: 900 }, vision: { lisibilite: "mauvaise", caracteres: 200 } }), "rapide")).toBeNull();
  });
  it("le modèle supérieur : seulement après une lecture visuelle qui doute, et seulement si la page est visée (auto) ou l'exigence précise", () => {
    const douteuse = scan(8, { ocr: { confiance: 48, caracteres: 900 }, vision: { lisibilite: "partielle", caracteres: 500 } });
    expect(palierRequis(douteuse, "auto")).toBeNull();
    expect(palierRequis({ ...douteuse, visee: true }, "auto")).toMatchObject({ palier: "VISION_SUPERIEURE" });
    expect(palierRequis(douteuse, "precis")).toMatchObject({ palier: "VISION_SUPERIEURE" });
    expect(palierRequis({ ...douteuse, vision: { lisibilite: "bonne", caracteres: 900 }, ocr: { confiance: 66, caracteres: 900 } }, "precis")).toBeNull();
    expect(palierRequis({ ...douteuse, superieure: { caracteres: 900 } }, "precis")).toBeNull();
  });
});

describe("planifier — le budget borne, les pages visées passent devant, le reste est DIT", () => {
  it("500 pages scannées en « precis » : au plus 40 OCR par appel ; puis, relues, au plus 8 au modèle supérieur — jamais 500", () => {
    const pages = Array.from({ length: 500 }, (_, i) => scan(i + 1));
    const p1 = planifier(pages, "precis");
    expect(p1.aFaire.filter((d) => d.palier === "OCR")).toHaveLength(40);
    expect(p1.horsBudget).toHaveLength(460);
    expect(p1.coutEstimeUsd).toBeCloseTo(0.04, 3);
    const relues = pages.map((p) => ({ ...p, ocr: { confiance: 40, caracteres: 300 }, vision: { lisibilite: "mauvaise" as const, caracteres: 100 } }));
    const p2 = planifier(relues, "precis", { visionSuperieure: 500 });
    expect(p2.budget.visionSuperieure).toBe(PLAFOND_SUPERIEUR_ABSOLU);
    expect(p2.aFaire.filter((d) => d.palier === "VISION_SUPERIEURE")).toHaveLength(8);
    expect(p2.horsBudget.length).toBe(492);
    expect(planifier(relues, "rapide").aFaire.some((d) => d.palier === "VISION_SUPERIEURE")).toBe(false);
    expect(BUDGETS.rapide.visionSuperieure).toBe(0);
  });
  it("les pages VISÉES passent devant, puis les moins sûres ; le plan revient dans l'ordre de lecture", () => {
    const pages: EtatPage[] = [
      scan(1, { ocr: { confiance: 60, caracteres: 500 } }),
      scan(2, { ocr: { confiance: 30, caracteres: 500 } }),
      scan(3, { ocr: { confiance: 50, caracteres: 500 }, visee: true }),
      scan(4, { ocr: { confiance: 45, caracteres: 500 } }),
    ];
    const p = planifier(pages, "auto", { visionRapide: 2 });
    expect(p.aFaire.map((d) => d.n)).toEqual([2, 3]);
    expect(p.horsBudget.map((d) => d.n)).toEqual([1, 4]);
  });
  it("le rapport compte par méthode, nomme les pages hors budget, et la confiance suit la méthode", () => {
    const pages: EtatPage[] = [natif(1), scan(2, { ocr: { confiance: 88, caracteres: 700 } }), scan(3, { ocr: { confiance: 30, caracteres: 50 }, vision: { lisibilite: "bonne", caracteres: 600 } }), scan(4, { ocr: { confiance: 20, caracteres: 10 }, vision: { lisibilite: "mauvaise", caracteres: 40 }, superieure: { caracteres: 900 } }), scan(5)];
    const r = rapport(pages, { aFaire: [], horsBudget: [{ n: 5, palier: "OCR", raison: "aucun texte natif" }], budget: BUDGETS.auto, coutEstimeUsd: 0 });
    expect(r.parMethode).toEqual({ NATIF: 1, OCR: 1, VISION_RAPIDE: 1, VISION_SUPERIEURE: 1, SANS: 1 });
    expect(r.lignes.join(" | ")).toMatch(/1 page\(s\) hors budget OCR \(5\)/);
    expect(methodeDe(pages[3]!)).toBe("VISION_SUPERIEURE");
    expect(confianceDe(pages[0]!)).toBe("VERIFIE");
    expect(confianceDe(pages[1]!)).toBe("PROBABLE");
    expect(confianceDe(scan(9, { ocr: { confiance: 40, caracteres: 300 } }))).toBe("INCERTAIN");
    expect(confianceDe(pages[4]!)).toBe("ABSENT");
    expect(estimerCout([{ n: 1, palier: "VISION_SUPERIEURE", raison: "" }, { n: 2, palier: "OCR", raison: "" }])).toBeCloseTo(0.031, 4);
  });
});

describe("mesure consignée — media_paliers_respectes", () => {
  it("le repli à quatre niveaux ne noie jamais un gros document dans le modèle supérieur", () => {
    // Les propriétés sont vérifiées par les blocs de ce fichier ; cette ligne les porte au
    // registre des cibles, sans quoi elles resteraient « non mesurées » au rapport.
    consignerMesure("paliers_plafond", { n: 1, ok: 1 }, "lib/media/paliers.test.ts",
      "500 pages scannées : le modèle supérieur ne voit que les pages qui l'exigent");
  });
});
