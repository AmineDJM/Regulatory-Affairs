/**
 * LA DETTE DE FRONTIÈRE, EN UN COUP D'ŒIL.
 *
 * `npx tsx scripts/adam-boundary.ts`
 *
 * Le test `src/platform/boundary.test.ts` empêche le chiffre de monter ; ce script dit COMMENT
 * le faire baisser — par quelles cibles commencer, quels fichiers sont les plus couplés. Les
 * deux lisent le même scanner, donc ils ne peuvent pas diverger.
 */
import { scanBoundary, formatBoundary } from "../src/platform/boundary-scan";

const report = scanBoundary();
console.log(formatBoundary(report, 20));
console.log("\nPAR NATURE (ce que la frontière doit absorber en priorité) :");
const bucket = (t: string) =>
  t === "@prisma/client" ? "SCHÉMA (types générés)"
  : t.includes("/prisma") ? "BASE DE DONNÉES"
  : /rbac|session|entity-access|company/.test(t) ? "SÉCURITÉ / IDENTITÉ"
  : t.startsWith("src/lib/actions/") ? "ACTIONS SERVEUR"
  : t.startsWith("src/lib/queries/") ? "REQUÊTES MÉTIER"
  : t.startsWith("src/components/") ? "COMPOSANTS UI"
  : "AUTRES MODULES ERP";
const buckets = new Map<string, number>();
for (const [t, n] of report.perTarget) buckets.set(bucket(t), (buckets.get(bucket(t)) ?? 0) + n);
for (const [b, n] of [...buckets.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${b}`);
}
