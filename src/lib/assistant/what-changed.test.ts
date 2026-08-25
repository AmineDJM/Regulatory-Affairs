import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess } from "@/lib/rbac";
import { POWER_TOOLS } from "./power-tools";
import { parseSince } from "./what-changed";

/**
 * WHAT CHANGED — « qu'est-ce qui a changé depuis lundi ? » : seuls les changements TRACÉS
 * depuis la date remontent (pas ceux d'avant), avec QUI a agi et l'état actuel en face ;
 * « aucun changement tracé » est une réponse honnête et complète.
 */

const exec = (id: string): CurrentUser => ({
  id, name: "PDG", email: `${id}@t.dz`, role: "DIRECTION",
  access: { modules: new Map(), rowGrants: new Map() } as unknown as EffectiveAccess,
  mustChangePassword: false,
});

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__wc__${Date.now()}`;
const REF = `${TAG}-PAY`;
let ceoId = "";
let payId = "";

const tool = POWER_TOOLS.find((t) => t.def.name === "what_changed")!;
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

suite("what_changed — le diff tracé depuis une date, l'état actuel en face", () => {
  beforeAll(async () => {
    const ceo = await prisma.user.create({ data: { name: `${TAG} Nadia`, email: `${TAG}c@t.dz`, passwordHash: "x", role: "DIRECTION" } });
    ceoId = ceo.id;
    const pay = await prisma.paymentRequest.create({
      data: { reference: REF, title: `${TAG} achat imprimerie`, amount: 300_000, payee: "Imprimerie", requesterId: ceoId, status: "SUBMITTED", createdAt: ago(30) },
    });
    payId = pay.id;
    await prisma.auditLog.createMany({
      data: [
        // AVANT la date de référence — ne doit PAS remonter.
        { entityType: "PAYMENT_REQUEST", entityId: payId, action: "UPDATE", module: "Finances", field: "status", oldValue: "DRAFT", newValue: "SUBMITTED", summary: "Demande soumise", actorId: ceoId, createdAt: ago(20) },
        // DEPUIS la date — doivent remonter.
        { entityType: "PAYMENT_REQUEST", entityId: payId, action: "UPDATE", module: "Finances", field: "amount", oldValue: "300000", newValue: "320000", summary: "Montant corrigé", actorId: ceoId, createdAt: ago(3) },
        { entityType: "PAYMENT_REQUEST", entityId: payId, action: "VALIDATE", module: "Finances", summary: "Première validation rendue", actorId: ceoId, createdAt: ago(2) },
      ],
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: payId } }).catch(() => {});
    await prisma.paymentRequest.deleteMany({ where: { reference: REF } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("est réservé au siège exécutif, comme time_travel", () => {
    expect(tool.allowed(exec(ceoId))).toBe(true);
    expect(tool.allowed({ ...exec(ceoId), role: "DELEGATE" as CurrentUser["role"] })).toBe(false);
  });

  it("parseSince : AAAA-MM-JJ (début de journée Alger) ou N jours en arrière ; illisible → null", () => {
    expect(parseSince("2026-06-01")?.toISOString()).toBe("2026-05-31T23:00:00.000Z");
    const seven = parseSince("7", new Date("2026-08-25T12:00:00Z"));
    expect(seven?.toISOString()).toBe("2026-08-18T12:00:00.000Z");
    expect(parseSince("n'importe quoi")).toBeNull();
  });

  it("« depuis 7 jours » : SEULS les changements de la fenêtre remontent, avec qui a agi et l'état actuel", async () => {
    const out = JSON.parse(await tool.run({ reference: REF, since: "7" }, exec(ceoId)));
    const events = JSON.stringify(out.changements.significatifs);
    expect(events).toContain("Montant corrigé");
    expect(events).toContain("Première validation rendue");
    expect(events).not.toContain("Demande soumise"); // antérieur à la fenêtre
    expect(out.changements.total).toBe(2);
    expect(out.quiAAgi[0]).toMatchObject({ nom: `${TAG} Nadia`, actions: 2 });
    expect(out.etatActuel.statut).toBe("SUBMITTED");
    expect(out.lien).toBe(`/validations/paiements/${payId}`);
  });

  it("aucun changement dans la fenêtre → réponse honnête, jamais un diff inventé", async () => {
    const out = JSON.parse(await tool.run({ reference: REF, since: "1" }, exec(ceoId)));
    expect(out.reponse).toMatch(/Aucun changement SIGNIFICATIF tracé/);
    expect(out.etatActuel).toBeTruthy();
    expect(out.rappel).toMatch(/journal ne capture/);
  });

  it("référence inconnue → refus honnête", async () => {
    const out = await tool.run({ reference: `${TAG}-fantome`, since: "7" }, exec(ceoId));
    expect(out).toMatch(/Aucun dossier/);
  });
});
