import { describe, expect, it } from "vitest";
import { titreCourt, versDeckExecutif } from "./deck";
import { construireDeckVerifie, verifierSpecDeck } from "@/lib/artifact/decks/build";
import type { ArtefactSpec } from "./spec";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA TRADUCTION DOIT PRODUIRE UNE SPEC LÉGALE — sinon la délégation tue tous les decks.
 *
 * `construireDeckVerifie` REFUSE une spec hors règles : octets vides, `ok: false`. C'est ce qui
 * fait sa valeur, et c'est ce qui rend la traduction responsable. Un test qui se contenterait
 * d'un cas bien élevé ne dirait rien : on pousse donc CHAQUE borne — treize puces, un paragraphe
 * de trois cents mots, un titre de trente mots, quarante lignes, douze colonnes, douze feuilles —
 * et on exige zéro bloquant.
 *
 * CE QUI LE FERAIT TOMBER : traduire en recopiant. Le livrable partirait alors vide dès qu'un
 * modèle est un peu bavard, et l'étape échouerait sur « taille » sans que rien ne dise pourquoi.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const base = (p: Partial<ArtefactSpec> = {}): ArtefactSpec => ({
  key: "k", title: "Revue de portefeuille", format: "PPTX",
  summary: [], sheets: [], charts: [], sources: [], ...p,
});

const feuille = (nom: string, lignes: number, colonnes: number) => ({
  name: nom,
  columns: Array.from({ length: colonnes }, (_, i) => ({ header: `Col ${i + 1}`, key: `c${i}`, type: "text" as const })),
  rows: Array.from({ length: lignes }, (_, r) =>
    Object.fromEntries(Array.from({ length: colonnes }, (_, i) => [`c${i}`, `v${r}-${i}`]))),
});

const mots = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const phrase = (n: number) => Array.from({ length: n }, (_, i) => `mot${i + 1}`).join(" ");

describe("la traduction en deck satisfait les règles du constructeur", () => {
  const cas: [string, ArtefactSpec][] = [
    ["treize puces courtes", base({ summary: [{ heading: "Constats", paragraphs: [], bullets: Array.from({ length: 13 }, (_, i) => `Constat numéro ${i + 1}`) }] })],
    ["un paragraphe de 300 mots", base({ summary: [{ heading: "Analyse", paragraphs: [phrase(300)], bullets: [] }] })],
    ["une puce de 60 mots", base({ summary: [{ heading: "Détail", paragraphs: [], bullets: [phrase(60)] }] })],
    ["un titre de 30 mots", base({ summary: [{ heading: phrase(30), paragraphs: ["Court."], bullets: [] }] })],
    ["une feuille de 40 lignes et 12 colonnes", base({ sheets: [feuille("Ventes", 40, 12)] })],
    ["douze feuilles", base({ sheets: Array.from({ length: 12 }, (_, i) => feuille(`Feuille ${i + 1}`, 3, 2)) })],
    ["vingt sources dont une très longue", base({ summary: [{ heading: "Synthèse", paragraphs: ["Le portefeuille progresse."], bullets: [] }], sources: [...Array.from({ length: 19 }, (_, i) => `Source ${i + 1}`), phrase(80)] })],
    ["des sections au contenu vide", base({ summary: [{ heading: "Titre seul", paragraphs: [], bullets: [] }] })],
    ["tout à la fois", base({
      summary: [{ heading: phrase(20), paragraphs: [phrase(400)], bullets: Array.from({ length: 20 }, (_, i) => `Puce ${i + 1}`) }],
      sheets: Array.from({ length: 9 }, (_, i) => feuille(`F${i + 1}`, 50, 10)),
      sources: ["ERP Adventum"],
    })],
  ];

  for (const [nom, spec] of cas) {
    it(`${nom} : zéro bloquant, et le fichier se construit`, async () => {
      const deck = versDeckExecutif(spec, new Date("2026-09-08T10:00:00Z"));
      expect(verifierSpecDeck(deck).bloquants, `${nom} produit une spec que le constructeur refuse`).toEqual([]);
      const construit = await construireDeckVerifie(deck);
      expect(construit.verification.bloquants).toEqual([]);
      expect(construit.octets.length, "un deck vide part chez le destinataire").toBeGreaterThan(1000);
    });
  }

  it("rien ne disparaît en silence : les puces excédentaires deviennent des diapositives", () => {
    const deck = versDeckExecutif(base({ summary: [{ heading: "Constats", paragraphs: [], bullets: Array.from({ length: 13 }, (_, i) => `Constat ${i + 1}`) }] }));
    expect(deck.diapos).toHaveLength(3);
    expect(deck.diapos.flatMap((d) => d.puces ?? [])).toHaveLength(13);
    expect(deck.diapos[0].titre).toBe("Constats (1/3)");
  });

  it("un tableau coupé DIT sur la diapositive combien de lignes existent", () => {
    const deck = versDeckExecutif(base({ sheets: [feuille("Ventes", 40, 12)] }));
    const d = deck.diapos.find((x) => x.tableau)!;
    expect(d.titre).toContain("12 lignes sur 40");
    expect(d.titre).toContain("8 colonnes sur 12");
    expect(d.tableau!.lignes).toHaveLength(12);
  });

  it("les feuilles qui n'ont pas tenu sont NOMMÉES avec les sources", () => {
    const deck = versDeckExecutif(base({ sheets: Array.from({ length: 12 }, (_, i) => feuille(`Feuille ${i + 1}`, 3, 2)), sources: ["ERP"] }));
    const dites = deck.diapos.flatMap((d) => d.puces ?? []).join(" ");
    expect(dites).toContain("Feuille 12");
    expect(dites).toContain("ERP");
  });

  it("un paragraphe long devient un CORPS, pas une puce de soixante mots", () => {
    const deck = versDeckExecutif(base({ summary: [{ heading: "Analyse", paragraphs: [phrase(60)], bullets: ["Court"] }] }));
    expect(deck.diapos.some((d) => d.texte && mots(d.texte) > 25)).toBe(true);
    expect(deck.diapos.flatMap((d) => d.puces ?? []).every((p) => mots(p) <= 25)).toBe(true);
  });

  describe("un titre tient sur une ligne, et garde son idée", () => {
    it("une première phrase courte est préférée à une troncature", () => {
      expect(titreCourt("Le CA recule de 12 %. " + phrase(40))).toBe("Le CA recule de 12 %");
    });
    it("sans phrase courte, on coupe et on le montre", () => {
      const t = titreCourt(phrase(40));
      expect(mots(t)).toBeLessThanOrEqual(14);
      expect(t.endsWith("…"), "rien ne dit au lecteur que le titre a été coupé").toBe(true);
    });
    it("un titre déjà court n'est pas touché", () => {
      expect(titreCourt("  Ventes  2026 ")).toBe("Ventes 2026");
    });
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN SEUL CONSTRUCTEUR DE DECKS (§118.5) — tenu par un test, pas par une bonne intention.
 *
 * Le deck des missions dessinait ses diapositives à la main pendant que `decks/build.ts` tenait
 * les règles éditoriales comme des bloquants. Les deux ont divergé exactement là où on l'attend :
 * sept puces d'un côté, six de l'autre, pour la même règle. Rien n'empêchait la divergence, donc
 * elle est arrivée ; ce test l'empêche.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("il n'y a qu'un constructeur de decks", () => {
  it("le rendu des missions ne dessine plus de diapositive lui-même", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile("src/lib/missions/artifacts/render.ts", "utf8");
    const code = source.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code, "render.ts redessine un deck au lieu de traduire vers le constructeur unique")
      .not.toContain("pptxgenjs");
    expect(code).not.toContain("addSlide");
    expect(code).toContain("construireDeckVerifie");
  });
});
