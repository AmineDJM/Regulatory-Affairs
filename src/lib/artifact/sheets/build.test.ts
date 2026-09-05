import { describe, expect, it } from "vitest";
import { construireClasseurVerifie, traduireFormule } from "@/lib/artifact/sheets/build";
import { lireClasseur } from "@/lib/artifact/sheets/reader";
import { feuilleParNom, lireCellule } from "@/lib/artifact/sheets/model";
import { comparerClasseurs } from "@/lib/artifact/sheets/diff";
import { tracerCellule, analyserClasseur, lirePlage } from "@/lib/artifact/sheets/analyse";

/**
 * LE CONSTRUCTEUR — un modèle livré est un modèle recalculé et audité. Le test construit un
 * devis (quantités × prix, remise, TVA paramétrée), et vérifie que le fichier FINAL porte les
 * bonnes valeurs, que l'audit ne relève rien, et qu'une spécification fausse est REFUSÉE.
 */
const devis = () => ({
  parametres: [{ nom: "TVA", valeur: 0.19, libelle: "Taux de TVA", format: "0%" }, { nom: "Remise", valeur: 0.05, libelle: "Remise commerciale", format: "0%" }],
  feuilles: [{
    nom: "Devis",
    colonnes: [
      { cle: "produit", titre: "Produit", largeur: 28 },
      { cle: "qte", titre: "Quantité" },
      { cle: "pu", titre: "PU HT", format: "#,##0.00 \"DZD\"" },
      { cle: "ht", titre: "Total HT", formule: "[qte]*[pu]*(1-{Remise})", format: "#,##0.00 \"DZD\"" },
      { cle: "ttc", titre: "Total TTC", formule: "[ht]*(1+{TVA})", format: "#,##0.00 \"DZD\"" },
    ],
    lignes: [
      { produit: "Amoxicilline 500 mg", qte: 100, pu: 120 },
      { produit: "Paracétamol 1 g", qte: 250, pu: 40 },
      { produit: "Ibuprofène 400 mg", qte: 50, pu: 80 },
    ],
    totaux: { ht: "SUM" as const, ttc: "SUM" as const, qte: "SUM" as const },
  }],
  cellules: [{ feuille: "Devis", ref: "G1", valeur: "Contrôle TTC" }, { feuille: "Devis", ref: "G2", formule: "SUM(E2:E4)", format: "#,##0.00" }],
});

describe("le constructeur de classeurs vérifiés", () => {
  it("traduit [colonne] et {paramètre} en A1 et noms définis, et refuse l'inconnu", () => {
    const cols = [{ cle: "qte", titre: "Q" }, { cle: "pu", titre: "P" }];
    expect(traduireFormule("=[qte]*[pu]*(1+{TVA})", cols, 7, new Set(["TVA"]))).toBe("A7*B7*(1+TVA)");
    expect(() => traduireFormule("[prix]*2", cols, 2, new Set())).toThrow(/colonne \[prix\] inconnue/);
    expect(() => traduireFormule("[qte]*{Taux}", cols, 2, new Set())).toThrow(/paramètre \{Taux\} inconnu/);
  });

  it("livre un devis dont les valeurs sont écrites, justes, et dont l'audit ne relève rien", async () => {
    const r = await construireClasseurVerifie(devis());
    expect(r.verification.ok, JSON.stringify(r.verification)).toBe(true);
    expect(r.verification.formules).toBe(3 * 2 + 3 + 1);
    expect(r.verification.erreurs).toEqual([]);
    // Les valeurs attendues : HT = qté × PU × 0,95 ; TTC = HT × 1,19.
    const ht = [100 * 120, 250 * 40, 50 * 80].map((x) => x * 0.95);
    const totalHt = ht.reduce((a, b) => a + b, 0);
    expect(r.valeurs.get("Devis!D2")).toBeCloseTo(ht[0], 6);
    expect(r.valeurs.get("Devis!D5")).toBeCloseTo(totalHt, 6);
    expect(r.valeurs.get("Devis!E5")).toBeCloseTo(totalHt * 1.19, 6);
    expect(r.valeurs.get("Devis!G2")).toBeCloseTo(totalHt * 1.19, 6);
    // Le fichier FINAL porte ces valeurs : un aperçu sans moteur de calcul les montre.
    const c = await lireClasseur(r.octets);
    const f = feuilleParNom(c, "Devis")!;
    expect(lireCellule(f, 5, 5)?.v as number).toBeCloseTo(totalHt * 1.19, 6);
    expect(lireCellule(f, 2, 4)?.f).toBe("B2*C2*(1-Remise)");
    expect(c.noms.map((n) => n.nom).sort()).toEqual(["Remise", "TVA"]);
    // Et l'analyse complète du fichier livré est propre.
    const a = await analyserClasseur(r.octets);
    expect(a.audit.parGravite.CRITIQUE + a.audit.parGravite.HAUTE).toBe(0);
    expect(a.recalcul.ecarts).toEqual([]);
    expect(a.recalcul.nonCalculees).toEqual([]);
  });

  it("refuse de livrer quand une formule donne une erreur", async () => {
    const spec = devis();
    spec.feuilles[0].colonnes[3].formule = "[qte]/[pu]/0";
    const r = await construireClasseurVerifie(spec);
    expect(r.verification.ok).toBe(false);
    // 3 HT, 3 TTC qui en découlent, les deux totaux et la cellule de contrôle : neuf erreurs, toutes nommées.
    expect(r.verification.erreurs.map((e) => e.erreur)).toEqual(new Array(9).fill("#DIV/0!"));
    expect(r.verification.erreurs[0]).toMatchObject({ ref: "Devis!D2", formule: "B2/C2/0" });
  });

  it("trace une cellule livrée : d'où vient le TTC, et ce qui dépend de la TVA", async () => {
    const r = await construireClasseurVerifie(devis());
    const a = await analyserClasseur(r.octets);
    const t = tracerCellule(a.classeur, a.graphe, a.recalcul, "Devis!E5");
    expect(t.ok).toBe(true);
    expect(t.cellule?.formule).toBe("SUM(E2:E4)");
    expect(t.precedents.plages[0].ref).toBe("Devis!E2:E4");
    expect(t.dependants).toEqual([]);
    expect(t.explication).toMatch(/^Devis!E5 vaut .* par la formule =SUM\(E2:E4\)\. Elle lit Devis!E2:E4 \(3 cellule\(s\)/);
    const tva = tracerCellule(a.classeur, a.graphe, a.recalcul, "Paramètres!B2");
    expect(tva.cellule?.valeur).toBe("0.19");
    expect(tva.rayon.formules).toBe(3 + 1 + 1); // les 3 TTC, le total TTC, le contrôle G2
    expect(tva.explication).toMatch(/est une valeur saisie : 0\.19\. 5 formule\(s\) en dépendent/);
    const plage = lirePlage(a.classeur, "Devis!A1:B2");
    expect(plage.lignes).toEqual([["Produit", "Quantité"], ["Amoxicilline 500 mg", "100"]]);
  });

  it("deux devis construits avec une ligne de plus se comparent proprement", async () => {
    const s1 = devis(); const s2 = devis();
    s2.feuilles[0].lignes.splice(1, 0, { produit: "Amlodipine 5 mg", qte: 30, pu: 15 });
    const [a, b] = await Promise.all([construireClasseurVerifie(s1), construireClasseurVerifie(s2)]);
    const c = comparerClasseurs(await lireClasseur(a.octets), await lireClasseur(b.octets));
    expect(c.parGenre.LIGNE_INSEREE).toBe(1);
    // SUM(D2:D4) → SUM(D2:D5) : l'étendue a suivi la ligne insérée. Ce n'est pas une formule
    // modifiée, c'est une plage ajustée — et le total qui en découle a changé de résultat.
    expect(c.parGenre.FORMULE_MODIFIEE ?? 0).toBe(0);
    expect(c.parGenre.PLAGE_AJUSTEE).toBe(3);
    expect(c.parGenre.VALEUR_MODIFIEE ?? 0).toBe(0);
    // Le contrôle G2 (SUM(E2:E4), écrit en dur dans la spécification) n'a PAS suivi : le
    // constructeur du second devis le refuse comme plage tronquée — la vérification a mordu.
    expect(b.verification.ok).toBe(false);
    expect(b.verification.constats.map((x) => `${x.code}@${x.cellule}`)).toEqual(["PLAGE_TRONQUEE@G2"]);
  });
});
