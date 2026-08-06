import { describe, it, expect } from "vitest";
import { findingQuality } from "./enrich";

/**
 * Un constat sert à défendre une position face à l'ANPP. « Section 3.2.P.8 incomplète » ne se
 * défend pas : il faut la règle appliquée et la PIÈCE (document, page, extrait). Ce contrôle
 * rend visible ce qui manque — sans jamais bloquer : un constat incomplet reste un constat.
 */

const FULL = {
  ruleRef: "ANPP-LD-VAR §4.2",
  confidence: 0.82,
  documentId: "doc_1",
  page: 12,
  excerpt: "Le certificat d'analyse ne porte pas la signature du pharmacien responsable.",
  recommendation: "Joindre le CoA signé avant dépôt.",
};

describe("findingQuality", () => {
  it("un constat complet : score plein, rien ne manque, défendable", () => {
    const q = findingQuality(FULL);
    expect(q.score).toBe(1);
    expect(q.missing).toEqual([]);
    expect(q.defensible).toBe(true);
  });

  it("un constat vide : score nul et six manques nommés", () => {
    const q = findingQuality({});
    expect(q.score).toBe(0);
    expect(q.missing).toHaveLength(6);
    expect(q.defensible).toBe(false);
  });

  it("nomme précisément ce qui manque, pour qu'on sache quoi corriger", () => {
    const q = findingQuality({ ...FULL, page: null, excerpt: null });
    expect(q.missing).toEqual(["page", "extrait exact"]);
  });

  it("sans la pièce, ce n'est pas défendable — même si tout le reste est là", () => {
    expect(findingQuality({ ...FULL, page: null }).defensible).toBe(false);
    expect(findingQuality({ ...FULL, excerpt: null }).defensible).toBe(false);
    expect(findingQuality({ ...FULL, documentId: null }).defensible).toBe(false);
    expect(findingQuality({ ...FULL, ruleRef: null }).defensible).toBe(false);
  });

  it("la recommandation améliore le score mais ne conditionne pas la défendabilité", () => {
    const q = findingQuality({ ...FULL, recommendation: null });
    expect(q.defensible).toBe(true);
    expect(q.score).toBeLessThan(1);
  });

  it("la page 0 compte comme une page renseignée — le zéro n'est pas l'absence", () => {
    expect(findingQuality({ ...FULL, page: 0 }).missing).toEqual([]);
  });

  it("une confiance de 0 est une information, pas un manque", () => {
    expect(findingQuality({ ...FULL, confidence: 0 }).missing).toEqual([]);
  });

  it("le score décroît d'un pas régulier par élément manquant", () => {
    expect(findingQuality({ ...FULL, recommendation: null }).score).toBeCloseTo(0.83, 2);
    expect(findingQuality({ ...FULL, recommendation: null, confidence: null }).score).toBeCloseTo(0.67, 2);
  });
});
