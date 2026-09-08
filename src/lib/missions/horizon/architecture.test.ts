import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUI TIENT L'HORIZON DEBOUT — les invariants que le code doit PORTER, pas promettre.
 *
 * Chaque test nomme le cas qui le ferait tomber (§118.17). Un test dont on ne sait pas dire ce
 * qui le ferait échouer n'est pas un test : c'est une phrase rassurante.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const lire = (rel: string): string => readFileSync(join(process.cwd(), rel), "utf8");

describe("le plafond GLOBAL de replans n'existe plus (§118.42)", () => {
  it("aucun code de production ne compare `planVersion` à un plafond pour REFUSER de replanifier", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : quelqu'un réintroduit `planVersion >= PLANS_MAX` ou
     * `planVersion: { lt: … }` dans le pilote ou la requête du battement. C'est exactement la
     * ligne qui tuait une mission de sept jalons parce qu'un seul d'entre eux s'y reprenait —
     * elle mourait pour avoir AVANCÉ.
     */
    const fichiers = [
      "src/platform/in-process/missions/runtime.ts",
      "src/lib/missions/events/router.ts",
      "src/platform/in-process/missions/horizon.ts",
    ];
    for (const f of fichiers) {
      const src = lire(f);
      const lignes = src.split("\n")
        .map((l, i) => ({ n: i + 1, l }))
        .filter(({ l }) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//"))
        .filter(({ l }) => /planVersion\s*(>=|>)\s*[A-Z_]*MAX|planVersion:\s*\{\s*lt:/.test(l));
      expect(lignes.map((x) => `${f}:${x.n} ${x.l.trim()}`), `${f} borne encore les replans par un compteur global`)
        .toEqual([]);
    }
  });

  it("la requête du battement filtre sur `replanBloque`, qui se remet à faux sur information neuve", () => {
    const router = lire("src/lib/missions/events/router.ts");
    expect(router, "le battement ne lit pas le verdict de progrès").toContain("replanBloque: false");
    expect(router, "aucune information neuve ne rouvre le droit de replanifier")
      .toMatch(/updateMany[\s\S]{0,400}replanBloque:\s*false/);
  });
});

describe("la compilation d'un jalon ne détruit pas les autres", () => {
  it("`materialiser` borne le CONTOURNEMENT au périmètre du jalon", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : `contournees` recalculé sur `enBase` au lieu de
     * `duPerimetre`. Compiler le jalon 2 marquerait alors « contournées » toutes les étapes du
     * jalon 1 — elles ne figurent pas dans `compiled.steps` — et la mission perdrait son propre
     * acquis à chaque jalon franchi. C'est le défaut le plus destructeur que la compilation par
     * jalons pouvait introduire.
     */
    const store = lire("src/lib/missions/runtime/store.ts");
    expect(store).toContain("const duPerimetre = opts.milestoneId");
    expect(store).toMatch(/const contournees = duPerimetre\.filter/);
  });

  it("les étapes compilées portent leur `milestoneId`", () => {
    const store = lire("src/lib/missions/runtime/store.ts");
    expect(store).toContain("milestoneId: opts.milestoneId ?? null");
  });
});

describe("le moteur ne conclut pas une mission dont l'horizon est ouvert", () => {
  it("`conclure` lit `horizonOuvert` AVANT d'interroger le contrôle et le juge", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : la porte retirée, ou placée APRÈS l'appel au juge. Une
     * mission de sept jalons se ferait alors juger au bout du premier — le juge lirait
     * l'objectif ENTIER, ne verrait qu'un septième du travail, refuserait honnêtement, et six
     * jalons ne seraient jamais écrits.
     */
    const engine = lire("src/lib/missions/runtime/engine.ts");
    const iPorte = engine.indexOf("if (etat.horizonOuvert)");
    const iJuge = engine.indexOf("const verdict = await evaluerObjectif(");
    expect(iPorte, "la porte d'horizon a disparu de `conclure`").toBeGreaterThan(0);
    expect(iJuge, "l'appel au juge a disparu").toBeGreaterThan(0);
    expect(iPorte, "la porte est APRÈS le juge : la mission serait jugée sur un septième du travail")
      .toBeLessThan(iJuge);
  });

  it("`avancer` honore PAUSED — un état qu'aucun code ne lit est une promesse d'écran", () => {
    const engine = lire("src/lib/missions/runtime/engine.ts");
    expect(engine).toMatch(/if \(etat\.status === "PAUSED"\)/);
  });
});

describe("le socle de l'horizon reste PUR", () => {
  it("`jalon`, `budget` et `modification` n'importent NI base NI modèle", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : quelqu'un ajoute `import { prisma }` dans une règle pure
     * « pour aller chercher une info ». Le raisonnement deviendrait alors intestable sans base,
     * et la CONVERSATION — qui doit prévoir une empreinte de modification sans rien écrire —
     * ouvrirait une transaction pour poser une question.
     */
    for (const f of ["jalon", "budget", "modification"]) {
      const src = lire(`src/lib/missions/horizon/${f}.ts`);
      const imports = [...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
      expect(imports, `${f}.ts importe quelque chose : il doit rester pur`).toEqual([]);
    }
  });

  it("`fraicheur` n'importe QUE le hachage du socle Node", () => {
    const src = lire("src/lib/missions/horizon/fraicheur.ts");
    const imports = [...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports).toEqual(["node:crypto"]);
  });
});

describe("la fraîcheur a un APPELANT DE PRODUCTION (§118.14)", () => {
  it("les entrées vieillies entrent dans les CONTRAINTES du sous-plan suivant", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : `entreesAVerifier` supprimée du contexte de planification.
     * `MissionInput` redeviendrait une table qu'on remplit et que personne ne lit — l'exemple
     * même de la brique écrite, testée, et sans effet. La fraîcheur ne sert que si elle CHANGE
     * un plan.
     */
    const pilote = lire("src/platform/in-process/missions/horizon.ts");
    expect(pilote).toContain("const perimees = await entreesAVerifier(mission.id);");
    expect(pilote).toMatch(/contraintes: perimees/);
    expect(pilote, "la fraîcheur ne passe pas par le module qui la juge").toContain("aRegarder(entrees, new Date())");
  });

  it("le pilote ne relit RIEN de sa propre autorité — il énonce, le plan décide", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : quelqu'un fait relire le pilote « pour aller plus vite ».
     * On produirait alors des lectures hors plan, sans étape pour les porter ni reçu pour les
     * prouver — c'est-à-dire des faits sans provenance, exactement ce que tout le registre de
     * preuves existe pour empêcher.
     */
    const pilote = lire("src/platform/in-process/missions/horizon.ts");
    const f = pilote.slice(pilote.indexOf("async function entreesAVerifier"));
    const corps = f.slice(0, f.indexOf("\n}"));
    expect(corps, "`entreesAVerifier` exécute une capacité au lieu de se contenter de dire")
      .not.toMatch(/executer|runner|\.lire\(|capabilit/i);
  });
});

describe("l'arrêt d'une mission ferme aussi son horizon", () => {
  it("`annuler` annule les jalons vivants", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : la ligne retirée. `chargerEtat` rendrait alors
     * `horizonOuvert: true` pour toujours sur une mission arrêtée, et le pilote la reprendrait
     * indéfiniment — le geste d'arrêt le plus important du produit, rendu inopérant par une
     * table qu'il ne connaissait pas.
     */
    const control = lire("src/lib/missions/runtime/control.ts");
    expect(control).toMatch(/prisma\.missionMilestone\.updateMany[\s\S]{0,300}statut: "CANCELLED"/);
  });
});

describe("la fraîcheur se prend au REÇU, jamais au plan", () => {
  it("`daterLEntree` lit `sortie.recu` et refuse ce qui n'est pas une lecture", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : quelqu'un la branche sur `step.input` « parce que c'est
     * plus simple ». On daterait alors des lectures qui n'ont pas eu lieu — une fraîcheur bâtie
     * sur une intention, qui rassure exactement là où elle devrait alerter.
     */
    const engine = lire("src/lib/missions/runtime/engine.ts");
    expect(engine).toContain("const recu = sortie.recu;");
    expect(engine).toContain("EFFETS_LECTURE.has(recu.effect)");
    expect(engine).toMatch(/valeur: recu\.resultHash/);
  });

  /**
   * ── LE TEST QUI MANQUAIT, ET CE QU'IL A COÛTÉ ──────────────────────────────────────────
   *
   * La version précédente vérifiait le CORPS de `daterLEntree` et rien d'autre. Le corps était
   * juste ; l'APPEL avait été perdu dans une édition. Résultat mesuré sur un run live :
   * 53 étapes abouties, 2 332 reçus en base, et ZÉRO entrée datée — la fraîcheur était écrite,
   * testée, et sans aucun effet (§118.14 : une capacité sans appelant réel n'existe pas).
   *
   * Ce test-ci exige l'appelant, et il exige qu'il soit DANS la branche `DONE` de `ecrireSortie` :
   * c'est le seul endroit où le reçu d'une lecture réussie existe.
   */
  it("et elle est APPELÉE — dans la branche DONE de `ecrireSortie`, pas seulement définie", () => {
    const engine = lire("src/lib/missions/runtime/engine.ts");
    // On borne la recherche À LA FONCTION : `if (sortie.status === "DONE")` apparaît aussi dans
    // la définition du type `StepOutcome`, et chercher dans tout le fichier comparerait des
    // positions qui n'ont rien à voir.
    const debut = engine.indexOf("async function ecrireSortie(");
    const corps = engine.slice(debut, engine.indexOf("\n}", debut));
    const iDone = corps.indexOf('if (sortie.status === "DONE")');
    const iFailed = corps.indexOf('if (sortie.status === "FAILED")');
    const iAppel = corps.indexOf("await daterLEntree(etat.id, step, sortie);");
    expect(debut, "`ecrireSortie` a disparu").toBeGreaterThan(0);
    expect(iAppel, "`daterLEntree` n'est appelée nulle part dans `ecrireSortie` : la fraîcheur est du code mort")
      .toBeGreaterThan(0);
    expect(iAppel, "l'appel est hors de la branche DONE").toBeGreaterThan(iDone);
    expect(iAppel, "l'appel est hors de la branche DONE").toBeLessThan(iFailed);
  });
});
