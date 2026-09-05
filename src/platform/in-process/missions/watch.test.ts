import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getAccess, type EffectiveAccess } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { recordEvent } from "@/lib/events/ledger";
import { arreterSurveillance, balayerSurveillances, creerSurveillance, listerSurveillances } from "@/platform/in-process/missions/watch";
import { WATCH_TOOLS } from "@/lib/assistant/watch-tools";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « SURVEILLE CETTE TÂCHE ET PRÉVIENS-MOI SEULEMENT S'IL Y A UN PROBLÈME » — par l'entrée réelle.
 *
 * L'outil crée la surveillance (cible résolue, règles par défaut, mission-support) ; le balayage
 * la relit : une échéance à 2 jours est un problème → UNE notification ; le même problème le
 * lendemain → aucune ; la tâche terminée par le VRAI registre d'événements réveille la
 * surveillance → une information « terminée », la surveillance se ferme, la mission conclut.
 * Rien ne dépend de la mémoire d'un processus : chaque appel repart de la base.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__watch${Date.now()}`;
let pdg: CurrentUser;
let taskId = "";
const titreTache = `${TAG} Préparer la réponse ANPP`;

const notifs = () => prisma.notification.findMany({ where: { userId: pdg.id, title: { contains: "Surveillance" } }, orderBy: { createdAt: "asc" }, select: { title: true, body: true, type: true } });

suite("SURVEILLANCE DURABLE — un problème dit une fois, une fin dite une fois, rien entre les deux", () => {
  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { name: `${TAG} PDG`, email: `${TAG}pdg@amd.dz`, passwordHash: "x", role: "SUPER_ADMIN" },
      select: { id: true, name: true, email: true, role: true },
    });
    pdg = { id: u.id, name: u.name, email: u.email, role: u.role, access: (await getAccess(u.id, u.role)) as EffectiveAccess, mustChangePassword: false };
    const t = await prisma.task.create({
      data: { title: titreTache, status: "TODO", dueDate: new Date(Date.now() + 2 * 86_400_000), assignedToId: pdg.id, createdById: pdg.id },
      select: { id: true },
    });
    taskId = t.id;
  }, 120_000);

  afterAll(async () => {
    await prisma.adamWatch.deleteMany({ where: { ownerId: pdg.id } }).catch(() => {});
    await prisma.mission.deleteMany({ where: { ownerId: pdg.id } }).catch(() => {});
    await prisma.businessEvent.deleteMany({ where: { entityType: "TASK", entityId: taskId } }).catch(() => {});
    await prisma.task.deleteMany({ where: { id: taskId } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: pdg.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: pdg.id } }).catch(() => {});
  }, 120_000);

  it("l'outil crée la surveillance : cible résolue par son titre, règles du type, mission-support, état initial relu", async () => {
    const outil = WATCH_TOOLS.find((t) => t.def.name === "watch_entity")!;
    const brut = await outil.run({ reference: titreTache, instruction: `Surveille la tâche « ${titreTache} » et préviens-moi seulement s'il y a un problème.` }, pdg);
    const r = JSON.parse(brut) as { ok: boolean; surveillance: string; mission: string; type: string; regles: string; etatActuel: string };
    expect(r.ok, brut).toBe(true);
    expect(r.type).toBe("TASK");
    expect(r.regles).toMatch(/échéance à moins de 3 jours/);
    expect(r.etatActuel).toMatch(/TODO/);
    const mission = await prisma.mission.findUnique({ where: { id: r.mission }, select: { kind: true, status: true, title: true } });
    expect(mission?.kind).toBe("WATCH");
    expect(mission?.status).toBe("WAITING_EVENT");
    expect(mission?.title).toMatch(/^Surveillance — /);
    // La création n'a PAS notifié : rien ne se passe tant que tout va bien.
    expect(await notifs()).toHaveLength(0);
    // Une seconde création sur la même cible COMPLÈTE la première au lieu de la doubler.
    const bis = JSON.parse(await outil.run({ reference: titreTache }, pdg)) as { surveillance: string };
    expect(bis.surveillance).toBe(r.surveillance);
    expect(await prisma.adamWatch.count({ where: { ownerId: pdg.id, status: "ACTIVE" } })).toBe(1);
  }, 120_000);

  it("le balayage signale l'échéance proche UNE fois ; le lendemain, le même problème se tait", async () => {
    // La surveillance vient d'être créée : son prochain contrôle est dans 24 h. Le fait qui l'a
    // mise à jour (la seconde création) l'a ramené à maintenant — on balaie.
    const r1 = await balayerSurveillances(new Date());
    expect(r1.examinees).toBeGreaterThanOrEqual(1);
    expect(r1.signalees).toBe(1);
    const n1 = await notifs();
    expect(n1).toHaveLength(1);
    expect(n1[0].title).toMatch(/^Surveillance — /);
    expect(n1[0].body).toMatch(/échéance dans 2 jour/);
    expect(n1[0].body).toMatch(/Recommandation/);

    // Le lendemain : le problème est le MÊME (signature stable) → rien.
    const demain = new Date(Date.now() + 25 * 3_600_000);
    const r2 = await balayerSurveillances(demain);
    expect(r2.examinees).toBeGreaterThanOrEqual(1);
    expect(r2.signalees).toBe(0);
    expect(await notifs()).toHaveLength(1);

    const w = await prisma.adamWatch.findFirst({ where: { ownerId: pdg.id }, select: { lastSignature: true, nextCheckAt: true } });
    expect(w?.lastSignature).toBeTruthy();
    expect(w!.nextCheckAt.getTime()).toBeGreaterThan(demain.getTime());
  }, 120_000);

  it("la tâche terminée par le VRAI registre réveille la surveillance : une information « terminée », et la surveillance se ferme", async () => {
    await prisma.task.update({ where: { id: taskId }, data: { status: "DONE", completedAt: new Date() } });
    // LE FAIT — c'est lui qui réveille (« changement ERP → réveil »), pas un appel direct.
    await recordEvent({ type: "TASK_COMPLETED", sourceDomain: "tasks", entityType: "TASK", entityId: taskId, actorId: pdg.id } as never);
    const w = await prisma.adamWatch.findFirst({ where: { ownerId: pdg.id }, select: { id: true, nextCheckAt: true, missionId: true } });
    expect(w!.nextCheckAt.getTime()).toBeLessThanOrEqual(Date.now());

    const r = await balayerSurveillances(new Date());
    expect(r.terminees).toBe(1);
    const n = await notifs();
    expect(n).toHaveLength(2);
    expect(n[1].title).toMatch(/^Surveillance terminée — /);
    expect(n[1].body).toMatch(/DONE/);
    const apres = await prisma.adamWatch.findUnique({ where: { id: w!.id }, select: { status: true, closeReason: true } });
    expect(apres?.status).toBe("CLOSED");
    expect(apres?.closeReason).toMatch(/terminée/);
    expect((await prisma.mission.findUnique({ where: { id: w!.missionId }, select: { status: true } }))?.status).toBe("COMPLETED");
    // Le journal de la mission-support dit toute l'histoire.
    const kinds = (await prisma.missionEvent.findMany({ where: { missionId: w!.missionId }, select: { kind: true } })).map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(["WATCH_CREATED", "WATCH_CHECKED", "NOTIFIED", "WATCH_ENDED"]));
    expect(await listerSurveillances(pdg)).toHaveLength(0);
  }, 120_000);

  it("arrêter : la sienne seulement, et la mission-support est annulée", async () => {
    const r = await creerSurveillance(pdg, { reference: titreTache });
    // La tâche est DONE : elle n'est plus « ouverte », donc introuvable par titre — le refus est dit.
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/rien à surveiller/);
    const autre = await prisma.user.create({ data: { name: `${TAG} autre`, email: `${TAG}autre@amd.dz`, passwordHash: "x", role: "SUPER_ADMIN" }, select: { id: true } });
    const t2 = await prisma.task.create({ data: { title: `${TAG} Relire le contrat`, status: "TODO", assignedToId: pdg.id, createdById: pdg.id }, select: { id: true } });
    const c = await creerSurveillance(pdg, { reference: `${TAG} Relire le contrat` });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const intrus: CurrentUser = { ...pdg, id: autre.id };
    expect((await arreterSurveillance(intrus, c.id)).ok).toBe(false);
    expect((await arreterSurveillance(pdg, c.id)).ok).toBe(true);
    expect((await prisma.mission.findUnique({ where: { id: c.missionId }, select: { status: true } }))?.status).toBe("CANCELLED");
    await prisma.task.deleteMany({ where: { id: t2.id } });
    await prisma.user.deleteMany({ where: { id: autre.id } });
  }, 120_000);
});
