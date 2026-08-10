import { describe, it, expect, vi } from "vitest";
import {
  isAmbiguous, selectAmbiguousFacts, buildArbitrationPrompt, parseArbitration, arbitrateAmbiguousFacts,
  type AmbiguousFact,
} from "./arbitrate-facts";

/**
 * Arbitrage contextuel des faits en conflit : sélection (seuls les scores SERRÉS montent à
 * l'IA), consigne (extraits = donnée non fiable, pièges nommés), réponse assainie (le choix DOIT
 * être un candidat existant, 0 = abstention), et bout-en-bout avec IA injectée sur le cas réel
 * (comparateur Epzicom vs trithérapie du dossier).
 */

const strengthFact: AmbiguousFact = {
  factKey: "STRENGTH",
  label: "Dosage / teneur",
  candidates: [
    { rep: "600 mg and 300 mg", score: 1.4, extracts: ["…fixed-dose combination of 600 mg and 300 mg, respectively (Epzicom or Kivexa, ViiV Healthcare)…"] },
    { rep: "600MG, LAMIVUDINE 300MG & DOLUTEGRAVIR 50MG", score: 0.9, extracts: ["MCNEIL AND ARGUS PHARMACEUTICALS LIMITED ABACAVIR 600MG, LAMIVUDINE 300MG & DOLUTEGRAVIR 50MG TABLETS"] },
  ],
};

describe("isAmbiguous / selectAmbiguousFacts", () => {
  it("un fait est ambigu quand la tête ne double pas le second — sinon le déterministe suffit", () => {
    expect(isAmbiguous([{ score: 1.4 }, { score: 0.9 }])).toBe(true);
    expect(isAmbiguous([{ score: 3.0 }, { score: 0.9 }])).toBe(false); // domination nette
    expect(isAmbiguous([{ score: 1.0 }])).toBe(false); // valeur unique
  });

  it("sélectionne les plus serrés d'abord et borne candidats/extraits", () => {
    const wide: AmbiguousFact = { factKey: "INN", label: "DCI", candidates: [{ rep: "a", score: 1.9, extracts: [] }, { rep: "b", score: 1.0, extracts: [] }] };
    const tight: AmbiguousFact = { factKey: "STRENGTH", label: "Dosage", candidates: [{ rep: "x", score: 1.05, extracts: ["e".repeat(500), "f", "g"] }, { rep: "y", score: 1.0, extracts: [] }] };
    const out = selectAmbiguousFacts([wide, tight]);
    expect(out.map((f) => f.factKey)).toEqual(["STRENGTH", "INN"]); // ratio 1,05 avant 1,9
    expect(out[0].candidates[0].extracts).toHaveLength(2); // extraits bornés
    expect(out[0].candidates[0].extracts[0].length).toBeLessThanOrEqual(260);
  });
});

describe("buildArbitrationPrompt / parseArbitration", () => {
  it("la consigne encadre les extraits comme NON FIABLES et numérote les candidats", () => {
    const p = buildArbitrationPrompt({ title: "Triumeq — enregistrement", reference: "REG-2026-7655E7" }, [strengthFact]);
    expect(p).toContain("Triumeq");
    expect(p).toContain("NON_FIABLES");
    expect(p).toContain("1. « 600 mg and 300 mg »");
    expect(p).toContain("2. « 600MG, LAMIVUDINE 300MG & DOLUTEGRAVIR 50MG »");
  });

  it("réponse assainie : indice hors bornes ou fait inconnu écartés, 0 = abstention", () => {
    const out = parseArbitration(
      { choix: [{ fait: "STRENGTH", indice: 2 }, { fait: "INCONNU", indice: 1 }, { fait: "STRENGTH", indice: 1 }] },
      [strengthFact],
    );
    expect(out.get("STRENGTH")).toBe("600MG, LAMIVUDINE 300MG & DOLUTEGRAVIR 50MG"); // premier choix retenu, doublon ignoré
    expect(out.size).toBe(1);
    expect(parseArbitration({ choix: [{ fait: "STRENGTH", indice: 0 }] }, [strengthFact]).size).toBe(0); // abstention
    expect(parseArbitration({ nimporte: true }, [strengthFact]).size).toBe(0); // JSON invalide
  });
});

describe("arbitrateAmbiguousFacts — bout en bout (IA injectée)", () => {
  it("cas réel : l'IA lit le contexte et choisit la trithérapie du dossier, pas le comparateur", async () => {
    const aiFn = vi.fn(async (prompt: string) => {
      expect(prompt).toContain("Epzicom"); // le contexte incriminant est bien montré
      return { ok: true, configured: true, text: '{"choix":[{"fait":"STRENGTH","indice":2}]}' };
    });
    const out = await arbitrateAmbiguousFacts({ title: "Triumeq" }, [strengthFact], aiFn);
    expect(out.get("STRENGTH")).toContain("DOLUTEGRAVIR 50MG");
  });

  it("panne IA ou réponse inexploitable → carte vide (le déterministe garde la main), jamais d'exception", async () => {
    expect((await arbitrateAmbiguousFacts({ title: "T" }, [strengthFact], async () => ({ ok: false, configured: true }))).size).toBe(0);
    expect((await arbitrateAmbiguousFacts({ title: "T" }, [strengthFact], async () => ({ ok: true, configured: true, text: "pas du json" }))).size).toBe(0);
    expect((await arbitrateAmbiguousFacts({ title: "T" }, [strengthFact], async () => { throw new Error("boom"); })).size).toBe(0);
    expect((await arbitrateAmbiguousFacts({ title: "T" }, [], vi.fn())).size).toBe(0);
  });
});
