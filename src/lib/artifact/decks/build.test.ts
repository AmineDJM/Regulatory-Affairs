import { describe, expect, it } from "vitest";
import { construireDeckVerifie, verifierSpecDeck } from "@/lib/artifact/decks/build";
import { adaptateurPptx } from "@/lib/artifact/adapters/pptx/adapter";
import type { PptxModel } from "@/lib/artifact/object-model/model";

const diapo = (n: number) => ({ titre: `Idée ${n} — un constat par diapositive`, puces: [`Premier point de la diapositive ${n}`, `Deuxième point, chiffré : ${n * 3} %`, `Troisième point, la décision attendue`], notes: `Notes ${n}` });

describe("le constructeur de decks « une idée par diapositive »", () => {
  it("construit un deck de 120 diapositives, relu et contrôlé, en quelques secondes", async () => {
    const spec = { titre: "Revue stratégique 2026", sousTitre: "Comité de direction", diapos: Array.from({ length: 120 }, (_, i) => diapo(i + 1)) };
    spec.diapos[10] = { titre: "Le chiffre qui compte", puces: [], notes: "", ...{ chiffre: { valeur: "41,3 M DZD", legende: "Chiffre d'affaires consolidé, 9 mois" } } } as never;
    spec.diapos[20] = { titre: "Ventes par région", puces: [], notes: "", ...{ tableau: { colonnes: ["Région", "CA", "Marge"], lignes: [["Alger", "12,1 M", "31 %"], ["Oran", "8,4 M", "28 %"], ["Constantine", "6,2 M", "25 %"]] } } } as never;
    const r = await construireDeckVerifie(spec);
    expect(r.verification.ok, r.verification.bloquants.join(" | ")).toBe(true);
    expect(r.verification.diapos).toBe(121); // couverture + 120
    expect(r.ms).toBeLessThan(20_000);
    const m = (await adaptateurPptx.ouvrir(r.octets)).modele() as PptxModel;
    expect(m.slides[0].title).toBe("Revue stratégique 2026");
    expect(m.slides[1].title).toBe("Idée 1 — un constat par diapositive");
    expect(m.slides[1].shapes[1].text.split("\n")).toHaveLength(3);
    expect(m.slides[11].shapes.map((s) => s.text)).toContain("41,3 M DZD");
    expect(m.slides[21].shapes.some((s) => s.role === "table")).toBe(true);
  });

  it("refuse de livrer une spécification qui viole les règles, en nommant la diapositive et la règle", async () => {
    const r = await construireDeckVerifie({
      titre: "Deck bancal",
      diapos: [
        { titre: "", puces: ["a b"] },
        { titre: "Sept puces c'est trop", puces: ["un deux", "trois quatre", "cinq six", "sept huit", "neuf dix", "onze douze", "treize quatorze"] },
        { titre: "Vide" },
        { titre: "Un titre interminable qui déroule toute la thèse au lieu de la nommer en une seule ligne lisible", puces: ["ok ok"] },
        { titre: "Tableau trop long", tableau: { colonnes: ["a", "b"], lignes: Array.from({ length: 15 }, (_, i) => [i, i]) } },
      ],
    });
    expect(r.verification.ok).toBe(false);
    expect(r.octets.length).toBe(0);
    expect(r.verification.bloquants).toEqual([
      "Diapo 1 : pas de titre.",
      "Diapo 2 : 7 puces (maximum 6) — scinder en deux diapositives.",
      "Diapo 3 « Vide » : vide (ni puces, ni texte, ni chiffre, ni tableau).",
      "Diapo 4 : titre de 18 mots (maximum 14) — une idée par diapositive tient en une ligne.",
      "Diapo 5 : tableau de 15 lignes (maximum 12) — un tableau long va dans l'annexe Excel.",
    ]);
    expect(verifierSpecDeck({ titre: "x", diapos: [{ titre: "Même", puces: ["a b"] }, { titre: "même", puces: ["c d"] }] }).avertissements).toEqual(["Le titre « même » revient sur les diapos 1, 2."]);
  });
});
