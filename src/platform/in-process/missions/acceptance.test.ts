import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  executerAcceptance, rendreTexteAcceptance, verdictRun4,
  type ResultatAcceptance,
} from "@/platform/in-process/missions/acceptance";
import type { ResultatDeep } from "@/platform/in-process/missions/deep-smoke";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA COUCHE D'ACCEPTANCE, JOUÉE EN LOCAL — la répétition générale du Run 4.
 *
 * Ce test exécute la VRAIE couche d'acceptance (celle que `npm run adam:smoke:deep` joue après
 * les missions historiques) : mêmes scénarios, mêmes chemins de production, seul le réseau du
 * modèle est scripté. Ce qu'il garantit avant le run payant :
 *
 *   • AUCUN scénario déterministe ne FAIL — un FAIL ici serait un FAIL au Run 4 ;
 *   • les scénarios qui exigent le fournisseur réel sont DITS `NOT_PROVEN_LIVE` quand la clé
 *     est absente — jamais simulés, jamais passés en douce (§14 : on ne triche pas sur le
 *     statut) ;
 *   • le banc nettoie tout ce qu'il crée — deux exécutions successives ne se marchent pas
 *     dessus.
 *
 * Ce qu'il ne prouve PAS, et il faut le dire : le comportement du modèle réel (recherche web,
 * cache de prompt, en-têtes de débit). Cette réponse-là n'existe qu'au Run 4, sur Render.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

/** Tous les scénarios attendus — un code qui disparaît silencieusement est une capacité qu'on
 *  a cessé de prouver, et ce test doit le dire. */
const CODES_ATTENDUS = [
  "BG-1", "BG-2", "BG-3", "BG-4",
  "TIME-1", "EVT-1", "EVT-2",
  "REM-1", "REM-2", "MAIL-1",
  "CRASH-1", "MASS-1", "PAT-1",
  "SPEC-1", "SPEC-2", "CHEAT-1", "COST-1",
  "WEB-1", "WEB-2", "WEB-3", "CONC-1", "TOK-1", "CACHE-1",
] as const;

suite("ACCEPTANCE RUN 4 — la couche entière, en local, sur les chemins de production", () => {
  let resultat: ResultatAcceptance;

  it("s'exécute de bout en bout : zéro FAIL, le live honnêtement NOT_PROVEN_LIVE sans clé", async () => {
    resultat = await executerAcceptance({
      // Le banc local ne force jamais le live : la décision revient à l'environnement — sur
      // Render la clé existe et les scénarios live se jouent VRAIMENT.
      onScenario: (l) => process.stdout.write(`${l}\n`),
    });

    // 1 — Le CONTRAT DE COUVERTURE : chaque capacité annoncée a son scénario, joué.
    const codes = resultat.scenarios.map((s) => s.code);
    for (const attendu of CODES_ATTENDUS) expect(codes, `scénario ${attendu} disparu`).toContain(attendu);
    expect(resultat.scenarios.length).toBe(CODES_ATTENDUS.length);

    // 2 — AUCUN ÉCHEC déterministe. Un FAIL local serait un FAIL au Run 4 : le nommer ici.
    const echecs = resultat.scenarios.filter((s) => s.statut === "FAIL");
    expect(echecs.map((s) => `${s.code}: ${s.preuve}`), "des scénarios d'acceptance ÉCHOUENT").toEqual([]);

    // 3 — L'HONNÊTETÉ SUR LE LIVE : sans clé, chaque scénario live est NOT_PROVEN_LIVE et le
    //     DIT ; avec clé (Render), ils doivent avoir été réellement joués (PASS/FAIL/ECARTE).
    const lives = resultat.scenarios.filter((s) => s.live);
    if (!resultat.liveDisponible) {
      for (const s of lives) {
        expect(s.statut, `${s.code} prétend un statut live sans fournisseur`).toBe("NOT_PROVEN_LIVE");
        expect(s.preuve).toContain("OPENAI_API_KEY");
      }
    } else {
      for (const s of lives) expect(s.statut).not.toBe("NOT_PROVEN_LIVE" satisfies string);
    }

    // 4 — Les comptes du rendu sont ceux des scénarios, pas une seconde comptabilité.
    expect(resultat.compte.pass + resultat.compte.fail + resultat.compte.nonProuveLive + resultat.compte.ecartes)
      .toBe(resultat.scenarios.length);
  }, 600_000);

  it("le NETTOYAGE ne laisse rien : missions, salariés, rappels, connexions, événements du jeton", async () => {
    expect(resultat, "le run précédent doit avoir tourné").toBeDefined();
    const jeton = resultat.jeton;
    expect(await prisma.mission.count({ where: { title: { contains: jeton } } })).toBe(0);
    expect(await prisma.user.count({ where: { email: { startsWith: jeton } } })).toBe(0);
    expect(await prisma.employee.count({ where: { department: `DEP-${jeton}` } })).toBe(0);
    expect(await prisma.businessEvent.count({ where: { payload: { path: ["marqueur"], equals: jeton } } })).toBe(0);
  }, 60_000);

  it("le rendu et le verdict §29 impriment les lignes qui décident — depuis les mesures, jamais à la main", () => {
    expect(resultat).toBeDefined();
    const texte = rendreTexteAcceptance(resultat);
    expect(texte).toContain("ACCEPTANCE RUN 4");
    expect(texte).toContain("PASS");

    // Un deep VIDE suffit : le verdict doit rester imprimable (dénominateurs nuls → « — »,
    // jamais un zéro inventé) et porter TOUTES ses lignes.
    const deepVide: ResultatDeep = {
      horodatage: new Date().toISOString(), jeton: "t", modele: null, cible: 0, concurrence: 0,
      missions: [], ecartes: [], jetonsEntree: 0, jetonsSortie: 0, appelsModele: 0,
      latenceTotaleMs: 0, nettoyage: { supprimees: 0, gardees: false },
      paliers: null, arretEscalade: null, concurrenceRetenue: null,
    };
    const verdict = verdictRun4(deepVide, resultat);
    for (const ligne of [
      "RUN 4 — VERDICT AUTOMATIQUE", "HISTORICAL", "NEW AUTONOMY", "BACKGROUND", "WAIT_FOR_TIME",
      "WAIT_FOR_EVENT", "EMAIL_PIPELINE", "REMINDERS", "CRASH_RESTART", "MASSIVE_PROGRESS",
      "WEB_RESEARCH", "DEEP_RESEARCH", "ADAPTIVE_CONCURRENCY", "TOKEN_RESERVATION", "PROMPT_CACHE",
      "PLAN_PATTERNS", "SPECULATIVE", "NO_DUPLICATE_EFFECT", "FALSE_SUCCESS", "FALSE_BLOCK",
      "DEFECTS", "REPLANS", "MODEL_CALLS", "TOTAL_TOKENS", "CACHED_TOKENS", "WEB_SEARCH_CALLS",
      "TOTAL_COST", "WASTED_MODEL_CALLS",
    ]) {
      expect(verdict, `ligne « ${ligne} » absente du verdict`).toContain(ligne);
    }
  });
});
