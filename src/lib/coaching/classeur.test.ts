import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { lireClasseur } from "@/lib/artifact/sheets/reader";
import { construireGraphe, idDe } from "@/lib/artifact/sheets/graph";
import { recalculer } from "@/lib/artifact/sheets/evaluate";
import { GRILLE_PAR_DEFAUT, type Points } from "./grille";
import { construireClasseurFiche, construireClasseurSuivi, nomDeFichier, type FichePourClasseur } from "./classeur";

/**
 * LE CLASSEUR TÉLÉCHARGÉ (§118.157) — rouvert par NOTRE lecteur, recalculé par NOTRE moteur.
 *
 * « Le fichier s'ouvre » ne prouve rien (§118.24, §118.54). Ce banc rouvre le classeur, relit
 * ses textes, et RECALCULE ses formules : le total que la formule produit doit retomber sur le
 * total que le module pur a calculé — deux chemins indépendants, un seul nombre (§118.59).
 */

const EXEMPLE: Record<string, Points> = { A: 3, B: 3, C: 3, D: 2, E: 2 };

const fiche = (p: Partial<FichePourClasseur> = {}): FichePourClasseur => ({
  grille: GRILLE_PAR_DEFAUT,
  gridVersion: 1,
  collaborateur: "Amel Haddad",
  manager: "Karim Benali",
  visitDate: new Date("2026-09-12T00:00:00.000Z"),
  sector: "Centre — Région Centre — BU Oncologie",
  notes: EXEMPLE,
  strengths: "Préparation soignée du portefeuille.\nBonne connaissance de l'historique.",
  improvements: "Laisser davantage parler le médecin.",
  status: "FINALIZED",
  finalizedAt: new Date("2026-09-13T09:00:00.000Z"),
  finalisePar: "Karim Benali",
  ...p,
});

function colLigne(ref: string): { row: number; col: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
  const col = m[1]!.split("").reduce((s, c) => s * 26 + (c.charCodeAt(0) - 64), 0);
  return { row: Number(m[2]), col };
}

async function textes(octets: Buffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(octets as unknown as ArrayBuffer);
  const ws = wb.getWorksheet("Fiche de coaching")!;
  const out: string[] = [];
  ws.eachRow((row) => row.eachCell((c) => {
    if (c.master.address !== c.address) return;
    const v = c.value as unknown;
    if (v && typeof v === "object" && "richText" in (v as object)) out.push((v as { richText: { text: string }[] }).richText.map((r) => r.text).join(""));
    else if (v !== null && v !== undefined && typeof v !== "object") out.push(String(v));
  }));
  return out.join("\n");
}

describe("la fiche en classeur — au format du modèle de la Direction", () => {
  it("la formule du total, RECALCULÉE, retombe sur le total de la fiche (13 / 20, comme la cellule D16 du modèle)", async () => {
    const { octets, total, max, celluleTotal } = await construireClasseurFiche(fiche());
    expect([total, max]).toEqual([13, 20]);
    const classeur = await lireClasseur(octets);
    const feuille = classeur.feuilles.find((f) => f.nom === "Fiche de coaching")!;
    const { row, col } = colLigne(celluleTotal);
    const cellule = [...feuille.cellules.values()].find((c) => c.row === row && c.col === col);
    expect(cellule?.f, "le total est une FORMULE, pas une photographie").toMatch(/^D\d+(\+D\d+){4}$/);
    const recalcul = recalculer(classeur, construireGraphe(classeur));
    expect(recalcul.valeurs.get(idDe(feuille.index, row, col))).toBe(13);
    expect(recalcul.ecarts, "chaque valeur affichée est celle que sa formule produit").toEqual([]);
  });

  it("TÉMOIN : un total affiché faux (formule intacte) est vu par le recalcul — sans lui, l'assertion précédente ne pourrait pas tomber", async () => {
    const { octets, celluleTotal } = await construireClasseurFiche(fiche());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(octets as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Fiche de coaching")!;
    const c = ws.getCell(celluleTotal);
    c.value = { formula: (c.value as { formula: string }).formula, result: 19 };
    const falsifie = Buffer.from(await wb.xlsx.writeBuffer());
    const classeur = await lireClasseur(falsifie);
    const recalcul = recalculer(classeur, construireGraphe(classeur));
    expect(recalcul.ecarts.length).toBeGreaterThan(0);
  });

  it("chaque axe RENVOIE au niveau retenu (`=Cn`), comme le modèle — et un axe non noté reste vide", async () => {
    const { octets } = await construireClasseurFiche(fiche({ notes: { A: 4, B: 1 }, status: "DRAFT", finalizedAt: null, finalisePar: null }));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(octets as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Fiche de coaching")!;
    const formules: { cellule: string; formule: string; resultat: unknown }[] = [];
    ws.eachRow((row) => row.eachCell((c) => {
      // Une cellule FUSIONNÉE se relit sur chacune de ses cases : seule la case maîtresse compte.
      if (c.master.address !== c.address) return;
      const v = c.value as { formula?: string; result?: unknown } | null;
      if (v && typeof v === "object" && v.formula) formules.push({ cellule: c.address, formule: v.formula, resultat: v.result });
    }));
    const parAxe = formules.filter((f) => /^C\d+$/.test(f.formule));
    expect(parAxe, "seuls les axes NOTÉS portent une formule").toHaveLength(2);
    for (const f of parAxe) {
      const niveau = ws.getCell(f.formule).value;
      expect(niveau, `${f.cellule} renvoie à ${f.formule}, qui doit porter le niveau retenu`).toBe(f.resultat);
    }
    expect(parAxe.map((f) => f.resultat)).toEqual([4, 1]);
    const total = formules.find((f) => f.formule.includes("+"))!;
    expect(total.resultat, "le total d'un brouillon est partiel, et le pied le dit").toBe(5);
    expect(await textes(octets)).toMatch(/BROUILLON — fiche non finalisée/);
  });

  it("porte chaque texte de la fiche : en-tête, échelle, les vingt critères, le bilan, la version de grille", async () => {
    const { octets } = await construireClasseurFiche(fiche());
    const t = await textes(octets);
    for (const attendu of [
      "FICHE DE COACHING – TOURNÉE EN DOUBLE",
      "Collaborateur : Amel Haddad", "Manager : Karim Benali", "Date : 12/09/2026",
      "Secteur / Région / CDR : Centre — Région Centre — BU Oncologie",
      "Échelle d'Évaluation (Niveaux de Maîtrise)",
      "MB = Maîtrise Basique (Insuffisant / À développer) : 1",
      "PM = Parfaite Maîtrise (Exemplaire / Stratégique) : 4",
      "Grille d'Évaluation des Compétences",
      "Axe d'Évaluation", "Critères d'Observation", "Niveau de Maîtrise", "Total des Points",
      "Bilan & Plan d'Action", "1. Points Forts Observés :", "2. Points à Améliorer :",
      "Laisser davantage parler le médecin.", "Grille version 1",
    ]) expect(t, attendu).toContain(attendu);
    for (const axe of GRILLE_PAR_DEFAUT.axes) {
      expect(t).toContain(axe.titre);
      axe.criteres.forEach((c, k) => expect(t).toContain(`• ${GRILLE_PAR_DEFAUT.niveaux[k]!.code} : ${c}`));
    }
  });

  it("fusionne l'axe et son total sur quatre lignes, et s'imprime sur une largeur de page A4 portrait", async () => {
    const { octets } = await construireClasseurFiche(fiche());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(octets as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Fiche de coaching")!;
    const fusions = (ws.model as { merges?: string[] }).merges ?? [];
    const verticales = fusions.filter((m) => /^([AD])(\d+):\1(\d+)$/.test(m) && (() => {
      const [, , a, b] = /^([AD])(\d+):\1(\d+)$/.exec(m)!;
      return Number(b) - Number(a) === 3;
    })());
    expect(verticales, "cinq axes × (titre + total)").toHaveLength(10);
    expect(ws.pageSetup.orientation).toBe("portrait");
    expect(ws.pageSetup.paperSize).toBe(9);
    expect(ws.pageSetup.fitToWidth).toBe(1);
  });

  it("un nom de fichier sans accent ni espace", () => {
    expect(nomDeFichier("Amel Haddad", new Date("2026-09-12T00:00:00.000Z"))).toBe("Fiche_coaching_Amel_Haddad_2026-09-12.xlsx");
    expect(nomDeFichier("Aïcha Benaïssa-Oukil", new Date("2026-01-02T00:00:00.000Z"))).toBe("Fiche_coaching_Aicha_Benaissa_Oukil_2026-01-02.xlsx");
  });
});

describe("le classeur de suivi — l'outil de gestion du directeur des opérations", () => {
  it("une ligne par fiche, les axes en colonnes, et la synthèse", async () => {
    const lignes = [
      { collaboratorId: "k1", collaborateur: "Amel Haddad", visitDate: new Date("2026-06-01T00:00:00Z"), status: "FINALIZED" as const, grille: GRILLE_PAR_DEFAUT, notes: { A: 2, B: 2, C: 2, D: 2, E: 2 } as Record<string, Points>, manager: "Karim", sector: "Centre", gridVersion: 1, strengths: "Ponctuelle", improvements: "Objections" },
      { collaboratorId: "k1", collaborateur: "Amel Haddad", visitDate: new Date("2026-09-12T00:00:00Z"), status: "FINALIZED" as const, grille: GRILLE_PAR_DEFAUT, notes: EXEMPLE, manager: "Karim", sector: "Centre", gridVersion: 1, strengths: null, improvements: null },
    ];
    const octets = await construireClasseurSuivi(lignes, GRILLE_PAR_DEFAUT);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(octets as unknown as ArrayBuffer);
    const fiches = wb.getWorksheet("Fiches")!;
    const entete = (fiches.getRow(1).values as unknown[]).slice(1);
    expect(entete.slice(4, 9)).toEqual(GRILLE_PAR_DEFAUT.axes.map((a) => a.titre));
    expect(fiches.rowCount).toBe(3);
    const derniere = (fiches.getRow(3).values as unknown[]).slice(1);
    expect(derniere.slice(4, 9)).toEqual([3, 3, 3, 2, 2]);
    expect(derniere[9]).toBe(13);
    expect(derniere[10]).toBe(20);
    expect((fiches.getRow(2).values as unknown[]).slice(1)).toContain("Ponctuelle");
    const syn = wb.getWorksheet("Synthèse")!;
    expect((syn.getRow(2).values as unknown[]).slice(1)).toEqual(["Amel Haddad", 2, "2026-09-12", 13, 20, 58, "En hausse"]);
  });
});
