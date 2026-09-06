import { describe, expect, it } from "vitest";
import { type ProblemeCsp, resoudreContraintes } from "./contraintes";

describe("contraintes — affecter des choix sous des règles logiques", () => {
  it("le coloriage de carte à trois couleurs : une affectation valide, jamais deux voisins pareils", () => {
    const voisins: [string, string][] = [["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"], ["C", "D"], ["D", "E"]];
    const r = resoudreContraintes({
      variables: ["A", "B", "C", "D", "E"].map((n) => ({ nom: n, domaine: ["rouge", "vert", "bleu"] })),
      contraintes: voisins.map(([a, b]) => ({ type: "differentes" as const, a, b })),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const [a, b] of voisins) expect(r.affectation[a]).not.toBe(r.affectation[b]);
    expect(Object.keys(r.affectation).length).toBe(5);
  });

  it("un planning de gardes : personne deux nuits de suite, au plus deux gardes chacun, préférences suivies", () => {
    const jours = ["lun", "mar", "mer", "jeu", "ven"];
    const equipe = ["Sarah", "Yassine", "Amine"];
    const p: ProblemeCsp = {
      variables: jours.map((j) => ({ nom: j, domaine: equipe, preferees: j === "lun" ? ["Amine"] : [] })),
      contraintes: [
        ...jours.slice(0, -1).map((j, i) => ({ type: "differentes" as const, a: j, b: jours[i + 1]!, nom: `pas deux nuits de suite (${j}/${jours[i + 1]})` })),
        ...equipe.map((p2) => ({ type: "auPlus" as const, valeur: p2, n: 2, nom: `au plus 2 gardes pour ${p2}` })),
        { type: "interdit", variable: "ven", valeurs: ["Sarah"], nom: "Sarah indisponible vendredi" },
      ],
    };
    const r = resoudreContraintes(p);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (let i = 0; i < jours.length - 1; i += 1) expect(r.affectation[jours[i]!]).not.toBe(r.affectation[jours[i + 1]!]);
    for (const membre of equipe) expect(jours.filter((j) => r.affectation[j] === membre).length).toBeLessThanOrEqual(2);
    expect(r.affectation.ven).not.toBe("Sarah");
    expect(r.affectation.lun).toBe("Amine");
    expect(r.rigueur.limites.some((l) => /pas la meilleure/.test(l))).toBe(true);
  });

  it("nomme les règles responsables quand il n'y a PAS de solution", () => {
    // Trois créneaux, deux personnes, chacun au plus une garde : impossible.
    const r = resoudreContraintes({
      variables: ["c1", "c2", "c3"].map((n) => ({ nom: n, domaine: ["A", "B"] })),
      contraintes: [
        { type: "auPlus", valeur: "A", n: 1, nom: "A au plus une fois" },
        { type: "auPlus", valeur: "B", n: 1, nom: "B au plus une fois" },
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.statut).toBe("IMPOSSIBLE");
    // Trois créneaux, deux valeurs, chacune plafonnée à une : retirer L'UN des deux plafonds suffit,
    // et le code nomme les deux plutôt que de dire « impossible ».
    expect(r.contraintesEnCause.sort()).toEqual(["A au plus une fois", "B au plus une fois"]);
    expect(r.erreur).toMatch(/Retirer l'une de celles-ci suffirait/);
    expect(Object.keys(r.meilleurePartielle).length).toBeGreaterThan(0);
    // Avec une seule règle bloquante, elle est nommée.
    const uneSeule = resoudreContraintes({
      variables: [{ nom: "x", domaine: ["a", "b"] }, { nom: "y", domaine: ["a"] }],
      contraintes: [{ type: "differentes", a: "x", b: "y" }, { type: "impose", variable: "x", valeurs: ["a"], nom: "x doit valoir a" }],
    });
    expect(uneSeule.ok).toBe(false);
    if (uneSeule.ok) return;
    expect(uneSeule.contraintesEnCause.length).toBeGreaterThanOrEqual(1);
    expect(uneSeule.erreur).toMatch(/Retirer l'une/);
  });

  it("la cohérence d'arc force les valeurs évidentes AVANT de chercher", () => {
    const r = resoudreContraintes({
      variables: [{ nom: "a", domaine: [1, 2, 3] }, { nom: "b", domaine: [1, 2, 3] }, { nom: "c", domaine: [1, 2, 3] }],
      contraintes: [
        { type: "impose", variable: "a", valeurs: [1] },
        { type: "toutesDifferentes", variables: ["a", "b", "c"] },
        { type: "interdit", variable: "b", valeurs: [3] },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.forcees).toContain("a");
    expect(r.domainesReduits.a).toEqual([1]);
    expect(r.domainesReduits.b).toEqual([2]);
    expect(r.affectation).toEqual({ a: 1, b: 2, c: 3 });
    expect(r.forcees).toContain("b");
  });

  it("gère les paires interdites, les implications et « au moins »", () => {
    const r = resoudreContraintes({
      variables: [
        { nom: "salle", domaine: ["A", "B", "C"] },
        { nom: "horaire", domaine: ["9h", "14h"] },
        { nom: "animateur", domaine: ["Sarah", "Yassine"] },
      ],
      contraintes: [
        { type: "pairesInterdites", a: "salle", b: "horaire", paires: [["A", "9h"], ["B", "9h"], ["C", "9h"]], nom: "aucune salle le matin" },
        { type: "siAlors", si: { variable: "horaire", vaut: "14h" }, alors: { variable: "animateur", pasVaut: "Yassine" }, nom: "Yassine part à midi" },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.affectation.horaire).toBe("14h");
    expect(r.affectation.animateur).toBe("Sarah");
    const auMoins = resoudreContraintes({
      variables: ["j1", "j2", "j3"].map((n) => ({ nom: n, domaine: ["ouvert", "ferme"] })),
      contraintes: [{ type: "auMoins", valeur: "ouvert", n: 2, nom: "au moins deux jours ouverts" }],
    });
    expect(auMoins.ok).toBe(true);
    if (auMoins.ok) expect(Object.values(auMoins.affectation).filter((v) => v === "ouvert").length).toBeGreaterThanOrEqual(2);
  });

  it("refuse un problème incohérent en le disant", () => {
    const vide = resoudreContraintes({ variables: [], contraintes: [] });
    expect(vide.ok).toBe(false);
    if (!vide.ok) expect(vide.statut).toBe("INVALIDE");
    const domaineVide = resoudreContraintes({ variables: [{ nom: "x", domaine: [] }], contraintes: [] });
    expect(domaineVide.ok).toBe(false);
    if (!domaineVide.ok) expect(domaineVide.erreur).toMatch(/domaine vide/);
    const inconnue = resoudreContraintes({ variables: [{ nom: "x", domaine: [1] }], contraintes: [{ type: "differentes", a: "x", b: "z" }] });
    expect(inconnue.ok).toBe(false);
    if (!inconnue.ok) expect(inconnue.erreur).toMatch(/z/);
  });

  it("tient l'échelle : 8 dames sur un échiquier, et 40 dossiers à répartir", () => {
    // 8 dames : colonnes = variables, lignes = valeurs, aucune sur la même ligne ni diagonale.
    const cols = Array.from({ length: 8 }, (_, i) => `c${i}`);
    const paires: { type: "pairesInterdites"; a: string; b: string; paires: [number, number][] }[] = [];
    for (let i = 0; i < 8; i += 1) for (let j = i + 1; j < 8; j += 1) {
      const interdites: [number, number][] = [];
      for (let a = 0; a < 8; a += 1) for (let b = 0; b < 8; b += 1) if (Math.abs(a - b) === j - i) interdites.push([a, b]);
      paires.push({ type: "pairesInterdites", a: cols[i]!, b: cols[j]!, paires: interdites });
    }
    const t0 = Date.now();
    const dames = resoudreContraintes({
      variables: cols.map((n) => ({ nom: n, domaine: Array.from({ length: 8 }, (_, i) => i) })),
      contraintes: [{ type: "toutesDifferentes", variables: cols }, ...paires],
    });
    expect(dames.ok).toBe(true);
    if (dames.ok) {
      const l = cols.map((c) => dames.affectation[c] as number);
      expect(new Set(l).size).toBe(8);
      for (let i = 0; i < 8; i += 1) for (let j = i + 1; j < 8; j += 1) expect(Math.abs(l[i]! - l[j]!)).not.toBe(j - i);
    }
    expect(Date.now() - t0).toBeLessThan(5000);

    const dossiers = Array.from({ length: 40 }, (_, i) => `d${i}`);
    const gens = ["Sarah", "Yassine", "Amine", "Nadia"];
    const r = resoudreContraintes({
      variables: dossiers.map((n) => ({ nom: n, domaine: gens })),
      contraintes: gens.map((g) => ({ type: "auPlus" as const, valeur: g, n: 10, nom: `10 dossiers max pour ${g}` })),
    });
    expect(r.ok).toBe(true);
    if (r.ok) for (const g of gens) expect(dossiers.filter((d) => r.affectation[d] === g).length).toBeLessThanOrEqual(10);
  });
});
