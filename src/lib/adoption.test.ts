import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getAdoptionScores, type AdoptionScore } from "./adoption";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__adopttest__";
const comp = (s: AdoptionScore, key: string) => s.components.find((c) => c.key === key)!.score;

suite("Score d'adoption — robustesse au gaming", () => {
  let churnerId = "", workerId = "", regularId = "", bursterId = "";

  beforeAll(async () => {
    const mk = (s: string) => prisma.user.create({ data: { name: `${TAG}${s}`, email: `${TAG}${s}@t.dz`, role: "VIEWER", passwordHash: "x" } });
    const [a, b, c, d] = await Promise.all([mk("churner"), mk("worker"), mk("regular"), mk("burster")]);
    churnerId = a.id; workerId = b.id; regularId = c.id; bursterId = d.id;

    const now = Date.now();

    // CHURNER : crée puis supprime 50 tâches → seulement des traces d'audit
    // CREATE/DELETE, AUCUNE tâche survivante (le gaming classique).
    await prisma.auditLog.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        actorId: churnerId, action: (i % 2 === 0 ? "CREATE" : "DELETE") as never,
        module: "Espace de travail", entityType: "TASK" as never, createdAt: new Date(now - 3600000),
      })),
    });

    // WORKER : 10 tâches RÉELLEMENT terminées (lignes survivantes, completedAt).
    await prisma.task.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        title: `${TAG} done ${i}`, assignedToId: workerId, createdById: workerId,
        status: "DONE" as never, completedAt: new Date(now - 86400000),
      })),
    });

    // REGULAR : actif sur 15 jours DISTINCTS (1 vue par jour).
    await prisma.activityLog.createMany({
      data: Array.from({ length: 15 }, (_, i) => ({
        userId: regularId, type: "PAGE_VIEW", module: "DASHBOARD", createdAt: new Date(now - i * 86400000),
      })),
    });

    // BURSTER : 100 vues le MÊME jour (tentative de gonfler par le volume).
    await prisma.activityLog.createMany({
      data: Array.from({ length: 100 }, () => ({
        userId: bursterId, type: "PAGE_VIEW", module: "DASHBOARD", createdAt: new Date(now - 3600000),
      })),
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actor: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.activityLog.deleteMany({ where: { user: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.task.deleteMany({ where: { title: { startsWith: TAG } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("créer puis supprimer des tâches ne crédite AUCUN travail durable", async () => {
    const { scores } = await getAdoptionScores();
    const churner = scores.find((s) => s.userId === churnerId)!;
    const worker = scores.find((s) => s.userId === workerId)!;
    // Le churner a 50 actions d'audit mais 0 tâche survivante → durable = 0.
    expect(comp(churner, "durable")).toBe(0);
    // Le worker a 10 tâches réellement terminées → durable > 0.
    expect(comp(worker, "durable")).toBeGreaterThan(0);
    // Accomplir un vrai travail bat le churn.
    expect(worker.score).toBeGreaterThan(churner.score);
  });

  it("la régularité compte les JOURS distincts, pas le volume d'un seul jour", async () => {
    const { scores } = await getAdoptionScores();
    const regular = scores.find((s) => s.userId === regularId)!;
    const burster = scores.find((s) => s.userId === bursterId)!;
    expect(regular.activeDays).toBe(15);
    expect(burster.activeDays).toBe(1); // 100 vues, un seul jour
    expect(comp(regular, "regularity")).toBeGreaterThan(comp(burster, "regularity"));
    expect(regular.score).toBeGreaterThan(burster.score);
  });

  it("tous les scores sont bornés 0–100 et la moyenne est calculée", async () => {
    const { scores, average } = await getAdoptionScores();
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
    expect(average).toBeGreaterThanOrEqual(0);
    expect(average).toBeLessThanOrEqual(100);
  });
});
