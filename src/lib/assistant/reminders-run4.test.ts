import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { runAssistantReminders, snoozeReminder } from "./reminders";
import { recordEvent } from "@/lib/events/ledger";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * RAPPELS RUN 4 — l'échelle de relances, l'extinction sur événement (§10), le report.
 *
 * Le scénario payé d'avance : « rappelle-moi demain 9h si Sarah n'a pas envoyé le contrat ;
 * si je ne réponds pas, relance-moi 48h plus tard ». Trois pièces, trois pannes possibles :
 *   • l'ÉCHELLE se consomme barreau par barreau et s'arrête SEULE — jamais du harcèlement ;
 *   • le contrat qui arrive À 8H éteint le rappel de 9h — relances comprises, et une réponse
 *     SANS la pièce attendue n'éteint rien (§26) ;
 *   • le REPORT décale l'échéance sans rien perdre d'autre.
 *
 * L'horloge est INJECTÉE (`runAssistantReminders(now)`) : les jours du scénario durent des
 * millisecondes, le code éprouvé est celui de production.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__rap${Date.now().toString(36)}`;
let userId = "";

const H = 3_600_000;

suite("Échelle de relances, extinction sur e-mail, report", () => {
  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { name: `${TAG} PDG`, email: `${TAG}@amd.dz`, passwordHash: "x", role: "SUPER_ADMIN" },
      select: { id: true },
    });
    userId = u.id;
  });

  afterAll(async () => {
    await prisma.assistantReminder.deleteMany({ where: { userId } });
    await prisma.notification.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.businessEvent.deleteMany({ where: { payload: { path: ["marqueur"], equals: TAG } } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  });

  it("l'échelle se consomme barreau par barreau, puis le rappel s'ÉTEINT — jamais à l'infini", async () => {
    const t0 = new Date("2026-09-01T08:00:00.000Z");
    const r = await prisma.assistantReminder.create({
      data: {
        userId, title: `${TAG} relance Sarah`, dueAt: t0, recurrence: "NONE",
        escalationsH: [48, 72],
      },
      select: { id: true },
    });

    // Tir nº 1 (l'échéance passe) : le premier barreau se consomme, la prochaine échéance
    // est PLANIFIÉE À +48 h — pas re-signalée à chaque battement.
    await runAssistantReminders(new Date(t0.getTime() + 60_000));
    let lu = await prisma.assistantReminder.findUnique({
      where: { id: r.id }, select: { active: true, dueAt: true, escalationsH: true },
    });
    expect(lu!.active).toBe(true);
    expect(lu!.dueAt.getTime()).toBe(t0.getTime() + 60_000 + 48 * H);
    expect(lu!.escalationsH).toEqual([72]);

    // Tir nº 2 (48 h plus tard) : dernier barreau.
    const t2 = new Date(lu!.dueAt.getTime() + 1_000);
    await runAssistantReminders(t2);
    lu = await prisma.assistantReminder.findUnique({
      where: { id: r.id }, select: { active: true, dueAt: true, escalationsH: true },
    });
    expect(lu!.active).toBe(true);
    expect(lu!.escalationsH).toEqual([]);

    // Tir nº 3 : plus de barreau, pas de récurrence → le rappel se TAIT pour de bon.
    await runAssistantReminders(new Date(lu!.dueAt.getTime() + 1_000));
    const final = await prisma.assistantReminder.findUnique({ where: { id: r.id }, select: { active: true } });
    expect(final!.active).toBe(false);
  });

  it("§10 : le contrat qui ARRIVE éteint le rappel ET ses relances — mais pas un mail sans la pièce (§26)", async () => {
    const r = await prisma.assistantReminder.create({
      data: {
        userId, title: `${TAG} contrat Sarah`, dueAt: new Date(Date.now() + 24 * H),
        recurrence: "NONE", escalationsH: [48],
        stopOnEvent: { event: "EMAIL_RECEIVED", from: "sarah@exemple.dz", attachment: true },
      },
      select: { id: true },
    });

    // Un mail de Sarah SANS pièce jointe : « je l'envoie bientôt » — le rappel RESTE armé.
    await recordEvent({
      type: "EMAIL_RECEIVED", sourceDomain: "comms",
      payload: { from: "sarah@exemple.dz", subject: "Re: contrat", hasAttachments: false, attachments: [], marqueur: TAG },
    });
    let lu = await prisma.assistantReminder.findUnique({ where: { id: r.id }, select: { active: true } });
    expect(lu!.active).toBe(true);

    // Un mail d'une AUTRE personne AVEC pièce : pas le bon expéditeur — toujours armé.
    await recordEvent({
      type: "EMAIL_RECEIVED", sourceDomain: "comms",
      payload: { from: "yacine@exemple.dz", subject: "contrat", hasAttachments: true, attachments: ["contrat.pdf"], marqueur: TAG },
    });
    lu = await prisma.assistantReminder.findUnique({ where: { id: r.id }, select: { active: true } });
    expect(lu!.active).toBe(true);

    // LE mail attendu — Sarah, avec le contrat : le rappel s'éteint TOUT SEUL, relances comprises.
    await recordEvent({
      type: "EMAIL_RECEIVED", sourceDomain: "comms",
      payload: { from: "sarah@exemple.dz", subject: "Le contrat signé", hasAttachments: true, attachments: ["contrat-signe.pdf"], marqueur: TAG },
    });
    lu = await prisma.assistantReminder.findUnique({ where: { id: r.id }, select: { active: true } });
    expect(lu!.active).toBe(false);

    // §42 : le REJEU du même fait (webhook dupliqué) ne réveille rien et ne casse rien.
    await recordEvent({
      type: "EMAIL_RECEIVED", sourceDomain: "comms",
      payload: { from: "sarah@exemple.dz", subject: "Le contrat signé", hasAttachments: true, attachments: ["contrat-signe.pdf"], marqueur: TAG },
    });
    lu = await prisma.assistantReminder.findUnique({ where: { id: r.id }, select: { active: true } });
    expect(lu!.active).toBe(false);
  });

  it("le report décale l'échéance depuis MAX(échéance, maintenant) — et jamais le rappel d'un autre", async () => {
    const dans1h = new Date(Date.now() + H);
    const r = await prisma.assistantReminder.create({
      data: { userId, title: `${TAG} à reporter`, dueAt: dans1h, recurrence: "NONE" },
      select: { id: true },
    });

    const nouvelle = await snoozeReminder(r.id, userId, 30);
    expect(nouvelle).not.toBeNull();
    expect(Math.abs(nouvelle!.getTime() - (dans1h.getTime() + 30 * 60_000))).toBeLessThan(1_500);

    // Le rappel d'un autre ne se reporte pas en devinant son identifiant.
    expect(await snoozeReminder(r.id, "quelqu-un-d-autre", 30)).toBeNull();
  });
});
