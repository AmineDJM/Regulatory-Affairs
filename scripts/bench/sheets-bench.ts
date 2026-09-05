/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BANC D'ÉCHELLE EXCEL — les cibles du mandat « Office God Mode », MESURÉES.
 *
 *   100 000+ lignes, 50 000+ formules, 100+ feuilles : lecture, graphe, recalcul, audit,
 *   comparaison de deux versions, trace d'une cellule. Sur de VRAIS fichiers .xlsx, produits par
 *   ExcelJS en flux (la génération n'est pas mesurée : elle n'est pas le sujet).
 *
 *   npm run sheets:bench            → deux classeurs : GRAND (1 feuille × 100 000 lignes × 12 colonnes,
 *                                     200 000 formules) et LARGE (120 feuilles × 400 lignes, 96 000 formules)
 *   SHEETS_BENCH_LIGNES=20000 …     → un banc plus court pour une machine modeste
 *
 * ── CE QUI EST MESURÉ, ET CE QUI NE L'EST PAS ───────────────────────────────────────────
 *
 * MESURÉ : chaque étape séparément, à froid (première lecture du fichier) — c'est ce qu'une
 * personne ressent à « vérifie ce fichier ». La mémoire résiduelle après chaque banc.
 * PAS MESURÉ : le réseau et la lecture du blob Drive. Un BUDGET par étape fait échouer le banc
 * s'il est dépassé : un banc qui ne peut pas échouer n'est pas un banc.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { lireClasseur } from "@/lib/artifact/sheets/reader";
import { construireGraphe } from "@/lib/artifact/sheets/graph";
import { recalculer } from "@/lib/artifact/sheets/evaluate";
import { auditerClasseur } from "@/lib/artifact/sheets/audit";
import { comparerClasseurs } from "@/lib/artifact/sheets/diff";
import { tracerCellule } from "@/lib/artifact/sheets/analyse";

const LIGNES = Number(process.env.SHEETS_BENCH_LIGNES ?? 100_000);
const FEUILLES = Number(process.env.SHEETS_BENCH_FEUILLES ?? 120);
const LIGNES_PAR_FEUILLE = 400;
const REGIONS = ["Alger", "Oran", "Constantine", "Annaba", "Sétif", "Blida", "Tlemcen", "Béjaïa", "Batna", "Ouargla"];

interface Mesure { banc: string; etape: string; ms: number; budgetMs: number; detail: string }
const mesures: Mesure[] = [];
let echec = false;

function noter(banc: string, etape: string, ms: number, budgetMs: number, detail: string): void {
  mesures.push({ banc, etape, ms: Math.round(ms), budgetMs, detail });
  if (ms > budgetMs) echec = true;
  console.log(`  ${ms > budgetMs ? "✗" : "✓"} ${etape.padEnd(14)} ${String(Math.round(ms)).padStart(7)} ms  (budget ${budgetMs} ms)  ${detail}`);
}

const mo = (o: number) => `${Math.round(o / 1024 / 1024)} Mo`;
const heap = () => { if (global.gc) global.gc(); return process.memoryUsage().heapUsed; };

/** GRAND : une feuille de données de LIGNES lignes, deux colonnes de formules par ligne, une synthèse par région. */
async function genererGrand(chemin: string, variante: 1 | 2): Promise<void> {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: chemin, useSharedStrings: false, useStyles: false });
  const ws = wb.addWorksheet("Données");
  ws.addRow(["Id", "Date", "Produit", "Région", "Qté", "PU", "Remise", "Coût", "Commercial", "CA net", "Marge", "Statut"]).commit();
  let r = 2;
  const nb = LIGNES + (variante === 2 ? 1 : 0);
  for (let i = 0; i < nb; i++) {
    // Variante 2 : une ligne insérée au milieu, trois valeurs modifiées, une formule écrasée.
    const inseree = variante === 2 && i === Math.floor(LIGNES / 2);
    const idx = variante === 2 && i > Math.floor(LIGNES / 2) ? i - 1 : i;
    const qte = inseree ? 999 : 1 + (idx * 7) % 50;
    const pu = inseree ? 100 : 20 + (idx * 13) % 480;
    const remise = (idx % 10) / 100;
    const cout = Math.round(pu * 0.6);
    let qteV: number = qte;
    if (variante === 2 && (idx === 10 || idx === 5000 || idx === 77_777)) qteV = qte + 1;
    const ca = { formula: `E${r}*F${r}*(1-G${r})`, result: qteV * pu * (1 - remise) } as ExcelJS.CellFormulaValue;
    const marge: ExcelJS.CellValue = variante === 2 && idx === 12_345
      ? 4242 // formule écrasée par une valeur
      : ({ formula: `J${r}-H${r}*E${r}`, result: qteV * pu * (1 - remise) - cout * qteV } as ExcelJS.CellFormulaValue);
    ws.addRow([idx + 1, new Date(Date.UTC(2026, idx % 12, 1 + (idx % 28))), `P${idx % 300}`, REGIONS[idx % REGIONS.length], qteV, pu, remise, cout, `C${idx % 40}`, ca, marge, idx % 3 === 0 ? "Livré" : "En cours"]).commit();
    r += 1;
  }
  ws.commit();
  const s = wb.addWorksheet("Synthèse");
  s.addRow(["Région", "CA net", "Marge", "Lignes"]).commit();
  REGIONS.forEach((reg, i) => {
    const rr = i + 2;
    s.addRow([reg, { formula: `SUMIF(Données!D2:D${r - 1},A${rr},Données!J2:J${r - 1})` }, { formula: `SUMIF(Données!D2:D${r - 1},A${rr},Données!K2:K${r - 1})` }, { formula: `COUNTIF(Données!D2:D${r - 1},A${rr})` }]).commit();
  });
  s.addRow(["Total", { formula: `SUM(B2:B${REGIONS.length + 1})` }, { formula: `SUM(C2:C${REGIONS.length + 1})` }, { formula: `SUM(D2:D${REGIONS.length + 1})` }]).commit();
  s.commit();
  await wb.commit();
}

/** LARGE : FEUILLES feuilles de site, deux colonnes de formules, une synthèse qui les additionne toutes. */
async function genererLarge(chemin: string): Promise<void> {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: chemin, useSharedStrings: false, useStyles: false });
  for (let f = 1; f <= FEUILLES; f++) {
    const ws = wb.addWorksheet(`Site ${f}`);
    ws.addRow(["Mois", "Produit", "Qté", "PU", "Coût", "CA", "Marge", "Marge %"]).commit();
    for (let i = 0; i < LIGNES_PAR_FEUILLE; i++) {
      const r = i + 2;
      const qte = 1 + (i * f) % 40; const pu = 10 + (i * 7) % 200; const cout = Math.round(pu * 0.55);
      ws.addRow([1 + (i % 12), `P${i % 50}`, qte, pu, cout, { formula: `C${r}*D${r}`, result: qte * pu }, { formula: `F${r}-E${r}*C${r}`, result: qte * pu - cout * qte }, { formula: `IFERROR(G${r}/F${r},0)`, result: (qte * pu - cout * qte) / (qte * pu) }]).commit();
    }
    const t = LIGNES_PAR_FEUILLE + 2;
    ws.addRow(["Total", null, { formula: `SUM(C2:C${t - 1})` }, null, null, { formula: `SUM(F2:F${t - 1})` }, { formula: `SUM(G2:G${t - 1})` }, { formula: `IFERROR(G${t}/F${t},0)` }]).commit();
    ws.commit();
  }
  const s = wb.addWorksheet("Synthèse");
  s.addRow(["Site", "CA", "Marge"]).commit();
  for (let f = 1; f <= FEUILLES; f++) s.addRow([`Site ${f}`, { formula: `'Site ${f}'!F${LIGNES_PAR_FEUILLE + 2}` }, { formula: `'Site ${f}'!G${LIGNES_PAR_FEUILLE + 2}` }]).commit();
  s.addRow(["Groupe", { formula: `SUM(B2:B${FEUILLES + 1})` }, { formula: `SUM(C2:C${FEUILLES + 1})` }]).commit();
  s.commit();
  await wb.commit();
}

async function chrono<T>(f: () => Promise<T> | T): Promise<[T, number]> {
  const d = performance.now();
  const v = await f();
  return [v, performance.now() - d];
}

async function bancGrand(dossier: string): Promise<void> {
  console.log(`\n── GRAND : 1 feuille × ${LIGNES.toLocaleString("fr-FR")} lignes × 12 colonnes (${(LIGNES * 2).toLocaleString("fr-FR")} formules + synthèse) ──`);
  const p1 = path.join(dossier, "grand-v1.xlsx"); const p2 = path.join(dossier, "grand-v2.xlsx");
  const [, gen] = await chrono(async () => { await genererGrand(p1, 1); await genererGrand(p2, 2); });
  const octets1 = fs.readFileSync(p1); const octets2 = fs.readFileSync(p2);
  console.log(`  génération (non mesurée) : ${Math.round(gen)} ms · ${mo(octets1.length)} par fichier`);
  const avant = heap();

  const [c1, tLecture] = await chrono(() => lireClasseur(octets1));
  const cellules = c1.feuilles.reduce((s, f) => s + f.cellules.size, 0);
  noter("GRAND", "lecture", tLecture, 15_000, `${cellules.toLocaleString("fr-FR")} cellules · ${c1.feuilles.length} feuilles`);
  const [g, tGraphe] = await chrono(() => construireGraphe(c1));
  noter("GRAND", "graphe", tGraphe, 6_000, `${g.metriques.formules.toLocaleString("fr-FR")} formules · ${g.metriques.aretes.toLocaleString("fr-FR")} arêtes · ${g.metriques.plages} plages`);
  const [rc, tRecalc] = await chrono(() => recalculer(c1, g));
  noter("GRAND", "recalcul", tRecalc, 10_000, `${rc.ecarts.length} écart(s) · ${rc.nonCalculees.length} non calculée(s) · ${rc.circulaires.length} circulaire(s)`);
  if (rc.ecarts.length !== 0) { echec = true; console.log(`  ✗ le recalcul devrait retrouver EXACTEMENT les valeurs écrites : ${JSON.stringify(rc.ecarts.slice(0, 3))}`); }
  const [a, tAudit] = await chrono(() => auditerClasseur(c1, g, rc));
  noter("GRAND", "audit", tAudit, 10_000, `${a.total} constat(s) · ${JSON.stringify(a.parGravite)}`);
  const [tr, tTrace] = await chrono(() => tracerCellule(c1, g, rc, "Données!E5"));
  noter("GRAND", "trace", tTrace, 2_000, `E5 → ${tr.rayon.formules} formule(s) dépendante(s)`);
  const [c2, tLecture2] = await chrono(() => lireClasseur(octets2));
  noter("GRAND", "lecture v2", tLecture2, 15_000, `${c2.feuilles.reduce((s, f) => s + f.cellules.size, 0).toLocaleString("fr-FR")} cellules`);
  const [d, tDiff] = await chrono(() => comparerClasseurs(c1, c2));
  noter("GRAND", "comparaison", tDiff, 12_000, d.resume);
  const attendu = { LIGNE_INSEREE: 1, FORMULE_ECRASEE: 1, VALEUR_MODIFIEE: 3 };
  for (const [genre, n] of Object.entries(attendu)) {
    const obtenu = (d.parGenre as Record<string, number | undefined>)[genre] ?? 0;
    if (obtenu !== n) {
      echec = true;
      console.log(`  ✗ comparaison : ${genre} attendu ${n}, obtenu ${obtenu}`);
      for (const x of d.changements.filter((x) => x.genre === genre).slice(0, 6)) console.log(`      ${x.feuille}!${x.cellule} ${x.avant} → ${x.apres}`);
    }
  }
  if ((d.parGenre.FORMULE_MODIFIEE ?? 0) > 0) {
    echec = true;
    console.log(`  ✗ comparaison : ${d.parGenre.FORMULE_MODIFIEE} formule(s) « modifiée(s) » alors que seules des lignes ont bougé`);
    for (const x of d.changements.filter((x) => x.genre === "FORMULE_MODIFIEE").slice(0, 4)) console.log(`      ${x.feuille}!${x.cellule} ${x.avant} → ${x.apres}`);
  }
  if (a.parGravite.CRITIQUE + a.parGravite.HAUTE > 0) {
    echec = true;
    console.log(`  ✗ audit : un classeur généré propre ne doit rien avoir de critique ni de haut`);
    for (const x of a.constats.filter((x) => x.gravite !== "BASSE" && x.gravite !== "MOYENNE").slice(0, 6)) console.log(`      ${x.gravite} ${x.code} ${x.feuille}!${x.cellule} — ${x.message}`);
  }
  console.log(`  mémoire résiduelle : ${mo(heap() - avant)} (deux classeurs en mémoire)`);
}

async function bancLarge(dossier: string): Promise<void> {
  console.log(`\n── LARGE : ${FEUILLES} feuilles × ${LIGNES_PAR_FEUILLE} lignes (${(FEUILLES * (LIGNES_PAR_FEUILLE * 3 + 4) + FEUILLES * 2 + 2).toLocaleString("fr-FR")} formules, synthèse inter-feuilles) ──`);
  const p = path.join(dossier, "large.xlsx");
  const [, gen] = await chrono(() => genererLarge(p));
  const octets = fs.readFileSync(p);
  console.log(`  génération (non mesurée) : ${Math.round(gen)} ms · ${mo(octets.length)}`);
  const avant = heap();
  const [c, tLecture] = await chrono(() => lireClasseur(octets));
  noter("LARGE", "lecture", tLecture, 15_000, `${c.feuilles.reduce((s, f) => s + f.cellules.size, 0).toLocaleString("fr-FR")} cellules · ${c.feuilles.length} feuilles`);
  const [g, tGraphe] = await chrono(() => construireGraphe(c));
  noter("LARGE", "graphe", tGraphe, 6_000, `${g.metriques.formules.toLocaleString("fr-FR")} formules · ${g.metriques.aretes.toLocaleString("fr-FR")} arêtes`);
  const [rc, tRecalc] = await chrono(() => recalculer(c, g));
  noter("LARGE", "recalcul", tRecalc, 10_000, `${rc.ecarts.length} écart(s) · ${rc.nonCalculees.length} non calculée(s)`);
  if (rc.ecarts.length !== 0) { echec = true; console.log(`  ✗ écarts inattendus : ${JSON.stringify(rc.ecarts.slice(0, 3))}`); }
  const [a, tAudit] = await chrono(() => auditerClasseur(c, g, rc));
  noter("LARGE", "audit", tAudit, 10_000, `${a.total} constat(s) · ${JSON.stringify(a.parGravite)}`);
  if (a.parGravite.CRITIQUE + a.parGravite.HAUTE + a.parGravite.BASSE > 0) {
    echec = true;
    console.log("  ✗ audit : seul le constat « formules sans valeur enregistrée » est attendu sur ce classeur généré");
    for (const x of a.constats.filter((x) => x.code !== "NON_RECALCULE").slice(0, 6)) console.log(`      ${x.gravite} ${x.code} ${x.feuille}!${x.cellule} — ${x.message}`);
  }
  const [tr, tTrace] = await chrono(() => tracerCellule(c, g, rc, "'Site 1'!C2"));
  noter("LARGE", "trace", tTrace, 2_000, `Site 1!C2 → ${tr.rayon.formules} formule(s), ${tr.rayon.parFeuille.length} feuille(s)`);
  if (tr.rayon.parFeuille.length < 2) { echec = true; console.log("  ✗ la trace devrait traverser jusqu'à la Synthèse"); }
  console.log(`  mémoire résiduelle : ${mo(heap() - avant)}`);
}

(async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "sheets-bench-"));
  console.log(`Banc Excel — Node ${process.version} · fichiers dans ${dossier}`);
  try {
    await bancGrand(dossier);
    await bancLarge(dossier);
  } finally {
    fs.rmSync(dossier, { recursive: true, force: true });
  }
  console.log("\n| Banc | Étape | ms | Budget | Détail |\n|---|---|---:|---:|---|");
  for (const m of mesures) console.log(`| ${m.banc} | ${m.etape} | ${m.ms} | ${m.budgetMs} | ${m.detail.replace(/\|/g, "/")} |`);
  const sortie = path.join("bench-out", `sheets-bench-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync("bench-out", { recursive: true });
  fs.writeFileSync(sortie, JSON.stringify({ lignes: LIGNES, feuilles: FEUILLES, node: process.version, mesures, echec }, null, 2));
  console.log(`\nJSON : ${sortie}\n${echec ? "ÉCHEC : un budget est dépassé ou une vérification a échoué." : "OK : tous les budgets tenus."}`);
  process.exit(echec ? 1 : 0);
})();
