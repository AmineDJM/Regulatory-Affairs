import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getAccess } from "@/lib/rbac";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__blocktest__";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN BLOCAGE EXPLICITE PRIME SUR TOUT ACCÈS IMPLICITE.
 *
 * ── LE DÉFAUT QU'ON CORRIGE ──────────────────────────────────────────────────────────────────
 *
 * `getAccess` pose des accès IMPLICITES : tenir les RH ouvre les Moyens généraux, diriger un
 * département ouvre le Recrutement, avoir une validation en attente ouvre le module visé, se voir
 * partager une enveloppe ouvre les Budgets… Aucun ne consultait `blockedModules`.
 *
 * Conséquence, rapportée telle quelle : un administrateur RETIRE les Moyens généraux à quelqu'un
 * dans la console, et le module revient au rafraîchissement suivant. Sans message, sans trace —
 * la règle implicite le rendait, en silence, à chaque requête. On finit par croire que la console
 * ne marche pas, et l'on cesse de s'en servir.
 *
 * Le commentaire de `blockedModules` promettait pourtant l'inverse depuis toujours : « un blocage
 * qui se lèverait tout seul serait pire qu'inutile : il serait imprévisible. »
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
suite("un module BLOQUÉ ne revient pas par une règle implicite", () => {
  let userId = "";

  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { name: `${TAG}rh`, email: `${TAG}rh@t.dz`, role: "VIEWER", passwordHash: "x" },
    });
    userId = u.id;
    // On lui donne les RH en MODIFICATION : c'est cette règle-là qui ouvre implicitement les
    // Moyens généraux (« qui tient les RH pilote les moyens généraux »).
    await prisma.userAccess.create({
      data: { userId, module: "RH", canView: true, canUpdate: true, scope: "ALL" },
    });
  });

  afterAll(async () => {
    await prisma.userAccess.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("sans blocage, la règle implicite ouvre bien les Moyens généraux", async () => {
    const access = await getAccess(userId, "VIEWER");
    expect(access.modules.has("GENERAL_MEANS")).toBe(true);
  });

  it("AVEC un blocage posé dans la console, le module NE revient PAS", async () => {
    await prisma.userAccess.create({
      data: { userId, module: "GENERAL_MEANS", canView: false },
    });
    const access = await getAccess(userId, "VIEWER");
    expect(access.modules.has("GENERAL_MEANS")).toBe(false);
    // …et le reste de ses droits n'a pas bougé : bloquer un module n'en ferme pas un autre.
    expect(access.modules.has("RH")).toBe(true);
  });
});

/**
 * LE GARDE EST-IL LE SEUL CHEMIN ?
 *
 * Le test ci-dessus prouve que la règle des Moyens généraux respecte les blocages. Il ne prouve
 * rien des SIX AUTRES accès implicites — ni de celui qu'on ajoutera le mois prochain, qui est
 * précisément celui qui rouvrira le trou.
 *
 * On vérifie donc la propriété STRUCTURELLE : après la déclaration de `grantImplicit`, plus aucun
 * `modules.set(` n'existe hors de la fonction elle-même. Ajouter un accès implicite par un chemin
 * parallèle fait échouer ce test, avec la ligne fautive sous les yeux.
 */
describe("aucun accès implicite ne contourne le garde", () => {
  it("plus aucun `modules.set` hors de `grantImplicit`", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/rbac.ts"), "utf8");
    const debut = src.indexOf("const grantImplicit =");
    expect(debut, "`grantImplicit` a disparu de rbac.ts").toBeGreaterThan(0);

    const fautives = src
      .slice(debut)
      .split("\n")
      .map((l, i) => ({ n: i, texte: l }))
      .filter((l) => l.texte.includes("modules.set(") && !l.texte.includes("modules.set(module,"));

    expect(
      fautives.map((l) => l.texte.trim()),
      "Un accès implicite est posé hors du garde : il ignorera un blocage explicite de l'administrateur. Passez par `grantImplicit`.",
    ).toEqual([]);
  });
});
