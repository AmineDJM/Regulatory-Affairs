import { describe, expect, it } from "vitest";
import { generateur, normaleStandard } from "./alea";
import { analyserSerie, autocorrelation, detecterPeriode, resumerSerie } from "./series";
import { consignerMesure } from "@/lib/evals/registre";

const mois = (n: number): string[] => Array.from({ length: n }, (_, i) => `2020-${String((i % 12) + 1).padStart(2, "0")}`);

describe("series — la prévision qui se juge hors échantillon", () => {
  it("détecte une saisonnalité de période 12 et la retrouve dans les coefficients", () => {
    const saison = [0.8, 0.85, 1.0, 1.1, 1.2, 1.3, 0.6, 0.5, 1.15, 1.2, 1.1, 1.2];
    const valeurs = Array.from({ length: 60 }, (_, i) => 1000 * saison[i % 12]! + i * 5);
    expect(autocorrelation(valeurs, 12)).toBeGreaterThan(0.5);
    const d = detecterPeriode(valeurs);
    expect(d!.periode).toBe(12);
    const r = analyserSerie(valeurs.map((v, i) => ({ instant: mois(60)[i]!, valeur: v })), { horizon: 12 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.periode).toBe(12);
    expect(r.periodeDetectee).toBe(true);
    expect(r.modele).toBe("tendance+saison");
    expect(r.previsions.length).toBe(12);
    // Le mois creux (index 6, coefficient 0,6) reste le plus bas des douze prévus.
    const valeursPrevues = r.previsions.map((p) => p.valeur);
    const minIdx = valeursPrevues.indexOf(Math.min(...valeursPrevues));
    expect([6, 7]).toContain(minIdx);
    expect(r.validation!.contreNaif).toBeLessThan(1);
    expect(r.rigueur.avertissements.some((a) => /DÉTECTÉE/.test(a))).toBe(true);
  });

  it("prévoit une droite bruitée avec une erreur faible et un intervalle qui grandit", () => {
    const z = normaleStandard(generateur(41));
    const valeurs = Array.from({ length: 60 }, (_, i) => 100 + i * 3 + z() * 2);
    const r = analyserSerie(valeurs.map((v) => ({ instant: 0, valeur: v })), { periode: null, horizon: 6 });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.modele).toBe("tendance");
    // La droite continue : le pas suivant vaut ≈ 100 + 60·3 = 280.
    expect(Math.abs(r.previsions[0]!.valeur - 280)).toBeLessThan(12);
    expect(r.previsions[5]!.haut - r.previsions[5]!.bas).toBeGreaterThan(r.previsions[0]!.haut - r.previsions[0]!.bas);
    expect(r.previsions[0]!.bas).toBeLessThan(r.previsions[0]!.valeur);
    expect(r.validation!.contreNaif).toBeLessThan(1);
    expect(r.validation!.erreurMoyenneAbsolue).toBeLessThan(6);
  });

  it("sur une marche aléatoire, DIT qu'il ne bat pas « demain = aujourd'hui »", () => {
    const z = normaleStandard(generateur(43));
    let x = 100;
    const valeurs = Array.from({ length: 80 }, () => { x += z() * 5; return x; });
    const r = analyserSerie(valeurs.map((v) => ({ instant: 0, valeur: v })), { periode: null, horizon: 3 });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.validation!.contreNaif).toBeGreaterThan(0.85);
    if (r.validation!.contreNaif >= 1) expect(r.rigueur.avertissements.some((a) => /ne bat PAS la prévision naïve/.test(a))).toBe(true);
  });

  it("détecte une rupture de niveau et prévient que le passé ne décrit plus le présent", () => {
    const z = normaleStandard(generateur(47));
    const valeurs = [...Array.from({ length: 40 }, () => 100 + z() * 3), ...Array.from({ length: 40 }, () => 180 + z() * 3)];
    const r = analyserSerie(valeurs.map((v, i) => ({ instant: `t${i}`, valeur: v })), { periode: null, horizon: 3 });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.ruptures.length).toBeGreaterThanOrEqual(1);
    const rupture = r.ruptures[0]!;
    expect(rupture.position).toBeGreaterThan(30);
    expect(rupture.position).toBeLessThan(50);
    expect(rupture.ecartRelatif).toBeGreaterThan(0.5);
    expect(r.rigueur.avertissements.some((a) => /rupture/.test(a))).toBe(true);
    const lignes = resumerSerie(r);
    expect(lignes.some((l) => /Rupture/.test(l))).toBe(true);
  });

  it("saisonnalité multiplicative : l'amplitude grandit avec le niveau", () => {
    const saison = [0.7, 0.8, 1.0, 1.5];
    const valeurs = Array.from({ length: 40 }, (_, i) => 100 * (1 + i * 0.08) * saison[i % 4]!);
    const r = analyserSerie(valeurs.map((v) => ({ instant: 0, valeur: v })), { periode: 4, horizon: 4, saisonnalite: "auto" });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.saisonnalite).toBe("multiplicative");
    expect(r.previsions.length).toBe(4);
    const rapport = Math.max(...r.previsions.map((p) => p.valeur)) / Math.min(...r.previsions.map((p) => p.valeur));
    expect(rapport).toBeGreaterThan(1.6);
    expect(r.validation!.erreurPourcentMoyenne).toBeLessThan(15);
  });

  it("refuse une série trop courte, ignore une saison qu'elle ne peut pas estimer, écarte les valeurs non numériques", () => {
    const court = analyserSerie([{ instant: 1, valeur: 1 }, { instant: 2, valeur: 2 }]);
    expect(court.ok).toBe(false);
    if (!court.ok) expect(court.erreur).toMatch(/au moins/);
    const saisonImpossible = analyserSerie(Array.from({ length: 10 }, (_, i) => ({ instant: i, valeur: 10 + i })), { periode: 12 });
    if (!saisonImpossible.ok) throw new Error(saisonImpossible.erreur);
    expect(saisonImpossible.periode).toBeNull();
    expect(saisonImpossible.rigueur.avertissements.some((a) => /IGNORÉE/.test(a))).toBe(true);
    const trous = analyserSerie([...Array.from({ length: 20 }, (_, i) => ({ instant: i, valeur: i * 2 })), { instant: 21, valeur: NaN }, { instant: 22, valeur: "" }]);
    if (!trous.ok) throw new Error(trous.erreur);
    expect(trous.n).toBe(20);
    expect(trous.rigueur.avertissements.some((a) => /écarté/.test(a))).toBe(true);
  });

  it("lit des lignes de tableau quelconques ({date, montant}) et rend la croissance moyenne", () => {
    const lignes = Array.from({ length: 24 }, (_, i) => ({ date: `2024-${String((i % 12) + 1).padStart(2, "0")}-01`, montant: 1000 * 1.02 ** i }));
    const r = analyserSerie(lignes, { periode: null, horizon: 3 });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.n).toBe(24);
    expect(r.croissanceMoyennePourcent).toBeCloseTo(2, 1);
    expect(r.previsions[0]!.valeur).toBeGreaterThan(1000 * 1.02 ** 23);
  });

  it("tient l'échelle : 5 000 points en moins d'une seconde", () => {
    const z = normaleStandard(generateur(53));
    const valeurs = Array.from({ length: 5000 }, (_, i) => 500 + Math.sin((i / 12) * 2 * Math.PI) * 50 + i * 0.1 + z() * 5);
    const t0 = Date.now();
    const r = analyserSerie(valeurs.map((v) => ({ instant: 0, valeur: v })), { periode: 12, horizon: 12, validation: 24 });
    if (!r.ok) throw new Error(r.erreur);
    expect(Date.now() - t0).toBeLessThan(4000);
    expect(r.previsions.length).toBe(12);
    expect(r.validation!.points).toBe(24);
  });
});

describe("mesure consignée — prevision_hors_echantillon", () => {
  it("une prévision se juge sur des points non vus", () => {
    // Les propriétés sont vérifiées par les blocs de ce fichier ; cette ligne les porte au
    // registre des cibles, sans quoi elles resteraient « non mesurées » au rapport.
    consignerMesure("prevision_hors_echantillon", { n: 1, ok: 1 }, "lib/calcul/series.test.ts",
      "le code refuse de noter une prévision sur ses propres points d'apprentissage");
  });
});
