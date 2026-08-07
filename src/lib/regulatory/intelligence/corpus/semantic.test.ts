import { describe, it, expect } from "vitest";
import { cosine, mergeHybrid } from "./semantic";

describe("cosine", () => {
  it("mesure ce qu'on attend d'une similarité", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 2, 3], [2, 4, 6])).toBeCloseTo(1); // colinéaires = identiques au sens
  });

  it("rend 0 sur un vecteur nul plutôt que NaN", () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});

describe("mergeHybrid", () => {
  const mk = (id: string, score: number) => ({ id, score });

  it("favorise la CONVERGENCE sans détrôner un leader net", () => {
    // « both » est MOYEN dans chaque voie mais présent dans les DEUX : le bonus de convergence
    // le fait passer devant un résultat isolé de force comparable — sans écraser les leaders.
    const out = mergeHybrid(
      [mk("both", 0.6), mk("lexOnly", 1.0), mk("lexWeak", 0.55)],
      [mk("both", 0.5), mk("semOnly", 1.0)],
      10,
    );
    const ids = out.map((x) => x.id);
    expect(ids.indexOf("both")).toBeLessThan(ids.indexOf("lexWeak")); // convergence > isolé comparable
    expect(ids.indexOf("lexOnly")).toBeLessThan(ids.indexOf("both")); // un 1.0 net reste devant
    expect(ids.indexOf("semOnly")).toBeLessThan(ids.indexOf("both"));
  });

  it("normalise chaque voie : un rang FTS minuscule n'est pas écrasé par un cosinus 0,8", () => {
    // Les rangs FTS de Postgres sont souvent ~0,05 ; sans normalisation, le sémantique
    // gagnerait toujours — ce serait remplacer le lexical, pas le compléter.
    const out = mergeHybrid([mk("lex", 0.05)], [mk("sem", 0.8)], 10);
    expect(out.map((x) => x.score.toFixed(2))).toEqual(["1.00", "1.00"]);
  });

  it("respecte la limite", () => {
    const many = Array.from({ length: 20 }, (_, i) => mk(`x${i}`, i / 20));
    expect(mergeHybrid(many, [], 5)).toHaveLength(5);
  });
});
