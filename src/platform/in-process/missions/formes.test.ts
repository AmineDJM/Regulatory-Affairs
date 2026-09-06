import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  etatFormes, formeConnue, oublierFormes, prechargerFormes, recolterFormes,
} from "@/platform/in-process/missions/formes";
import { OBSERVATIONS_MAX } from "@/lib/missions/registry/formes";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PONT DES FORMES, SUR DES SORTIES RÉELLES.
 *
 * `formes.test.ts` côté registre vérifie l'ALGORITHME sur des données fabriquées. Ici on part de
 * la vraie table — les `MissionStep.result` que des missions ont réellement produits — parce que
 * deux propriétés ne se démontrent que là :
 *
 *   1. LA REQUÊTE FAIT CE QU'ELLE DIT : elle partitionne par capacité, donc une capacité très
 *      appelée ne peut pas consommer le plafond et affamer les autres. Le défaut inverse serait
 *      silencieux — on apprendrait quelque chose, donc rien n'aurait l'air cassé.
 *   2. AUCUNE VALEUR MÉTIER NE SORT. Les données fabriquées sont piégées par celui qui écrit le
 *      test, donc elles ne piègent que ce qu'il a imaginé. Les vraies sorties portent des noms de
 *      salariés, des montants, des références, des adresses — et ces formes partent dans le
 *      prompt du planificateur.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const siBase = dbOk ? describe : describe.skip;

siBase("le pont lit les vraies sorties", () => {
  let formes: Map<string, ReturnType<typeof formeConnue>>;
  let brutes: { capability: string; result: unknown }[] = [];

  beforeAll(async () => {
    formes = await recolterFormes();
    brutes = await prisma.$queryRaw<{ capability: string; result: unknown }[]>`
      SELECT s."capability" AS capability, s."result" AS result
      FROM "MissionStep" s
      WHERE s."capability" IS NOT NULL AND s."status" = 'DONE' AND s."result" IS NOT NULL
      LIMIT 4000
    `;
  });

  it("une forme apprise porte toujours au moins une observation", () => {
    // Une capacité rangée au cache avec zéro observation se lirait comme « elle ne rend rien » —
    // exactement l'affirmation qu'on interdit de fabriquer à partir d'un défaut de mesure.
    for (const [cap, f] of formes) {
      expect(f.observations, `« ${cap} » rangée sans observation`).toBeGreaterThan(0);
      expect(f.observations).toBeLessThanOrEqual(OBSERVATIONS_MAX);
    }
  });

  it("LE TEST QUI COMPTE : aucune VALEUR des sorties réelles n'apparaît dans les formes", () => {
    if (brutes.length === 0) return; // Rien à prouver sur une base vide, et rien à cacher non plus.

    // Tous les noms de champs vus quelque part : une valeur qui coïncide avec un nom de champ
    // n'est pas une fuite, c'est le nom. On les écarte pour ne pas accuser à tort.
    const noms = new Set<string>();
    const valeurs = new Set<string>();
    const parcourir = (v: unknown, depth: number): void => {
      if (depth > 8 || v === null || v === undefined) return;
      if (Array.isArray(v)) { for (const x of v.slice(0, 50)) parcourir(x, depth + 1); return; }
      if (typeof v === "object") {
        for (const [k, x] of Object.entries(v as Record<string, unknown>)) { noms.add(k); parcourir(x, depth + 1); }
        return;
      }
      const t = String(v);
      // Six caractères : sous ce seuil une coïncidence avec un fragment de nom de champ est
      // banale et l'accusation serait fausse. Les vraies fuites (noms, références, montants,
      // adresses) sont toutes plus longues.
      if (t.length >= 6) valeurs.add(t);
    };
    for (const b of brutes) parcourir(b.result, 0);

    /**
     * On compare des CHAÎNES ENTIÈRES, jamais des sous-chaînes, et on ne regarde que les FORMES
     * (pas les clés de la carte, qui sont des noms d'outils). Les deux précisions ont été
     * apprises en une exécution : « search_drive » est un nom d'outil, donc pas un secret, et
     * « ouvert » est un fragment du nom de champ « dossiersOuverts », donc pas une valeur. Un
     * test de sécurité qui accuse à tort finit désactivé, et c'est ainsi qu'on perd la garde.
     */
    const motsDeLaForme = new Set<string>();
    const ramasser = (v: unknown): void => {
      if (typeof v === "string") { motsDeLaForme.add(v); return; }
      if (Array.isArray(v)) { for (const x of v) ramasser(x); return; }
      if (v && typeof v === "object") for (const x of Object.values(v)) ramasser(x);
    };
    for (const f of formes.values()) ramasser(f);

    const fuites = [...valeurs].filter((v) => motsDeLaForme.has(v) && !noms.has(v));
    expect(fuites.slice(0, 5), "des valeurs métier ont fui dans les formes").toEqual([]);
  });

  it("la fenêtre est PAR CAPACITÉ : une capacité très appelée n'affame pas les autres", () => {
    if (brutes.length === 0) return;
    const compte = new Map<string, number>();
    for (const b of brutes) compte.set(b.capability, (compte.get(b.capability) ?? 0) + 1);
    const dominante = [...compte.entries()].sort((a, b) => b[1] - a[1])[0];
    // Toute capacité présente dans la table doit avoir une forme, y compris les rares — c'est
    // précisément ce qu'un « les N plus récentes » global aurait perdu.
    const sansForme = [...compte.keys()].filter((c) => !formes.has(c));
    expect(sansForme, `capacités présentes en base mais sans forme apprise (dominante : ${dominante?.[0]} × ${dominante?.[1]})`).toEqual([]);
  });

  it("le cache froid s'annonce comme froid, jamais comme une sortie vide", () => {
    oublierFormes();
    expect(etatFormes()).toEqual({ charge: false, capacites: 0 });
    expect(formeConnue("directory_list").observations).toBe(0);
  });

  it("le préchargement remplit, et `formeConnue` lit sans attendre", async () => {
    oublierFormes();
    const n = await prechargerFormes();
    expect(etatFormes()).toEqual({ charge: true, capacites: n });
    consignerMesure("capacite_forme_connue", { valeur: n },
      "platform/in-process/missions/formes.test.ts",
      `capacités dont la forme de sortie est APPRISE des exécutions réelles (la table écrite à la main en couvrait six)`);
    for (const cap of formes.keys()) {
      expect(formeConnue(cap).observations, `« ${cap} » perdue au préchargement`).toBeGreaterThan(0);
    }
  });
});
