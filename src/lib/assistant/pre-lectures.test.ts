import { describe, it, expect } from "vitest";
import { planifierPreLectures, motsSignificatifs, executerPreLectures } from "./pre-lectures";

describe("pré-lectures — la décision, pure", () => {
  it("une question documentaire déclenche la recherche fédérée ET la recherche documentaire, sur les mots porteurs", () => {
    const p = planifierPreLectures("Qu'avait promis Amel lors du dernier comité de direction ?", { route: "HYBRID_RETRIEVAL", isMutation: false });
    expect(p.map((x) => x.tool)).toEqual(["search_everything", "find_documents"]);
    expect(p[1].input.query).toBe("Amel lors comité direction");
  });

  it("une requête structurée ne déclenche que la recherche fédérée", () => {
    const p = planifierPreLectures("Quels paiements nécessitent mon attention ?", { route: "STRUCTURED_QUERY", isMutation: false });
    expect(p.map((x) => x.tool)).toEqual(["search_everything"]);
    expect(p[0].input.query).toBe("paiements");
  });

  it("les entités du plan priment sur les mots porteurs pour la recherche fédérée", () => {
    const p = planifierPreLectures("Pourquoi le dossier Trastuzumab est-il bloqué ?", { route: "DEEP_REASONING", isMutation: false, entites: ["Trastuzumab"] });
    expect(p[0].input.query).toBe("Trastuzumab");
  });

  it("jamais sur une mutation, une salutation, une route hors périmètre ou une question sans mot porteur", () => {
    expect(planifierPreLectures("Crée une tâche pour Raihana", { route: "ACTION", isMutation: true })).toEqual([]);
    expect(planifierPreLectures("Bonjour Adam", { route: "HYBRID_RETRIEVAL", isMutation: false })).toEqual([]);
    expect(planifierPreLectures("Où en est le dossier Nivolumab ?", { route: "FAST_DETERMINISTIC", isMutation: false })).toEqual([]);
    expect(planifierPreLectures("Est-ce que tout va bien ?", { route: "HYBRID_RETRIEVAL", isMutation: false })).toEqual([]);
  });

  it("les mots vides tombent, les identités restent, sans doublon ni ponctuation", () => {
    expect(motsSignificatifs("Retrouve tout ce qui concerne Hetero Labs — dossiers, contrat, courriers, tâches — et résume la situation.")).toEqual(["concerne", "Hetero", "Labs", "dossiers", "contrat", "courriers"]);
  });
});

describe("pré-lectures — l'exécution, bornée", () => {
  it("une lecture lente est abandonnée, une lecture en échec est absente, les autres reviennent", async () => {
    const faites = await executerPreLectures(
      [
        { tool: "search_everything", input: { query: "ok" } },
        { tool: "find_documents", input: { query: "lent" } },
      ],
      async (tool) => {
        if (tool === "find_documents") await new Promise((r) => setTimeout(r, 120));
        return `resultat ${tool}`;
      },
      40,
    );
    expect(faites.map((f) => f.tool)).toEqual(["search_everything"]);
    expect(faites[0].id).toBe("pre_1");
    const echec = await executerPreLectures([{ tool: "search_everything", input: { query: "x" } }], async () => { throw new Error("panne"); });
    expect(echec).toEqual([]);
  });
});
