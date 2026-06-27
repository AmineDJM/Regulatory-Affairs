import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { canViewDossier, getDossier } from "@/lib/queries/dossiers";
import { createDossierRecord } from "@/lib/dossiers-core";
import { createDossier, updateDossierStatus, postDossierMessage, assignDossier } from "./dossier-actions";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__dostest__";
async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

suite("Dossiers — création, visibilité, échange, pilotage, proposition IA", () => {
  let dossierId = "", creatorId = "", assigneeId = "", participantId = "", outsiderId = "";

  beforeAll(async () => {
    const mk = (s: string) => prisma.user.create({ data: { name: `${TAG}${s}`, email: `${TAG}${s}@t.dz`, role: "MEDICAL_DELEGATE", passwordHash: "x" } });
    const [c, a, p, o] = await Promise.all([mk("creator"), mk("assignee"), mk("participant"), mk("outsider")]);
    creatorId = c.id; assigneeId = a.id; participantId = p.id; outsiderId = o.id;
  });

  afterAll(async () => {
    await prisma.dossier.deleteMany({ where: { reference: { startsWith: "DOS-" }, createdBy: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { actor: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("ouverture d'un dossier (référence DOS-, responsable notifié)", async () => {
    ACTOR = await actorFor(creatorId, "MEDICAL_DELEGATE");
    const fd = new FormData();
    fd.set("title", `${TAG} Recherche prix hôtels`); fd.set("description", "Congrès Paris"); fd.set("category", "Hôtels"); fd.set("assignedToId", assigneeId);
    const r = await createDossier(undefined, fd);
    expect(r.ok).toBe(true);
    dossierId = r.id!;
    const d = await prisma.dossier.findUniqueOrThrow({ where: { id: dossierId } });
    expect(d.reference).toMatch(/^DOS-\d{4}-\d{3}$/);
    expect(d.assignedToId).toBe(assigneeId);
    expect(d.status).toBe("OPEN");
    const notif = await prisma.notification.findFirst({ where: { userId: assigneeId, title: "Nouveau dossier de suivi" } });
    expect(notif).not.toBeNull();
  });

  it("visible par le créateur et le responsable, pas par un tiers", async () => {
    const d = await getDossier(dossierId);
    expect(canViewDossier(await actorFor(creatorId, "MEDICAL_DELEGATE"), d!)).toBe(true);
    expect(canViewDossier(await actorFor(assigneeId, "MEDICAL_DELEGATE"), d!)).toBe(true);
    expect(canViewDossier(await actorFor(outsiderId, "MEDICAL_DELEGATE"), d!)).toBe(false);
  });

  it("ajout d'un participant (notifié) qui voit alors le dossier", async () => {
    ACTOR = await actorFor(creatorId, "MEDICAL_DELEGATE");
    const fd = new FormData(); fd.set("id", dossierId); fd.set("assignedToId", assigneeId); fd.append("participantIds", participantId);
    expect((await assignDossier(fd)).ok).toBe(true);
    const d = await getDossier(dossierId);
    expect(d!.participantIds).toContain(participantId);
    expect(canViewDossier(await actorFor(participantId, "MEDICAL_DELEGATE"), d!)).toBe(true);
  });

  it("un membre échange dans le fil ; un tiers ne peut pas", async () => {
    ACTOR = await actorFor(assigneeId, "MEDICAL_DELEGATE");
    const ok = new FormData(); ok.set("id", dossierId); ok.set("body", "J'ai trois devis.");
    expect((await postDossierMessage(ok)).ok).toBe(true);
    ACTOR = await actorFor(outsiderId, "MEDICAL_DELEGATE");
    const no = new FormData(); no.set("id", dossierId); no.set("body", "intrus");
    expect((await postDossierMessage(no)).ok).toBe(false);
    const msgs = await prisma.dossierMessage.findMany({ where: { dossierId } });
    expect(msgs).toHaveLength(1);
  });

  it("le pilotage (statut) est réservé au créateur/responsable", async () => {
    ACTOR = await actorFor(participantId, "MEDICAL_DELEGATE"); // participant ≠ manager
    const fdP = new FormData(); fdP.set("id", dossierId); fdP.set("status", "DONE");
    expect((await updateDossierStatus(fdP)).ok).toBe(false);
    ACTOR = await actorFor(assigneeId, "MEDICAL_DELEGATE"); // responsable
    const fdA = new FormData(); fdA.set("id", dossierId); fdA.set("status", "IN_PROGRESS");
    expect((await updateDossierStatus(fdA)).ok).toBe(true);
    const d = await prisma.dossier.findUniqueOrThrow({ where: { id: dossierId } });
    expect(d.status).toBe("IN_PROGRESS");
  });

  it("proposition IA : createDossierRecord crée le dossier et notifie", async () => {
    const { id, reference } = await createDossierRecord(
      { title: `${TAG} Analyse IQVIA`, category: "Analyse IQVIA", assignedToId: assigneeId, participantIds: [participantId] },
      creatorId,
    );
    expect(reference).toMatch(/^DOS-\d{4}-\d{3}$/);
    const d = await prisma.dossier.findUniqueOrThrow({ where: { id } });
    expect(d.assignedToId).toBe(assigneeId);
    expect(d.participantIds).toContain(participantId);
  });
});
