import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * UNE DEMANDE DE RECRUTEMENT, UN GESTE À LA FOIS (audit 360°, R14 — §118.192).
 *
 * Chaque écriture d'ÉTAPE est conditionnelle sur l'étape LUE : `updateMany` avec `stage` dans son `where`.
 * Les gestes de ce lot ont chacun leur course forcée dans `actions/recruitment-correction-flow.test.ts` ;
 * ce cliquet tient la règle pour l'écriture qu'on ajoutera DEMAIN, que personne n'aura pensé à faire
 * courir (§118.58) — un `update` par identifiant seul écrase en silence le geste qui est passé avant lui.
 */

const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const SRC = sansCommentaires(readFileSync(join(process.cwd(), "src/lib/actions/recruitment-actions.ts"), "utf8"));

function argumentsDe(src: string, ouvrante: number): string {
  let prof = 0;
  for (let i = ouvrante; i < src.length; i += 1) {
    if (src[i] === "(") prof += 1;
    else if (src[i] === ")") { prof -= 1; if (prof === 0) return src.slice(ouvrante + 1, i); }
  }
  return src.slice(ouvrante + 1);
}

/** Le texte du `where` d'un appel Prisma, accolades équilibrées. */
function whereDe(args: string): string {
  const m = /\bwhere\s*:\s*\{/.exec(args);
  if (!m) return "";
  let prof = 0;
  for (let i = m.index + m[0].length - 1; i < args.length; i += 1) {
    if (args[i] === "{") prof += 1;
    else if (args[i] === "}") { prof -= 1; if (prof === 0) return args.slice(m.index, i + 1); }
  }
  return args.slice(m.index);
}

describe("Recrutement — chaque écriture d'étape est conditionnelle sur l'étape lue", () => {
  it("aucune écriture d'étape par identifiant seul", () => {
    const ecritures: string[] = [];
    const fautives: string[] = [];
    for (const a of SRC.matchAll(/(?:prisma|tx)\.recruitmentRequest\.(update|updateMany)\s*\(/g)) {
      const args = argumentsDe(SRC, a.index! + a[0].length - 1);
      // Une écriture d'ÉTAPE : `stage` hors du `where` (dans ce qu'elle écrit).
      const reste = args.replace(whereDe(args), "");
      if (!/\bstage\s*:/.test(reste)) continue;
      ecritures.push(a[0]);
      if (a[1] !== "updateMany" || !/\bstage\s*:/.test(whereDe(args))) fautives.push(args.slice(0, 120).replace(/\s+/g, " "));
    }
    // PLANCHER : un parcours cassé rendrait ce cliquet vert en ne trouvant RIEN (§118.17). Mesuré : 13.
    expect(ecritures.length, "aucune écriture d'étape trouvée : le cliquet ne lit plus la bonne forme").toBeGreaterThanOrEqual(13);
    expect(fautives, `écritures d'étape non conditionnelles : ${fautives.join(" | ")}`).toEqual([]);
  });

  it("la décision écrit les marches que `marchesChangees` désigne — appariées par leur RANG, jamais par position", () => {
    // La règle pure est éprouvée seule (`request-flow.test.ts`) ; c'est son POINT D'APPEL qu'il faut tenir
    // (§118.49) : la base rend les marches triées dans ce banc (index), pas toujours en production.
    const i = SRC.indexOf("export async function decideRecruitmentStep");
    const corps = SRC.slice(i, SRC.indexOf("export async function", i + 10));
    expect(corps).toMatch(/const changees = marchesChangees\(steps, nextSteps\);/);
    expect(corps).toMatch(/for \(const s of changees\)/);
    expect(corps, "plus aucune comparaison par position").not.toMatch(/\.filter\(\(s, i\) => s\.status !== steps\[i\]/);
  });

  it("TÉMOIN : le cliquet sait dire NON", () => {
    const faux = "await prisma.recruitmentRequest.update({ where: { id }, data: { stage: \"SOURCING\" } });";
    const a = /(?:prisma|tx)\.recruitmentRequest\.(update|updateMany)\s*\(/.exec(faux)!;
    const args = argumentsDe(faux, a.index + a[0].length - 1);
    expect(a[1] !== "updateMany" || !/\bstage\s*:/.test(whereDe(args))).toBe(true);
  });
});
