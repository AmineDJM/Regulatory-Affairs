import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { runScheduledWorkflows } from "./runner";
import { registerWorkflow, resetWorkflowRegistry } from "./registry";
import { createWorkflow, setWorkflowStatus, updateWorkflow, deleteWorkflow, listWorkflows } from "./manage";
import { ALGIERS_OFFSET_HOURS } from "./contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PLANIFICATEUR, SUR BASE RÉELLE — ce que le calcul pur ne prouve pas.
 *
 * Quatre promesses qui ne tiennent qu'en base :
 *   • UNE SEULE EXÉCUTION — deux instances qui voient la même planification due n'en font qu'un
 *     passage, sinon le rapport du dimanche part en double ;
 *   • L'ÉCHÉANCE AVANCE À LA PRISE — un processus tué ne laisse pas une planification en boucle ;
 *   • L'HISTORIQUE DIT LA VÉRITÉ — « n'a pas tourné » et « a tourné sans rien trouver » sont deux
 *     choses différentes, et c'est justement la question qu'on se pose quand un rapport manque ;
 *   • LA PROPRIÉTÉ EST GARDÉE — on ne touche pas à la planification de quelqu'un d'autre.
 *
 * Tout ce qui est créé porte le préfixe `WFTEST-` et disparaît à la fin.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const TAG = "WFTEST-";
let ownerId = "";
let strangerId = "";

/** Combien de fois chaque traitement d'essai a réellement tourné. */
const calls = { ok: 0, empty: 0, boom: 0 };

async function cleanup() {
  const wfs = await prisma.scheduledWorkflow.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
  const ids = wfs.map((w) => w.id);
  if (ids.length) {
    await prisma.workflowRun.deleteMany({ where: { workflowId: { in: ids } } });
    await prisma.scheduledWorkflow.deleteMany({ where: { id: { in: ids } } });
  }
}

beforeAll(async () => {
  await cleanup();
  const users = await prisma.user.findMany({ take: 2, select: { id: true } });
  ownerId = users[0]?.id ?? "";
  strangerId = users[1]?.id ?? users[0]?.id ?? "";
});

afterAll(cleanup);

beforeEach(() => {
  resetWorkflowRegistry();
  calls.ok = 0; calls.empty = 0; calls.boom = 0;
  registerWorkflow({
    kind: "wftest_ok", label: "Essai", description: "x", mutates: false,
    run: async () => { calls.ok += 1; return { didWork: true, summary: "fait" }; },
  });
  registerWorkflow({
    kind: "wftest_empty", label: "Essai vide", description: "x", mutates: false,
    run: async () => { calls.empty += 1; return { didWork: false, summary: "rien à faire" }; },
  });
  registerWorkflow({
    kind: "wftest_boom", label: "Essai qui tombe", description: "x", mutates: false,
    run: async () => { calls.boom += 1; throw new Error("panne simulée"); },
  });
});

/** Crée une planification DÉJÀ DUE, en court-circuitant le calcul d'échéance. */
async function dueWorkflow(kind: string, name = `${TAG}${kind}`) {
  const wf = await prisma.scheduledWorkflow.create({
    data: {
      name, kind, recurrence: "DAILY", hourLocal: 7,
      nextRunAt: new Date(Date.now() - 60_000), ownerId,
    },
    select: { id: true, nextRunAt: true },
  });
  return wf;
}

describe("§9 — le passage", () => {
  it("exécute une planification due, une seule fois", async () => {
    const wf = await dueWorkflow("wftest_ok");
    const r = await runScheduledWorkflows(new Date(), 5);
    expect(r.ran).toBeGreaterThanOrEqual(1);
    expect(calls.ok).toBe(1);

    // Immédiatement après, elle n'est plus due : le second passage ne la reprend pas.
    const before = calls.ok;
    await runScheduledWorkflows(new Date(), 5);
    expect(calls.ok).toBe(before);
    await prisma.scheduledWorkflow.delete({ where: { id: wf.id } }).catch(() => undefined);
  });

  it("avance l'échéance À LA PRISE, avant même d'exécuter", async () => {
    // Si l'échéance n'était avancée qu'après le traitement, un processus tué en plein travail
    // laisserait la planification perpétuellement due — elle rejouerait en boucle un traitement
    // qui plante.
    const wf = await dueWorkflow("wftest_boom");
    await runScheduledWorkflows(new Date(), 5);
    const after = await prisma.scheduledWorkflow.findUnique({ where: { id: wf.id }, select: { nextRunAt: true, claimedAt: true } });
    expect(after!.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    // Et le verrou est retombé, MÊME après l'échec : sinon un incident d'une seconde bloquerait
    // la planification jusqu'au délai de péremption.
    expect(after!.claimedAt).toBeNull();
    await prisma.scheduledWorkflow.delete({ where: { id: wf.id } }).catch(() => undefined);
  });

  it("distingue « fait », « rien à faire » et « en panne » dans l'historique", async () => {
    const a = await dueWorkflow("wftest_ok", `${TAG}a`);
    const b = await dueWorkflow("wftest_empty", `${TAG}b`);
    const c = await dueWorkflow("wftest_boom", `${TAG}c`);
    await runScheduledWorkflows(new Date(), 5);

    const status = async (id: string) =>
      (await prisma.workflowRun.findFirst({ where: { workflowId: id }, orderBy: { startedAt: "desc" }, select: { status: true, error: true, summary: true } }));

    expect((await status(a.id))!.status).toBe("OK");
    // « Rien à faire » n'est PAS un échec : le confondre ferait passer une base à jour pour une panne.
    expect((await status(b.id))!.status).toBe("SKIPPED");
    const failed = await status(c.id);
    expect(failed!.status).toBe("FAILED");
    expect(failed!.error).toContain("panne simulée");

    for (const w of [a, b, c]) await prisma.scheduledWorkflow.delete({ where: { id: w.id } }).catch(() => undefined);
  });

  it("une clé inconnue est CONSIGNÉE, pas devinée", async () => {
    // Le cas d'une planification créée pour un traitement retiré depuis — ou d'une clé écrite à
    // la main dans la base. Le registre fermé la rend inoffensive ; l'historique la rend visible.
    const wf = await dueWorkflow("wftest_inexistant");
    await runScheduledWorkflows(new Date(), 5);
    const run = await prisma.workflowRun.findFirst({ where: { workflowId: wf.id }, select: { status: true, summary: true } });
    expect(run!.status).toBe("SKIPPED");
    expect(run!.summary).toContain("inconnu");
    await prisma.scheduledWorkflow.delete({ where: { id: wf.id } }).catch(() => undefined);
  });

  it("une planification EN PAUSE ne tourne pas, même si son échéance est passée", async () => {
    const wf = await dueWorkflow("wftest_ok");
    await prisma.scheduledWorkflow.update({ where: { id: wf.id }, data: { status: "PAUSED" } });
    await runScheduledWorkflows(new Date(), 5);
    expect(calls.ok).toBe(0);
    await prisma.scheduledWorkflow.delete({ where: { id: wf.id } }).catch(() => undefined);
  });
});

describe("§9 — la gestion", () => {
  it("crée avec une échéance CALCULÉE, visible tout de suite", async () => {
    if (!ownerId) return;
    const r = await createWorkflow(
      { name: `${TAG}point`, kind: "wftest_ok", recurrence: "WEEKLY", hourLocal: 7, dayOfWeek: 0 },
      ownerId,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // L'utilisateur doit pouvoir vérifier ce qu'il vient de programmer, pas l'apprendre au
    // premier passage.
    expect(r.value.schedule).toBe("Tous les dimanches à 07 h");
    expect(r.value.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    await deleteWorkflow(r.value.id, ownerId);
  });

  it("refuse une clé absente du registre", async () => {
    if (!ownerId) return;
    const r = await createWorkflow({ name: `${TAG}x`, kind: "supprime-tout", recurrence: "DAILY" }, ownerId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("inconnu");
  });

  it("refuse une récurrence hors grammaire", async () => {
    if (!ownerId) return;
    const r = await createWorkflow({ name: `${TAG}y`, kind: "wftest_ok", recurrence: "*/5 * * * *" }, ownerId);
    expect(r.ok).toBe(false);
  });

  it("la reprise recalcule l'échéance — sinon une pause de trois semaines déclencherait aussitôt", async () => {
    if (!ownerId) return;
    const c = await createWorkflow({ name: `${TAG}pause`, kind: "wftest_ok", recurrence: "DAILY", hourLocal: 7 }, ownerId);
    if (!c.ok) return;
    await prisma.scheduledWorkflow.update({ where: { id: c.value.id }, data: { nextRunAt: new Date(Date.now() - 3 * 7 * 24 * 3_600_000) } });
    await setWorkflowStatus(c.value.id, "PAUSED", ownerId);
    const resumed = await setWorkflowStatus(c.value.id, "ACTIVE", ownerId);
    expect(resumed.ok).toBe(true);
    if (resumed.ok) expect(resumed.value.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    await deleteWorkflow(c.value.id, ownerId);
  });

  it("modifier la cadence recalcule l'échéance — sinon l'affichage mentirait", async () => {
    if (!ownerId) return;
    const c = await createWorkflow({ name: `${TAG}mod`, kind: "wftest_ok", recurrence: "DAILY", hourLocal: 7 }, ownerId);
    if (!c.ok) return;
    const u = await updateWorkflow(c.value.id, { recurrence: "MONTHLY", dayOfMonth: 15, hourLocal: 9 }, ownerId);
    expect(u.ok).toBe(true);
    if (u.ok) {
      expect(u.value.schedule).toBe("Le 15 de chaque mois à 09 h");
      // L'échéance doit VRAIMENT tomber un 15 à 9 h locales, et dans le futur. Garder l'ancienne
      // échéance quotidienne pendant que l'écran annonce « le 15 de chaque mois » serait un
      // mensonge d'interface : l'utilisateur attendrait un rapport à la mauvaise date.
      expect(u.value.nextRunAt.getTime()).toBeGreaterThan(Date.now());
      const local = new Date(u.value.nextRunAt.getTime() + ALGIERS_OFFSET_HOURS * 3_600_000);
      expect(local.getUTCDate()).toBe(15);
      expect(local.getUTCHours()).toBe(9);
    }
    await deleteWorkflow(c.value.id, ownerId);
  });

  it("on ne touche pas à la planification de quelqu'un d'autre", async () => {
    if (!ownerId || strangerId === ownerId) return;
    const c = await createWorkflow({ name: `${TAG}garde`, kind: "wftest_ok", recurrence: "DAILY" }, ownerId);
    if (!c.ok) return;

    // Le même message pour « introuvable » et « pas à vous » : distinguer les deux apprendrait à
    // un curieux qu'une planification existe.
    const denied = await setWorkflowStatus(c.value.id, "PAUSED", strangerId);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error).toBe("Planification introuvable.");
    expect((await deleteWorkflow(c.value.id, strangerId)).ok).toBe(false);
    expect((await updateWorkflow(c.value.id, { name: "détourné" }, strangerId)).ok).toBe(false);

    await deleteWorkflow(c.value.id, ownerId);
  });

  it("une planification orpheline se SIGNALE au lieu de se taire", async () => {
    if (!ownerId) return;
    const wf = await dueWorkflow("wftest_ok", `${TAG}orphelin`);
    resetWorkflowRegistry(); // le traitement disparaît du produit
    const list = await listWorkflows(ownerId);
    const found = list.find((w) => w.id === wf.id);
    expect(found?.orphaned).toBe(true);
    // La clé reste lisible : afficher un vide ferait croire à un bogue d'affichage.
    expect(found?.kindLabel).toBe("wftest_ok");
    await prisma.scheduledWorkflow.delete({ where: { id: wf.id } }).catch(() => undefined);
  });

  it("supprimer emporte l'historique — une planification fantôme serait pire", async () => {
    if (!ownerId) return;
    const wf = await dueWorkflow("wftest_ok", `${TAG}suppr`);
    await runScheduledWorkflows(new Date(), 5);
    expect(await prisma.workflowRun.count({ where: { workflowId: wf.id } })).toBeGreaterThan(0);
    await deleteWorkflow(wf.id, ownerId);
    expect(await prisma.workflowRun.count({ where: { workflowId: wf.id } })).toBe(0);
  });
});
