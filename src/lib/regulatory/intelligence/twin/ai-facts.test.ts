import { describe, it, expect } from "vitest";
import { extractFactsWithAI, type AiFn, type AiFactDoc } from "./ai-facts";

const DOC: AiFactDoc = {
  documentId: "doc1",
  sectionCode: "1.3",
  ctdTitle: "RCP",
  text: "RÉSUMÉ DES CARACTÉRISTIQUES DU PRODUIT. Indications thérapeutiques : traitement de l'hypertension artérielle essentielle chez l'adulte. Composition : chaque comprimé contient 10 mg d'amlodipine.",
};

const mockAi = (payload: unknown): AiFn => async () => ({ ok: true, configured: true, text: JSON.stringify(payload) });

describe("extractFactsWithAI — compréhension IA sourcée & ancrée (jamais d'invention)", () => {
  it("retient un fait dont la preuve figure EXACTEMENT dans le document (méthode « ai »)", async () => {
    const ai = mockAi({ facts: [{ factKey: "INDICATION", value: "Hypertension artérielle essentielle", evidence: "traitement de l'hypertension artérielle essentielle chez l'adulte", documentIndex: 1, confidence: 0.9 }] });
    const hits = await extractFactsWithAI([DOC], ai);
    expect(hits).toHaveLength(1);
    expect(hits[0].factKey).toBe("INDICATION");
    expect(hits[0].method).toBe("ai");
    expect(hits[0].documentId).toBe("doc1");
    expect(hits[0].sectionCode).toBe("1.3");
  });

  it("PLAFONNE la confiance des propositions IA (déterministe prioritaire à valeur égale)", async () => {
    const ai = mockAi({ facts: [{ factKey: "INN", value: "Amlodipine", evidence: "10 mg d'amlodipine", documentIndex: 1, confidence: 0.99 }] });
    const hits = await extractFactsWithAI([DOC], ai);
    expect(hits).toHaveLength(1);
    expect(hits[0].confidence).toBeLessThanOrEqual(0.7);
  });

  it("ÉCARTE un fait dont la preuve n'est PAS dans le document (anti-hallucination)", async () => {
    const ai = mockAi({ facts: [{ factKey: "INDICATION", value: "Diabète de type 2", evidence: "indiqué dans le traitement du diabète de type 2", documentIndex: 1, confidence: 0.9 }] });
    const hits = await extractFactsWithAI([DOC], ai);
    expect(hits).toHaveLength(0);
  });

  it("ÉCARTE une clé de fait hors catalogue", async () => {
    const ai = mockAi({ facts: [{ factKey: "PRIX_PUBLIC", value: "500 DZD", evidence: "amlodipine", documentIndex: 1, confidence: 0.9 }] });
    const hits = await extractFactsWithAI([DOC], ai);
    expect(hits).toHaveLength(0);
  });

  it("ÉCARTE un documentIndex invalide", async () => {
    const ai = mockAi({ facts: [{ factKey: "INN", value: "Amlodipine", evidence: "10 mg d'amlodipine", documentIndex: 5, confidence: 0.9 }] });
    const hits = await extractFactsWithAI([DOC], ai);
    expect(hits).toHaveLength(0);
  });

  it("renvoie [] si l'IA échoue (jamais de throw)", async () => {
    const failing: AiFn = async () => ({ ok: false, configured: true, error: "boom" });
    expect(await extractFactsWithAI([DOC], failing)).toEqual([]);
  });

  it("renvoie [] pour une sortie non JSON", async () => {
    const garbage: AiFn = async () => ({ ok: true, configured: true, text: "désolé, je ne peux pas" });
    expect(await extractFactsWithAI([DOC], garbage)).toEqual([]);
  });

  it("renvoie [] sans document exploitable", async () => {
    const ai = mockAi({ facts: [] });
    expect(await extractFactsWithAI([], ai)).toEqual([]);
  });
});
