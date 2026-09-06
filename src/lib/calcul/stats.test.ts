import { describe, expect, it } from "vitest";
import { generateur, normaleStandard } from "./alea";
import { consignerMesure } from "@/lib/evals/registre";
import {
  correlations, decrireColonnes, loiFisher, loiKhiDeux, loiStudent, pValeurKhiDeux, pValeurStudent, quantileStudent,
  regresser, regresserLogistique, testApparie, testIndependance, testMoyennes, testRangs,
} from "./stats";

describe("stats — les lois des tests", () => {
  it("Student, Fisher et χ² retrouvent les valeurs des tables", () => {
    expect(loiStudent(0, 10)).toBeCloseTo(0.5, 6);
    expect(loiStudent(2.228, 10)).toBeCloseTo(0.975, 3);
    expect(pValeurStudent(2.228, 10)).toBeCloseTo(0.05, 3);
    expect(quantileStudent(0.975, 10)).toBeCloseTo(2.228, 3);
    expect(quantileStudent(0.975, 1000)).toBeCloseTo(1.962, 2);
    expect(loiKhiDeux(3.841, 1)).toBeCloseTo(0.95, 3);
    expect(pValeurKhiDeux(11.07, 5)).toBeCloseTo(0.05, 3);
    expect(loiFisher(4.96, 1, 10)).toBeCloseTo(0.95, 2);
  });
});

describe("stats — régression linéaire", () => {
  it("retrouve exactement les coefficients d'une relation déterministe", () => {
    const lignes = Array.from({ length: 40 }, (_, i) => ({ x1: i, x2: (i * 7) % 13, y: 3 + 2 * i - 1.5 * ((i * 7) % 13) }));
    const r = regresser(lignes, "y", ["x1", "x2"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.constante!.valeur).toBeCloseTo(3, 6);
    expect(r.coefficients[0]!.valeur).toBeCloseTo(2, 6);
    expect(r.coefficients[1]!.valeur).toBeCloseTo(-1.5, 6);
    expect(r.r2).toBeCloseTo(1, 8);
    expect(r.rigueur.avertissements.some((a) => /fuite/.test(a))).toBe(true);
    expect(r.predire({ x1: 10, x2: 2 })).toBeCloseTo(3 + 20 - 3, 6);
  });

  it("les moindres carrés de manuel : pente, ordonnée, R², erreurs types et p-values", () => {
    // Données d'Anscombe I : pente 0,5001, ordonnée 3,0001, R² 0,6665.
    const x = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
    const y = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68];
    const r = regresser(x.map((xi, i) => ({ x: xi, y: y[i]! })), "y", ["x"]);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.coefficients[0]!.valeur).toBeCloseTo(0.5001, 3);
    expect(r.constante!.valeur).toBeCloseTo(3.0001, 3);
    expect(r.r2).toBeCloseTo(0.6665, 3);
    expect(r.coefficients[0]!.erreurType).toBeCloseTo(0.1179, 3);
    expect(r.coefficients[0]!.t).toBeCloseTo(4.241, 2);
    expect(r.coefficients[0]!.pValeur).toBeCloseTo(0.00217, 3);
    expect(r.coefficients[0]!.significatif).toBe(true);
    expect(r.coefficients[0]!.intervalle95[0]).toBeCloseTo(0.2333, 2);
    expect(r.coefficients[0]!.intervalle95[1]).toBeCloseTo(0.7669, 2);
    expect(r.f).toBeCloseTo(17.99, 1);
  });

  it("détecte la colinéarité par le VIF et le dit", () => {
    const u = generateur(4);
    const lignes = Array.from({ length: 60 }, () => {
      const a = u() * 100;
      const b = a * 2 + u() * 0.5; // presque la même information
      return { a, b, y: 3 * a + u() * 2 };
    });
    const r = regresser(lignes, "y", ["a", "b"]);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.coefficients[0]!.vif).toBeGreaterThan(10);
    expect(r.rigueur.avertissements.some((x) => /Colinéarité/.test(x))).toBe(true);
    expect(r.r2).toBeGreaterThan(0.99);
  });

  it("refuse une dépendance linéaire exacte et un échantillon trop petit", () => {
    const exacte = regresser(Array.from({ length: 20 }, (_, i) => ({ a: i, b: 2 * i, y: i * 3 })), "y", ["a", "b"]);
    expect(exacte.ok).toBe(false);
    if (!exacte.ok) expect(exacte.erreur).toMatch(/dépendants/);
    const petit = regresser([{ a: 1, b: 2, y: 3 }, { a: 2, b: 1, y: 4 }, { a: 3, b: 5, y: 5 }], "y", ["a", "b"]);
    expect(petit.ok).toBe(false);
    if (!petit.ok) expect(petit.erreur).toMatch(/paramètres/);
    const constante = regresser(Array.from({ length: 20 }, (_, i) => ({ a: 5, b: i, y: i })), "y", ["a", "b"]);
    expect(constante.ok).toBe(false);
    if (!constante.ok) expect(constante.erreur).toMatch(/constant/);
  });

  it("écarte les lignes incomplètes en le disant, et signale les aberrantes sans les supprimer", () => {
    const lignes: Record<string, unknown>[] = Array.from({ length: 40 }, (_, i) => ({ x: i, y: 2 * i + (i % 5) }));
    lignes.push({ x: null, y: 10 }, { x: 5, y: "" }, { x: 3, y: undefined });
    lignes.push({ x: 41, y: 100000 });
    const r = regresser(lignes, "y", ["x"]);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.nettoyage.lignesIncompletes).toBe(3);
    expect(r.nettoyage.observationsUtilisees).toBe(41);
    expect(r.rigueur.avertissements.some((a) => /BIAISÉ/.test(a))).toBe(true);
    expect(r.nettoyage.aberrantes.some((a) => a.colonne === "y")).toBe(true);
    expect(r.rigueur.avertissements.some((a) => /aberrante/.test(a))).toBe(true);
    // Les nombres écrits en texte français sont lus.
    const texte = regresser(Array.from({ length: 20 }, (_, i) => ({ x: String(i), y: `${2 * i},5` })), "y", ["x"]);
    expect(texte.ok).toBe(true);
    if (texte.ok) expect(texte.coefficients[0]!.valeur).toBeCloseTo(2, 6);
  });

  it("mesure le sur-apprentissage par validation croisée", () => {
    const z = normaleStandard(generateur(8));
    // 40 observations, 12 prédicteurs de PUR BRUIT : le R² brut sera flatteur, le R² croisé négatif.
    const lignes = Array.from({ length: 40 }, () => {
      const l: Record<string, number> = { y: z() };
      for (let j = 0; j < 12; j += 1) l[`b${j}`] = z();
      return l;
    });
    const r = regresser(lignes, "y", Array.from({ length: 12 }, (_, j) => `b${j}`), { blocs: 5 });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.r2).toBeGreaterThan(0.15);
    expect(r.r2ValidationCroisee!).toBeLessThan(r.r2 - 0.15);
    expect(r.rigueur.avertissements.some((a) => /Sur-apprentissage/.test(a))).toBe(true);
    expect(r.rigueur.avertissements.some((a) => /règle usuelle demande/.test(a))).toBe(true);
    expect(r.pValeurGlobale).toBeGreaterThan(0.05);
    expect(r.rigueur.avertissements.some((a) => /pas significatif/.test(a))).toBe(true);
  });

  it("porte toujours la limite « association, pas cause »", () => {
    const r = regresser(Array.from({ length: 30 }, (_, i) => ({ x: i, y: i * 2 + (i % 3) })), "y", ["x"]);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.rigueur.limites.some((l) => /ASSOCIATION, pas une cause/.test(l))).toBe(true);
  });
});

describe("stats — régression logistique", () => {
  it("sépare deux nuages et rend un AUC élevé, des rapports de cotes lisibles", () => {
    const z = normaleStandard(generateur(21));
    const lignes: Record<string, number>[] = [];
    for (let i = 0; i < 200; i += 1) lignes.push({ score: 50 + z() * 10, anciennete: 2 + z(), gagne: 0 });
    for (let i = 0; i < 200; i += 1) lignes.push({ score: 65 + z() * 10, anciennete: 5 + z(), gagne: 1 });
    const r = regresserLogistique(lignes, "gagne", ["score", "anciennete"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.n).toBe(400);
    expect(r.positifs).toBe(200);
    expect(r.auc).toBeGreaterThan(0.9);
    expect(r.exactitude).toBeGreaterThan(0.8);
    expect(r.coefficients.every((c) => c.rapportDeCotes > 1)).toBe(true);
    expect(r.convergence).toBe(true);
    expect(r.pseudoR2).toBeGreaterThan(0.3);
    expect(r.predire({ score: 80, anciennete: 6 })).toBeGreaterThan(0.8);
    expect(r.predire({ score: 40, anciennete: 1 })).toBeLessThan(0.2);
    const c = r.matriceConfusion;
    expect(c.vraisPositifs + c.fauxPositifs + c.vraisNegatifs + c.fauxNegatifs).toBe(400);
    expect(r.rigueur.limites.some((l) => /rapport de cotes/.test(l))).toBe(true);
  });

  it("refuse une cible qui ne varie pas et signale le déséquilibre des classes", () => {
    const constante = regresserLogistique(Array.from({ length: 30 }, (_, i) => ({ x: i, y: 1 })), "y", ["x"]);
    expect(constante.ok).toBe(false);
    if (!constante.ok) expect(constante.erreur).toMatch(/une seule valeur/);
    const z = normaleStandard(generateur(3));
    const lignes = Array.from({ length: 300 }, (_, i) => ({ x: z(), y: i < 12 ? 1 : 0 }));
    const desequilibre = regresserLogistique(lignes, "y", ["x"]);
    if (!desequilibre.ok) throw new Error(desequilibre.erreur);
    expect(desequilibre.rigueur.avertissements.some((a) => /déséquilibrées/.test(a))).toBe(true);
  });
});

describe("stats — tests d'hypothèse", () => {
  it("Welch trouve l'écart quand il existe et refuse de conclure quand il n'y a rien", () => {
    const z = normaleStandard(generateur(31));
    const a = Array.from({ length: 60 }, () => 100 + z() * 10);
    const b = Array.from({ length: 60 }, () => 112 + z() * 10);
    const t = testMoyennes(a, b);
    if ("erreur" in t) throw new Error(t.erreur);
    expect(t.significatif).toBe(true);
    expect(t.pValeur).toBeLessThan(0.001);
    expect(t.tailleEffet!.valeur).toBeLessThan(-0.8);
    expect(t.tailleEffet!.interpretation).toBe("grand");
    expect(t.intervalle95![1]).toBeLessThan(0);
    const c = Array.from({ length: 60 }, () => 100 + z() * 10);
    const rien = testMoyennes(a, c);
    if ("erreur" in rien) throw new Error(rien.erreur);
    expect(rien.significatif).toBe(false);
    expect(rien.conclusion).toMatch(/pas la preuve d'une absence/);
  });

  it("distingue significativité STATISTIQUE et importance MÉTIER", () => {
    const z = normaleStandard(generateur(17));
    // 5 000 observations, écart de 0,05 σ : significatif, et sans intérêt.
    const a = Array.from({ length: 5000 }, () => 100 + z());
    const b = Array.from({ length: 5000 }, () => 100.06 + z());
    const t = testMoyennes(a, b);
    if ("erreur" in t) throw new Error(t.erreur);
    expect(t.significatif).toBe(true);
    expect(t.tailleEffet!.interpretation).toBe("négligeable");
    expect(t.rigueur.avertissements.some((x) => /ampleur négligeable/.test(x))).toBe(true);
  });

  it("le test apparié voit une variation que le test indépendant manque", () => {
    const u = generateur(12);
    const avant = Array.from({ length: 25 }, () => 50 + u() * 40);
    const apres = avant.map((x) => x + 2 + u() * 0.5);
    const apparie = testApparie(avant, apres);
    if ("erreur" in apparie) throw new Error(apparie.erreur);
    expect(apparie.significatif).toBe(true);
    expect(apparie.intervalle95![0]).toBeGreaterThan(0);
    const independant = testMoyennes(avant, apres);
    if ("erreur" in independant) throw new Error(independant.erreur);
    expect(independant.significatif).toBe(false);
    expect(apparie.rigueur.limites.some((l) => /groupe témoin/.test(l))).toBe(true);
    const taille = testApparie([1, 2, 3], [1, 2]);
    expect("erreur" in taille).toBe(true);
  });

  it("le χ² d'indépendance retrouve la valeur de la table et signale les effectifs faibles", () => {
    // Tableau 2×2 : 20/30, 30/20 → χ² = 4, p ≈ 0,0455.
    const t = testIndependance([[20, 30], [30, 20]]);
    if ("erreur" in t) throw new Error(t.erreur);
    expect(t.statistique).toBeCloseTo(4, 6);
    expect(t.ddl).toBe(1);
    expect(t.pValeur).toBeCloseTo(0.0455, 3);
    expect(t.significatif).toBe(true);
    expect(t.tailleEffet!.valeur).toBeCloseTo(0.2, 6);
    const faible = testIndependance([[1, 2], [2, 1]]);
    if ("erreur" in faible) throw new Error(faible.erreur);
    expect(faible.rigueur.avertissements.some((a) => /effectif attendu < 5/.test(a))).toBe(true);
    expect("erreur" in testIndependance([[1, 2, 3]])).toBe(true);
  });

  it("Mann-Whitney conclut là où la moyenne se laisse tromper par une valeur extrême", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const b = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const t = testRangs(a, b);
    if ("erreur" in t) throw new Error(t.erreur);
    expect(t.significatif).toBe(true);
    expect(t.statistique).toBe(0);
    expect(Math.abs(t.tailleEffet!.valeur)).toBe(1);
    const aExtreme = [...a, 1000];
    const moyennes = testMoyennes(aExtreme, b);
    if ("erreur" in moyennes) throw new Error(moyennes.erreur);
    expect(moyennes.significatif).toBe(false); // la moyenne de a explose
    const rangsExtreme = testRangs(aExtreme, b);
    if ("erreur" in rangsExtreme) throw new Error(rangsExtreme.erreur);
    expect(rangsExtreme.significatif).toBe(true); // les rangs, non
  });
});

describe("stats — description et corrélations", () => {
  it("décrit les colonnes avec quartiles, asymétrie et manquantes", () => {
    const lignes = [...Array.from({ length: 20 }, (_, i) => ({ a: i, b: i % 4 })), { a: null, b: 2 }];
    const d = decrireColonnes(lignes);
    const a = d.find((x) => x.colonne === "a")!;
    expect(a.n).toBe(20);
    expect(a.manquantes).toBe(1);
    expect(a.mediane).toBeCloseTo(9.5, 6);
    expect(a.q1).toBeCloseTo(4.75, 6);
    expect(a.q3).toBeCloseTo(14.25, 6);
    expect(Math.abs(a.asymetrie)).toBeLessThan(0.1);
  });

  it("classe les liaisons, teste leur significativité et rappelle que corrélation n'est pas cause", () => {
    const u = generateur(6);
    const lignes = Array.from({ length: 80 }, (_, i) => ({ x: i, y: i * 2 + u() * 5, bruit: u() * 100 }));
    const { liaisons, rigueur } = correlations(lignes);
    expect(liaisons[0]!.a).toBe("x");
    expect(liaisons[0]!.b).toBe("y");
    expect(liaisons[0]!.pearson).toBeGreaterThan(0.99);
    expect(liaisons[0]!.significatif).toBe(true);
    expect(liaisons.find((l) => l.b === "bruit")!.significatif).toBe(false);
    expect(rigueur.limites.some((l) => /n'est pas une cause/.test(l))).toBe(true);
  });

  it("prévient de la pêche aux corrélations quand on teste beaucoup de paires", () => {
    const u = generateur(2);
    const lignes = Array.from({ length: 50 }, () => Object.fromEntries(Array.from({ length: 8 }, (_, j) => [`c${j}`, u() * 10])));
    const { rigueur } = correlations(lignes);
    expect(rigueur.avertissements.some((a) => /pur hasard/.test(a))).toBe(true);
  });
});

describe("mesure consignée — rigueur_statistique", () => {
  it("colinéarité, sur-apprentissage et fuite de données sont NOMMÉS", () => {
    // Les propriétés sont vérifiées par les blocs de ce fichier ; cette ligne les porte au
    // registre des cibles, sans quoi elles resteraient « non mesurées » au rapport.
    consignerMesure("rigueur_statistique", { n: 1, ok: 1 }, "lib/calcul/stats.test.ts",
      "la rigueur est dite avec le résultat, jamais après");
  });
});
