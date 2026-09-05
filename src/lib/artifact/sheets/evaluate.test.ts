import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { evaluerFormule, recalculer, ErreurExcel, type Scalaire } from "@/lib/artifact/sheets/evaluate";
import { construireGraphe, idDe } from "@/lib/artifact/sheets/graph";
import { lireClasseur } from "@/lib/artifact/sheets/reader";
import { nouvelleFeuille, poserCellule, type Classeur } from "@/lib/artifact/sheets/model";

/**
 * L'ÉVALUATEUR — comparé à ce qu'Excel AFFICHE, pas à ce qu'on croit qu'il calcule.
 *
 * Chaque valeur attendue ci-dessous a été vérifiée dans Excel : les coercions (« 3 » + 4 = 7,
 * VRAI + 1 = 2, « abc » + 1 = #VALUE!), les dates en numéros de série, la finance (PMT, VAN,
 * TRI) à la décimale près. Un moteur qui calcule « à peu près » comme Excel produit des audits
 * faux — et un audit faux est pire qu'aucun audit.
 */

const f = (formule: string, classeur?: Classeur, maintenant?: Date): Scalaire => evaluerFormule(formule, classeur, { maintenant, feuille: 1 });
const brut = (v: Scalaire): unknown => (v instanceof ErreurExcel ? v.code : v);

/** Un classeur construit en mémoire : Ventes (tableau) + Param (TVA) + un nom défini. */
function classeurVentes(): Classeur {
  const ventes = nouvelleFeuille(1, "Ventes");
  const lignes: [string, number, number][] = [["Amoxicilline", 10, 120], ["Paracétamol", 25, 40], ["Ibuprofène", 5, 80], ["Amlodipine", 40, 15]];
  poserCellule(ventes, { row: 1, col: 1, v: "Produit", t: "s", f: null });
  poserCellule(ventes, { row: 1, col: 2, v: "Qté", t: "s", f: null });
  poserCellule(ventes, { row: 1, col: 3, v: "PU", t: "s", f: null });
  lignes.forEach(([nom, q, pu], i) => {
    poserCellule(ventes, { row: i + 2, col: 1, v: nom, t: "s", f: null });
    poserCellule(ventes, { row: i + 2, col: 2, v: q, t: "n", f: null });
    poserCellule(ventes, { row: i + 2, col: 3, v: pu, t: "n", f: null });
    poserCellule(ventes, { row: i + 2, col: 4, v: q * pu, t: "n", f: `B${i + 2}*C${i + 2}` });
  });
  poserCellule(ventes, { row: 7, col: 2, v: "3", t: "s", f: null }); // un nombre stocké en texte
  const param = nouvelleFeuille(2, "Param");
  poserCellule(param, { row: 1, col: 1, v: "TVA", t: "s", f: null });
  poserCellule(param, { row: 1, col: 2, v: 0.19, t: "n", f: null });
  return { feuilles: [ventes, param], noms: [{ nom: "TauxTVA", refersTo: "Param!$B$1", feuille: null }], limites: [] };
}

describe("l'évaluateur — arithmétique et coercitions d'Excel", () => {
  it("respecte la priorité, le pourcentage, la puissance et la concaténation", () => {
    expect(f("=1+2*3")).toBe(7);
    expect(f("(1+2)*3")).toBe(9);
    expect(f("=2^3^2")).toBe(64); // Excel : associativité GAUCHE, (2^3)^2
    expect(f("=-2^2")).toBe(4); // Excel : le moins unaire prime sur ^
    expect(f("=50%")).toBe(0.5);
    expect(f("=200*10%")).toBe(20);
    expect(f("=\"Total : \"&12&\" DZD\"")).toBe("Total : 12 DZD");
    expect(f("=10/4")).toBe(2.5);
  });

  it("coerce comme Excel : texte numérique, booléens, et #VALUE! sur un texte non numérique", () => {
    expect(f("=\"3\"+4")).toBe(7);
    expect(f("=TRUE+1")).toBe(2);
    expect(brut(f("=\"abc\"+1"))).toBe("#VALUE!");
    expect(brut(f("=1/0"))).toBe("#DIV/0!");
    expect(f("=1=1")).toBe(true);
    expect(f("=\"a\"<\"b\"")).toBe(true);
    expect(f("=\"A\"=\"a\"")).toBe(true); // comparaison de texte insensible à la casse
    expect(f("=2<>2")).toBe(false);
  });

  it("IF est paresseux, IFERROR rattrape, les erreurs se propagent", () => {
    expect(f("=IF(1>0,\"oui\",1/0)")).toBe("oui");
    expect(f("=IFERROR(1/0,\"n/a\")")).toBe("n/a");
    expect(brut(f("=SUM(1,1/0)"))).toBe("#DIV/0!");
    expect(f("=IFS(1>2,\"a\",2>1,\"b\")")).toBe("b");
    expect(f("=AND(TRUE,1>0)")).toBe(true);
    expect(f("=OR(FALSE,0)")).toBe(false);
    expect(f("=NOT(TRUE)")).toBe(false);
    expect(f("=ISNUMBER(\"3\")")).toBe(false);
    expect(f("=ISERROR(1/0)")).toBe(true);
  });
});

describe("l'évaluateur — plages, critères, recherches, texte, dates, finance", () => {
  const c = classeurVentes();

  it("agrège des plages et des références inter-feuilles, avec les alias français", () => {
    expect(f("=SUM(D2:D5)", c)).toBe(1200 + 1000 + 400 + 600);
    expect(f("=SOMME(B2:B5)", c)).toBe(80);
    expect(f("=AVERAGE(C2:C5)", c)).toBe(63.75);
    expect(f("=MOYENNE(C2:C5)", c)).toBe(63.75);
    expect(f("=COUNT(A1:D5)", c)).toBe(12); // les nombres seulement, pas les en-têtes ni les produits
    expect(f("=COUNTA(A1:A5)", c)).toBe(5);
    expect(f("=NB(B7)", c)).toBe(0); // « 3 » en texte n'est PAS compté par NB
    expect(f("=SUM(B7)", c)).toBe(0); // ni sommé — Excel ignore le texte dans une plage
    expect(f("=B7+1", c)).toBe(4); // mais une référence directe est coercée
    expect(f("=MAX(D2:D5)-MIN(D2:D5)", c)).toBe(800);
    expect(f("=SUMPRODUCT(B2:B5,C2:C5)", c)).toBe(3200);
    expect(f("=Param!B1*100", c)).toBe(19);
    expect(f("=SUM(D2:D5)*TauxTVA", c)).toBeCloseTo(608, 9);
    expect(f("=MEDIAN(B2:B5)", c)).toBe(17.5);
    expect(f("=LARGE(D2:D5,2)", c)).toBe(1000);
    expect(f("=RANK(D3,D2:D5)", c)).toBe(2);
  });

  it("applique les critères d'Excel : comparaisons, jokers, égalité insensible à la casse", () => {
    expect(f("=SUMIF(B2:B5,\">20\",D2:D5)", c)).toBe(1000 + 600);
    expect(f("=COUNTIF(A2:A5,\"Am*\")", c)).toBe(2);
    expect(f("=NB.SI(A2:A5,\"amoxicilline\")", c)).toBe(1);
    expect(f("=SUMIFS(D2:D5,B2:B5,\">=10\",C2:C5,\"<100\")", c)).toBe(1000 + 600);
    expect(f("=COUNTIFS(B2:B5,\">5\",C2:C5,\"<50\")", c)).toBe(2);
    expect(f("=AVERAGEIF(B2:B5,\"<30\")", c)).toBe((10 + 25 + 5) / 3);
    expect(f("=COUNTBLANK(A1:E5)", c)).toBe(6); // D1 (pas d'en-tête) + E1:E5, au-delà du contenu
  });

  it("cherche comme Excel : RECHERCHEV exacte/approchée, EQUIV/INDEX, XLOOKUP, CHOOSE", () => {
    expect(f("=VLOOKUP(\"Ibuprofène\",A2:D5,4,FALSE)", c)).toBe(400);
    expect(f("=RECHERCHEV(\"Paracétamol\",A2:D5,2,0)", c)).toBe(25);
    expect(brut(f("=VLOOKUP(\"Inconnu\",A2:D5,2,FALSE)", c))).toBe("#N/A");
    expect(f("=IFNA(VLOOKUP(\"Inconnu\",A2:D5,2,FALSE),\"absent\")", c)).toBe("absent");
    expect(f("=INDEX(D2:D5,MATCH(\"Amlodipine\",A2:A5,0))", c)).toBe(600);
    expect(f("=EQUIV(25,B2:B5,0)", c)).toBe(2);
    expect(f("=XLOOKUP(\"Amlodipine\",A2:A5,C2:C5)", c)).toBe(15);
    expect(f("=XLOOKUP(\"Rien\",A2:A5,C2:C5,\"?\")", c)).toBe("?");
    expect(f("=HLOOKUP(\"PU\",A1:D5,3,FALSE)", c)).toBe(40);
    expect(f("=CHOOSE(2,\"a\",\"b\",\"c\")")).toBe("b");
    expect(f("=INDEX(A2:D5,2,1)", c)).toBe("Paracétamol");
    // Recherche APPROCHÉE sur une colonne triée : 30 tombe entre 25 et 40.
    expect(f("=VLOOKUP(30,{5,\"a\";25,\"b\";40,\"c\"},2,TRUE)")).toBe("b");
    expect(f("=ROW(B7)")).toBe(7);
    expect(f("=COLUMN(D1)")).toBe(4);
    expect(f("=ROWS(A1:A10)*COLUMNS(A1:C1)")).toBe(30);
  });

  it("manipule le texte", () => {
    expect(f("=LEFT(\"Adventum\",3)")).toBe("Adv");
    expect(f("=GAUCHE(\"Adventum\",3)")).toBe("Adv");
    expect(f("=RIGHT(\"Adventum\",2)")).toBe("um");
    expect(f("=MID(\"Adventum\",3,4)")).toBe("vent");
    expect(f("=LEN(\"  a b  \")")).toBe(7);
    expect(f("=TRIM(\"  a   b  \")")).toBe("a b");
    expect(f("=UPPER(\"dz\")&LOWER(\"DA\")")).toBe("DZda");
    expect(f("=PROPER(\"amine djouamai\")")).toBe("Amine Djouamai");
    expect(f("=SUBSTITUTE(\"a-b-c\",\"-\",\"+\")")).toBe("a+b+c");
    expect(f("=FIND(\"b\",\"abc\")")).toBe(2);
    expect(brut(f("=FIND(\"z\",\"abc\")"))).toBe("#VALUE!");
    expect(f("=SEARCH(\"B\",\"abc\")")).toBe(2);
    expect(f("=VALUE(\"12.5\")")).toBe(12.5);
    expect(f("=CONCATENATE(\"a\",1,TRUE)")).toBe("a1TRUE");
    expect(f("=TEXTJOIN(\", \",TRUE,\"a\",\"\",\"b\")")).toBe("a, b");
    expect(f("=TEXT(1234.5,\"0.00\")")).toBe("1234.50");
    expect(f("=TEXT(0.256,\"0%\")")).toBe("26%");
    expect(f("=ROUND(2.345,2)")).toBe(2.35);
    expect(f("=ARRONDI(-2.5,0)")).toBe(-3); // Excel arrondit loin de zéro
    expect(f("=ROUNDUP(2.01,0)")).toBe(3);
    expect(f("=ROUNDDOWN(-2.99,0)")).toBe(-2);
    expect(f("=MOD(-7,3)")).toBe(2); // signe du diviseur, comme Excel
    expect(f("=INT(-2.5)")).toBe(-3);
  });

  it("compte les dates en numéros de série, avec « aujourd'hui » injecté", () => {
    const maintenant = new Date(Date.UTC(2026, 8, 5, 10, 30));
    expect(f("=DATE(2026,9,5)")).toBe(46270);
    expect(f("=TODAY()", undefined, maintenant)).toBe(46270);
    expect(f("=AUJOURDHUI()", undefined, maintenant)).toBe(46270);
    expect(f("=YEAR(DATE(2026,9,5))")).toBe(2026);
    expect(f("=MOIS(DATE(2026,9,5))")).toBe(9);
    expect(f("=JOUR(DATE(2026,9,5))")).toBe(5);
    expect(f("=EOMONTH(DATE(2026,2,10),0)")).toBe(f("=DATE(2026,2,28)"));
    expect(f("=EDATE(DATE(2026,1,31),1)")).toBe(f("=DATE(2026,2,28)"));
    expect(f("=DAYS(DATE(2026,12,31),DATE(2026,1,1))")).toBe(364);
    expect(f("=DATEDIF(DATE(2020,3,15),DATE(2026,9,5),\"Y\")")).toBe(6);
    expect(f("=DATEDIF(DATE(2026,1,1),DATE(2026,9,5),\"M\")")).toBe(8);
    expect(f("=NETWORKDAYS(DATE(2026,9,1),DATE(2026,9,30))")).toBe(22);
    expect(f("=WEEKDAY(DATE(2026,9,5))")).toBe(7); // samedi, convention 1 = dimanche
    expect(f("=DATE(2026,13,1)")).toBe(f("=DATE(2027,1,1)")); // débordement de mois comme Excel
  });

  it("calcule la finance comme Excel (PMT, PV, FV, VAN, TRI)", () => {
    expect(f("=PMT(0.05/12,60,10000)") as number).toBeCloseTo(-188.71, 2);
    expect(f("=PV(0.08,10,-1000)") as number).toBeCloseTo(6710.08, 2);
    expect(f("=FV(0.06/12,120,-100)") as number).toBeCloseTo(16387.93, 2);
    expect(f("=NPV(0.1,-10000,3000,4200,6800)") as number).toBeCloseTo(1188.44, 2); // l'exemple de la doc Excel
    expect(f("=VAN(0.1,{3000,4200,6800})") as number).toBeCloseTo(11307.29, 2);
    expect(f("=IRR({-70000,12000,15000,18000,21000,26000})") as number).toBeCloseTo(0.0866, 4);
    expect(f("=ABS(-3)+SQRT(16)+POWER(2,10)")).toBe(1031);
    expect(f("=ROUND(LN(EXP(2)),10)")).toBe(2);
    expect(f("=LOG(1000)")).toBe(3);
    expect(f("=STDEV({2,4,4,4,5,5,7,9})") as number).toBeCloseTo(2.138, 3);
  });

  it("rend #NAME? sur une fonction inconnue, sans la taire", () => {
    expect(brut(f("=FONCTION_INVENTEE(1)"))).toBe("#NAME?");
  });
});

describe("le recalcul d'un vrai classeur", () => {
  async function classeur(opts: { faux?: boolean; cycle?: boolean; inconnue?: boolean } = {}): Promise<Classeur> {
    const wb = new ExcelJS.Workbook();
    const v = wb.addWorksheet("Ventes");
    v.addRow(["Produit", "Qté", "PU", "Total"]);
    v.addRow(["A", 2, 100, { formula: "B2*C2", result: 200 }]);
    v.addRow(["B", 3, 50, { formula: "B3*C3", result: 150 }]);
    v.addRow(["C", 4, 25, { formula: "B4*C4", result: opts.faux ? 999 : 100 }]);
    v.addRow(["Total", null, null, { formula: "SUM(D2:D4)", result: 450 }]);
    v.addRow(["TTC", null, null, { formula: "D5*(1+TauxTVA)", result: 535.5 }]);
    if (opts.cycle) {
      v.getCell("F1").value = { formula: "F2+1", result: 1 };
      v.getCell("F2").value = { formula: "F1+1", result: 2 };
    }
    if (opts.inconnue) v.getCell("G1").value = { formula: "MACRO_MAISON(D5)", result: 0 };
    const p = wb.addWorksheet("Param");
    p.addRow(["TVA", 0.19]);
    wb.definedNames.add("Param!$B$1", "TauxTVA");
    return lireClasseur(Buffer.from(await wb.xlsx.writeBuffer()));
  }

  it("retrouve exactement les valeurs affichées d'un classeur sain : zéro écart", async () => {
    const c = await classeur();
    const g = construireGraphe(c);
    const r = recalculer(c, g);
    expect(r.ecarts).toEqual([]);
    expect(r.circulaires).toEqual([]);
    expect(r.fonctionsInconnues).toEqual([]);
    expect(r.metriques.formules).toBe(5);
    expect(r.valeurs.get(idDe(1, 5, 4))).toBe(450);
    expect(r.valeurs.get(idDe(1, 6, 4))).toBeCloseTo(535.5, 9);
  });

  it("nomme la cellule dont la valeur enregistrée ne correspond plus à sa formule", async () => {
    const c = await classeur({ faux: true });
    const r = recalculer(c, construireGraphe(c));
    // D4 affiche 999 mais vaut 100 ; D5 affiche 450 (= somme des valeurs VRAIES) et le recalcul
    // le confirme : l'écart est localisé à sa source, pas propagé en cascade.
    expect(r.ecarts.map((e) => e.id)).toEqual([idDe(1, 4, 4)]);
    expect(r.ecarts[0]).toMatchObject({ formule: "B4*C4", affichee: 999, recalculee: 100 });
  });

  it("isole une référence circulaire sans bloquer le reste, et nomme une fonction inconnue", async () => {
    const c = await classeur({ cycle: true, inconnue: true });
    const g = construireGraphe(c);
    const r = recalculer(c, g);
    expect(g.cycles).toHaveLength(1);
    expect(new Set(r.circulaires)).toEqual(new Set([idDe(1, 1, 6), idDe(1, 2, 6)]));
    expect(r.fonctionsInconnues).toEqual(["MACRO_MAISON"]);
    expect(r.valeurs.get(idDe(1, 5, 4))).toBe(450); // le reste est recalculé
    // La formule non vérifiable garde sa valeur AFFICHÉE (0) : un #NAME? de notre fait cascaderait
    // en faux écarts sur tout ce qui en dépend.
    expect(r.nonVerifiees).toEqual([idDe(1, 1, 7)]);
    expect(r.valeurs.get(idDe(1, 1, 7))).toBe(0);
    expect(r.ecarts).toEqual([]);
  });
});
