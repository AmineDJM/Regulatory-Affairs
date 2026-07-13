import { describe, it, expect } from "vitest";
import { extractLooseJson } from "./json";

describe("extractLooseJson — extraction tolérante (réponses IA tronquées incluses)", () => {
  it("parse un JSON propre", () => {
    expect(extractLooseJson('{"a":1,"b":[1,2]}')).toEqual({ a: 1, b: [1, 2] });
  });

  it("ignore un préambule et un bloc ```json```", () => {
    const r = extractLooseJson('Voici le résultat :\n```json\n{"overall":"ok","perspectives":[]}\n```\nMerci.');
    expect(r).toEqual({ overall: "ok", perspectives: [] });
  });

  it("répare une réponse TRONQUÉE dans une chaîne (plafond de jetons)", () => {
    const truncated = '{"overall":"synthèse","perspectives":[{"perspective":"Qualité","verdict":"RESERVES","questions":["Préciser la stabil';
    const r = extractLooseJson(truncated) as { perspectives: { perspective: string; verdict: string }[] };
    expect(r).not.toBeNull();
    expect(r.perspectives[0].perspective).toBe("Qualité");
    expect(r.perspectives[0].verdict).toBe("RESERVES");
  });

  it("répare une troncature après une virgule (élément partiel)", () => {
    const truncated = '{"perspectives":[{"perspective":"A","verdict":"FAVORABLE","questions":[]},{"perspective":"B",';
    const r = extractLooseJson(truncated) as { perspectives: { perspective: string }[] };
    expect(r).not.toBeNull();
    expect(r.perspectives.length).toBeGreaterThanOrEqual(1);
    expect(r.perspectives[0].perspective).toBe("A");
  });

  it("renvoie null si aucun objet", () => {
    expect(extractLooseJson("désolé, je ne peux pas répondre")).toBeNull();
  });
});
