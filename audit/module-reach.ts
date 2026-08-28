/**
 * JOIGNABILITÉ AU NIVEAU MODULE — l'unité honnête.
 *
 * Le recensement par SYMBOLE se trompe : `rendreDocx` n'a aucun appelant direct hors de son
 * fichier, mais `rendre()` — exporté du même fichier et appelé par `build.ts` — l'appelle. Le
 * symbole est donc joignable. Compter les symboles isolément produit de faux morts.
 *
 * La question qui ne ment pas est : **ce MODULE est-il importé par au moins un fichier de
 * production ?** Si non, aucun de ses exports n'est atteignable depuis un usage réel, quelle
 * que soit la richesse de ses tests.
 *
 *   npx tsx audit/module-reach.ts src/lib/missions src/lib/artifact
 */

import { execFileSync } from "node:child_process";

const RACINES = process.argv.slice(2);

const rg = (args: string[]): string[] => {
  try {
    return execFileSync("rg", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      .split("\n").filter(Boolean);
  } catch { return []; }
};

const estBanc = (f: string) =>
  /\.test\.tsx?$/.test(f) || /(^|\/)e2e\//.test(f) || /(^|\/)fakes\.ts$/.test(f)
  || /(^|\/)fixtures\.ts$/.test(f) || /(^|\/)scripts\/(bench|auto-test)\//.test(f)
  || /(^|\/)audit\//.test(f);

for (const racine of RACINES) {
  const modules = rg(["--files", "-g", "*.ts", "-g", "!*.test.ts", "-g", "!fakes.ts", "-g", "!fixtures.ts", racine]);
  const morts: string[] = [];
  const testOnly: string[] = [];
  const vivants: string[] = [];

  for (const m of modules) {
    const alias = m.replace(/^src\//, "@/").replace(/\.tsx?$/, "");
    // On cherche l'alias ET le chemin relatif possible ; un import doit citer l'un des deux.
    const lignes = rg(["-n", "--no-heading", "-F", alias, "-g", "*.ts", "-g", "*.tsx", "src", "scripts", "e2e"]);
    const importeurs = new Set<string>();
    for (const l of lignes) {
      const f = l.slice(0, l.indexOf(":"));
      if (f === m) continue;
      importeurs.add(f);
    }
    const prod = [...importeurs].filter((f) => !estBanc(f));
    const bancs = [...importeurs].filter(estBanc);
    if (prod.length > 0) vivants.push(m);
    else if (bancs.length > 0) testOnly.push(`${m}   ← ${bancs.length} banc(s)`);
    else morts.push(m);
  }

  console.log(`\n═══ ${racine} ═══`);
  console.log(`modules            : ${modules.length}`);
  console.log(`  importés en prod : ${vivants.length}`);
  console.log(`  TEST-ONLY        : ${testOnly.length}`);
  console.log(`  AUCUN importeur  : ${morts.length}`);
  if (testOnly.length) {
    console.log(`\n  ── MODULES ATTEIGNABLES SEULEMENT PAR LES TESTS ──`);
    for (const t of testOnly.sort()) console.log(`    ${t}`);
  }
  if (morts.length) {
    console.log(`\n  ── MODULES SANS AUCUN IMPORTEUR ──`);
    for (const t of morts.sort()) console.log(`    ${t}`);
  }
}
