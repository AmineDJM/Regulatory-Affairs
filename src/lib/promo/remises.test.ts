import { describe, expect, it } from "vitest";
import { gestesDeRemise, lireNumeriques, lireRemises, refusRemise, remisNetParArticle, resumeRemises } from "./remises";

describe("le matériel remis en visite — la règle pure (§118.166)", () => {
  it("lit deux colonnes appariées par leur rang ; une quantité vide est une rangée non utilisée", () => {
    expect(lireRemises(["a", "b", "c"], ["20", "", "1 500"])).toEqual({ ok: true, remises: [{ itemId: "a", quantite: 20 }, { itemId: "c", quantite: 1500 }] });
    expect(lireRemises(["a"], ["12,5"])).toEqual({ ok: true, remises: [{ itemId: "a", quantite: 12.5 }] });
    expect(lireRemises([""], ["5"])).toEqual({ ok: true, remises: [] });
  });

  it("dit tout ce qui ne va pas, en une fois : illisible, négatif, doublon", () => {
    const r = lireRemises(["a", "b", "a"], ["vingt", "-3", "4"]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/ligne 1 est illisible/);
      expect(r.error).toMatch(/ligne 2 est négative/);
      expect(r.error).not.toMatch(/deux fois/); // « a » n'a pas été retenu en ligne 1 : la ligne 3 n'est pas un doublon
    }
    const doublon = lireRemises(["a", "a"], ["1", "2"]);
    expect(doublon.ok ? "" : doublon.error).toMatch(/figure deux fois \(ligne 2\)/);
  });

  it("les supports numériques cochés, sans doublon", () => {
    expect(lireNumeriques(["n1", " n1 ", "", "n2"])).toEqual(["n1", "n2"]);
  });

  it("ce qui est remis NET dans une visite : une remise contre-passée ne compte plus", () => {
    const net = remisNetParArticle([
      { id: "m1", itemId: "fiche", kind: "DISTRIBUTION", delta: -12, annuleId: null },
      { id: "m2", itemId: "fiche", kind: "DISTRIBUTION", delta: -8, annuleId: null },
      { id: "m3", itemId: "fiche", kind: "REVERSAL", delta: 12, annuleId: "m1" },
      { id: "m4", itemId: "stylo", kind: "DISTRIBUTION", delta: -5, annuleId: null },
      { id: "m5", itemId: "stylo", kind: "REVERSAL", delta: 5, annuleId: "m4" },
    ]);
    expect([...net.entries()]).toEqual([["fiche", 8]]);
  });

  it("une resoumission n'écrit que ce qui CHANGE", () => {
    const avant = new Map([["fiche", 20], ["stylo", 5]]);
    expect(gestesDeRemise(avant, [{ itemId: "fiche", quantite: 20 }, { itemId: "stylo", quantite: 5 }]).every((g) => g.geste === "AUCUN")).toBe(true);
    expect(gestesDeRemise(avant, [{ itemId: "fiche", quantite: 15 }, { itemId: "bloc", quantite: 2 }])).toEqual([
      { itemId: "bloc", avant: 0, apres: 2, geste: "REMETTRE" },
      { itemId: "fiche", avant: 20, apres: 15, geste: "REMPLACER" },
      { itemId: "stylo", avant: 5, apres: 0, geste: "REPRENDRE" },
    ]);
  });

  it("le refus dit l'article, la quantité, ce qui reste, et le geste qui débloque", () => {
    const m = refusRemise("Fiche posologique — Nivolex", 50, "Il ne reste que 30 de distribuable.");
    expect(m).toMatch(/50 « Fiche posologique — Nivolex » remis/);
    expect(m).toMatch(/Il ne reste que 30 de distribuable\. Rien n'est enregistré/);
    expect(m).toMatch(/demandez une dotation/);
    expect(resumeRemises([{ libelle: "Fiche", quantite: 1500 }, { libelle: "Stylo", quantite: 5 }])).toMatch(/^1\s500 Fiche, 5 Stylo$/);
  });
});
