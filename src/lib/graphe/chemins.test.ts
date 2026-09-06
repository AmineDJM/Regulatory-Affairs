import { describe, expect, it } from "vitest";
import { type Noeud, construire } from "./modele";
import { cheminsMultiples, composantes, cycles, plusCourtChemin, pointsDeRupture, portee } from "./chemins";

const N = (id: string): Noeud => ({ id, type: "X", libelle: id });
const g = (aretes: { de: string; a: string; relation?: string; poids?: number }[], ids?: string[]) => {
  const noms = ids ?? [...new Set(aretes.flatMap((a) => [a.de, a.a]))];
  const r = construire(noms.map(N), aretes.map((a) => ({ ...a, relation: a.relation ?? "lie" })));
  if (!r.ok) throw new Error(r.erreur);
  return r.graphe;
};

describe("graphe — chemins et dépendances", () => {
  it("trouve le plus court chemin et le raconte", () => {
    const reseau = g([
      { de: "adventum", a: "contrat2024" },
      { de: "contrat2024", a: "mouffok", relation: "signe_par" },
      { de: "mouffok", a: "anpp", relation: "siege_a" },
      { de: "adventum", a: "sofradis" },
      { de: "sofradis", a: "anpp" },
    ]);
    const c = plusCourtChemin(reseau, "adventum", "anpp")!;
    expect(c).not.toBeNull();
    expect(c.longueur).toBe(2);
    expect(c.noeuds).toEqual(["adventum", "sofradis", "anpp"]);
    expect(c.recit).toMatch(/adventum —\[lie\]→ sofradis/);
    // Aucun chemin : rendu null, pas une erreur.
    const isole = g([{ de: "a", a: "b" }], ["a", "b", "seul"]);
    expect(plusCourtChemin(isole, "a", "seul")).toBeNull();
    expect(plusCourtChemin(isole, "a", "a")!.longueur).toBe(0);
  });

  it("un lien FORT rapproche : le poids inverse la distance", () => {
    // a→b→c avec des liens faibles, a→d→c avec des liens forts : le chemin par d gagne.
    const reseau = g([
      { de: "a", a: "b", poids: 0.1 }, { de: "b", a: "c", poids: 0.1 },
      { de: "a", a: "d", poids: 10 }, { de: "d", a: "c", poids: 10 },
    ]);
    const c = plusCourtChemin(reseau, "a", "c")!;
    expect(c.noeuds).toEqual(["a", "d", "c"]);
    expect(c.cout).toBeCloseTo(0.2, 6);
  });

  it("l'orientation compte : « qui dépend de qui » n'est pas « comment sommes-nous liés »", () => {
    const reseau = g([{ de: "a", a: "b" }, { de: "c", a: "b" }]);
    expect(plusCourtChemin(reseau, "a", "c", { orientation: "orientee" })).toBeNull();
    const libre = plusCourtChemin(reseau, "a", "c", { orientation: "libre" })!;
    expect(libre.noeuds).toEqual(["a", "b", "c"]);
  });

  it("plusieurs chemins distincts : un lien unique et trois liens ne se valent pas", () => {
    const unSeul = g([{ de: "a", a: "b" }, { de: "b", a: "z" }]);
    expect(cheminsMultiples(unSeul, "a", "z", { maximum: 3 }).length).toBe(1);
    const plusieurs = g([
      { de: "a", a: "b" }, { de: "b", a: "z" },
      { de: "a", a: "c" }, { de: "c", a: "z" },
      { de: "a", a: "d" }, { de: "d", a: "z" },
    ]);
    const trouves = cheminsMultiples(plusieurs, "a", "z", { maximum: 3 });
    expect(trouves.length).toBeGreaterThanOrEqual(2);
    expect(new Set(trouves.map((c) => c.noeuds.join(">"))).size).toBe(trouves.length);
  });

  it("la portée d'une décision : ce qui en dépend, par niveau", () => {
    const reseau = g([
      { de: "decision", a: "dossier" }, { de: "dossier", a: "lot1" }, { de: "dossier", a: "lot2" },
      { de: "lot1", a: "client" }, { de: "autre", a: "decision" },
    ]);
    const aval = portee(reseau, "decision", { sens: "sortant", profondeurMax: 3 });
    expect(aval.map((x) => x.id).sort()).toEqual(["client", "dossier", "lot1", "lot2"]);
    expect(aval.find((x) => x.id === "dossier")!.distance).toBe(1);
    expect(aval.find((x) => x.id === "client")!.distance).toBe(3);
    expect(aval.find((x) => x.id === "client")!.via).toBe("lot1");
    const amont = portee(reseau, "decision", { sens: "entrant" });
    expect(amont.map((x) => x.id)).toEqual(["autre"]);
    // La profondeur borne : à 1 saut, seul le dossier.
    expect(portee(reseau, "decision", { profondeurMax: 1 }).map((x) => x.id)).toEqual(["dossier"]);
  });

  it("détecte les dépendances circulaires et les composantes séparées", () => {
    const boucle = g([{ de: "a", a: "b" }, { de: "b", a: "c" }, { de: "c", a: "a" }, { de: "x", a: "y" }]);
    const trouves = cycles(boucle);
    expect(trouves.length).toBe(1);
    expect([...trouves[0]!].sort()).toEqual(["a", "b", "c"]);
    const morceaux = composantes(boucle);
    expect(morceaux.length).toBe(2);
    expect(morceaux[0]!.length).toBe(3);
    expect(morceaux[1]!.sort()).toEqual(["x", "y"]);
    expect(cycles(g([{ de: "a", a: "b" }, { de: "b", a: "c" }]))).toEqual([]);
  });

  it("les points de rupture : « si cette personne part, qu'est-ce qui se retrouve isolé ? »", () => {
    // Deux grappes reliées par le SEUL karim : lui parti, le réseau se coupe en deux.
    const reseau = g([
      { de: "a1", a: "a2" }, { de: "a2", a: "a3" }, { de: "a3", a: "a1" },
      { de: "a1", a: "karim" }, { de: "karim", a: "b1" },
      { de: "b1", a: "b2" }, { de: "b2", a: "b3" }, { de: "b3", a: "b1" },
    ]);
    const ruptures = pointsDeRupture(reseau);
    const karim = ruptures.find((r) => r.id === "karim");
    expect(karim, `points trouvés : ${ruptures.map((r) => r.id).join(", ")}`).toBeTruthy();
    expect(karim!.composantesApres).toBe(2);
    expect(karim!.isole.length).toBeGreaterThan(0);
    // Un réseau en anneau n'a aucun point de rupture : tout est doublé.
    const anneau = g([{ de: "a", a: "b" }, { de: "b", a: "c" }, { de: "c", a: "d" }, { de: "d", a: "a" }]);
    expect(pointsDeRupture(anneau)).toEqual([]);
  });

  it("tient l'échelle : 2 000 nœuds en chaîne, chemin trouvé sous la seconde", () => {
    const aretes = Array.from({ length: 1999 }, (_, i) => ({ de: `n${i}`, a: `n${i + 1}` }));
    const grand = g(aretes);
    const t0 = Date.now();
    const c = plusCourtChemin(grand, "n0", "n11", { profondeurMax: 12 })!;
    expect(c.longueur).toBe(11);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(composantes(grand).length).toBe(1);
  });
});
