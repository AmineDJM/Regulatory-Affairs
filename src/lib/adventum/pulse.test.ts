import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { runIntelligencePulse, getPulse } from "./pulse";

// Intégration (nécessite Postgres). Vérifie l'analyse EN CONTINU : un instantané horaire est
// persisté, l'opération est idempotente (un seul par heure, verrou de bucket), et getPulse expose
// des compteurs de tendance exploitables.
let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const BUCKET = new Date().toISOString().slice(0, 13);

suite("Adventum Pulse — instantané continu (Brain + Process Intelligence)", () => {
  beforeAll(async () => {
    await prisma.intelligenceSnapshot.deleteMany({ where: { bucket: BUCKET } }).catch(() => {});
  });
  afterAll(async () => {
    await prisma.intelligenceSnapshot.deleteMany({ where: { bucket: BUCKET } }).catch(() => {});
  });

  it("persiste un instantané horaire et reste idempotent (1×/h)", async () => {
    await runIntelligencePulse();
    const after1 = await prisma.intelligenceSnapshot.count({ where: { bucket: BUCKET } });
    expect(after1).toBe(1);

    // Deuxième passe la même heure : ne crée pas de doublon (verrou de bucket).
    await runIntelligencePulse();
    const after2 = await prisma.intelligenceSnapshot.count({ where: { bucket: BUCKET } });
    expect(after2).toBe(1);

    const snap = await prisma.intelligenceSnapshot.findUnique({ where: { bucket: BUCKET } });
    expect(snap).toBeTruthy();
    expect(snap!.riskTotal).toBeGreaterThanOrEqual(0);
    expect(snap!.detail).toBeTruthy(); // { byCategory, criticalIds, topRisks }
  });

  it("getPulse expose des compteurs de tendance", async () => {
    await runIntelligencePulse();
    const p = await getPulse();
    expect(p.hasData).toBe(true);
    expect(p.points).toBeGreaterThanOrEqual(1);
    expect(typeof p.current.riskTotal).toBe("number");
    expect(typeof p.current.stuck).toBe("number");
    expect(Array.isArray(p.spark.riskTotal)).toBe(true);
  });
});
