import { describe, expect, it } from "vitest";
import { generateur, normaleStandard } from "./alea";
import { acp, detecterAnomalies, matriceDe, resumerSegmentation, segmenter } from "./ml";

describe("ml — segmentation", () => {
  it("retrouve trois nuages bien séparés et les caractérise", () => {
    const z = normaleStandard(generateur(1));
    const lignes: Record<string, number>[] = [];
    for (let i = 0; i < 60; i += 1) lignes.push({ ca: 10 + z(), commandes: 5 + z(), retard: 1 + z() * 0.3 });
    for (let i = 0; i < 60; i += 1) lignes.push({ ca: 100 + z() * 5, commandes: 50 + z() * 3, retard: 2 + z() * 0.3 });
    for (let i = 0; i < 60; i += 1) lignes.push({ ca: 12 + z(), commandes: 6 + z(), retard: 30 + z() });
    const r = segmenter(lignes, { graine: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.k).toBe(3);
    expect(r.silhouette).toBeGreaterThan(0.6);
    expect(r.groupes.map((g) => g.taille).sort((a, b) => a - b)).toEqual([60, 60, 60]);
    // Un groupe se distingue par le retard, un autre par le CA.
    const parRetard = r.groupes.find((g) => g.centre.retard! > 20)!;
    expect(parRetard.signature[0]!.colonne).toBe("retard");
    expect(parRetard.signature[0]!.ecartsTypes).toBeGreaterThan(1);
    const grosCa = r.groupes.find((g) => g.centre.ca! > 50)!;
    expect(grosCa.signature.find((s) => s.colonne === "ca")!.ecartsTypes).toBeGreaterThan(1);
    expect(r.normalise).toBe(true);
    // Chaque observation est affectée à exactement un groupe.
    expect(r.affectations.length).toBe(180);
    expect(new Set(r.affectations.map((a) => a.groupe)).size).toBe(3);
    const lignesTexte = resumerSegmentation(r);
    expect(lignesTexte[0]).toMatch(/3 groupes/);
  });

  it("dit quand il n'y a PAS de structure : les k-moyennes trouvent toujours k groupes", () => {
    const u = generateur(9);
    const lignes = Array.from({ length: 150 }, () => ({ a: u() * 10, b: u() * 10 }));
    const r = segmenter(lignes, { graine: 2 });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.silhouette).toBeLessThan(0.45);
    expect(r.rigueur.limites.some((l) => /TOUJOURS k groupes/.test(l))).toBe(true);
  });

  it("sans normalisation, l'unité de mesure décide du découpage — et c'est DIT", () => {
    const z = normaleStandard(generateur(11));
    // Le CA est en millions, l'âge en années : sans normalisation, l'âge ne compte pour rien.
    const lignes: Record<string, number>[] = [];
    for (let i = 0; i < 50; i += 1) lignes.push({ ca: 1_000_000 + z() * 100_000, age: 25 + z() * 2 });
    for (let i = 0; i < 50; i += 1) lignes.push({ ca: 1_000_000 + z() * 100_000, age: 55 + z() * 2 });
    const brut = segmenter(lignes, { normaliser: false, k: 2, graine: 4 });
    const norme = segmenter(lignes, { normaliser: true, k: 2, graine: 4 });
    if (!brut.ok || !norme.ok) throw new Error("ko");
    const ecartAgeNorme = Math.abs(norme.groupes[0]!.centre.age! - norme.groupes[1]!.centre.age!);
    const ecartAgeBrut = Math.abs(brut.groupes[0]!.centre.age! - brut.groupes[1]!.centre.age!);
    expect(ecartAgeNorme).toBeGreaterThan(20);
    expect(ecartAgeBrut).toBeLessThan(10);
    expect(brut.rigueur.hypotheses.some((h) => /NON normalisées/.test(h))).toBe(true);
  });

  it("écarte les colonnes non numériques et les lignes incomplètes", () => {
    const lignes = [
      ...Array.from({ length: 30 }, (_, i) => ({ x: i, y: i * 2, nom: `client ${i}` })),
      { x: null, y: 5, nom: "trou" },
    ];
    const m = matriceDe(lignes);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.m.colonnes).toEqual(["x", "y"]);
    expect(m.ignorees).toEqual(["nom"]);
    expect(m.m.incompletes).toBe(1);
    const r = segmenter(lignes, { k: 2, graine: 1 });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.rigueur.avertissements.some((a) => /écartée/.test(a))).toBe(true);
  });
});

describe("ml — ACP", () => {
  it("trouve que trois variables redondantes n'en font qu'une", () => {
    const z = normaleStandard(generateur(13));
    const lignes = Array.from({ length: 200 }, () => {
      const f = z();
      return { a: f * 10 + z() * 0.2, b: f * 5 + z() * 0.1, c: -f * 8 + z() * 0.15, bruit: z() * 3 };
    });
    const r = acp(lignes);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.composantes[0]!.varianceExpliqueePourcent).toBeGreaterThan(70);
    expect(r.composantesPour90).toBeLessThanOrEqual(2);
    const p1 = r.composantes[0]!.poids;
    // a, b, c pèsent lourd ; le bruit, non.
    expect(Math.abs(p1.find((x) => x.colonne === "bruit")!.poids)).toBeLessThan(0.2);
    expect(Math.abs(p1.find((x) => x.colonne === "a")!.poids)).toBeGreaterThan(0.4);
    // c est de signe opposé à a.
    expect(p1.find((x) => x.colonne === "a")!.poids * p1.find((x) => x.colonne === "c")!.poids).toBeLessThan(0);
    // Les variances expliquées somment à 100 % quand toutes les composantes sont extraites.
    const total = acp(lignes, undefined, 4);
    if (!total.ok) throw new Error("ko");
    expect(total.composantes.reduce((s, c) => s + c.varianceExpliqueePourcent, 0)).toBeCloseTo(100, 3);
    expect(r.projection.length).toBe(200);
    expect(r.rigueur.limites.some((l) => /elle résume, elle n'explique pas/.test(l))).toBe(true);
  });

  it("dit quand aucune réduction n'est utile", () => {
    const z = normaleStandard(generateur(15));
    const lignes = Array.from({ length: 200 }, () => ({ a: z(), b: z(), c: z(), d: z() }));
    const r = acp(lignes, undefined, 4);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.composantes[0]!.varianceExpliqueePourcent).toBeLessThan(45);
    expect(r.rigueur.avertissements.some((a) => /Aucune réduction utile/.test(a))).toBe(true);
  });
});

describe("ml — anomalies", () => {
  it("trouve la valeur extrême, la combinaison anormale et l'isolé", () => {
    const z = normaleStandard(generateur(19));
    const lignes: Record<string, number>[] = [];
    for (let i = 0; i < 200; i += 1) { const t = z(); lignes.push({ montant: 1000 + t * 100, quantite: 20 + t * 2 }); }
    lignes.push({ montant: 50_000, quantite: 21 });      // 200 : valeur extrême
    lignes.push({ montant: 1200, quantite: 5 });          // 201 : combinaison anormale (montant haut, quantité basse)
    const r = detecterAnomalies(lignes);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const index = r.anomalies.map((a) => a.index);
    expect(index).toContain(200);
    expect(index).toContain(201);
    const extreme = r.anomalies.find((a) => a.index === 200)!;
    expect(extreme.methodes).toContain("écart robuste");
    expect(extreme.raisons.some((x) => /montant/.test(x))).toBe(true);
    const combinaison = r.anomalies.find((a) => a.index === 201)!;
    expect(combinaison.methodes.some((m) => m === "profil multivarié" || m === "isolement")).toBe(true);
    expect(r.rigueur.limites.some((l) => /n'est pas une erreur/.test(l))).toBe(true);
    // Les scores classent : le plus flagrant en premier.
    expect(r.anomalies[0]!.score).toBeGreaterThanOrEqual(r.anomalies[r.anomalies.length - 1]!.score);
  });

  it("la sensibilité change le nombre de signalements et refuse un échantillon trop petit", () => {
    const z = normaleStandard(generateur(23));
    const lignes = Array.from({ length: 300 }, () => ({ x: z() * 10, y: z() * 10 }));
    const large = detecterAnomalies(lignes, { sensibilite: "large" });
    const prudente = detecterAnomalies(lignes, { sensibilite: "prudente" });
    if (!large.ok || !prudente.ok) throw new Error("ko");
    expect(large.anomalies.length).toBeGreaterThanOrEqual(prudente.anomalies.length);
    expect(prudente.seuils.zModifie).toBe(5);
    const petit = detecterAnomalies([{ x: 1 }, { x: 2 }, { x: 300 }]);
    expect(petit.ok).toBe(false);
  });

  it("sur des données sans anomalie, ne crie pas au loup", () => {
    const z = normaleStandard(generateur(29));
    const lignes = Array.from({ length: 300 }, () => ({ a: 50 + z() * 5 }));
    const r = detecterAnomalies(lignes, { sensibilite: "normale" });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.anomalies.length).toBeLessThan(15);
    expect(r.rigueur.limites.some((l) => /l'absence d'anomalie n'est pas une preuve/.test(l))).toBe(true);
  });
});
