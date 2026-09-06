import { describe, expect, it } from "vitest";
import { type Arete, type Noeud, auMoment, construire, degre, estTemporel, filtrerRelations, nom, sommaire, valideA, voisins } from "./modele";

const N = (id: string, type = "PERSONNE"): Noeud => ({ id, type, libelle: id.toUpperCase() });

describe("graphe — le modèle et le temps", () => {
  it("construit l'index, compte les degrés et ignore les arêtes dont un bout manque", () => {
    const r = construire([N("a"), N("b"), N("c")], [
      { de: "a", a: "b", relation: "connait" },
      { de: "b", a: "c", relation: "connait" },
      { de: "a", a: "zzz", relation: "connait" },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ignorees).toBe(1);
    expect(r.graphe.aretes.length).toBe(2);
    expect(degre(r.graphe, "b")).toEqual({ entrant: 1, sortant: 1, total: 2 });
    expect(degre(r.graphe, "a")).toEqual({ entrant: 0, sortant: 1, total: 1 });
    expect(voisins(r.graphe, "b", "les_deux").map((v) => v.id).sort()).toEqual(["a", "c"]);
    expect(voisins(r.graphe, "b", "sortant").map((v) => v.id)).toEqual(["c"]);
    expect(nom(r.graphe, "a")).toBe("A");
    expect(nom(r.graphe, "inconnu")).toBe("inconnu");
  });

  it("un lien réciproque se parcourt dans les deux sens", () => {
    const r = construire([N("a"), N("b")], [{ de: "a", a: "b", relation: "travaille avec", reciproque: true }]);
    if (!r.ok) throw new Error(r.erreur);
    expect(voisins(r.graphe, "b", "sortant").map((v) => v.id)).toEqual(["a"]);
    expect(voisins(r.graphe, "a", "sortant").map((v) => v.id)).toEqual(["b"]);
  });

  it("LE TEMPS : « qui était responsable au moment de cette décision ? »", () => {
    const aretes: Arete[] = [
      { de: "sarah", a: "dossier", relation: "responsable_de", depuis: "2026-01-01", jusqua: "2026-07-01" },
      { de: "yassine", a: "dossier", relation: "responsable_de", depuis: "2026-07-01" },
    ];
    const r = construire([N("sarah"), N("yassine"), N("dossier", "DOSSIER")], aretes);
    if (!r.ok) throw new Error(r.erreur);
    expect(estTemporel(r.graphe)).toBe(true);

    const enMars = auMoment(r.graphe, new Date("2026-03-15"));
    expect(voisins(enMars, "dossier", "entrant").map((v) => v.id)).toEqual(["sarah"]);
    const enSeptembre = auMoment(r.graphe, new Date("2026-09-15"));
    expect(voisins(enSeptembre, "dossier", "entrant").map((v) => v.id)).toEqual(["yassine"]);
    // La borne de fin est EXCLUE, celle de début INCLUSE : le 1er juillet, c'est Yassine.
    expect(valideA(aretes[0]!, new Date("2026-07-01"))).toBe(false);
    expect(valideA(aretes[1]!, new Date("2026-07-01"))).toBe(true);
    // L'histoire n'est pas écrasée : le graphe complet porte encore les deux.
    expect(r.graphe.aretes.length).toBe(2);
    expect(sommaire(r.graphe).periode).toEqual({ de: "2026-01-01", a: "2026-07-01" });
  });

  it("un lien sans bornes vaut à toute date", () => {
    const r = construire([N("a"), N("b")], [{ de: "a", a: "b", relation: "appartient" }]);
    if (!r.ok) throw new Error(r.erreur);
    expect(auMoment(r.graphe, new Date("1990-01-01")).aretes.length).toBe(1);
    expect(auMoment(r.graphe, new Date("2099-01-01")).aretes.length).toBe(1);
    expect(estTemporel(r.graphe)).toBe(false);
  });

  it("filtre par relation et rend un sommaire lisible", () => {
    const r = construire([N("a"), N("b", "SOCIETE"), N("c", "SOCIETE")], [
      { de: "a", a: "b", relation: "travaille_chez" },
      { de: "b", a: "c", relation: "fournit" },
      { de: "a", a: "c", relation: "connait" },
    ]);
    if (!r.ok) throw new Error(r.erreur);
    const s = sommaire(r.graphe);
    expect(s.noeuds).toBe(3);
    expect(s.aretes).toBe(3);
    expect(s.parType).toEqual({ PERSONNE: 1, SOCIETE: 2 });
    expect(s.parRelation.fournit).toBe(1);
    const seulFournit = filtrerRelations(r.graphe, ["fournit"]);
    expect(seulFournit.aretes.length).toBe(1);
    expect(degre(seulFournit, "a").total).toBe(0);
  });

  it("refuse un graphe vide ou hors limite", () => {
    expect(construire([], [])).toMatchObject({ ok: false });
    const r = construire([], [{ de: "a", a: "b", relation: "x" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/Aucun nœud/);
  });
});
