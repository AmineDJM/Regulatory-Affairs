import { describe, it, expect } from "vitest";
import { normalizeSimulation } from "./run";

/**
 * Le message « Sortie non conforme au schéma » venait d'un schéma RIGIDE qui rejetait toute la
 * simulation pour un détail : verdict en minuscules, onzième perspective, question trop longue,
 * `risks` absent. Ces tests prouvent qu'on récupère désormais l'exploitable au lieu de tout jeter.
 */
describe("normalizeSimulation — tolérance de format", () => {
  it("accepte un verdict en minuscules / variante et le normalise", () => {
    const { perspectives } = normalizeSimulation({
      perspectives: [{ perspective: "Qualité", verdict: "réservé / avec réserves", questions: ["Méthode validée ?"], risks: [] }],
    });
    expect(perspectives[0].verdict).toBe("RESERVES");
  });

  it("mappe favorable / défavorable quelle que soit la casse", () => {
    const { perspectives } = normalizeSimulation({
      perspectives: [
        { perspective: "A", verdict: "Favorable", questions: ["q"] },
        { perspective: "B", verdict: "DÉFAVORABLE", risks: ["r"] },
      ],
    });
    expect(perspectives.map((p) => p.verdict)).toEqual(["FAVORABLE", "DEFAVORABLE"]);
  });

  it("ne rejette plus une 11ᵉ perspective — il en garde 12 au plus", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ perspective: `P${i}`, verdict: "RESERVES", questions: [`q${i}`] }));
    const { perspectives } = normalizeSimulation({ perspectives: many });
    expect(perspectives.length).toBe(12);
  });

  it("tronque une question trop longue au lieu de faire échouer toute la sortie", () => {
    const long = "x".repeat(2000);
    const { perspectives } = normalizeSimulation({ perspectives: [{ perspective: "Stab", verdict: "RESERVES", questions: [long] }] });
    expect(perspectives[0].questions[0].length).toBe(400);
  });

  it("supporte `risques`/`questions_probables` (clés françaises) et objets {text}", () => {
    const { perspectives } = normalizeSimulation({
      perspectives: [{ perspective: "Clinique", verdict: "RESERVES", questions_probables: [{ text: "Indication justifiée ?" }], risques: ["Effet indésirable"] }],
    });
    expect(perspectives[0].questions).toEqual(["Indication justifiée ?"]);
    expect(perspectives[0].risks).toEqual(["Effet indésirable"]);
  });

  it("récupère `overall` (ou `synthese`) et le borne", () => {
    expect(normalizeSimulation({ overall: "Bilan.", perspectives: [] }).overall).toBe("Bilan.");
    expect(normalizeSimulation({ synthese: "Autre bilan.", perspectives: [{ perspective: "X", questions: ["q"] }] }).overall).toBe("Autre bilan.");
  });

  it("rend une liste vide (pas une erreur) quand il n'y a vraiment rien", () => {
    expect(normalizeSimulation({}).perspectives).toEqual([]);
    expect(normalizeSimulation("bruit").perspectives).toEqual([]);
    expect(normalizeSimulation(null).perspectives).toEqual([]);
  });
});
