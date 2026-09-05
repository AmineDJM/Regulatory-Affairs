import { describe, expect, it } from "vitest";
import { contratDepuisSchema, decrireEntrees, estGabarit, exempleEntree, verifierEntree } from "./input-contract";

const SCHEMA_DECISION = {
  type: "object",
  properties: {
    reference: { type: "string", description: "Référence de l'ordre." },
    decision: { type: "string", enum: ["APPROVE", "REFUSE", "REQUEST_CHANGES", "REQUEST_INFO"] },
    note: { type: "string" },
    proposedAmount: { type: "number" },
    urgent: { type: "boolean" },
    limit: { type: ["integer", "null"] },
    tags: { type: "array" },
  },
  required: ["reference", "decision"],
};

describe("le contrat d'entrée — dérivé du schéma, montré, vérifié", () => {
  it("dérive les champs, leur type lisible, leur obligation et leurs valeurs", () => {
    const c = contratDepuisSchema(SCHEMA_DECISION)!;
    expect(c.champs.map((x) => x.nom)).toEqual(["reference", "decision", "note", "proposedAmount", "urgent", "limit", "tags"]);
    expect(c.champs.find((x) => x.nom === "reference")).toMatchObject({ type: "texte", requis: true, description: "Référence de l'ordre." });
    expect(c.champs.find((x) => x.nom === "decision")!.valeurs).toEqual(["APPROVE", "REFUSE", "REQUEST_CHANGES", "REQUEST_INFO"]);
    expect(c.champs.find((x) => x.nom === "limit")!.type).toBe("entier");
    expect(c.champs.find((x) => x.nom === "tags")!.type).toBe("liste");
    expect(contratDepuisSchema(null)).toBeNull();
    expect(contratDepuisSchema({ type: "object" })).toBeNull();
  });

  it("décrit les entrées en une ligne : obligatoires d'abord, énumérations en clair, options bornées", () => {
    const c = contratDepuisSchema(SCHEMA_DECISION)!;
    expect(decrireEntrees(c)).toBe(
      "entrées : reference* (texte), decision* (APPROVE|REFUSE|REQUEST_CHANGES|REQUEST_INFO), note (texte), proposedAmount (nombre), urgent (booléen), limit (entier), tags (liste)",
    );
    const large = contratDepuisSchema({
      type: "object",
      properties: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`o${i}`, { type: "string" }])),
      required: [],
    })!;
    expect(decrireEntrees(large)).toMatch(/o5 \(texte\), \+4 optionnelle\(s\)$/);
    expect(decrireEntrees({ champs: [] })).toBe("entrées : aucune");
  });

  it("refuse une clé inconnue et une obligatoire manquante — sans deviner la plus proche", () => {
    const c = contratDepuisSchema(SCHEMA_DECISION)!;
    const v = verifierEntree({ paymentReference: "PAY-1", action: "APPROVE" }, c);
    expect(v.inconnues).toEqual(["paymentReference", "action"]);
    expect(v.manquantes).toEqual(["reference", "decision"]);
    expect(v.invalides).toEqual([]);
    expect(v.reparations).toEqual([]);
  });

  it("une référence {{…}} compte comme présente et n'est pas jugée", () => {
    const c = contratDepuisSchema(SCHEMA_DECISION)!;
    const v = verifierEntree({ reference: "{{lecture.ref}}", decision: "{{analyse.decision}}" }, c);
    expect(v.manquantes).toEqual([]);
    expect(v.invalides).toEqual([]);
    expect(estGabarit("{{a.b}}")).toBe(true);
    expect(estGabarit("texte")).toBe(false);
  });

  it("répare les fautes de forme (casse d'énumération, nombre en texte, booléen en mot) et les dit", () => {
    const c = contratDepuisSchema(SCHEMA_DECISION)!;
    const v = verifierEntree({ reference: "PAY-1", decision: "approve", proposedAmount: "12 500,50", urgent: "oui", note: 42 }, c);
    expect(v.invalides).toEqual([]);
    expect(v.entree).toMatchObject({ decision: "APPROVE", proposedAmount: 12500.5, urgent: true, note: "42" });
    expect(v.reparations.map((r) => r.champ).sort()).toEqual(["decision", "note", "proposedAmount", "urgent"]);
  });

  it("refuse ce qui ne se répare pas : valeur hors énumération, texte pour une liste, entier non entier", () => {
    const c = contratDepuisSchema(SCHEMA_DECISION)!;
    const v = verifierEntree({ reference: "PAY-1", decision: "VALIDER", tags: "a,b", limit: "2.5" }, c);
    expect(v.invalides.map((i) => i.champ).sort()).toEqual(["decision", "limit", "tags"]);
    expect(v.invalides.find((i) => i.champ === "decision")!.raison).toContain("APPROVE|REFUSE");
  });

  it("une entrée minimale honore le contrat : les obligatoires seulement, dans leur forme", () => {
    const c = contratDepuisSchema(SCHEMA_DECISION)!;
    const ex = exempleEntree(c);
    expect(ex).toEqual({ reference: "x", decision: "APPROVE" });
    const v = verifierEntree(ex, c);
    expect(v.inconnues).toEqual([]); expect(v.manquantes).toEqual([]); expect(v.invalides).toEqual([]);
    expect(exempleEntree(null)).toEqual({});
  });

  it("répare une clé synonyme sans ambiguïté (« query » → « question ») et refuse quand il faudrait deviner", () => {
    const contrat = contratDepuisSchema({ type: "object", properties: { question: { type: "string" }, limit: { type: "integer" } }, required: ["question"] })!;
    const r = verifierEntree({ query: "contrat Julphar" }, contrat);
    expect(r.entree).toEqual({ question: "contrat Julphar" });
    expect(r.inconnues).toEqual([]);
    expect(r.manquantes).toEqual([]);
    expect(r.reparations).toEqual([{ champ: "question", de: "clé « query »", vers: "contrat Julphar" }]);
    // Deux clés inconnues pour un seul manquant : on ne choisit pas.
    const deux = verifierEntree({ query: "a", texte: "b" }, contrat);
    expect(deux.inconnues).toEqual(["query", "texte"]);
    expect(deux.manquantes).toEqual(["question"]);
    // Un type incompatible : pas de déplacement.
    const mauvais = verifierEntree({ query: 12 }, contrat);
    expect(mauvais.manquantes).toEqual(["question"]);
    expect(mauvais.inconnues).toEqual(["query"]);
  });
});
