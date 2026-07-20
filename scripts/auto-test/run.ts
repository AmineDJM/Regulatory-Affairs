import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT, discoverRoutes, auditCoherence, roleAccessMatrix, renderMarkdown,
  type AuditResult, type Finding,
} from "./lib";

/**
 * Auto-testeur AMD — orchestrateur CLI.
 *
 *   npx tsx scripts/auto-test/run.ts            # audit statique (aucun serveur requis)
 *   npx tsx scripts/auto-test/run.ts --live --base-url=http://localhost:3000
 *   npx tsx scripts/auto-test/run.ts --live --seed        # sème des comptes jetables par rôle
 *   npx tsx scripts/auto-test/run.ts --ai                 # triage IA des constats (si API configurée)
 *
 * Sorties : `auto-test-report.md` + `auto-test-report.json` (racine du dépôt).
 * Code de sortie ≠ 0 si au moins un **bug** (utilisable en CI).
 */

interface Args {
  live: boolean;
  seed: boolean;
  ai: boolean;
  baseUrl: string | null;
  outDir: string;
}

function parseArgs(argv: string[]): Args {
  const get = (k: string) => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(k.length + 3) : null;
  };
  return {
    live: argv.includes("--live"),
    seed: argv.includes("--seed"),
    ai: argv.includes("--ai"),
    baseUrl: get("base-url") ?? process.env.AUTOTEST_BASE_URL ?? null,
    outDir: get("out") ?? REPO_ROOT,
  };
}

function summarize(findings: Finding[]): { bugs: number; warnings: number; infos: number } {
  return {
    bugs: findings.filter((f) => f.severity === "bug").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    infos: findings.filter((f) => f.severity === "info").length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Date.now();

  console.log("● Auto-testeur AMD — découverte des pages…");
  const routes = discoverRoutes();
  const findings = auditCoherence(routes);
  const matrix = roleAccessMatrix();
  console.log(`  ${routes.length} pages · ${matrix.length} rôles · ${findings.length} constat(s)`);

  const result: AuditResult = {
    generatedAt: new Date().toISOString(),
    routeCount: routes.length,
    routes,
    findings,
    matrix,
  };

  // Crawl en direct (optionnel) : nécessite une instance en marche + Playwright.
  if (args.live) {
    try {
      const { runLiveCrawl } = await import("./live");
      console.log("● Crawl en direct (Playwright)…");
      result.live = await runLiveCrawl({ baseUrl: args.baseUrl, seed: args.seed, routes, matrix });
      const live = result.live as { findings?: Finding[] };
      if (live.findings?.length) result.findings.push(...live.findings);
    } catch (e) {
      console.warn(`  ⚠ Crawl en direct indisponible : ${(e as Error).message}`);
      console.warn("    (Playwright non installé ? Aucune instance joignable ? L'audit statique reste valable.)");
    }
  }

  // Triage IA (optionnel) : résume/priorise les constats en langage clair.
  if (args.ai) {
    try {
      const { aiTriage } = await import("./ai");
      console.log("● Triage IA des constats…");
      const triage = await aiTriage(result);
      if (triage) result.live = { ...(result.live as object), markdown: `${(result.live as { markdown?: string })?.markdown ?? ""}\n\n${triage}` };
    } catch (e) {
      console.warn(`  ⚠ Triage IA indisponible : ${(e as Error).message}`);
    }
  }

  const md = renderMarkdown(result);
  const mdPath = path.join(args.outDir, "auto-test-report.md");
  const jsonPath = path.join(args.outDir, "auto-test-report.json");
  fs.writeFileSync(mdPath, md);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

  const { bugs, warnings, infos } = summarize(result.findings);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("");
  console.log(`━━━ Résultat ━━━`);
  console.log(`  🔴 Bugs        : ${bugs}`);
  console.log(`  🟠 Avertiss.   : ${warnings}`);
  console.log(`  🔵 Infos       : ${infos}`);
  console.log(`  Rapport        : ${path.relative(REPO_ROOT, mdPath)}  (+ .json)`);
  console.log(`  Durée          : ${secs}s`);
  if (bugs > 0) {
    console.log("");
    console.log("  Bugs (à corriger en priorité) :");
    for (const f of result.findings.filter((x) => x.severity === "bug")) {
      console.log(`   - ${f.code}${f.route ? ` ${f.route}` : ""} : ${f.message}`);
    }
  }
  process.exit(bugs > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
