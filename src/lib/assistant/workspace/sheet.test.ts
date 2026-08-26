import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { sheetPreview, parseCsv, toSheet } from "./sheet";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « MONTRE LE MOI ICI » — dit d'un export Excel.
 *
 * La réponse de production était « Je ne peux pas afficher un fichier Excel ». Ce fichier
 * vérifie que c'était faux, et le restera : un classeur produit par l'ERP se relit dans la
 * conversation, AVANT d'être envoyé à qui que ce soit.
 *
 * Ce qui est verrouillé ici tient en trois points, et le troisième est le plus important :
 *   • un vrai .xlsx se lit (le test en fabrique un, il ne simule pas) ;
 *   • le CSV francophone au point-virgule se lit aussi ;
 *   • un fichier ILLISIBLE rend `null` — jamais un tableau inventé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Un vrai classeur, écrit puis relu — pas une imitation de la structure d'ExcelJS. */
async function xlsx(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Feuille 1");
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("un classeur Excel se relit dans la conversation", () => {
  it("la première ligne devient les en-têtes", async () => {
    const buf = await xlsx([
      ["Référence", "Produit", "Statut"],
      ["REG-001", "Raltegravir", "En instruction"],
      ["REG-002", "Nintedanib", "Déposé"],
    ]);
    const s = await sheetPreview("Export Regulatory.xlsx", buf);
    expect(s).not.toBeNull();
    expect(s?.columns.map((c) => c.label)).toEqual(["Référence", "Produit", "Statut"]);
    expect(s?.rows).toHaveLength(2);
    expect(s?.rows[0].c1).toBe("Raltegravir");
    expect(s?.total).toBe(2);
  });

  it("l'aperçu est BORNÉ, et le total reste celui du FICHIER", async () => {
    // Le PDG doit lire « 200 lignes » et n'en voir que quelques dizaines : un aperçu sert à
    // relire, pas à consulter. Annoncer le nombre de lignes AFFICHÉES ferait croire le fichier
    // plus court qu'il n'est — et c'est ce qu'on enverrait.
    const rows: unknown[][] = [["Colonne A", "Colonne B"]];
    for (let i = 0; i < 200; i += 1) rows.push([`L${i}`, i]);
    const s = await sheetPreview("gros.xlsx", await xlsx(rows));
    expect(s?.total).toBe(200);
    expect(s?.rows.length).toBeLessThanOrEqual(30);
  });

  it("une colonne entièrement numérique s'aligne à droite", async () => {
    const s = await sheetPreview("x.xlsx", await xlsx([["Poste", "Montant"], ["A", 1000], ["B", 2500]]));
    expect(s?.columns.find((c) => c.label === "Montant")?.numeric).toBe(true);
    expect(s?.columns.find((c) => c.label === "Poste")?.numeric).toBe(false);
  });

  it("les dates sortent lisibles, pas en objets", async () => {
    const s = await sheetPreview("d.xlsx", await xlsx([
      ["Dossier", "Dépôt"],
      ["REG-001", new Date(Date.UTC(2026, 7, 24))],
      ["REG-002", new Date(Date.UTC(2026, 7, 25))],
    ]));
    expect(s?.rows[0].c1).toBe("2026-08-24");
  });

  it("une seule ligne de données ne fait pas un tableau", async () => {
    expect(await sheetPreview("x.xlsx", await xlsx([["A", "B"]]))).toBeNull();
  });
});

describe("le CSV — et son point-virgule francophone", () => {
  it("le séparateur est DÉDUIT, pas supposé", () => {
    const pv = parseCsv("Nom;Ville\nAmine;Alger\nKhaled;Oran");
    expect(pv?.columns.map((c) => c.label)).toEqual(["Nom", "Ville"]);
    expect(pv?.rows[1].c1).toBe("Oran");

    const virgule = parseCsv("Nom,Ville\nAmine,Alger\nKhaled,Oran");
    expect(virgule?.columns.map((c) => c.label)).toEqual(["Nom", "Ville"]);
  });

  it("les guillemets d'export sont retirés", () => {
    const s = parseCsv('"Nom";"Poste"\n"Raihana";"Assistante"\n"Deepak";"Directeur"');
    expect(s?.rows[0].c0).toBe("Raihana");
  });
});

describe("ce qu'on ne lit PAS — et qu'on ne fabrique pas non plus", () => {
  it("des octets qui ne sont pas un classeur rendent `null`", async () => {
    expect(await sheetPreview("faux.xlsx", Buffer.from("ceci n'est pas un classeur"))).toBeNull();
  });

  it("un format non pris en charge rend `null` — l'écran dira « téléchargeable »", async () => {
    expect(await sheetPreview("vieux.xls", Buffer.from("x"))).toBeNull();
    expect(await sheetPreview("contrat.pdf", Buffer.from("%PDF-1.7"))).toBeNull();
  });

  it("un en-tête PARTIEL ne bloque pas : la colonne sans nom est numérotée", () => {
    const s = toSheet([["Référence", ""], ["REG-001", "urgent"], ["REG-002", "normal"]]);
    expect(s?.columns.map((c) => c.label)).toEqual(["Référence", "Colonne 2"]);
  });

  it("une ligne ENTIÈREMENT vide en tête est du bruit d'export — elle est ignorée", () => {
    // Beaucoup de classeurs commencent par une ligne blanche. La garder ferait des en-têtes
    // « Colonne 1 / Colonne 2 » d'un fichier qui, lui, en a de très bons.
    const s = toSheet([["", ""], ["Nom", "Ville"], ["Amine", "Alger"], ["Khaled", "Oran"]]);
    expect(s?.columns.map((c) => c.label)).toEqual(["Nom", "Ville"]);
    expect(s?.rows).toHaveLength(2);
  });

  it("une cellule vide s'écrit « — », jamais « undefined »", () => {
    const s = toSheet([["A", "B"], ["x"], ["y", "z"]]);
    expect(s?.rows[0].c1).toBe("—");
  });
});
