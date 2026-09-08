import { describe, expect, it } from "vitest";
import { agregatDuLibelle, promouvoirTotaux } from "./totaux";
import { parserSpec } from "./spec";
import { construireClasseur } from "./xlsx";
import { controlerClasseur } from "./verify";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN TOTAL EST UNE OPÉRATION — et le classeur doit le RECALCULER, pas l'afficher.
 *
 * Le premier test part du VRAI point d'entrée (§118.14, §118.49) : la spec brute telle qu'un
 * modèle l'écrit, `parserSpec`, le classeur produit, le contrôle qui le rouvre. Un test qui
 * appellerait `promouvoirTotaux` seul dirait que la traduction est juste sans dire qu'elle est
 * BRANCHÉE — et c'est exactement ainsi qu'on obtient du code mort couvert par ses tests.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const brut = (rows: string[][], totals: unknown[] = []) => ({
  key: "k", title: "Consolidation", format: "XLSX", fileName: "c",
  summary: [], charts: [], sources: ["ERP"],
  sheets: [{
    name: "Ventes",
    columns: [{ header: "Produit", key: "produit", type: "text" }, { header: "CA", key: "ca", type: "money" }],
    rows: rows.map((values) => ({ values })), computed: [], totals, note: null,
  }],
});

const parse = (b: ReturnType<typeof brut>) => {
  const s = parserSpec(b as never);
  if ("error" in s) throw new Error(s.error);
  return s;
};

describe("un total écrit comme une donnée redevient une formule", () => {
  it("la ligne TOTAL sort des données et le classeur porte une VRAIE formule", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : laisser la ligne dans `rows`. Le classeur produirait alors
     * trois lignes de données, ZÉRO formule, et un chiffre qui ne bouge pas quand on change une
     * hypothèse — la photographie d'un tableur, pas un tableur.
     */
    const spec = parse(brut([["Nivolex", "84500"], ["Trastuzex", "91000"], ["TOTAL", "175500"]]));
    expect(spec.sheets?.[0].rows).toHaveLength(2);
    expect(spec.sheets?.[0].totals).toEqual({ ca: "SUM" });
    expect(spec.constats).toBeUndefined();

    const { buffer } = await construireClasseur(spec);
    const controle = await controlerClasseur(buffer, spec);
    const formules = controle.points.find((p) => p.nom === "formules");
    expect(formules?.detail, "aucune formule : le total ne se recalculera jamais").toContain("1 formule");
    expect(controle.points.find((p) => p.nom === "total:Ventes.ca")?.ok).toBe(true);
    expect(controle.ok).toBe(true);
  });

  it("un total FAUX est nommé, et le livrable ne passe pas VERIFIED", async () => {
    /**
     * 84 500 + 91 000 = 175 500. Le modèle avait écrit 170 000. Avant cette règle : zéro
     * formule, zéro cellule en erreur, `ok: true`, et 5 500 DZD d'écart partis à la direction.
     */
    const spec = parse(brut([["Nivolex", "84500"], ["Trastuzex", "91000"], ["TOTAL", "170000"]]));
    expect(spec.constats?.ecarts).toHaveLength(1);
    expect(spec.constats?.ecarts[0]).toMatchObject({ colonne: "ca", annonce: 170000, calcule: 175500 });

    const { buffer } = await construireClasseur(spec);
    const controle = await controlerClasseur(buffer, spec);
    expect(controle.ok, "un total faux sort VERIFIED").toBe(false);
    const arith = controle.points.find((p) => p.nom === "arithmetique:Ventes.ca");
    // `toLocaleString("fr-FR")` sépare les milliers par une espace fine insécable : on la
    // ramène à une espace ordinaire plutôt que de coller le caractère exact dans le test.
    const dit = (arith?.detail ?? "").replace(/[\s ]+/g, " ");
    expect(dit).toContain("175 500");
    expect(dit).toContain("170 000");
  });

  it("des SOUS-totaux ne sont pas promus — leur plage déborderait sur le groupe suivant", () => {
    const spec = parse(brut([
      ["Alger", "10"], ["Oran", "20"], ["Sous-total", "30"],
      ["Tunis", "40"], ["Sfax", "50"], ["Sous-total", "90"],
    ]));
    expect(spec.sheets?.[0].rows, "les sous-totaux ont été avalés dans une seule plage").toHaveLength(6);
    expect(spec.sheets?.[0].totals).toBeUndefined();
    expect(spec.constats?.suspectes[0]).toContain("sous-totaux");
  });

  it("« Total 2026 » n'est pas traduit — on ne sait pas s'il totalise le tableau ou l'année", () => {
    const spec = parse(brut([["Nivolex", "1"], ["Trastuzex", "2"], ["Total 2026", "3"]]));
    expect(spec.sheets?.[0].rows).toHaveLength(3);
    expect(spec.constats?.suspectes[0]).toContain("Total 2026");
  });

  it("une ligne de données dont le libellé ne dit rien n'est jamais touchée", () => {
    const spec = parse(brut([["Nivolex", "1"], ["Trastuzex", "2"], ["Pembrolizumab", "3"]]));
    expect(spec.sheets?.[0].rows).toHaveLength(3);
    expect(spec.constats).toBeUndefined();
  });

  it("un total DÉJÀ déclaré garde son agrégat, et l'écart se juge sur CET agrégat", () => {
    const spec = parse(brut([["A", "10"], ["B", "20"], ["Moyenne", "15"]], [{ column: "ca", agregat: "AVG" }]));
    expect(spec.sheets?.[0].totals).toEqual({ ca: "AVG" });
    expect(spec.constats).toBeUndefined();
  });

  describe("le vocabulaire est fermé, et il le reste", () => {
    it.each([
      ["TOTAL", "SUM"], ["Totaux", "SUM"], ["Total général", "SUM"], ["  somme  ", "SUM"],
      ["Cumul global", "SUM"], ["Moyenne", "AVG"],
    ])("« %s » déclare %s", (libelle, attendu) => {
      expect(agregatDuLibelle(libelle)).toBe(attendu);
    });

    it.each(["Total 2026", "Total Nivolex", "Sous-total", "Nivolex", "", "Total moyenne"])(
      "« %s » ne déclare rien", (libelle) => { expect(agregatDuLibelle(libelle)).toBeNull(); },
    );
  });

  it("rend null quand il n'y a rien à lire à coup sûr — un null laisse tout passer", () => {
    expect(promouvoirTotaux({
      nomFeuille: "F", totals: {},
      columns: [{ header: "P", key: "p", type: "text" }],
      rows: [{ p: "TOTAL" }, { p: "a" }],
    }), "sans colonne numérique il n'y a pas d'agrégat à faire").toBeNull();
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CLASSEUR EST RECALCULÉ — et la réconciliation peut TOMBER.
 *
 * Celle d'avant s'écrivait `point("reconciliation:…", true, …)` : vraie quoi qu'il arrive, sur
 * n'importe quel fichier, y compris un fichier faux. Elle rassurait, ce qui est pire que rien
 * (§118.17). La règle qui en sort est celle du sabotage : une assertion dont on ne sait pas
 * nommer le cas qui la ferait tomber n'est pas une assertion — alors on produit ce cas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("le classeur produit est RECALCULÉ, pas seulement relu", () => {
  const specComplete = () => parse(brut([["Nivolex", "84500"], ["Trastuzex", "91000"]], [{ column: "ca", agregat: "SUM" }]));

  it("les formules sont évaluées par le moteur du dépôt, et le total tombe juste", async () => {
    const spec = specComplete();
    const { buffer } = await construireClasseur(spec);
    const controle = await controlerClasseur(buffer, spec);

    const recalcul = controle.points.find((p) => p.nom === "recalcul");
    expect(recalcul?.ok, "aucun recalcul : le contrôle croit encore n'avoir pas de moteur").toBe(true);
    expect(recalcul?.detail).toContain("1 formule");

    const reconc = controle.points.find((p) => p.nom === "reconciliation:Ventes.ca");
    expect(reconc?.ok).toBe(true);
    expect(reconc?.detail).toContain("175500");
    expect(controle.nonVerifie.join(" "), "le contrôle déclare encore une impossibilité levée")
      .not.toContain("aucun moteur de calcul");
  });

  it("SABOTAGE — une donnée changée dans le fichier fait TOMBER la réconciliation", async () => {
    /**
     * On produit le classeur, puis on falsifie une cellule de données DANS le fichier, sans
     * toucher ni la spec ni la plage de la formule. Tous les autres contrôles restent verts :
     * l'archive s'ouvre, les relations tiennent, la formule couvre exactement les deux lignes.
     * Seule la VALEUR recalculée diverge — et c'est très exactement ce qu'un constructeur
     * fautif produirait. Si ce test passe au vert, le contrôle est redevenu décoratif.
     */
    const spec = specComplete();
    const { buffer } = await construireClasseur(spec);

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    wb.getWorksheet("Ventes")!.getCell("B2").value = 1;
    const falsifie = Buffer.from(await wb.xlsx.writeBuffer());

    const controle = await controlerClasseur(falsifie, spec);
    const reconc = controle.points.find((p) => p.nom === "reconciliation:Ventes.ca");
    expect(reconc?.ok, "le classeur affiche 91 001 et le contrôle dit que tout va bien").toBe(false);
    expect(reconc?.detail).toContain("91001");
    expect(controle.points.find((p) => p.nom === "total:Ventes.ca")?.ok, "la plage, elle, est restée juste").toBe(true);
    expect(controle.ok).toBe(false);
  });
});
