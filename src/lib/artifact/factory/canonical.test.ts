import { describe, expect, it } from "vitest";
import {
  calculerTableau, evaluerFormuleLigne, formaterValeur, formuleVerifiable, nomFeuilleDe, verifierCoherence, verifierSpecCanon,
  versClasseur, versDeck, versDocument, type DonneesCanoniques,
} from "@/lib/artifact/factory/canonical";

const canon = (): DonneesCanoniques => ({
  titre: "Revue commerciale T3 2026",
  sousTitre: "Comité de direction du 12 septembre",
  societe: { nom: "Adventum Pharma", couleur: "0B2545" },
  date: "2026-09-05",
  sections: [{ titre: "Faits marquants", puces: ["Croissance de 12 % sur la gamme cardio", "Deux ruptures évitées"] }],
  chiffres: [{ cle: "ca", libelle: "Chiffre d'affaires T3", valeur: 41_300_000, format: "montant" }],
  parametres: [{ nom: "TVA", valeur: 0.19, libelle: "Taux de TVA", format: "0%" }],
  tableaux: [{
    cle: "ventes", titre: "Ventes par région",
    colonnes: [
      { cle: "region", titre: "Région", type: "texte" },
      { cle: "qte", titre: "Quantité", type: "entier" },
      { cle: "pu", titre: "P.U.", type: "montant" },
      { cle: "ht", titre: "HT", type: "montant", formule: "[qte]*[pu]" },
      { cle: "ttc", titre: "TTC", type: "montant", formule: "[ht]*(1+{TVA})" },
    ],
    lignes: [
      { region: "Alger", qte: 120, pu: 250 },
      { region: "Oran", qte: 80, pu: 250 },
      { region: "Constantine", qte: 50, pu: 240.5 },
    ],
    totaux: ["qte", "ht", "ttc"],
  }],
});

describe("les données canoniques — le code calcule, les formats dérivent", () => {
  it("évalue les formules de ligne dans la petite grammaire, et refuse le reste", () => {
    expect(evaluerFormuleLigne("[qte]*[pu]", { qte: 3, pu: 2.5 }, {})).toBe(7.5);
    expect(evaluerFormuleLigne("=[ht]*(1+{TVA})", { ht: 100 }, { TVA: 0.19 })).toBe(119);
    expect(evaluerFormuleLigne("[a]/[b]", { a: 1, b: 0 }, {})).toBeNull();
    expect(evaluerFormuleLigne("SI([qte]>10;1;0)", { qte: 3 }, {})).toBeNull();
    expect(formuleVerifiable("[qte] * [pu] - 3,5")).toBe(true);
    expect(formuleVerifiable("ARRONDI([x];2)")).toBe(false);
    expect(formuleVerifiable("")).toBe(false);
  });

  it("calcule colonnes dérivées et totaux — les colonnes dérivées voient celles calculées avant elles", () => {
    const { lignes, totaux } = calculerTableau(canon().tableaux[0], { TVA: 0.19 });
    expect(lignes.map((l) => l.ht)).toEqual([30_000, 20_000, 12_025]);
    expect(lignes[0].ttc).toBe(35_700);
    expect(totaux).toEqual({ qte: 250, ht: 62_025, ttc: 73_809.75 });
  });

  it("formate à la française, de la même façon pour le deck et la note", () => {
    expect(formaterValeur(41_300_000, "montant")).toBe("41\u00a0300\u00a0000,00\u00a0DZD");
    expect(formaterValeur(0.125, "pourcentage")).toBe("12,5\u00a0%");
    expect(formaterValeur(0.12, "pourcentage")).toBe("12\u00a0%");
    expect(formaterValeur(1250, "entier")).toBe("1\u00a0250");
    expect(formaterValeur(2.5, "nombre")).toBe("2,50");
    expect(formaterValeur("2026-09-05", "date")).toBe("05/09/2026");
    expect(formaterValeur(null)).toBe("");
    expect(nomFeuilleDe("Ventes / T3 : [détail] ?")).toBe("Ventes T3 détail");
  });

  it("refuse une formule hors grammaire, une colonne ou un paramètre inconnu, un total sur une colonne absente", () => {
    const c = canon();
    c.tableaux[0].colonnes[3].formule = "ARRONDI([qte]*[pu];2)";
    c.tableaux[0].colonnes[4].formule = "[ht]*(1+{TVA_INCONNUE})+[inconnue]";
    c.tableaux[0].totaux = ["qte", "marge"];
    const v = verifierSpecCanon(c);
    expect(v.bloquants.some((b) => /grammaire vérifiable/.test(b))).toBe(true);
    expect(v.bloquants.some((b) => /paramètre inconnu \{TVA_INCONNUE\}/.test(b))).toBe(true);
    expect(v.bloquants.some((b) => /colonne inconnue \[inconnue\]/.test(b))).toBe(true);
    expect(v.bloquants.some((b) => /colonne inconnue « marge »/.test(b))).toBe(true);
    expect(verifierSpecCanon({ ...canon(), sections: [], tableaux: [], chiffres: [] }).bloquants).toContain("Le dossier est vide : ni section, ni tableau, ni chiffre.");
    expect(verifierSpecCanon(canon()).bloquants).toEqual([]);
  });

  it("dérive le classeur, le deck et la note de la même structure", () => {
    const c = canon();
    const classeur = versClasseur(c);
    expect(classeur.feuilles.map((f) => f.nom)).toEqual(["Ventes par région", "Chiffres clés"]);
    expect(classeur.feuilles[0].totaux).toEqual({ qte: "SUM", ht: "SUM", ttc: "SUM" });
    expect(classeur.feuilles[0].colonnes[3]).toMatchObject({ cle: "ht", formule: "[qte]*[pu]" });
    const deck = versDeck(c);
    expect(deck.diapos.map((d) => d.titre)).toEqual(["Faits marquants", "Chiffre d'affaires T3", "Ventes par région"]);
    expect(deck.diapos[1].chiffre?.valeur).toBe("41\u00a0300\u00a0000,00\u00a0DZD");
    const tableau = deck.diapos[2].tableau!;
    expect(tableau.lignes.at(-1)).toEqual(["Total", "250", "", "62\u00a0025,00\u00a0DZD", "73\u00a0809,75\u00a0DZD"]);
    const note = versDocument(c);
    expect(note.join("")).toContain("Revue commerciale T3 2026");
    expect(note.join("")).toContain("73\u00a0809,75\u00a0DZD");
  });

  it("tronque un long tableau dans le deck et le dit dans le titre et les notes", () => {
    const c = canon();
    c.tableaux[0].lignes = Array.from({ length: 30 }, (_, i) => ({ region: `R${i}`, qte: 1, pu: 1 }));
    const d = versDeck(c).diapos.at(-1)!;
    expect(d.titre).toBe("Ventes par région (11 premières lignes sur 30)");
    expect(d.tableau!.lignes).toHaveLength(12);
    expect(d.notes).toMatch(/30 lignes/);
    expect(verifierSpecCanon(c).avertissements.some((a) => /11/.test(a))).toBe(true);
  });

  it("compare les totaux du classeur recalculé à ceux du code — et refuse un dossier où rien n'a pu être comparé", () => {
    const c = canon();
    const bon = new Map<string, unknown>([["Ventes par région!B5", 250], ["Ventes par région!D5", 62_025], ["Ventes par région!E5", 73_809.75]]);
    expect(verifierCoherence(c, bon)).toEqual({ ok: true, totauxCompares: 3, ecarts: [] });
    const faux = new Map(bon);
    faux.set("Ventes par région!D5", 62_000);
    const r = verifierCoherence(c, faux);
    expect(r.ok).toBe(false);
    expect(r.ecarts).toEqual(["Ventes par région!D5 : classeur 62000 ≠ canonique 62025"]);
    expect(verifierCoherence(c, new Map()).ecarts).toHaveLength(3);
  });
});
