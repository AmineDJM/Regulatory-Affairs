/**
 * RECENSEMENT DE JOIGNABILITÉ — instrument d'AUDIT, pas de production.
 *
 * Question posée à chaque export : « si quelqu'un utilise Adam normalement maintenant, ce
 * symbole peut-il être atteint ? »
 *
 * Trois classes :
 *   PRODUCTION_CALLER — au moins un appelant hors test/banc/fixture
 *   TEST_ONLY         — appelé, mais seulement par des tests, des fakes ou des bancs
 *   NO_CALLER         — aucun appelant hors son propre fichier
 *
 * Le classement d'un fichier appelant est VOLONTAIREMENT strict : `fakes.ts`, `fixtures.ts`,
 * `*.test.ts`, `e2e/` et `scripts/bench/` ne comptent pas comme production. Un export dont le
 * seul appelant est un banc de sabotage n'est pas joignable par un utilisateur.
 *
 *   npx tsx audit/reachability.ts <dossier> [<dossier>...]
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CIBLES = process.argv.slice(2);
if (CIBLES.length === 0) {
  console.error("usage : reachability.ts src/lib/missions/ [src/lib/artifact/]");
  process.exit(1);
}

const rg = (args: string[]): string[] => {
  try {
    return execFileSync("rg", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      .split("\n").filter(Boolean);
  } catch {
    return []; // rg sort 1 quand il ne trouve rien
  }
};

/** Un fichier qui ne peut pas représenter un usage réel. */
function estBanc(f: string): boolean {
  return /\.test\.tsx?$/.test(f)
    || /(^|\/)e2e\//.test(f)
    || /(^|\/)fakes\.ts$/.test(f)
    || /(^|\/)fixtures\.ts$/.test(f)
    || /(^|\/)scripts\/bench\//.test(f)
    || /(^|\/)scripts\/auto-test\//.test(f)
    || /(^|\/)audit\//.test(f);
}

const fichiers = rg(["--files", "-g", "*.ts", "-g", "*.tsx", ...CIBLES]);

interface Sym { nom: string; fichier: string; ligne: number }
const symboles: Sym[] = [];

const DECL = /^export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/;
const DECL_CONST = /^export\s+(?:const|let)\s+([A-Za-z_$][\w$]*)\s*[:=]/;

for (const f of fichiers) {
  if (estBanc(f)) continue;
  const lignes = readFileSync(f, "utf8").split("\n");
  lignes.forEach((l, i) => {
    const m = DECL.exec(l) ?? DECL_CONST.exec(l);
    if (m) symboles.push({ nom: m[1], fichier: f, ligne: i + 1 });
  });
}

const resultats: { sym: Sym; classe: string; prod: string[]; tests: string[] }[] = [];

for (const s of symboles) {
  // Usages du nom PARTOUT, moins son fichier de définition.
  const lignes = rg([
    "-n", "--no-heading", "-w", s.nom,
    "-g", "*.ts", "-g", "*.tsx",
    "src", "scripts", "e2e",
  ]);
  const prod = new Set<string>();
  const tests = new Set<string>();
  for (const l of lignes) {
    const f = l.slice(0, l.indexOf(":"));
    if (f === s.fichier) continue;
    // Une ligne de ré-export pur ne prouve rien à elle seule ; on la garde côté production
    // seulement si le fichier lui-même est de production (une façade EST de la production).
    (estBanc(f) ? tests : prod).add(f);
  }
  const classe = prod.size > 0 ? "PRODUCTION_CALLER" : tests.size > 0 ? "TEST_ONLY" : "NO_CALLER";
  resultats.push({ sym: s, classe, prod: [...prod], tests: [...tests] });
}

const par = (c: string) => resultats.filter((r) => r.classe === c);
const prod = par("PRODUCTION_CALLER");
const testOnly = par("TEST_ONLY");
const aucun = par("NO_CALLER");

console.log(`PÉRIMÈTRE : ${CIBLES.join(" ")}`);
console.log(`exports analysés : ${resultats.length}`);
console.log(`  PRODUCTION_CALLER : ${prod.length}`);
console.log(`  TEST_ONLY         : ${testOnly.length}`);
console.log(`  NO_CALLER         : ${aucun.length}`);

if (testOnly.length) {
  console.log(`\n── TEST_ONLY (${testOnly.length}) ────────────────────────────────`);
  for (const r of testOnly.sort((a, b) => a.sym.fichier.localeCompare(b.sym.fichier))) {
    console.log(`  ${r.sym.nom}`);
    console.log(`      ${r.sym.fichier}:${r.sym.ligne}`);
    console.log(`      appelé par : ${r.tests.slice(0, 4).join(", ")}${r.tests.length > 4 ? ` (+${r.tests.length - 4})` : ""}`);
  }
}

if (aucun.length) {
  console.log(`\n── NO_CALLER (${aucun.length}) ──────────────────────────────────`);
  for (const r of aucun.sort((a, b) => a.sym.fichier.localeCompare(b.sym.fichier))) {
    console.log(`  ${r.sym.nom}  —  ${r.sym.fichier}:${r.sym.ligne}`);
  }
}
