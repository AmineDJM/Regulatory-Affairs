import { describe, expect, it } from "vitest";
import { briefingDeRegles, briefingDu, heureAlger, jourAlger, lireReponseModele, promptBriefing, type BriefRisk } from "./briefing";

const r = (key: string, level: string, status = "NOUVEAU", extra: Partial<BriefRisk> = {}): BriefRisk => ({
  key, level, status, title: `Titre ${key}`, object: `Objet ${key}`, module: `Module ${key}`, owner: "Finances",
  ageDays: 6, recommendation: "Relancer les Finances.", href: `/x/${key}`, ...extra,
});

describe("briefingDeRegles — le repli sans modèle", () => {
  it("annonce les décisions, cite les deux plus graves, puis le reste — chaque phrase porte sa source", () => {
    const c = briefingDeRegles([r("m", "medium"), r("c", "critical"), r("h", "high"), r("p", "high", "PRIS_EN_CHARGE"), r("i", "critical", "IGNORE")], { resolved: 2, created: 1 });
    expect(c.decisions).toBe(2);
    expect(c.since).toEqual({ resolved: 2, created: 1 });
    expect(c.paragraphs[0].sentences[0].text).toBe("2 décisions vous attendent.");
    expect(c.paragraphs[0].sentences.slice(1).map((s) => s.refs)).toEqual([["c"], ["h"]]);
    expect(c.paragraphs[0].sentences[1].text).toBe("Titre c — Objet c depuis 6 j : relancer les finances.");
    // Le risque ignoré n'est jamais cité ; le pris en charge et le moyen viennent ensuite.
    const cites = c.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.refs));
    expect(cites).not.toContain("i");
    expect(cites).toEqual(expect.arrayContaining(["p", "m"]));
  });

  it("sans risque ouvert : une phrase, aucune décision", () => {
    const c = briefingDeRegles([r("x", "critical", "RESOLU")], { resolved: 0, created: 0 });
    expect(c.decisions).toBe(0);
    expect(c.paragraphs).toEqual([{ sentences: [{ text: "Aucun risque ouvert ce matin.", refs: [] }] }]);
  });

  it("sans urgence : le dit, puis liste ce qui reste ouvert", () => {
    const c = briefingDeRegles([r("m", "medium")], { resolved: 0, created: 0 });
    expect(c.paragraphs[0].sentences[0].text).toBe("Aucune décision urgente ce matin.");
    expect(c.paragraphs[1].sentences[0].refs).toEqual(["m"]);
  });
});

describe("lireReponseModele — lecture stricte", () => {
  const connus = new Set(["a", "b"]);
  it("garde le texte et les seules sources connues", () => {
    const p = lireReponseModele({ paragraphs: [{ sentences: [{ text: " 3 décisions. ", refs: ["a", "inventée", "a"] }, { text: "", refs: [] }] }] }, connus);
    expect(p).toEqual([{ sentences: [{ text: "3 décisions.", refs: ["a"] }] }]);
  });
  it("rend null sur une forme inattendue (le repli prend le relais)", () => {
    expect(lireReponseModele(null, connus)).toBeNull();
    expect(lireReponseModele({ paragraphs: [] }, connus)).toBeNull();
    expect(lireReponseModele({ paragraphs: [{ sentences: "texte" }] }, connus)).toBeNull();
    expect(lireReponseModele({ paragraphs: [{ sentences: [{ text: "  " }] }] }, connus)).toBeNull();
    expect(lireReponseModele("du texte libre", connus)).toBeNull();
  });
});

describe("promptBriefing", () => {
  it("donne les clés des risques ouverts et rappelle la règle des sources", () => {
    const { system, user } = promptBriefing([r("a", "high"), r("z", "low", "RESOLU")], { resolved: 1, created: 0 }, "2026-10-07");
    expect(user).toContain("clé=a");
    expect(user).not.toContain("clé=z");
    expect(user).toContain("Depuis hier : 1 risque(s) résolu(s)");
    expect(system).toMatch(/UNIQUEMENT des clés/);
  });
});

describe("l'heure d'Alger et l'échéance de 7 h", () => {
  it("Alger est à UTC+1", () => {
    expect(heureAlger(new Date("2026-10-07T05:59:00Z"))).toBe(6);
    expect(heureAlger(new Date("2026-10-07T06:00:00Z"))).toBe(7);
    expect(jourAlger(new Date("2026-10-07T23:30:00Z"))).toBe("2026-10-08");
  });
  it("dû après 7 h, une fois par jour", () => {
    expect(briefingDu(new Date("2026-10-07T05:30:00Z"), null)).toBe(false);
    expect(briefingDu(new Date("2026-10-07T06:10:00Z"), null)).toBe(true);
    expect(briefingDu(new Date("2026-10-07T06:10:00Z"), "2026-10-07")).toBe(false);
    expect(briefingDu(new Date("2026-10-07T06:10:00Z"), "2026-10-06")).toBe(true);
  });
});
