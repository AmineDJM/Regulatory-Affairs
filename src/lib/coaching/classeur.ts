import ExcelJS from "exceljs";
import { bilanDesNotes, NOMBRE_NIVEAUX, type GrilleCoaching, type Points } from "./grille";
import { syntheseParAxe, syntheseParCollaborateur, type FichePourSynthese } from "./synthese";
import { formaterJour, jourDe } from "./dates";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CLASSEUR DE LA FICHE DE COACHING (§118.157) — la fiche téléchargée, au format du modèle
 * fourni par la Direction.
 *
 * On reprend la STRUCTURE du classeur d'origine, section par section : titre, en-tête
 * (collaborateur, manager, date, secteur), échelle des niveaux, grille « Axe d'évaluation /
 * Critères d'observation / Niveau de maîtrise / Total des points », total général, bilan. Et sa
 * LOGIQUE : chaque axe porte une FORMULE qui renvoie au niveau retenu (`=C20` quand c'est MA),
 * le total général les additionne (`=D18+D22+…`). Le fichier reste donc vivant — on change un
 * niveau dans Excel, le total suit — au lieu d'être la photographie d'un tableur (§118.59).
 *
 * Ce qui change, et pourquoi : les lignes d'en-tête sont FUSIONNÉES sur la largeur (le modèle
 * tenait tout dans une colonne A de 85 caractères, qui ne s'imprime pas sur une page), le
 * niveau retenu est SURLIGNÉ dans sa couleur, et le pied dit la version de grille et le statut
 * — une fiche imprimée doit pouvoir dire de quelle évaluation elle est la copie.
 *
 * Écrit avec ExcelJS : SheetJS communautaire ne sait pas écrire un fond ni une police
 * (`regulatory/export.ts` l'a mesuré).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface FichePourClasseur {
  grille: GrilleCoaching;
  gridVersion: number;
  collaborateur: string;
  manager: string | null;
  visitDate: Date;
  sector: string | null;
  notes: Record<string, Points>;
  strengths: string | null;
  improvements: string | null;
  status: "DRAFT" | "FINALIZED";
  finalizedAt: Date | null;
  finalisePar: string | null;
}

const POLICE = "Times New Roman";
const GRIS_FILET = "FFC4C7C5";
const NOIR = "FF000000";
/** Le fond du total général — le bleu d'accent du modèle d'origine (thème 4, éclairci). */
const FOND_TOTAL = "FF8FAADC";
const FOND_ENTETE = "FFF2F2F2";
/** Le fond du niveau RETENU, dans la couleur de son niveau (1 → 4). */
const FOND_NIVEAU: Record<number, string> = { 1: "FFFDE2E2", 2: "FFFEF3C7", 3: "FFDCFCE7", 4: "FFDBEAFE" };

/** Les largeurs, en caractères : l'axe, le critère, le niveau, le total. */
const LARGEURS = [30, 62, 13, 13] as const;
const LARGEUR_TOTALE = LARGEURS.reduce((s, l) => s + l, 0);

type Police = Partial<ExcelJS.Font>;
const police = (p: Police = {}): Partial<ExcelJS.Font> => ({ name: POLICE, size: 12, ...p });

const filet = (couleur: string, style: ExcelJS.BorderStyle = "thin"): Partial<ExcelJS.Border> => ({ style, color: { argb: couleur } });

/** Hauteur d'une ligne de texte replié, pour une largeur donnée — ExcelJS ne la calcule pas. */
function hauteur(texte: string, largeurCaracteres: number, minimum = 18): number {
  const parLigne = Math.max(10, Math.floor(largeurCaracteres * 0.95));
  const lignes = texte.split("\n").reduce((s, para) => s + Math.max(1, Math.ceil(para.length / parLigne)), 0);
  return Math.min(409, Math.max(minimum, lignes * 15.5 + 5));
}

function ligneFusionnee(ws: ExcelJS.Worksheet, r: number): ExcelJS.Cell {
  ws.mergeCells(r, 1, r, 4);
  return ws.getCell(r, 1);
}

/**
 * LA FICHE, en classeur. Rend le fichier et le TOTAL qu'il porte — l'appelant (et le banc)
 * peuvent vérifier que la formule écrite retombe sur le total calculé.
 */
export async function construireClasseurFiche(f: FichePourClasseur): Promise<{ octets: Buffer; total: number; max: number; celluleTotal: string }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AMD Internal OS";
  wb.created = new Date();
  const ws = wb.addWorksheet("Fiche de coaching", { views: [{ showGridLines: false }] });
  ws.columns = LARGEURS.map((width) => ({ width }));

  const bilan = bilanDesNotes(f.grille, f.notes);
  let r = 1;

  // ── TITRE ─────────────────────────────────────────────────────────────────────────────────
  const titre = ligneFusionnee(ws, r);
  titre.value = f.grille.titre;
  titre.font = police({ size: 20, bold: true });
  titre.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(r).height = 30;
  r += 2;

  // ── EN-TÊTE ───────────────────────────────────────────────────────────────────────────────
  const entete: [string, string][] = [
    ["Collaborateur :", f.collaborateur],
    ["Manager :", f.manager ?? ""],
    ["Date :", formaterJour(f.visitDate)],
    ["Secteur / Région / CDR :", f.sector ?? ""],
  ];
  for (const [libelle, valeur] of entete) {
    const c = ligneFusionnee(ws, r);
    c.value = { richText: [{ text: libelle, font: police({ bold: true }) }, { text: ` ${valeur}`, font: police() }] };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(r).height = 18;
    r += 1;
  }
  r += 1;

  // ── ÉCHELLE ───────────────────────────────────────────────────────────────────────────────
  const echelle = ligneFusionnee(ws, r);
  echelle.value = "Échelle d'Évaluation (Niveaux de Maîtrise)";
  echelle.font = police({ size: 13.5, bold: true });
  ws.getRow(r).height = 20;
  r += 1;
  f.grille.niveaux.forEach((n, i) => {
    const c = ligneFusionnee(ws, r);
    c.value = {
      richText: [
        { text: n.code, font: police({ bold: true }) },
        { text: ` = ${n.libelle} `, font: police() },
        ...(n.qualification ? [{ text: `(${n.qualification})`, font: police({ italic: true }) }] : []),
        { text: ` : ${i + 1}`, font: police() },
      ],
    };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(r).height = 17;
    r += 1;
  });
  r += 1;

  // ── GRILLE ────────────────────────────────────────────────────────────────────────────────
  ws.mergeCells(r, 1, r, 2);
  const grilleTitre = ws.getCell(r, 1);
  grilleTitre.value = "Grille d'Évaluation des Compétences";
  grilleTitre.font = police({ size: 13.5, bold: true });
  grilleTitre.alignment = { vertical: "middle" };
  const libelleTotal = ws.getCell(r, 3);
  libelleTotal.value = `Total (sur ${bilan.max})`;
  libelleTotal.font = police({ bold: true, size: 11 });
  libelleTotal.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
  const ligneTotal = r;
  ws.getRow(r).height = 27;
  r += 1;

  const enTetes = ["Axe d'Évaluation", "Critères d'Observation", "Niveau de Maîtrise", "Total des Points"];
  enTetes.forEach((t, i) => {
    const c = ws.getCell(r, i + 1);
    c.value = t;
    c.font = police({ bold: true });
    c.alignment = { vertical: "middle", horizontal: i < 2 ? "left" : "center", wrapText: true, indent: i < 2 ? 1 : 0 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOND_ENTETE } };
    c.border = { top: filet(NOIR, "medium"), bottom: filet(NOIR, "medium"), left: filet(GRIS_FILET, "medium"), right: filet(GRIS_FILET, "medium") };
  });
  ws.getRow(r).height = 31;
  r += 1;

  const cellulesAxes: string[] = [];
  for (const axe of f.grille.axes) {
    const debut = r;
    const fin = r + NOMBRE_NIVEAUX - 1;
    const retenu = f.notes[axe.cle];
    ws.mergeCells(debut, 1, fin, 1);
    const titreAxe = ws.getCell(debut, 1);
    titreAxe.value = axe.titre;
    titreAxe.font = police({ bold: true });
    titreAxe.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };

    axe.criteres.forEach((critere, k) => {
      const ligne = debut + k;
      const niveau = f.grille.niveaux[k]!;
      const choisi = retenu === k + 1;
      const c = ws.getCell(ligne, 2);
      c.value = { richText: [{ text: "• ", font: police() }, { text: `${niveau.code} :`, font: police({ bold: true }) }, { text: ` ${critere}`, font: police() }] };
      c.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
      const n = ws.getCell(ligne, 3);
      n.value = k + 1;
      n.font = police({ size: 11, bold: choisi });
      n.alignment = { vertical: "middle", horizontal: "center" };
      if (choisi) {
        for (const cell of [c, n]) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOND_NIVEAU[k + 1]! } };
      }
      const bas = k === NOMBRE_NIVEAUX - 1 ? filet(NOIR, "medium") : filet(GRIS_FILET);
      c.border = { left: filet(GRIS_FILET, "medium"), right: filet(GRIS_FILET, "medium"), bottom: bas, top: k === 0 ? filet(NOIR, "medium") : undefined };
      n.border = { bottom: bas, top: k === 0 ? filet(NOIR, "medium") : undefined };
      ws.getRow(ligne).height = hauteur(`• ${niveau.code} : ${critere}`, LARGEURS[1], 31);
    });

    ws.mergeCells(debut, 4, fin, 4);
    const total = ws.getCell(debut, 4);
    // LA FORMULE DU MODÈLE : le total d'un axe RENVOIE au niveau retenu (`=C20`), il ne le recopie
    // pas. Un axe non noté reste vide — il compte zéro dans la somme, et c'est ce qu'il vaut.
    if (retenu) total.value = { formula: `C${debut + retenu - 1}`, result: retenu };
    total.font = police({ size: 12, bold: true });
    total.alignment = { vertical: "middle", horizontal: "center" };
    total.border = { top: filet(NOIR, "medium"), bottom: filet(NOIR, "medium"), right: filet(NOIR, "medium") };
    titreAxe.border = { top: filet(NOIR, "medium"), bottom: filet(NOIR, "medium"), left: filet(NOIR, "medium") };
    cellulesAxes.push(`D${debut}`);
    r = fin + 1;
  }

  const celluleTotal = ws.getCell(ligneTotal, 4);
  celluleTotal.value = { formula: cellulesAxes.join("+"), result: bilan.total };
  celluleTotal.font = police({ size: 13, bold: true });
  celluleTotal.alignment = { vertical: "middle", horizontal: "center" };
  celluleTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOND_TOTAL } };
  celluleTotal.border = { top: filet(NOIR, "medium"), bottom: filet(NOIR, "medium"), left: filet(NOIR, "medium"), right: filet(NOIR, "medium") };
  r += 1;

  // ── BILAN ─────────────────────────────────────────────────────────────────────────────────
  const bilanTitre = ligneFusionnee(ws, r);
  bilanTitre.value = f.grille.bilan.titre;
  bilanTitre.font = police({ size: 13.5, bold: true });
  ws.getRow(r).height = 20;
  r += 1;
  for (const [libelle, texte] of [[f.grille.bilan.pointsForts, f.strengths], [f.grille.bilan.pointsAAmeliorer, f.improvements]] as const) {
    const l = ligneFusionnee(ws, r);
    l.value = libelle;
    l.font = police({ bold: true });
    l.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(r).height = 18;
    r += 1;
    const t = ligneFusionnee(ws, r);
    t.value = texte ?? "";
    t.font = police();
    t.alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: 1 };
    t.border = { top: filet(GRIS_FILET), bottom: filet(GRIS_FILET), left: filet(GRIS_FILET), right: filet(GRIS_FILET) };
    ws.getRow(r).height = hauteur(texte ?? "", LARGEUR_TOTALE - 2, 45);
    r += 2;
  }

  // ── PIED : de quelle évaluation cette feuille est la copie ────────────────────────────────
  const pied = ligneFusionnee(ws, r);
  pied.value = `${f.status === "FINALIZED"
    ? `Fiche finalisée${f.finalizedAt ? ` le ${f.finalizedAt.toLocaleDateString("fr-FR", { timeZone: "Africa/Algiers" })}` : ""}${f.finalisePar ? ` par ${f.finalisePar}` : ""}`
    : "BROUILLON — fiche non finalisée"} · Grille version ${f.gridVersion} · AMD Internal OS`;
  pied.font = { name: POLICE, size: 9, italic: true, color: { argb: "FF6B7280" } };
  const derniere = r;

  ws.pageSetup = {
    paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    printArea: `A1:D${derniere}`,
  };
  ws.headerFooter.oddFooter = "&L&8Fiche de coaching — tournée en double&R&8Page &P / &N";

  const octets = Buffer.from(await wb.xlsx.writeBuffer());
  return { octets, total: bilan.total, max: bilan.max, celluleTotal: `D${ligneTotal}` };
}

/** Un nom de fichier sans accent ni espace — il voyage par mail et dans des systèmes de fichiers variés. */
export function nomDeFichier(collaborateur: string, visitDate: Date): string {
  const slug = collaborateur.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "collaborateur";
  return `Fiche_coaching_${slug}_${jourDe(visitDate)}.xlsx`;
}

export interface LignePourListe extends FichePourSynthese {
  manager: string | null;
  sector: string | null;
  gridVersion: number;
  strengths: string | null;
  improvements: string | null;
}

/**
 * LE CLASSEUR DE SUIVI — toutes les fiches visibles, une par ligne, plus la synthèse. C'est
 * l'outil de GESTION du directeur des opérations : trier par collaborateur, filtrer un axe,
 * comparer les tournées d'un trimestre.
 *
 * Les colonnes d'axes sont celles de la grille COURANTE, reconnues par leur clé : une fiche d'une
 * version plus ancienne remplit les axes qu'elle partage et laisse vides ceux qui n'existaient pas.
 */
export async function construireClasseurSuivi(lignes: readonly LignePourListe[], courante: GrilleCoaching): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AMD Internal OS";
  const ws = wb.addWorksheet("Fiches", { views: [{ state: "frozen", ySplit: 1 }] });
  const enTetes = [
    "Date", "Collaborateur", "Manager", "Secteur / Région / CDR",
    ...courante.axes.map((a) => a.titre),
    "Total", "Sur", "%", "Statut", "Grille (version)", "Points forts", "Points à améliorer",
  ];
  ws.addRow(enTetes);
  for (const l of lignes) {
    const b = bilanDesNotes(l.grille, l.notes);
    ws.addRow([
      jourDe(l.visitDate), l.collaborateur, l.manager ?? "", l.sector ?? "",
      ...courante.axes.map((a) => l.notes[a.cle] ?? null),
      b.total, b.max, b.max ? Math.round((b.total / b.max) * 100) : null,
      l.status === "FINALIZED" ? "Finalisée" : "Brouillon", l.gridVersion, l.strengths ?? "", l.improvements ?? "",
    ]);
  }
  const entete = ws.getRow(1);
  entete.font = { bold: true };
  entete.alignment = { vertical: "middle", wrapText: true };
  entete.height = 36;
  entete.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOND_ENTETE } }; });
  ws.columns.forEach((col, i) => {
    col.width = i === 0 ? 12 : i < 3 ? 22 : i === 3 ? 28 : i < 4 + courante.axes.length ? 16 : i >= enTetes.length - 2 ? 50 : 11;
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: enTetes.length } };

  const syn = wb.addWorksheet("Synthèse");
  syn.addRow(["Collaborateur", "Fiches finalisées", "Dernière tournée", "Dernier total", "Sur", "Moyenne (%)", "Tendance"]);
  for (const c of syntheseParCollaborateur(lignes)) {
    syn.addRow([c.nom, c.fiches, jourDe(c.derniere.date), c.derniere.total, c.derniere.max, c.moyennePct,
      c.tendance === "hausse" ? "En hausse" : c.tendance === "baisse" ? "En baisse" : c.tendance === "stable" ? "Stable" : "—"]);
  }
  syn.addRow([]);
  syn.addRow(["Axe (grille en vigueur)", "Niveau moyen (1 à 4)", "Nombre de notes"]);
  const ligneAxes = syn.rowCount;
  for (const a of syntheseParAxe(lignes, courante)) syn.addRow([a.titre, a.moyenne, a.notes]);
  for (const n of [1, ligneAxes]) {
    const row = syn.getRow(n);
    row.font = { bold: true };
    row.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOND_ENTETE } }; });
  }
  syn.columns.forEach((col, i) => { col.width = i === 0 ? 40 : 18; });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
