import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA « VUE EXACTE » EST UNE VUE, PAS UNE USURPATION (§118.184 — audit 360°, S8).
 *
 * Le bandeau promettait « vos actions seront enregistrées au nom de l'administrateur » ; chaque action
 * partait pourtant au nom de la personne visualisée — au journal et dans les notifications. Ce banc
 * joue la VRAIE fonction de session (`build`, par `requireUser` et `getCurrentUser`) avec une vraie
 * session de Super Admin et le cookie de la vue : une lecture voit comme la personne, une écriture
 * part au nom de l'administrateur. Et il exige que chaque route d'API qui écrit le DÉCLARE.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let SESSION: unknown = null;
let EN_TETES = new Headers();
let COOKIE: string | undefined;
vi.mock("@/auth", () => ({ auth: async () => SESSION }));
vi.mock("next/headers", () => ({
  cookies: () => ({ get: (n: string) => (n === "amd_impersonate" && COOKIE ? { value: COOKIE } : undefined) }),
  headers: () => EN_TETES,
}));

import { prisma } from "@/lib/prisma";
import { requireUser, getCurrentUser, getCurrentUserPourEcrire } from "@/lib/session";

const TAG = "__vuex__";
let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

suite("Vue exacte — qui agit", () => {
  let admin = "", cible = "";
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
    admin = (await prisma.user.create({ data: { name: `${TAG}Admin`, email: `${TAG}admin@t.dz`, role: "SUPER_ADMIN", passwordHash: "x" } })).id;
    cible = (await prisma.user.create({ data: { name: `${TAG}Cible`, email: `${TAG}cible@t.dz`, role: "MEDICAL_DELEGATE", passwordHash: "x" } })).id;
    SESSION = { user: { id: admin, role: "SUPER_ADMIN", name: `${TAG}Admin`, email: `${TAG}admin@t.dz` } };
    COOKIE = cible;
  });
  afterAll(async () => { await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }); });

  it("une LECTURE (page, téléchargement) voit l'OS comme la personne visualisée", async () => {
    EN_TETES = new Headers();
    const u = await getCurrentUser();
    expect(u?.id).toBe(cible);
    expect(u?.impersonatedBy?.id).toBe(admin);
  });

  it("une ACTION SERVEUR part au nom du Super Admin — ce que le bandeau promet", async () => {
    EN_TETES = new Headers({ "next-action": "abc123" });
    const u = await requireUser();
    expect(u.id).toBe(admin);
    expect(u.impersonatedBy).toBeUndefined();
  });

  it("une route d'API qui ÉCRIT part aussi au nom du Super Admin", async () => {
    EN_TETES = new Headers();
    expect((await getCurrentUserPourEcrire())?.id).toBe(admin);
  });

  it("le cookie forgé par quelqu'un qui n'est pas Super Admin ne change rien", async () => {
    SESSION = { user: { id: cible, role: "MEDICAL_DELEGATE", name: "x", email: "x" } };
    COOKIE = admin;
    EN_TETES = new Headers();
    expect((await getCurrentUser())?.id).toBe(cible);
    SESSION = { user: { id: admin, role: "SUPER_ADMIN", name: `${TAG}Admin`, email: `${TAG}admin@t.dz` } };
    COOKIE = cible;
  });
});

/** Les fichiers de route sous un dossier, récursivement. */
function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? routes(p) : n === "route.ts" ? [p] : [];
  });
}

describe("Vue exacte — chaque route d'API qui écrit le déclare", () => {
  // Adam (assistant, voix) : visible du seul Super Admin PRINCIPAL. En vue exacte, la session rend une
  // autre personne, qu'Adam refuse déjà — elles n'écrivent donc jamais au nom de la personne visualisée.
  const ADAM = /src\/app\/api\/assistant\//;
  const fichiers = routes("src/app/api").filter((f) => /export (async )?function (POST|PUT|PATCH|DELETE)/.test(readFileSync(f, "utf8")));

  it("PRÉMISSE : le parcours trouve les routes qui écrivent", () => {
    expect(fichiers.length).toBeGreaterThan(20);
  });

  it("aucune route qui écrit ne lit l'identité par `getCurrentUser` dans un gestionnaire d'écriture", () => {
    const fautives: string[] = [];
    for (const f of fichiers) {
      if (ADAM.test(f)) continue;
      const src = readFileSync(f, "utf8");
      const aussiGet = /export (async )?function GET/.test(src);
      // Une route qui n'a QUE des gestionnaires d'écriture ne doit jamais appeler `getCurrentUser()` ;
      // une route mixte doit choisir l'identité selon la méthode.
      if (!aussiGet && /\bgetCurrentUser\(\)/.test(src)) fautives.push(f);
      if (aussiGet && /\bgetCurrentUser\(\)/.test(src) && !/req\.method === "GET" \? await getCurrentUser\(\) : await getCurrentUserPourEcrire\(\)/.test(src)) fautives.push(f);
      if (/\brequireUser\(\)/.test(src)) fautives.push(f);
    }
    expect(fautives).toEqual([]);
  });
});
