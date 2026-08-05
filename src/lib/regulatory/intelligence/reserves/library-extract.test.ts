import { describe, expect, it } from "vitest";
import {
  parseExtraction, normalizeModule, buildTextExtraction, buildVisionExtraction, RESERVE_SCHEMA,
} from "./library-extract";
import { textIsUsable } from "./library-ingest";
import { ruleConfidence } from "./library";

/**
 * L'extraction des réserves ANPP est une chaîne de PREUVE : ce qui en sort peut être opposé à
 * l'agence. Une seule règle compte vraiment — **le verbatim est le texte exact** — et tout le
 * reste doit échouer proprement plutôt que d'inventer.
 */

describe("Réserves ANPP — assainissement de l'extraction", () => {
  it("garde le verbatim EXACT, sans reformulation", () => {
    const exact = "Le certificat d'analyse du lot 2026-A1 n'est pas signé par le pharmacien responsable.";
    const r = parseExtraction({ reserves: [{ verbatim: exact, category: "SIGNATURE_LEGALISATION", severity: "MAJOR" }] });
    expect(r.reserves[0].verbatim).toBe(exact);
  });

  it("ÉCARTE une réserve sans verbatim — sans texte exact, elle n'a aucune valeur probante", () => {
    const r = parseExtraction({
      reserves: [
        { verbatim: "", category: "AUTRE", severity: "MAJOR" },
        { verbatim: "   ", category: "AUTRE", severity: "MAJOR" },
        { verbatim: "Réserve valable sur la stabilité.", category: "STABILITE", severity: "MAJOR" },
      ],
    });
    expect(r.reserves).toHaveLength(1);
    expect(r.reserves[0].verbatim).toContain("stabilité");
  });

  it("retombe sur des valeurs sûres quand le modèle sort du cadre", () => {
    const r = parseExtraction({ reserves: [{ verbatim: "x".repeat(20), category: "CATEGORIE_INVENTEE", severity: "APOCALYPTIQUE" }] });
    expect(r.reserves[0].category).toBe("AUTRE");
    expect(r.reserves[0].severity).toBe("MAJOR");
  });

  it("borne la confiance dans [0, 1] et comble son absence", () => {
    const r = parseExtraction({
      reserves: [
        { verbatim: "a".repeat(20), confidence: 5 },
        { verbatim: "b".repeat(20), confidence: -2 },
        { verbatim: "c".repeat(20) },
      ],
    });
    expect(r.reserves.map((x) => x.confidence)).toEqual([1, 0, 0.5]);
  });

  it("renumérote dans l'ordre du document, quoi qu'ait écrit le modèle", () => {
    const r = parseExtraction({
      reserves: [
        { verbatim: "première".padEnd(20, "."), ordinal: 42 },
        { verbatim: "deuxième".padEnd(20, "."), ordinal: 7 },
      ],
    });
    expect(r.reserves.map((x) => x.ordinal)).toEqual([1, 2]);
  });

  it("n'invente pas d'en-tête produit quand il est absent", () => {
    const r = parseExtraction({ reserves: [{ verbatim: "y".repeat(20) }] });
    expect(r.productName).toBeNull();
    expect(r.dci).toBeNull();
    expect(r.supplier).toBeNull();
  });

  it("survit à une réponse vide ou absurde plutôt que de planter", () => {
    expect(parseExtraction(null).reserves).toEqual([]);
    expect(parseExtraction({}).reserves).toEqual([]);
    expect(parseExtraction({ reserves: "pas un tableau" }).reserves).toEqual([]);
  });
});

describe("Réserves ANPP — normalisation du module CTD", () => {
  it("ramène toutes les écritures à « M3 »", () => {
    for (const v of ["3", "M3", "m3", "Module 3", "MODULE 3", "module  3"]) {
      expect(normalizeModule(v)).toBe("M3");
    }
  });

  it("ne force rien quand il n'y a pas de module lisible", () => {
    expect(normalizeModule(null)).toBeNull();
    expect(normalizeModule("section qualité")).toBeNull();
    expect(normalizeModule("M9")).toBeNull(); // le CTD s'arrête à 5
  });
});

describe("Réserves ANPP — choix du chemin de lecture", () => {
  it("un texte riche se passe de la lecture en image", () => {
    expect(textIsUsable("Le dossier présente une réserve majeure concernant la validation. ".repeat(10), 1)).toBe(true);
  });

  it("un scan mal océrisé déclenche la lecture en image", () => {
    expect(textIsUsable("l| |1 ~~ ..", 3)).toBe(false);          // bruit
    expect(textIsUsable("", 2)).toBe(false);                      // rien
    expect(textIsUsable("a".repeat(300), 5)).toBe(false);         // trop peu par page
    expect(textIsUsable("123456789 ".repeat(60), 1)).toBe(false); // presque aucune lettre
  });
});

describe("Réserves ANPP — construction des consignes", () => {
  it("la consigne texte impose le schéma JSON strict et une température nulle", () => {
    const c = buildTextExtraction("contenu de la lettre", "reserves.pdf");
    expect(c.jsonSchema?.schema).toBe(RESERVE_SCHEMA);
    expect(c.temperature).toBe(0);
    expect(c.user).toContain("reserves.pdf");
    expect(c.images).toBeUndefined();
  });

  it("la consigne « vision » embarque les pages ET dit que l'IMAGE fait foi contre l'OCR", () => {
    const c = buildVisionExtraction([{ buffer: Buffer.from("png") }], "scan.pdf", "ocr approximatif");
    expect(c.images).toHaveLength(1);
    expect(c.user).toContain("IMAGE qui fait foi");
    expect(c.user).toContain("ocr approximatif");
  });
});

describe("Réserves ANPP — confiance d'une règle dérivée", () => {
  it("croît avec les occurrences, mais SATURE — dix fois ne vaut pas dix fois plus sûr", () => {
    expect(ruleConfidence(1, 0, 1)).toBeLessThan(ruleConfidence(3, 0, 1));
    expect(ruleConfidence(3, 0, 1)).toBeLessThan(ruleConfidence(6, 0, 1));
    expect(ruleConfidence(50, 0, 1)).toBe(ruleConfidence(5, 0, 1));
  });

  it("monte quand l'ANPP a RÉITÉRÉ — le reproche est constant", () => {
    expect(ruleConfidence(4, 2, 1)).toBeGreaterThan(ruleConfidence(4, 0, 1));
  });

  it("monte quand le même reproche touche plusieurs produits — règle générale, pas accident", () => {
    expect(ruleConfidence(4, 0, 3)).toBeGreaterThan(ruleConfidence(4, 0, 1));
  });

  it("NE DÉPASSE JAMAIS 0,9 : une règle dérivée reste une observation, pas un texte de loi", () => {
    expect(ruleConfidence(999, 999, 999)).toBeLessThanOrEqual(0.9);
  });
});
