import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { invaliderEtatsChauds, lireEtatChaud, rechaufferEtatChaud } from "@/lib/fabric/hot-state";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE MÉCANISME D'ÉTAT CHAUD (fabric F5) — écriture au travers, TTL, invalidation, DROITS.
 *
 * Le test le plus important est celui du CLOISONNEMENT : `subjectId` n'est pas une clé de
 * cache, c'est une clé de DROITS — l'état calculé pour une personne ne doit jamais sortir
 * pour une autre. Un cache qui mélange ses sujets est une fuite de données, pas une
 * optimisation.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const KIND = `__hot_test_${Date.now().toString(36)}`;

suite("fabric/hot-state — le précalcul par écriture", () => {
  afterAll(async () => {
    await prisma.assistantHotState.deleteMany({ where: { kind: { startsWith: "__hot_test_" } } }).catch(() => {});
  });

  it("première lecture = CALCULE et persiste ; deuxième = PRECALCULE sans rappeler le calcul", async () => {
    let appels = 0;
    const calcul = async () => { appels += 1; return { n: 42 }; };

    const premiere = await lireEtatChaud(KIND, "sujet-a", { ttlMs: 60_000, calcul });
    expect(premiere.voie).toBe("CALCULE");
    expect(premiere.valeur).toEqual({ n: 42 });
    expect(appels).toBe(1);

    const seconde = await lireEtatChaud(KIND, "sujet-a", { ttlMs: 60_000, calcul });
    expect(seconde.voie).toBe("PRECALCULE");
    expect(seconde.valeur).toEqual({ n: 42 });
    // LE POINT : le calcul n'a PAS été payé une deuxième fois.
    expect(appels).toBe(1);
    // La fraîcheur est DITE : l'instant de calcul de la ligne servie, pas « maintenant ».
    expect(seconde.calculeLe.getTime()).toBe(premiere.calculeLe.getTime());
    expect(seconde.coutMesureMs).toBe(premiere.coutMesureMs);
  });

  it("le TTL expiré recalcule — un état trop vieux ne se sert pas", async () => {
    let appels = 0;
    const calcul = async () => { appels += 1; return appels; };
    await lireEtatChaud(`${KIND}-ttl`, "s", { ttlMs: 60_000, calcul });
    // Vieillir la ligne artificiellement — le TTL se juge sur `computedAt`.
    await prisma.assistantHotState.updateMany({
      where: { kind: `${KIND}-ttl`, subjectId: "s" },
      data: { computedAt: new Date(Date.now() - 3_600_000) },
    });
    const l = await lireEtatChaud(`${KIND}-ttl`, "s", { ttlMs: 60_000, calcul });
    expect(l.voie).toBe("CALCULE");
    expect(appels).toBe(2);
  });

  it("un état INVALIDÉ n'est plus servi, même dans le TTL — le fait métier prime", async () => {
    let appels = 0;
    const calcul = async () => { appels += 1; return appels; };
    await lireEtatChaud(`${KIND}-inv`, "s", { ttlMs: 3_600_000, calcul });
    const marquees = await invaliderEtatsChauds(`${KIND}-inv`);
    expect(marquees).toBe(1);
    // Idempotente : une ligne déjà marquée ne se remarque pas.
    expect(await invaliderEtatsChauds(`${KIND}-inv`)).toBe(0);

    const l = await lireEtatChaud(`${KIND}-inv`, "s", { ttlMs: 3_600_000, calcul });
    expect(l.voie).toBe("CALCULE");
    expect(appels).toBe(2);
    // Le recalcul REMET la ligne en service (staleAt effacé).
    const ligne = await prisma.assistantHotState.findUnique({ where: { kind_subjectId: { kind: `${KIND}-inv`, subjectId: "s" } } });
    expect(ligne?.staleAt).toBeNull();
  });

  it("CLOISONNEMENT — l'état d'un sujet ne sort JAMAIS pour un autre sujet", async () => {
    await rechaufferEtatChaud(`${KIND}-iso`, "personne-a", async () => "vue de A");
    const b = await lireEtatChaud(`${KIND}-iso`, "personne-b", { ttlMs: 3_600_000, calcul: async () => "vue de B" });
    // B a payé SON calcul — il n'a pas reçu la ligne de A.
    expect(b.voie).toBe("CALCULE");
    expect(b.valeur).toBe("vue de B");
    const a = await lireEtatChaud(`${KIND}-iso`, "personne-a", { ttlMs: 3_600_000, calcul: async () => "recalcul de A" });
    expect(a.voie).toBe("PRECALCULE");
    expect(a.valeur).toBe("vue de A");
  });

  it("le coût est MESURÉ, pas estimé — un calcul lent laisse sa trace", async () => {
    const l = await rechaufferEtatChaud(`${KIND}-cout`, "s", async () => {
      await new Promise((r) => setTimeout(r, 30));
      return "ok";
    });
    expect(l.coutMesureMs).toBeGreaterThanOrEqual(25);
    const ligne = await prisma.assistantHotState.findUnique({ where: { kind_subjectId: { kind: `${KIND}-cout`, subjectId: "s" } } });
    expect(ligne?.costMs).toBe(l.coutMesureMs);
  });
});
