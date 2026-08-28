import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { SOURCES, fraicheurDe } from "@/lib/fabric/registry";
import { assistantToolsFor } from "@/lib/assistant";
import { POWER_TOOLS } from "@/lib/assistant/power-tools";
import { TOOL_DOMAINS, TOOL_DOMAINS_RESTE } from "@/lib/assistant/context/tool-shortlist";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess, Module, Action } from "@/lib/rbac";
import { MODULES } from "@/lib/rbac";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE REGISTRE DES SOURCES EST-IL VRAI ? — une carte fausse est pire que pas de carte.
 *
 * La panne que ce fichier interdit est EXACTEMENT celle que `catalog.test.ts` a documentée pour
 * les missions : `capability-meta.ts` déclarait quatre capacités PLAUSIBLES qui n'existaient
 * nulle part, et quatre tests passaient au vert sur des noms imaginaires. Un registre de
 * sources qui citerait des capacités fantômes enverrait Adam consulter une carte qui montre
 * des routes inexistantes — avec l'assurance en plus.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

/** Un porteur au périmètre MAXIMAL : si une capacité n'existe pas pour lui, elle n'existe pas. */
const actions: Action[] = ["VIEW", "CREATE", "UPDATE", "DELETE", "VALIDATE", "EXPORT", "UPLOAD"];
const superAdmin: CurrentUser = {
  id: "src-registry-test", name: "Test", email: "t@t.dz", role: "SUPER_ADMIN",
  access: {
    modules: new Map((MODULES as readonly Module[]).map((m) => [m, { module: m, actions: new Set(actions), scope: "ALL" as const }])),
    rowGrants: new Map(),
  } as unknown as EffectiveAccess,
  mustChangePassword: false,
};

describe("fabric/registry — la carte des sources dit vrai", () => {
  it("chaque capacité déclarée EXISTE dans le vrai registre d'outils — aucun fantôme", () => {
    const reels = new Set(assistantToolsFor(superAdmin).map((d) => d.name));
    const fantomes = SOURCES.flatMap((s) => s.capacites.filter((c) => !reels.has(c)).map((c) => `${s.famille}:${c}`));
    expect(fantomes, "des capacités déclarées au registre n'existent nulle part").toEqual([]);
  });

  it("chaque table déclarée EXISTE dans le schéma Prisma — la provenance ne pointe pas dans le vide", async () => {
    const tables = [...new Set(SOURCES.flatMap((s) => s.tables))];
    const rows = await prisma.$queryRawUnsafe<{ relname: string }[]>(
      `SELECT relname FROM pg_class WHERE relname = ANY($1) AND relkind = 'r'`, tables,
    );
    const existantes = new Set(rows.map((r) => r.relname));
    expect(tables.filter((t) => !existantes.has(t)), "tables déclarées absentes du schéma").toEqual([]);
  });

  it("`source_map` est un outil réel, enregistré et classé dans la liste courte", () => {
    expect(POWER_TOOLS.some((t) => t.def.name === "source_map"), "outil non enregistré").toBe(true);
    const domaines = { ...TOOL_DOMAINS, ...TOOL_DOMAINS_RESTE };
    expect(domaines.source_map, "outil non classé — la liste courte ne le montrerait jamais").toBeTruthy();
  });

  it("l'index de contenu du Drive est déclaré NON exhaustif — « pas dans l'index » ≠ « pas dans le Drive »", () => {
    const index = SOURCES.find((s) => s.famille === "DRIVE_CONTENU_INDEXE");
    expect(index?.preuveNegative, "déclarer l'index exhaustif ferait signer de fausses absences au juge").toBe(false);
    // Et le Drive lui-même, table SQL bornable, reste démontrable.
    expect(SOURCES.find((s) => s.famille === "DRIVE")?.preuveNegative).toBe(true);
  });
});

suite("fabric/registry — les sondes de fraîcheur", () => {
  it("une source dérivée MESURE sa synchronisation ; une source vivante ne prétend pas mesurer", async () => {
    const drive = await fraicheurDe("DRIVE");
    expect(drive.nature).toBe("TEMPS_REEL");

    const index = await fraicheurDe("DRIVE_CONTENU_INDEXE");
    expect(index.nature).toBe("INDEXEE");
    // `synchroniseeJusqua` est une Date ou null (rien d'indexé) — jamais une invention.
    if (index.synchroniseeJusqua !== null) {
      expect(index.synchroniseeJusqua.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
    }
  });

  it("le nombre d'éléments est une ESTIMATION, honnêtement null quand Postgres ne sait pas", async () => {
    const f = await fraicheurDe("ANNUAIRE");
    // reltuples peut valoir -1 (jamais analysé) → null, jamais 0 : « pas estimé » ≠ « vide ».
    expect(f.elementsEstimes === null || f.elementsEstimes >= 0).toBe(true);
  });
});
