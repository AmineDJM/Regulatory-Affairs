import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE RÉFÉRENCE DÉRIVÉE DU MAXIMUM SE RECALCULE SOUS COLLISION (§118.175).
 *
 * `buildRef` lit les références existantes et rend la suivante : deux créations à la même
 * seconde lisent le MÊME maximum, calculent la MÊME référence, et la seconde heurte la contrainte
 * d'unicité. `createWithRetry` recalcule et réessaie ; `enSerie` sérialise une série dans le
 * processus (§118.148g). Trouvé par la suite elle-même : deux bancs déposaient des sponsorings en
 * parallèle, et `createSponsoring` — le seul des quatre dépôts Ad & Pro sans filet — échouait sur
 * une erreur brute. Le même défaut tenait la création des sujets (le chemin de la réservation) et
 * la demande de pièce d'un poste (la série DEM, que le secrétariat, lui, protégeait).
 *
 * Réparer trois créations ne protège pas la quatrième (§118.58). Le cliquet s'arme sur un fait du
 * FICHIER : un fichier qui numérote par `buildRef` porte un filet. Il est GROSSIER, et on le dit :
 * il attrape le fichier qui n'en a AUCUN, pas celui qui en a un sur une création et l'oublie sur
 * l'autre — le lire fonction par fonction serait faux sur le motif le plus courant, une aide qui
 * calcule la référence appelée DANS l'essai d'une autre fonction. Les fichiers déjà sans filet
 * sont une DETTE NOMMÉE au chiffre mesuré : elle ne peut que baisser, et un fichier neuf sans
 * filet fait tomber la suite.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** La dette mesurée le 02/10/2026 : des créations numérotées sans filet, à reprendre une à une. */
const DETTE = new Set([
  "src/lib/actions/ad-pro-transfer-actions.ts",
  "src/lib/actions/directive-actions.ts",
  "src/lib/actions/finance-actions.ts",
  "src/lib/actions/logistics-actions.ts",
  "src/lib/actions/payroll-hr-actions.ts",
  "src/lib/actions/pch-actions.ts",
  "src/lib/actions/purchase-request-actions.ts",
  "src/lib/actions/regulatory-actions.ts",
  "src/lib/actions/support-actions.ts",
  "src/lib/medical-info.ts",
  // Deux AIDES de la série FIN : le filet appartient à leurs appelants, qui n'en ont pas.
  "src/lib/finance/next-ref.ts", // expense-actions, petty-cash-actions
  "src/lib/finance/settle-invoice.ts", // invoice-actions, legal-actions
]);

function fichiersDeProduction(dir = "src"): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom);
    if (statSync(p).isDirectory()) { out.push(...fichiersDeProduction(p)); continue; }
    if (!/\.(ts|tsx)$/.test(nom) || /\.(test|spec)\.tsx?$/.test(nom)) continue;
    out.push(p);
  }
  return out;
}

/** La source SANS commentaires : un commentaire qui cite `createWithRetry(` ne pose aucun filet (§118.79d). */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const FILET = /\b(createWithRetry|enSerie)\(/;
const NUMEROTE = /(?<!function\s)\bbuildRef\(/;

/** Le corps d'une fonction exportée, jusqu'à l'accolade fermante en colonne 0 — le style du dépôt. */
function aidesExportees(code: string): { nom: string; corps: string }[] {
  const out: { nom: string; corps: string }[] = [];
  for (const m of code.matchAll(/^export (?:async )?function (\w+)\(/gm)) {
    const debut = m.index ?? 0;
    const fin = code.indexOf("\n}\n", debut);
    out.push({ nom: m[1]!, corps: code.slice(debut, fin < 0 ? undefined : fin) });
  }
  return out;
}

/**
 * Qui est EN DETTE. Un fichier qui numérote et porte un filet est couvert. Sans filet, deux cas :
 * une AIDE partagée (« la prochaine référence FIN ») ne fait pas la création — le filet appartient
 * à ses appelants, et elle est couverte quand TOUS en portent un ; sinon, c'est le fichier qui crée,
 * et il est en dette. Sans ce partage, une aide ne pourrait jamais sortir de la dette, même ses
 * appelants réparés : un cliquet qui ne peut pas descendre ne garde rien (§118.79c).
 */
function etat() {
  const sources = new Map<string, string>();
  for (const f of fichiersDeProduction()) sources.set(relative(process.cwd(), f).replace(/\\/g, "/"), sansCommentaires(readFileSync(f, "utf8")));
  const numerotent: string[] = [];
  const sansFilet: string[] = [];
  const appelantsNus = new Map<string, string[]>();
  for (const [rel, code] of sources) {
    // L'appel, pas la définition : `refs.ts` DÉFINIT `buildRef` et porte les deux filets.
    if (!NUMEROTE.test(code)) continue;
    numerotent.push(rel);
    if (FILET.test(code)) continue;
    const specificateur = rel.replace(/^src\//, "@/").replace(/\.tsx?$/, "");
    const aides = aidesExportees(code).filter((a) => NUMEROTE.test(a.corps)).map((a) => a.nom);
    const appelants = [...sources].filter(([autre, c]) =>
      autre !== rel && c.includes(`"${specificateur}"`) && aides.some((n) => new RegExp(`\\b${n}\\b`).test(c)));
    if (appelants.length > 0 && appelants.every(([, c]) => FILET.test(c))) continue;
    sansFilet.push(rel);
    appelantsNus.set(rel, appelants.filter(([, c]) => !FILET.test(c)).map(([a]) => a));
  }
  return { numerotent, sansFilet, appelantsNus };
}

describe("Cliquet — une référence numérotée porte son filet", () => {
  it("PLANCHER : le parcours trouve les fichiers qui numérotent — un parcours cassé rendrait le cliquet vert sur rien", () => {
    expect(etat().numerotent.length).toBeGreaterThanOrEqual(20);
  });

  it("aucun fichier NEUF sans filet — et le refus nomme le fichier, avec ses appelants nus si c'est une aide", () => {
    const { sansFilet, appelantsNus } = etat();
    const neufs = sansFilet.filter((f) => !DETTE.has(f)).map((f) => `${f}${appelantsNus.get(f)?.length ? ` (appelée sans filet par ${appelantsNus.get(f)!.join(", ")})` : ""}`);
    expect(neufs, "numérote par buildRef sans createWithRetry ni enSerie : la seconde création simultanée échouerait").toEqual([]);
  });

  it("la DETTE ne fait que baisser : un fichier réparé sort de la liste, et la liste ne grossit pas", () => {
    const { sansFilet } = etat();
    const repares = [...DETTE].filter((f) => !sansFilet.includes(f));
    expect(repares, "réparé : retirez-le de DETTE — un cliquet qui ne peut pas descendre ne garde rien (§118.79c)").toEqual([]);
    expect(DETTE.size, "dette mesurée le 02/10/2026").toBeLessThanOrEqual(12);
  });

  it("les trois créations réparées par ce lot gardent leur filet", () => {
    const { numerotent, sansFilet } = etat();
    for (const f of ["src/lib/actions/sponsoring-actions.ts", "src/lib/dossiers-core.ts", "src/lib/actions/ad-pro-item-actions.ts"]) {
      expect(numerotent, `${f} numérote encore`).toContain(f);
      expect(sansFilet, `${f} a perdu son filet`).not.toContain(f);
    }
  });
});
