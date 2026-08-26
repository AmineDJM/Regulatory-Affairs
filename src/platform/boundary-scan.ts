import fs from "node:fs";
import path from "node:path";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE SCANNER DE FRONTIÈRE — il compte ce qui traverse, et c'est tout.
 *
 * POURQUOI CE FICHIER EXISTE. La séparation d'Adam et de l'ERP se joue sur 447 imports répartis
 * dans 118 fichiers. Deux façons de traiter cela :
 *
 *   • la réécriture d'un bloc — longue, risquée, et invérifiable tant qu'elle n'est pas finie ;
 *   • un CLIQUET — on mesure la dette, on interdit qu'elle grossisse, on la fait baisser lot
 *     après lot. À tout instant le produit marche, et le chiffre dit où l'on en est.
 *
 * La mission demande explicitement d'éviter « une réécriture aveugle ». Le cliquet est la
 * réponse : il rend la migration incrémentale ET irréversible. Sans lui, une frontière posée un
 * mardi est reperforée le jeudi par quelqu'un qui avait juste besoin d'un import — et personne
 * ne le voit passer en revue de code.
 *
 * Ce module ne dépend de rien du produit : `fs` et `path`. Il est lu par le test de frontière et
 * par le script d'audit, jamais par du code d'exécution.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LE PÉRIMÈTRE SURVEILLÉ — la frontière et tout ce qui doit se tenir derrière elle.
 *
 * `src/platform/` n'appartient NI à Adam NI à l'ERP : c'est le contrat que les deux partagent.
 * L'ERP y publie ses faits, Adam y lit et y demande. Le placer d'un côté ou de l'autre aurait
 * recréé une dépendance dans ce sens-là — l'ERP important « du Adam » pour annoncer qu'un
 * paiement est validé aurait été un couplage inverse, plus difficile à voir que le direct.
 */
export const ADAM_PATHS = [
  "src/platform/",
  "src/lib/assistant/",
  "src/lib/assistant.ts",
  "src/lib/assistant-",
  "src/lib/comms/",
  "src/components/chief/",
  "src/app/(chief)/",
  "src/app/(app)/assistant/",
  "src/app/api/assistant/",
] as const;

/**
 * LE PONT AUTORISÉ — le seul endroit d'Adam qui a le droit de connaître l'ERP.
 *
 * Un pont, pas une passoire : s'il y en avait deux, il n'y en aurait bientôt plus aucun.
 */
export const BRIDGE_PATHS = ["src/platform/in-process/"] as const;

/** Ce qui n'est PAS l'ERP : les paquets externes, et Adam lui-même. */
const isAdam = (f: string) => ADAM_PATHS.some((p) => f.startsWith(p));
const isBridge = (f: string) => BRIDGE_PATHS.some((p) => f.startsWith(p));

/**
 * LES MODULES NEUTRES — ni ERP, ni Adam : des utilitaires sans état, sans base, sans règle
 * métier. Les faire traverser la frontière n'apprend rien à Adam sur l'ERP.
 *
 * La liste est COURTE et le restera : chaque entrée est une exception qu'il faut pouvoir
 * défendre. `utils` et `labels` sont du formatage ; `prisma-enums` n'existe pas, et c'est
 * volontaire — un énuméré généré EST une dépendance au schéma.
 */
const NEUTRAL = new Set(["src/lib/utils", "src/lib/labels"]);

export interface Violation {
  /** Le fichier d'Adam qui importe. */
  from: string;
  /** Le module ERP importé. */
  to: string;
}

export interface BoundaryReport {
  adamFiles: number;
  violations: Violation[];
  /** Nombre d'imports sortants par fichier d'Adam — la dette, ventilée. */
  perFile: Map<string, number>;
  /** Nombre d'imports par cible ERP — dit quoi abstraire en premier. */
  perTarget: Map<string, number>;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const IMPORT_RE = /(?:^|\n)\s*import\s+(?:type\s+)?(?:[\s\S]*?)\s*from\s*["']([^"']+)["']/g;
/** `await import("…")` — un import paresseux traverse la frontière tout autant. */
const DYNAMIC_RE = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Parcourt le périmètre d'Adam et rend tout ce qui traverse vers l'ERP.
 *
 * LES TESTS SONT EXCLUS, et c'est un choix défendable : un test a le droit de fabriquer un jeu
 * de données avec Prisma. Ce qu'on protège, c'est le CODE D'EXÉCUTION — celui qui part en
 * production et qui devra un jour tourner sans l'ERP à portée d'import.
 */
export function scanBoundary(root = process.cwd()): BoundaryReport {
  const cwd = process.cwd();
  process.chdir(root);
  try {
    const files = walk("src")
      .map((f) => f.split(path.sep).join("/"))
      .filter(isAdam)
      .filter((f) => !/\.test\.tsx?$/.test(f));

    const violations: Violation[] = [];
    const perFile = new Map<string, number>();
    const perTarget = new Map<string, number>();

    for (const file of files) {
      if (isBridge(file)) continue; // Le pont a le droit. C'est sa raison d'être.
      const src = fs.readFileSync(file, "utf8");
      const specs: string[] = [];
      for (const m of src.matchAll(IMPORT_RE)) specs.push(m[1]);
      for (const m of src.matchAll(DYNAMIC_RE)) specs.push(m[1]);

      for (const spec of specs) {
        // `@prisma/client` est la dépendance la plus profonde à l'ERP : le schéma lui-même.
        const target = spec === "@prisma/client" ? "@prisma/client"
          : spec.startsWith("@/") ? spec.replace("@/", "src/")
            : null;
        if (!target) continue;
        if (target !== "@prisma/client" && (isAdam(target) || isAdam(`${target}/`))) continue;
        if (NEUTRAL.has(target)) continue;

        violations.push({ from: file, to: target });
        perFile.set(file, (perFile.get(file) ?? 0) + 1);
        perTarget.set(target, (perTarget.get(target) ?? 0) + 1);
      }
    }
    return { adamFiles: files.length, violations, perFile, perTarget };
  } finally {
    process.chdir(cwd);
  }
}

/** Le rapport, tel qu'on le lit dans un terminal. */
export function formatBoundary(r: BoundaryReport, topN = 20): string {
  const byTarget = [...r.perTarget.entries()].sort((a, b) => b[1] - a[1]);
  const byFile = [...r.perFile.entries()].sort((a, b) => b[1] - a[1]);
  const lines = [
    `FRONTIÈRE ADAM ↔ ERP`,
    `  fichiers Adam (hors tests) : ${r.adamFiles}`,
    `  imports traversants        : ${r.violations.length}`,
    `  cibles ERP distinctes      : ${r.perTarget.size}`,
    `  fichiers concernés         : ${r.perFile.size}`,
    "",
    `LES ${topN} CIBLES LES PLUS IMPORTÉES (par quoi commencer) :`,
    ...byTarget.slice(0, topN).map(([t, n]) => `  ${String(n).padStart(3)}  ${t}`),
    "",
    `LES ${topN} FICHIERS LES PLUS COUPLÉS :`,
    ...byFile.slice(0, topN).map(([f, n]) => `  ${String(n).padStart(3)}  ${f}`),
  ];
  return lines.join("\n");
}
