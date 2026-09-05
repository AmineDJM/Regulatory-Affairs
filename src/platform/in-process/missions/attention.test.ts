import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { porteAttentionPour } from "@/platform/in-process/missions/attention";
import { journaliser } from "@/lib/missions/runtime/store";

/**
 * LA PORTE D'ATTENTION, par l'entrée réelle : un signal entre, une notification sort (ou pas),
 * le journal dit ce qui est parti, et le même fait ne se redit pas. L'e-mail est injecté : le
 * test vérifie QUAND il part, pas qu'un SMTP répond.
 */
let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `att${Date.now().toString(36)}`;
let ownerId = "";
let missionId = "";

suite("porte d'attention — niveaux, canaux, dédoublonnage, plafond", () => {
  beforeAll(async () => {
    const u = await prisma.user.create({ data: { name: `${TAG} PDG`, email: `${TAG}@amd.dz`, passwordHash: "x", role: "SUPER_ADMIN" }, select: { id: true } });
    ownerId = u.id;
    const m = await prisma.mission.create({ data: { kind: "RUNTIME", status: "RUNNING", title: `${TAG} Dossier Trastuzex`, objective: "x", goalRaw: "x", ownerId, planVersion: 1 }, select: { id: true } });
    missionId = m.id;
  }, 60_000);
  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: ownerId } }).catch(() => {});
    await prisma.mission.deleteMany({ where: { ownerId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: ownerId } }).catch(() => {});
  }, 60_000);

  it("une mission terminée avec effets : INFO, notification + push, pas d'e-mail, journal NOTIFIED ; la redite est supprimée", async () => {
    const mails: string[] = [];
    const porte = porteAttentionPour({ envoyerMail: async (_o, sujet) => { mails.push(sujet); return "envoye"; } });
    const r1 = await porte.signaler({
      kind: "MISSION_COMPLETED", missionId, ownerId, titre: "", planVersion: 1,
      raison: "Les trois messages sont partis.", bilan: { faites: 4, total: 4, echouees: 0, effets: ["send_message ×3"] },
    });
    expect(r1.niveau).toBe("INFO");
    expect(r1.canaux).toEqual(["notification", "push"]);
    expect(mails).toHaveLength(0);
    const notif = await prisma.notification.findFirst({ where: { userId: ownerId }, orderBy: { createdAt: "desc" } });
    expect(notif?.title).toBe(`Mission terminée — ${TAG} Dossier Trastuzex`);
    expect(notif?.body).toContain("Actions : send_message ×3");
    expect(notif?.link).toBe(`/missions/${missionId}`);
    const journal = await prisma.missionEvent.findMany({ where: { missionId, kind: "NOTIFIED" }, select: { detail: true } });
    expect(journal).toHaveLength(1);
    expect((journal[0].detail as { niveau: string }).niveau).toBe("INFO");

    const r2 = await porte.signaler({
      kind: "MISSION_COMPLETED", missionId, ownerId, titre: "", planVersion: 1,
      raison: "Les trois messages sont partis.", bilan: { faites: 4, total: 4, echouees: 0, effets: ["send_message ×3"] },
    });
    expect(r2.supprime).toBe(true);
    expect(await prisma.notification.count({ where: { userId: ownerId } })).toBe(1);
  }, 60_000);

  it("une question au dirigeant : ARBITRAGE, notification VALIDATION_REQUIRED, e-mail tenté, jamais redemandée d'elle-même", async () => {
    const mails: { sujet: string; corps: string }[] = [];
    const porte = porteAttentionPour({ envoyerMail: async (_o, sujet, corps) => { mails.push({ sujet, corps }); return "envoye"; } });
    const r = await porte.signaler({
      kind: "QUESTION", missionId, ownerId, titre: "", planVersion: 1, stepKey: "cadrage",
      raison: "Deux fournisseurs répondent au nom « Hetero » : Hetero Labs Ltd et Hetero Biopharma.", decision: "lequel viser ?",
    });
    expect(r.niveau).toBe("ARBITRAGE");
    expect(r.canaux).toEqual(["notification", "push", "email"]);
    expect(mails[0].sujet).toMatch(/^\[Adam\] Une précision — /);
    expect(mails[0].corps).toContain("Décision demandée : lequel viser ?");
    const notif = await prisma.notification.findFirst({ where: { userId: ownerId, type: "VALIDATION_REQUIRED" } });
    expect(notif).not.toBeNull();
    const encore = await porte.signaler({ kind: "QUESTION", missionId, ownerId, titre: "", planVersion: 1, stepKey: "cadrage", raison: "Deux fournisseurs…" });
    expect(encore.supprime).toBe(true);
    expect(mails).toHaveLength(1);
  }, 60_000);

  it("sans boîte connectée, l'e-mail ne part pas et le journal le DIT ; la notification part quand même", async () => {
    const porte = porteAttentionPour({ envoyerMail: async () => "sans-boite" });
    const r = await porte.signaler({ kind: "MISSION_BLOCKED", missionId, ownerId, titre: "", planVersion: 1, raison: "Le certificat GMP est introuvable partout.", bilan: { faites: 3, total: 5, echouees: 1 } });
    expect(r.niveau).toBe("ATTENTION");
    expect(r.canaux).toEqual(["notification", "push"]);
    const j = await prisma.missionEvent.findFirst({ where: { missionId, kind: "NOTIFIED", detail: { path: ["kind"], equals: "MISSION_BLOCKED" } }, select: { detail: true } });
    expect((j?.detail as { email: string }).email).toBe("sans-boite");
  }, 60_000);

  it("au-delà du plafond quotidien, une INFO devient une ligne de JOURNAL (sans push) — jamais un arbitrage", async () => {
    const autre = await prisma.mission.create({ data: { kind: "RUNTIME", status: "RUNNING", title: `${TAG} autre`, objective: "y", goalRaw: "y", ownerId, planVersion: 1 }, select: { id: true } });
    for (let i = 0; i < 16; i += 1) {
      await journaliser(autre.id, "NOTIFIED", "INFO — test", { niveau: "INFO", cle: `plafond:${i}` });
    }
    const porte = porteAttentionPour({ envoyerMail: async () => "envoye" });
    const info = await porte.signaler({ kind: "MISSION_PARTIAL", missionId: autre.id, ownerId, titre: "", planVersion: 1, raison: "Une partie reste ouverte.", bilan: { faites: 2, total: 4, echouees: 0 } });
    expect(info.niveau).toBe("JOURNAL");
    expect(info.canaux).toEqual(["notification"]);
    const arb = await porte.signaler({ kind: "APPROVAL_REQUIRED", missionId: autre.id, ownerId, titre: "", planVersion: 1, niveauApprobation: "SENSITIVE", raison: "3 e-mails externes", stepKey: "accord" });
    expect(arb.niveau).toBe("ARBITRAGE");
    expect(arb.canaux).toContain("email");
  }, 60_000);
});
