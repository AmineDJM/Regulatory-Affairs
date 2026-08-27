import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { ArtefactSpec, FeuilleSpec, GraphiqueSpec, TypeColonne } from "@/lib/missions/artifacts/spec";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CLASSEUR RÉEL (§21) — plusieurs feuilles, des formules VALIDES, et de vrais graphiques.
 *
 * ── POURQUOI CE FICHIER NE SE CONTENTE PAS D'EXCELJS ────────────────────────────────────
 *
 * ExcelJS écrit très bien des feuilles, des styles et des formules. Il ne sait PAS écrire de
 * graphique — la fonctionnalité n'existe pas dans la version publiée. Or « fabrique-moi
 * l'analyse PCH » sans un seul graphique produit un tableau de chiffres que personne ne lit.
 *
 * On fabrique donc le classeur avec ExcelJS, puis on ROUVRE l'archive et on y ajoute les
 * parties OOXML du graphique : la définition, le dessin qui la pose sur la feuille, les deux
 * relations, et les déclarations de type. C'est du format de fichier, pas de la magie — mais
 * cela demande d'être exact, parce qu'Excel refuse d'ouvrir une archive incohérente.
 *
 * ── LES FORMULES SONT ÉCRITES ICI, JAMAIS PAR UN MODÈLE ─────────────────────────────────
 *
 * Le code connaît le nombre réel de lignes et l'indice réel de chaque colonne au moment où il
 * écrit. C'est la seule façon d'avoir `=SUM(D2:D34)` juste : un modèle qui écrit cette chaîne
 * la fige à l'instant où il l'écrit, et elle devient fausse à la première donnée de plus.
 *
 * ── CE QU'ON N'A PAS FAIT, ET POURQUOI ──────────────────────────────────────────────────
 *
 * Pas de tableaux croisés dynamiques, pas de mise en forme conditionnelle, pas de macros. Ces
 * trois-là demandent chacun plusieurs parties OOXML supplémentaires et une validation qu'on ne
 * saurait pas tenir ; les livrer à moitié produirait des classeurs qu'Excel « répare » à
 * l'ouverture — une expérience pire que leur absence.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const NAVY = "FF0B2545";
const TEAL = "FF1B7F79";
const LIGHT = "FFF4F6F8";

const FORMATS: Record<TypeColonne, string | undefined> = {
  text: undefined,
  number: "#,##0.00",
  money: '#,##0 "DZD"',
  percent: "0.0%",
  date: "dd/mm/yyyy",
};

/** La lettre de colonne Excel — A, B, … Z, AA. Écrite ici parce qu'on en dépend partout. */
export function lettreColonne(index1: number): string {
  let n = index1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

interface Disposition {
  /** Toutes les colonnes, simples puis calculées, dans l'ordre où elles sont écrites. */
  cles: string[];
  premiereLigne: number;
  derniereLigne: number;
  ligneTotaux: number | null;
}

/**
 * ÉCRIT UNE FEUILLE et rend sa disposition RÉELLE.
 *
 * La disposition est rendue plutôt que recalculée par l'appelant : c'est elle qui garantit que
 * les graphiques pointent sur les mêmes cellules que celles qu'on vient d'écrire.
 */
function ecrireFeuille(wb: ExcelJS.Workbook, f: FeuilleSpec): Disposition {
  const ws = wb.addWorksheet(f.name, { views: [{ state: "frozen", ySplit: 1 }] });
  const calculees = f.computed ?? [];
  const cles = [...f.columns.map((c) => c.key), ...calculees.map((c) => c.key)];

  ws.columns = [
    ...f.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.min(38, Math.max(12, c.header.length + 4)) })),
    ...calculees.map((c) => ({ header: c.header, key: c.key, width: Math.min(24, Math.max(12, c.header.length + 4)) })),
  ];

  const entete = ws.getRow(1);
  entete.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  entete.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  entete.alignment = { vertical: "middle", wrapText: true };
  entete.height = 22;

  const premiereLigne = 2;
  for (const row of f.rows) ws.addRow(row);
  const derniereLigne = premiereLigne + f.rows.length - 1;

  // ── LES COLONNES CALCULÉES ──────────────────────────────────────────────────────────
  //
  // Écrites ligne par ligne avec les indices réels. Une division est TOUJOURS protégée par
  // IFERROR : sans elle, une seule quantité à zéro affiche `#DIV/0!` dans tout le classeur.
  for (const c of calculees) {
    const colIdx = cles.indexOf(c.key) + 1;
    for (let r = premiereLigne; r <= derniereLigne; r++) {
      const cell = ws.getCell(r, colIdx);
      const ref = (cle: string) => `${lettreColonne(cles.indexOf(cle) + 1)}${r}`;
      if (c.calcul === "GROWTH" && c.args.length >= 2) {
        const [debut, fin] = c.args;
        cell.value = { formula: `IFERROR((${ref(fin)}-${ref(debut)})/${ref(debut)},"")`, result: undefined };
        cell.numFmt = "0.0%";
      } else if (c.calcul === "RATIO" && c.args.length >= 2) {
        const [num, den] = c.args;
        cell.value = { formula: `IFERROR(${ref(num)}/${ref(den)},"")`, result: undefined };
        cell.numFmt = "#,##0.00";
      } else {
        const [val] = c.args;
        const colVal = lettreColonne(cles.indexOf(val) + 1);
        cell.value = {
          formula: `IFERROR(${ref(val)}/SUM($${colVal}$${premiereLigne}:$${colVal}$${derniereLigne}),"")`,
          result: undefined,
        };
        cell.numFmt = "0.0%";
      }
    }
  }

  // Les formats de nombre des colonnes simples.
  for (const c of f.columns) {
    const fmt = FORMATS[c.type];
    if (!fmt) continue;
    const colIdx = cles.indexOf(c.key) + 1;
    for (let r = premiereLigne; r <= derniereLigne; r++) ws.getCell(r, colIdx).numFmt = fmt;
  }

  // ── LA LIGNE DE TOTAUX ──────────────────────────────────────────────────────────────
  let ligneTotaux: number | null = null;
  if (f.totals && f.rows.length > 0) {
    ligneTotaux = derniereLigne + 1;
    const ligne = ws.getRow(ligneTotaux);
    ligne.getCell(1).value = "TOTAL";
    ligne.font = { bold: true };
    ligne.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
    for (const [cle, agregat] of Object.entries(f.totals)) {
      const colIdx = cles.indexOf(cle) + 1;
      if (colIdx <= 0) continue;
      const L = lettreColonne(colIdx);
      const plage = `${L}${premiereLigne}:${L}${derniereLigne}`;
      const fn = agregat === "AVG" ? "AVERAGE" : agregat;
      const cell = ligne.getCell(colIdx);
      cell.value = { formula: `${fn}(${plage})`, result: undefined };
      const src = f.columns.find((c) => c.key === cle);
      cell.numFmt = src ? (FORMATS[src.type] ?? "#,##0.00") : "#,##0.00";
    }
  }

  if (f.note) {
    const r = (ligneTotaux ?? derniereLigne) + 2;
    const cell = ws.getCell(r, 1);
    cell.value = f.note;
    cell.font = { italic: true, size: 9, color: { argb: "FF5B6470" } };
  }

  // Le filtre automatique n'est posé QUE sur la zone de données : l'inclure dans la ligne de
  // totaux ferait disparaître le total au premier filtrage.
  if (f.rows.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: derniereLigne, column: cles.length } };
  }

  return { cles, premiereLigne, derniereLigne, ligneTotaux };
}

/** La synthèse exécutive — première feuille, parce qu'on lit la réponse avant les données. */
function ecrireSynthese(wb: ExcelJS.Workbook, spec: ArtefactSpec): void {
  if (!spec.summary || spec.summary.length === 0) return;
  const ws = wb.addWorksheet("Synthèse");
  ws.columns = [{ width: 110 }];
  let r = 1;
  const titre = ws.getCell(r++, 1);
  titre.value = spec.title;
  titre.font = { bold: true, size: 16, color: { argb: NAVY } };
  r++;
  for (const s of spec.summary) {
    const h = ws.getCell(r++, 1);
    h.value = s.heading;
    h.font = { bold: true, size: 12, color: { argb: TEAL } };
    for (const p of s.paragraphs) {
      const c = ws.getCell(r++, 1);
      c.value = p;
      c.alignment = { wrapText: true, vertical: "top" };
    }
    for (const b of s.bullets) {
      const c = ws.getCell(r++, 1);
      c.value = `• ${b}`;
      c.alignment = { wrapText: true, vertical: "top" };
    }
    r++;
  }
  if (spec.sources && spec.sources.length > 0) {
    const h = ws.getCell(r++, 1);
    h.value = "Sources";
    h.font = { bold: true, size: 12, color: { argb: TEAL } };
    for (const s of spec.sources) ws.getCell(r++, 1).value = s;
  }
}

export interface ResultatClasseur {
  buffer: Buffer;
  /** Ce qui a réellement été écrit — le contrôle qualité s'en sert au lieu de re-deviner. */
  feuilles: { name: string; rows: number; columns: number; totalsRow: number | null }[];
  graphiques: number;
  formules: number;
}

/**
 * FABRIQUE LE CLASSEUR — feuilles, formules, puis graphiques injectés dans l'archive.
 */
export async function construireClasseur(spec: ArtefactSpec): Promise<ResultatClasseur> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AMD Internal OS";
  wb.created = new Date();

  ecrireSynthese(wb, spec);

  const dispositions = new Map<string, Disposition>();
  const feuilles: ResultatClasseur["feuilles"] = [];
  let formules = 0;

  for (const f of spec.sheets ?? []) {
    const d = ecrireFeuille(wb, f);
    dispositions.set(f.name, d);
    formules += (f.computed?.length ?? 0) * f.rows.length + Object.keys(f.totals ?? {}).length;
    feuilles.push({ name: f.name, rows: f.rows.length, columns: d.cles.length, totalsRow: d.ligneTotaux });
  }

  const brut = Buffer.from(await wb.xlsx.writeBuffer());
  const charts = (spec.charts ?? []).filter((c) => dispositions.has(c.sheet));
  if (charts.length === 0) return { buffer: brut, feuilles, graphiques: 0, formules };

  const buffer = await injecterGraphiques(brut, wb, charts, dispositions);
  return { buffer, feuilles, graphiques: charts.length, formules };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'INJECTION DES GRAPHIQUES — du format de fichier, écrit à la main.
 *
 * Pour chaque graphique, cinq choses doivent être cohérentes, faute de quoi Excel annonce un
 * fichier endommagé :
 *
 *   1. `xl/charts/chartN.xml`                — la définition (type, séries, plages) ;
 *   2. `xl/drawings/drawingN.xml`            — l'ancrage sur la feuille ;
 *   3. `xl/drawings/_rels/drawingN.xml.rels` — le dessin pointe vers le graphique ;
 *   4. `xl/worksheets/_rels/sheetK.xml.rels` — la feuille pointe vers le dessin ;
 *   5. `[Content_Types].xml`                 — les deux nouveaux types déclarés.
 *
 * Plus l'élément `<drawing>` ajouté dans le XML de la feuille, JUSTE avant `</worksheet>` :
 * le schéma impose cet ordre, et un `<drawing>` placé plus haut invalide le document.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
async function injecterGraphiques(
  brut: Buffer,
  wb: ExcelJS.Workbook,
  charts: GraphiqueSpec[],
  dispositions: Map<string, Disposition>,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(brut);

  // L'ORDRE DES FEUILLES DANS EXCELJS EST L'ORDRE DES FICHIERS `sheetN.xml`. On le relit du
  // classeur plutôt que de le supposer : la feuille de synthèse décale tout d'un rang.
  const indexFeuille = new Map<string, number>();
  wb.eachSheet((ws, id) => { indexFeuille.set(ws.name, id); });

  // Un seul dessin par feuille : plusieurs graphiques sur la même feuille partagent son dessin.
  const parFeuille = new Map<string, GraphiqueSpec[]>();
  for (const c of charts) parFeuille.set(c.sheet, [...(parFeuille.get(c.sheet) ?? []), c]);

  let noChart = 0;
  let noDrawing = 0;
  const overrides: string[] = [];

  for (const [nomFeuille, liste] of parFeuille) {
    const idx = indexFeuille.get(nomFeuille);
    const dispo = dispositions.get(nomFeuille);
    if (!idx || !dispo) continue;

    noDrawing += 1;
    const ancres: string[] = [];
    const relsDessin: string[] = [];

    for (const [i, chart] of liste.entries()) {
      noChart += 1;
      const xml = chartXml(chart, nomFeuille, dispo);
      zip.file(`xl/charts/chart${noChart}.xml`, xml);
      overrides.push(
        `<Override PartName="/xl/charts/chart${noChart}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
      );
      const rId = `rId${i + 1}`;
      relsDessin.push(
        `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${noChart}.xml"/>`,
      );
      // Les graphiques sont posés les uns SOUS les autres, à droite du tableau : ils ne
      // recouvrent donc jamais les données, quel que soit leur nombre.
      const colDepart = dispo.cles.length + 1;
      const ligneDepart = 1 + i * 20;
      ancres.push(ancrageXml(rId, colDepart, ligneDepart, noChart));
    }

    zip.file(
      `xl/drawings/drawing${noDrawing}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" `
      + `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" `
      + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${ancres.join("")}</xdr:wsDr>`,
    );
    zip.file(
      `xl/drawings/_rels/drawing${noDrawing}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relsDessin.join("")}</Relationships>`,
    );
    overrides.push(
      `<Override PartName="/xl/drawings/drawing${noDrawing}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
    );

    // ── LA RELATION DE LA FEUILLE VERS SON DESSIN ─────────────────────────────────────
    const cheminRels = `xl/worksheets/_rels/sheet${idx}.xml.rels`;
    const existant = zip.file(cheminRels);
    const dejaLa = existant ? await existant.async("string") : "";
    // On prend un identifiant que la feuille n'utilise pas : réutiliser `rId1` écraserait
    // silencieusement une relation existante (un lien hypertexte, par exemple).
    const dernier = Math.max(0, ...[...dejaLa.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1])));
    const rIdFeuille = `rId${dernier + 1}`;
    const relation = `<Relationship Id="${rIdFeuille}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${noDrawing}.xml"/>`;
    zip.file(
      cheminRels,
      dejaLa
        ? dejaLa.replace("</Relationships>", `${relation}</Relationships>`)
        : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
          + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relation}</Relationships>`,
    );

    // ── L'ÉLÉMENT `<drawing>` DANS LA FEUILLE, EN DERNIER ─────────────────────────────
    const cheminFeuille = `xl/worksheets/sheet${idx}.xml`;
    const fichierFeuille = zip.file(cheminFeuille);
    if (fichierFeuille) {
      const xmlFeuille = await fichierFeuille.async("string");
      zip.file(cheminFeuille, xmlFeuille.replace("</worksheet>", `<drawing r:id="${rIdFeuille}"/></worksheet>`));
    }
  }

  const ct = zip.file("[Content_Types].xml");
  if (ct) {
    const xml = await ct.async("string");
    zip.file("[Content_Types].xml", xml.replace("</Types>", `${overrides.join("")}</Types>`));
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** L'ancrage d'un graphique : deux cellules, un cadre graphique, une référence de relation. */
function ancrageXml(rId: string, col: number, ligne: number, id: number): string {
  return (
    `<xdr:twoCellAnchor>`
    + `<xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${ligne}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
    + `<xdr:to><xdr:col>${col + 8}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${ligne + 18}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
    + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr>`
    + `<xdr:cNvPr id="${id + 1}" name="Graphique ${id}"/><xdr:cNvGraphicFramePr/>`
    + `</xdr:nvGraphicFramePr>`
    + `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>`
    + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">`
    + `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" `
    + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rId}"/>`
    + `</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
  );
}

const echapper = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Une référence de plage absolue, avec le nom de feuille cité s'il contient un espace. */
function plage(feuille: string, colonne: number, de: number, a: number): string {
  const L = lettreColonne(colonne);
  const nom = /[^A-Za-z0-9_]/.test(feuille) ? `'${feuille.replace(/'/g, "''")}'` : feuille;
  return `${nom}!$${L}$${de}:$${L}$${a}`;
}

/** La définition d'un graphique — barres, courbe ou secteurs, selon `kind`. */
function chartXml(chart: GraphiqueSpec, feuille: string, d: Disposition): string {
  const colCat = d.cles.indexOf(chart.categories) + 1;
  const series = chart.series
    .map((cle, i) => {
      const col = d.cles.indexOf(cle) + 1;
      if (col <= 0) return "";
      return (
        `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>`
        + `<c:tx><c:strRef><c:f>${echapper(plage(feuille, col, 1, 1))}</c:f></c:strRef></c:tx>`
        + `<c:cat><c:strRef><c:f>${echapper(plage(feuille, colCat, d.premiereLigne, d.derniereLigne))}</c:f></c:strRef></c:cat>`
        + `<c:val><c:numRef><c:f>${echapper(plage(feuille, col, d.premiereLigne, d.derniereLigne))}</c:f></c:numRef></c:val>`
        + `</c:ser>`
      );
    })
    .join("");

  // LES AXES NE SONT PAS OPTIONNELS pour un histogramme ou une courbe : sans `c:catAx` et
  // `c:valAx`, Excel considère le graphique incomplet et propose de « réparer » le fichier.
  // Un camembert, lui, n'en a pas — et en ajouter le rendrait tout aussi invalide.
  const AXE_CAT = 111111111;
  const AXE_VAL = 222222222;
  const corps =
    chart.kind === "pie"
      ? `<c:pieChart><c:varyColors val="1"/>${series}</c:pieChart>`
      : chart.kind === "line"
        ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}`
          + `<c:marker val="1"/><c:axId val="${AXE_CAT}"/><c:axId val="${AXE_VAL}"/></c:lineChart>${axes(AXE_CAT, AXE_VAL)}`
        : `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}`
          + `<c:gapWidth val="60"/><c:axId val="${AXE_CAT}"/><c:axId val="${AXE_VAL}"/></c:barChart>${axes(AXE_CAT, AXE_VAL)}`;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" `
    + `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" `
    + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<c:chart>`
    + `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${echapper(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
    + `<c:autoTitleDeleted val="0"/>`
    + `<c:plotArea><c:layout/>${corps}</c:plotArea>`
    + `<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>`
    + `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>`
    + `</c:chart></c:chartSpace>`
  );
}

function axes(catId: number, valId: number): string {
  return (
    `<c:catAx><c:axId val="${catId}"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
    + `<c:delete val="0"/><c:axPos val="b"/><c:crossAx val="${valId}"/></c:catAx>`
    + `<c:valAx><c:axId val="${valId}"/><c:scaling><c:orientation val="minMax"/></c:scaling>`
    + `<c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:crossAx val="${catId}"/></c:valAx>`
  );
}
