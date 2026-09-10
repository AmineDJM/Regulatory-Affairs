import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UN DÉCOR DE TEST COÛTE SE COMPTE EN ALLERS-RETOURS, JAMAIS EN MILLISECONDES.
 *
 * ── LE DÉFAUT MESURÉ ────────────────────────────────────────────────────────────────────
 *
 * `src/lib/assistant/ops-goldens.test.ts` tourne en 985 ms SEUL. Dans la suite complète — 717
 * fichiers sur QUATRE cœurs — son `beforeAll` a dépassé les 30 000 ms de `hookTimeout` et la
 * porte est passée au rouge : « Hook timed out in 30000ms », zéro assertion en échec, 8 220
 * tests verts, un fichier rouge. Un rouge qui ressemble à une régression du produit et n'en est
 * pas coûte une suite de six minutes rejouée, et il apprend à ne plus lire le rouge.
 *
 * La cause n'était pas la lourdeur du décor — une trentaine de lignes — mais sa FORME : une
 * trentaine d'attentes l'une après l'autre, chacune payant la contention. Le décor a été réécrit
 * en TROIS VAGUES bornées par les seules clés étrangères (mesure : 985 → 747 ms).
 *
 * ── POURQUOI UN CLIQUET, ET POURQUOI SUR CETTE GRANDEUR-LÀ ──────────────────────────────
 *
 * Réparer ce décor-là ne protège pas le suivant : recensé, 74 décors portent SIX attentes
 * séquentielles ou plus, et le pire en porte quarante-sept — celui qui est tombé n'était même
 * pas le plus lourd. Les corriger un par un est exactement la dette des « 715 fiches » (§118.73)
 * et laisse entrer le soixante-quinzième.
 *
 * On tient donc la grandeur qui appartient au CODE. Le temps d'un décor dépend de la charge de la
 * machine — une assertion là-dessus mesure l'humeur de l'ordonnanceur (§118.83) ; le nombre
 * d'allers-retours SÉQUENTIELS, lui, est une propriété du texte, stable, et c'est elle qui décide
 * combien la contention peut coûter. Le plafond est le maximum MESURÉ : au-dessus, il ne pourrait
 * plus se déclencher (§118.79c), et c'est ce qui distingue un cliquet d'une décoration.
 *
 * ── CE QUE CE TEST NE PRÉTEND PAS ───────────────────────────────────────────────────────
 *
 * La lecture est LIGNE À LIGNE : un `await prisma.…` est compté quand il n'est pas dans un
 * `Promise.all([…])`. Elle ne suit pas les appels de fonction — un décor qui délègue ses écritures
 * à un utilitaire n'est pas vu. C'est assumé : ce cliquet attrape la forme QUI EST TOMBÉE, il ne
 * prétend pas mesurer le coût total d'un décor, et surestimer sa portée serait la tautologie que
 * §118.17 nomme.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * PLAFOND MESURÉ le 2026-09-10 : `src/platform/in-process/missions/watch.test.ts` porte 47
 * attentes séquentielles, le maximum du dépôt. Il ne peut que BAISSER — un décor ajouté au-dessus
 * fait tomber ce test, et c'est le but.
 */
const PLAFOND_ATTENTES = 47;

/** Combien de décors portent une forme séquentielle notable. Sert à voir la dette, pas à la juger. */
const SEUIL_NOTABLE = 6;

interface Decor { attentes: number; fichier: string; ligne: number }

function fichiersDeTest(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fichiersDeTest(p, acc);
    else if (e.name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

/**
 * Les attentes SÉQUENTIELLES d'un `beforeAll`. Ce qui est dans un `Promise.all([…])` part
 * ensemble : ce n'est pas une attente de plus, c'est la même.
 */
function decorsDe(fichier: string): Decor[] {
  const lignes = fs.readFileSync(fichier, "utf8").split("\n");
  const out: Decor[] = [];
  let i = 0;
  while (i < lignes.length) {
    if (!/beforeAll\(async/.test(lignes[i])) { i++; continue; }
    const indent = lignes[i].match(/^\s*/)![0].length;
    let j = i + 1;
    let attentes = 0;
    let profondeurAll = 0;
    for (; j < lignes.length; j++) {
      const l = lignes[j];
      if (/^\s*\}\)/.test(l) && l.match(/^\s*/)![0].length <= indent) break;
      if (/Promise\.all\(\[/.test(l)) profondeurAll++;
      if (profondeurAll > 0) { if (/^\s*\]\)/.test(l)) profondeurAll--; continue; }
      if (/await\s+prisma\./.test(l)) attentes++;
    }
    out.push({ attentes, fichier, ligne: i + 1 });
    i = j;
  }
  return out;
}

describe("le coût d'un décor de test est une propriété du CODE", () => {
  const tous = fichiersDeTest("src").flatMap(decorsDe);

  it("aucun décor ne dépasse le maximum mesuré d'allers-retours séquentiels", () => {
    // CE QUI LE FERAIT TOMBER : un `beforeAll` écrit avec plus d'attentes l'une après l'autre
    // que le pire d'aujourd'hui — c'est-à-dire le prochain « Hook timed out » de la porte.
    expect(tous.length, "des décors doivent être trouvés, sinon la lecture est cassée").toBeGreaterThan(50);
    const pires = tous.filter((d) => d.attentes > PLAFOND_ATTENTES);
    expect(
      pires.map((d) => `${d.fichier}:${d.ligne} — ${d.attentes} attentes séquentielles`),
      `Un décor dépasse ${PLAFOND_ATTENTES} attentes SÉQUENTIELLES vers Postgres. Sous la charge de `
      + "la suite complète (717 fichiers, 4 cœurs), chacune se paie plusieurs centaines de "
      + "millisecondes et le décor dépasse son plafond — un rouge qui ressemble à une régression "
      + "du produit sans en être une. Le geste : grouper en VAGUES les écritures que rien ne lie, "
      + "`Promise.all([…])` par vague, et n'attendre que ce qui a besoin d'un identifiant produit "
      + "par la vague précédente.",
    ).toEqual([]);
  });

  it("la dette est COMPTÉE et nommée, jamais laissée invisible", () => {
    const notables = tous.filter((d) => d.attentes >= SEUIL_NOTABLE).sort((a, b) => b.attentes - a.attentes);
    // Un filtre silencieux ne laisse aucune trace de ce qu'il retire (§118.52) : on imprime.
    const tete = notables.slice(0, 5).map((d) => `${d.attentes} → ${d.fichier}`);
    console.log(`   · décors à ≥ ${SEUIL_NOTABLE} attentes séquentielles : ${notables.length} / ${tous.length}`);
    for (const l of tete) console.log(`     ${l}`);
    // Et le décor qui EST tombé doit rester réparé : il est le seul cas dont on connaisse le prix.
    const goldens = decorsDe("src/lib/assistant/ops-goldens.test.ts");
    expect(goldens, "le décor des goldens d'ops doit être trouvé").toHaveLength(1);
    // MESURÉ : ZÉRO. Le décor n'écrit plus que par vagues (`await Promise.all([…])`), donc aucune
    // attente ne reste seule. Y remettre UNE SEULE écriture séquentielle fait tomber ce test —
    // vérifié en l'injectant — et c'est ce qui distingue cette borne d'un vœu.
    expect(
      goldens[0].attentes,
      "le décor qui a dépassé son plafond dans la porte est écrit en VAGUES : chaque écriture "
      + "remise en séquence rallonge à nouveau le chemin critique du décor sous contention",
    ).toBe(0);
  });
});
