import { describe, it, expect } from "vitest";
import { planifierPreLectures, motsSignificatifs, executerPreLectures, suiviPreLectures } from "./pre-lectures";

describe("pré-lectures — la décision, pure", () => {
  it("une question documentaire déclenche la recherche fédérée ET la recherche documentaire, sur les mots porteurs", () => {
    const p = planifierPreLectures("Qu'avait promis Amel lors du dernier comité de direction ?", { route: "HYBRID_RETRIEVAL", isMutation: false });
    expect(p.map((x) => x.tool)).toEqual(["search_everything", "find_documents"]);
    expect(p[1].input.query).toBe("Amel lors comité direction");
  });

  it("une requête structurée déclenche aussi la recherche documentaire — la réponse est souvent dans une pièce", () => {
    const p = planifierPreLectures("Quels paiements nécessitent mon attention ?", { route: "STRUCTURED_QUERY", isMutation: false });
    expect(p.map((x) => x.tool)).toEqual(["search_everything", "find_documents"]);
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

describe("pré-lectures — la seconde vague suit ce que la première a rendu évident", () => {
  it("une recherche focalisée sur une fiche appelle inspect_record ; un document de confiance HAUTE se lit", () => {
    const faites = [
      { tool: "search_everything", out: JSON.stringify({ total: 2, resultats: [{ famille: "Legal", reference: "CTR-2024-07", lien: "/legal/cmtoe5ndm0030y4tzmh1wpgcb" }, { famille: "Drive", lien: "/drive/cmtoe5nn1004yy4tzvwso8r4y" }] }) },
      { tool: "find_documents", out: JSON.stringify({ resultats: [{ driveNodeId: "cmtoe5nmi004hy4tzmc88en9x", confiance: "HAUTE" }, { driveNodeId: "x", confiance: "HAUTE" }] }) },
    ];
    expect(suiviPreLectures(faites)).toEqual([
      { tool: "inspect_record", input: { reference: "CTR-2024-07" } },
      { tool: "read_document", input: { driveNodeId: "cmtoe5nmi004hy4tzmc88en9x" } },
    ]);
  });

  it("sans référence, l'identifiant du lien sert ; trop de fiches ou une confiance moyenne : on ne suit pas", () => {
    expect(suiviPreLectures([{ tool: "search_everything", out: JSON.stringify({ total: 1, resultats: [{ famille: "Marchés PCH", lien: "/pch/cmtoe5nel003ry4tzy190mg4y" }] }) }]))
      .toEqual([{ tool: "inspect_record", input: { reference: "cmtoe5nel003ry4tzy190mg4y" } }]);
    const beaucoup = { total: 10, resultats: Array.from({ length: 5 }, (_, i) => ({ famille: "Legal", reference: `R-${i}`, lien: `/legal/id${i}abcdefgh` })) };
    expect(suiviPreLectures([{ tool: "search_everything", out: JSON.stringify(beaucoup) }])).toEqual([]);
    expect(suiviPreLectures([{ tool: "find_documents", out: JSON.stringify({ resultats: [{ driveNodeId: "abc", confiance: "MOYENNE" }] }) }])).toEqual([]);
    expect(suiviPreLectures([{ tool: "search_everything", out: "pas du json" }])).toEqual([]);
  });

  it("la recette « préparer une réunion » lit l'agenda, le point exécutif et les documents", () => {
    const p = planifierPreLectures("Prépare-moi le comité de demain matin : points à trancher, risques, chiffres clés.", { route: "DEEP_REASONING", isMutation: false, domain: "CALENDAR" });
    expect(p.map((x) => x.tool)).toEqual(["read_calendar", "executive_brief", "find_documents"]);
  });

  it("l'exécution enchaîne la seconde vague par le même exécuteur, et la coupe sur demande", async () => {
    const appels: string[] = [];
    const run = async (tool: string) => {
      appels.push(tool);
      if (tool === "search_everything") return JSON.stringify({ total: 1, resultats: [{ famille: "Legal", reference: "CTR-1", lien: "/legal/abcdefghij" }] });
      return `fiche ${tool}`;
    };
    const faites = await executerPreLectures([{ tool: "search_everything", input: { query: "hetero" } }], run);
    expect(faites.map((f) => `${f.id}:${f.tool}`)).toEqual(["pre_1:search_everything", "pre_2:inspect_record"]);
    appels.length = 0;
    await executerPreLectures([{ tool: "search_everything", input: { query: "hetero" } }], run, 1_000, { suivi: false });
    expect(appels).toEqual(["search_everything"]);
  });
});
