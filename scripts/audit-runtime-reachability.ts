/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA JOIGNABILITÉ DEPUIS LA PRODUCTION — reproductible, versionnée, à deux niveaux.
 *
 *   npx tsx scripts/audit-runtime-reachability.ts [dossier...]
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────────────────
 *
 * Un lot précédent annonçait « 124 en production / 14 test-only / 0 sans appelant ». Le chiffre
 * était juste ou faux, on ne pouvait pas le savoir : l'instrument qui l'avait produit n'était
 * pas dans le dépôt. Un nombre qu'on ne peut pas rejouer n'est pas une mesure, c'est un
 * souvenir. Celui-ci se relance à chaque lot, par n'importe qui.
 *
 * ── DEUX NIVEAUX, PARCE QU'ILS RÉPONDENT À DEUX QUESTIONS ────────────────────────────────
 *
 * MODULE  — « ce fichier est-il importé par du code de production ? » S'il ne l'est pas, aucun
 *           de ses exports n'est atteignable, quelle que soit la richesse de ses tests. C'est
 *           la mesure qui a révélé que `recovery/` était mort.
 *
 * SYMBOLE — « cet export a-t-il un appelant ? » Plus fin, et plus piégeux : `rendreDocx` n'a
 *           aucun appelant externe, mais `rendre()` — exporté du même fichier et appelé par
 *           `build.ts` — l'appelle. Le classer « mort » serait faux. D'où la classe
 *           INDIRECT : atteignable via un autre export du même module, lui-même joignable.
 *
 * Les deux sortent en `audit/reachability.json` (machine) et `audit/reachability.md` (humain).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const CIBLES = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ["src/lib/missions", "src/lib/artifact"];

const rg = (args: string[]): string[] => {
  try {
    return execFileSync("rg", args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 })
      .split("\n").filter(Boolean);
  } catch { return []; }
};

/**
 * LES RACINES DE TEST (§51). Tout le reste est une racine de PRODUCTION : routes Next, actions
 * serveur, ordonnanceur, ponts `in-process`, scripts d'exploitation.
 *
 * Le classement est volontairement strict. Un banc de sabotage ou une fixture ne « prouve »
 * l'usage de rien : c'est justement ce que l'audit cherchait à débusquer.
 */
const RACINE_TEST = [
  /\.test\.tsx?$/, /(^|\/)e2e\//, /(^|\/)fakes\.ts$/, /(^|\/)fixtures\.ts$/,
  /(^|\/)scripts\/(bench|auto-test)\//, /(^|\/)audit\//,
  /(^|\/)fake-[\w-]+\.ts$/,
];
const estTest = (f: string) => RACINE_TEST.some((r) => r.test(f));

interface Module { chemin: string; alias: string; importeursProd: string[]; importeursTest: string[] }
interface Symbole {
  nom: string; module: string; ligne: number;
  classe: "DIRECT_PROD_CALLER" | "INDIRECT_VIA_PROD_MODULE" | "TEST_ONLY" | "NO_CALLER";
  appelantsProd: string[]; appelantsTest: string[];
}

const DECL = /^export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/;
const DECL_CONST = /^export\s+(?:const|let)\s+([A-Za-z_$][\w$]*)\s*[:=]/;

const modules: Module[] = [];
const symboles: Symbole[] = [];

for (const racine of CIBLES) {
  const fichiers = rg(["--files", "-g", "*.ts", "-g", "!*.test.ts", "-g", "!fakes.ts", "-g", "!fixtures.ts", racine]);

  for (const chemin of fichiers) {
    const alias = chemin.replace(/^src\//, "@/").replace(/\.tsx?$/, "");
    const lignes = rg(["-n", "--no-heading", "-F", alias, "-g", "*.ts", "-g", "*.tsx", "src", "scripts", "e2e"]);
    const vus = new Set<string>();
    for (const l of lignes) {
      const f = l.slice(0, l.indexOf(":"));
      if (f !== chemin) vus.add(f);
    }
    modules.push({
      chemin, alias,
      importeursProd: [...vus].filter((f) => !estTest(f)),
      importeursTest: [...vus].filter(estTest),
    });
  }
}

const moduleProd = new Set(modules.filter((m) => m.importeursProd.length > 0).map((m) => m.chemin));

for (const m of modules) {
  const src = readFileSync(m.chemin, "utf8").split("\n");
  const exports: { nom: string; ligne: number }[] = [];
  src.forEach((l, i) => {
    const x = DECL.exec(l) ?? DECL_CONST.exec(l);
    if (x) exports.push({ nom: x[1], ligne: i + 1 });
  });

  for (const e of exports) {
    const lignes = rg(["-n", "--no-heading", "-w", e.nom, "-g", "*.ts", "-g", "*.tsx", "src", "scripts", "e2e"]);
    const prod = new Set<string>();
    const test = new Set<string>();
    let usageInterne = false;
    for (const l of lignes) {
      const f = l.slice(0, l.indexOf(":"));
      if (f === m.chemin) {
        // Un usage DANS le module qui n'est pas sa déclaration : un autre export l'appelle.
        const numero = Number(l.slice(f.length + 1, l.indexOf(":", f.length + 1)));
        if (numero !== e.ligne) usageInterne = true;
        continue;
      }
      (estTest(f) ? test : prod).add(f);
    }

    const classe: Symbole["classe"] =
      prod.size > 0 ? "DIRECT_PROD_CALLER"
      : usageInterne && moduleProd.has(m.chemin) ? "INDIRECT_VIA_PROD_MODULE"
      : test.size > 0 ? "TEST_ONLY"
      : "NO_CALLER";

    symboles.push({
      nom: e.nom, module: m.chemin, ligne: e.ligne, classe,
      appelantsProd: [...prod], appelantsTest: [...test],
    });
  }
}

const compte = <T extends string>(xs: { classe: T }[]) =>
  xs.reduce<Record<string, number>>((a, x) => ({ ...a, [x.classe]: (a[x.classe] ?? 0) + 1 }), {});

const modClasse = modules.map((m) => ({
  ...m,
  classe: m.importeursProd.length > 0 ? "PRODUCTION" : m.importeursTest.length > 0 ? "TEST_ONLY" : "ORPHAN",
}));

const rapport = {
  genereLe: new Date().toISOString(),
  perimetre: CIBLES,
  modules: { total: modules.length, ...compte(modClasse) } as Record<string, number>,
  symboles: { total: symboles.length, ...compte(symboles) } as Record<string, number>,
  modulesTestOnly: modClasse.filter((m) => m.classe === "TEST_ONLY").map((m) => m.chemin),
  modulesOrphelins: modClasse.filter((m) => m.classe === "ORPHAN").map((m) => m.chemin),
  symbolesSansAppelant: symboles.filter((s) => s.classe === "NO_CALLER").map((s) => `${s.module}:${s.ligne} ${s.nom}`),
  symbolesTestOnly: symboles.filter((s) => s.classe === "TEST_ONLY").map((s) => `${s.module}:${s.ligne} ${s.nom}`),
};

mkdirSync("audit", { recursive: true });
writeFileSync("audit/reachability.json", `${JSON.stringify(rapport, null, 2)}\n`);

const md = [
  `# Joignabilité depuis la production`,
  ``,
  `Généré par \`npx tsx scripts/audit-runtime-reachability.ts\` — ${rapport.genereLe}`,
  `Périmètre : ${CIBLES.map((c) => `\`${c}\``).join(", ")}`,
  ``,
  `## Niveau MODULE — « ce fichier est-il importé par de la production ? »`,
  ``,
  `| classe | n |`, `|---|---|`,
  `| PRODUCTION | ${rapport.modules.PRODUCTION ?? 0} |`,
  `| TEST_ONLY | ${rapport.modules.TEST_ONLY ?? 0} |`,
  `| ORPHAN | ${rapport.modules.ORPHAN ?? 0} |`,
  ``,
  ...(rapport.modulesTestOnly.length
    ? [`### Modules atteignables seulement par les tests`, ``, ...rapport.modulesTestOnly.map((m) => `- \`${m}\``), ``]
    : [`Aucun module test-only.`, ``]),
  `## Niveau SYMBOLE — « cet export a-t-il un appelant ? »`,
  ``,
  `\`INDIRECT_VIA_PROD_MODULE\` = appelé par un autre export du même module, lui-même joignable.`,
  `C'est le cas de \`rendreDocx\`, appelé par \`rendre()\` : le compter comme mort serait faux.`,
  ``,
  `| classe | n |`, `|---|---|`,
  `| DIRECT_PROD_CALLER | ${rapport.symboles.DIRECT_PROD_CALLER ?? 0} |`,
  `| INDIRECT_VIA_PROD_MODULE | ${rapport.symboles.INDIRECT_VIA_PROD_MODULE ?? 0} |`,
  `| TEST_ONLY | ${rapport.symboles.TEST_ONLY ?? 0} |`,
  `| NO_CALLER | ${rapport.symboles.NO_CALLER ?? 0} |`,
  ``,
].join("\n");
writeFileSync("audit/reachability.md", `${md}\n`);

console.log(`MODULES  ${modules.length} — prod ${rapport.modules.PRODUCTION ?? 0}`
  + ` · test-only ${rapport.modules.TEST_ONLY ?? 0} · orphelins ${rapport.modules.ORPHAN ?? 0}`);
console.log(`SYMBOLES ${symboles.length} — direct ${rapport.symboles.DIRECT_PROD_CALLER ?? 0}`
  + ` · indirect ${rapport.symboles.INDIRECT_VIA_PROD_MODULE ?? 0}`
  + ` · test-only ${rapport.symboles.TEST_ONLY ?? 0} · sans appelant ${rapport.symboles.NO_CALLER ?? 0}`);
for (const m of rapport.modulesTestOnly) console.log(`  TEST-ONLY  ${m}`);
for (const m of rapport.modulesOrphelins) console.log(`  ORPHELIN   ${m}`);
console.log(`\n→ audit/reachability.json · audit/reachability.md`);
