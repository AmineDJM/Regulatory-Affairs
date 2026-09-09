/**
 * GÉNÈRE `src/lib/actions/contrat.genere.ts` depuis la SOURCE des actions.
 *
 * Pourquoi un artefact versionné plutôt qu'une lecture à l'exécution : en production, les
 * fichiers `src/lib/actions/*.ts` ne sont pas sur le disque — Next.js les a compilés. Adam a
 * pourtant besoin de ces contrats à l'exécution. On dérive donc au moment du build, et le
 * cliquet (`contrat.test.ts`) REDÉRIVE à chaque test et compare : une dérive fait échouer les
 * tests en nommant l'action, personne n'entretient ce fichier à la main.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { scannerContrats } from "../src/lib/actions/contrat-scan";

const contrats = scannerContrats();
const illisibles = contrats.filter((c) => c.illisible);

// Une ligne par action : un diff de ce fichier NOMME l'action dont le contrat a bougé, au lieu
// d'un pavé que personne ne relit. C'est ce qui rend l'artefact revu au lieu d'accepté.
const entete = `// ⚠️  FICHIER GÉNÉRÉ — ne pas éditer à la main.
// Produit par \`npm run actions:contrat\` depuis la SOURCE de src/lib/actions/.
// Le cliquet \`src/lib/actions/contrat.test.ts\` redérive et compare : toute dérive échoue.
import type { ContratAction } from "./contrat";

export const CONTRATS_ACTIONS: readonly ContratAction[] = [
${contrats.map((c) => "  " + JSON.stringify(c)).join(",\n")}
];

/** Index par id — \`fichier:fonction\`, la même clé que le registre de parité. */
export const CONTRAT_PAR_ID: ReadonlyMap<string, ContratAction> =
  new Map(CONTRATS_ACTIONS.map((c) => [c.id, c]));
`;

writeFileSync(join(process.cwd(), "src", "lib", "actions", "contrat.genere.ts"), entete, "utf8");

/**
 * LA TABLE D'AIGUILLAGE — un spécificateur STATIQUE par fichier, chargé PARESSEUSEMENT.
 *
 * Trois formes étaient possibles et deux sont mauvaises. Un `import()` à chemin calculé fait
 * fabriquer à l'empaqueteur un module de contexte pour tout le dossier — analysable par
 * personne. Des imports statiques de tout le parc tireraient chaque dépendance lourde
 * (`mupdf`, `sharp`, `nodemailer`) dans le paquet de qui touche l'aiguillage. Une table de
 * fonctions paresseuses à spécificateurs littéraux garde les deux propriétés : l'empaqueteur
 * voit chaque chemin, et rien n'est chargé tant qu'on n'appelle pas.
 */
const fichiers = [...new Set(contrats.map((c) => c.fichier))].sort();
const aiguillage = `// ⚠️  FICHIER GÉNÉRÉ — ne pas éditer à la main. Voir \`npm run actions:contrat\`.
//
// Chaque entrée est un spécificateur LITTÉRAL : l'empaqueteur les voit tous, et rien n'est
// chargé avant l'appel. \`executer.test.ts\` résout les ${contrats.length} actions et échoue en
// nommant celle qui a disparu — c'est le contrôle d'appelant que le compilateur ne fait pas ici.

export const MODULES_ACTIONS: Readonly<Record<string, () => Promise<Record<string, unknown>>>> = {
${fichiers.map((f) => `  ${JSON.stringify(f)}: () => import(${JSON.stringify("./" + f)}) as unknown as Promise<Record<string, unknown>>,`).join("\n")}
};
`;
writeFileSync(join(process.cwd(), "src", "lib", "actions", "aiguillage.genere.ts"), aiguillage, "utf8");
console.info(`[CONTRAT] aiguillage : ${fichiers.length} modules`);

const appelables = contrats.length - illisibles.length;
console.info(`[CONTRAT] ${contrats.length} actions — ${appelables} appelables, ${illisibles.length} illisibles`);
const parCause = new Map<string, number>();
for (const c of illisibles) {
  const cause = c.illisible!.split("—")[0]!.split("(")[0]!.trim();
  parCause.set(cause, (parCause.get(cause) ?? 0) + 1);
}
for (const [cause, n] of [...parCause.entries()].sort((a, b) => b[1] - a[1])) {
  console.info(`   ${String(n).padStart(4)}  ${cause}`);
}
