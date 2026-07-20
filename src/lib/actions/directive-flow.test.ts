import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, scopeDirectives, type SessionUser } from "@/lib/rbac";
import { canViewDirective, getDirective } from "@/lib/queries/directives";
import { createDirective, updateDirectiveStatus, postDirectiveMessage, archiveDirective } from "./directive-actions";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__dirtest__";
async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

suite("Directives — émission, suivi, échange, diffusion par rôle", () => {
  let dirId = "", roleDirId = "", directionId = "", delegateId = "", delegate2Id = "", financeId = "";

  beforeAll(async () => {
    const mk = (s: string, role: SessionUser["role"]) =>
      prisma.user.create({ data: { name: `${TAG}${s}`, email: `${TAG}${s}@t.dz`, role, passwordHash: "x" } });
    const [dir, dg, dg2, fin] = await Promise.all([
      mk("direction", "DIRECTION"),
      mk("deleg", "MEDICAL_DELEGATE"),
      mk("deleg2", "MEDICAL_DELEGATE"),
      // Un compte d'un AUTRE rôle (non ciblé) : getAccess résout le rôle EN DIRECT de la base,
      // on ne peut donc plus « forcer » un rôle sur l'id de la Direction — il faut un vrai compte.
      mk("finance", "FINANCE_BUDGET_MANAGER"),
    ]);
    directionId = dir.id; delegateId = dg.id; delegate2Id = dg2.id; financeId = fin.id;
  });

  afterAll(async () => {
    await prisma.directive.deleteMany({ where: { reference: { startsWith: "DIR-" }, from: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("la Direction émet une directive nominative (statut OPEN, destinataire notifié)", async () => {
    ACTOR = await actorFor(directionId, "DIRECTION");
    const fd = new FormData();
    fd.set("title", `${TAG} Prioriser le dossier PCH`); fd.set("body", "Merci d'accélérer."); fd.set("priority", "HIGH"); fd.set("targetUserId", delegateId);
    const r = await createDirective(undefined, fd);
    expect(r.ok).toBe(true);
    dirId = r.id!;
    const d = await prisma.directive.findUniqueOrThrow({ where: { id: dirId } });
    expect(d.status).toBe("OPEN");
    expect(d.targetUserId).toBe(delegateId);
    expect(d.reference).toMatch(/^DIR-\d{4}-\d{3}$/);
    const notif = await prisma.notification.findFirst({ where: { userId: delegateId, title: "Nouvelle directive" } });
    expect(notif).not.toBeNull();
  });

  it("le destinataire voit la directive, un tiers non", async () => {
    const d = await getDirective(dirId);
    expect(canViewDirective(await actorFor(delegateId, "MEDICAL_DELEGATE"), d!)).toBe(true);
    expect(canViewDirective(await actorFor(delegate2Id, "MEDICAL_DELEGATE"), d!)).toBe(false); // pas ciblé nommément
  });

  it("le destinataire accuse réception puis le fil d'échange fonctionne dans les deux sens", async () => {
    ACTOR = await actorFor(delegateId, "MEDICAL_DELEGATE");
    const fdAck = new FormData(); fdAck.set("id", dirId); fdAck.set("status", "ACKNOWLEDGED");
    expect((await updateDirectiveStatus(fdAck)).ok).toBe(true);
    let d = await prisma.directive.findUniqueOrThrow({ where: { id: dirId } });
    expect(d.status).toBe("ACKNOWLEDGED");
    expect(d.acknowledgedById).toBe(delegateId);

    const fdMsg = new FormData(); fdMsg.set("id", dirId); fdMsg.set("body", "Bien reçu, je m'en occupe.");
    expect((await postDirectiveMessage(fdMsg)).ok).toBe(true);

    ACTOR = await actorFor(directionId, "DIRECTION");
    const fdMsg2 = new FormData(); fdMsg2.set("id", dirId); fdMsg2.set("body", "Parfait, merci.");
    expect((await postDirectiveMessage(fdMsg2)).ok).toBe(true);

    const msgs = await prisma.directiveMessage.findMany({ where: { directiveId: dirId }, orderBy: { createdAt: "asc" } });
    expect(msgs).toHaveLength(2);
    expect(msgs[0].authorId).toBe(delegateId);
    expect(msgs[1].authorId).toBe(directionId);
  });

  it("l'archivage est réservé à la Direction (le délégué ne peut pas)", async () => {
    ACTOR = await actorFor(delegateId, "MEDICAL_DELEGATE");
    const fd = new FormData(); fd.set("id", dirId);
    expect((await archiveDirective(fd)).ok).toBe(false);
    ACTOR = await actorFor(directionId, "DIRECTION");
    expect((await archiveDirective(fd)).ok).toBe(true);
    const d = await prisma.directive.findUniqueOrThrow({ where: { id: dirId } });
    expect(d.status).toBe("ARCHIVED");
  });

  it("diffusion par rôle : visible par tout membre du rôle ciblé via le scope", async () => {
    ACTOR = await actorFor(directionId, "DIRECTION");
    const fd = new FormData();
    fd.set("title", `${TAG} Tous délégués : remontez vos points`); fd.set("body", "Hebdo."); fd.set("targetRole", "MEDICAL_DELEGATE");
    const r = await createDirective(undefined, fd);
    expect(r.ok).toBe(true);
    roleDirId = r.id!;
    const d = await prisma.directive.findUniqueOrThrow({ where: { id: roleDirId } });
    expect(d.targetRole).toBe("MEDICAL_DELEGATE");
    expect(d.targetUserId).toBeNull();
    // Un délégué quelconque (non nommé) la voit via son rôle.
    const dg2 = await actorFor(delegate2Id, "MEDICAL_DELEGATE");
    const found = await prisma.directive.findFirst({ where: { AND: [{ id: roleDirId }, scopeDirectives(dg2)] }, select: { id: true } });
    expect(found?.id).toBe(roleDirId);
    // Un rôle non ciblé ne la voit pas (vrai compte Finances : son rôle réel est résolu en base).
    const finance = await actorFor(financeId, "FINANCE_BUDGET_MANAGER");
    const notFound = await prisma.directive.findFirst({ where: { AND: [{ id: roleDirId }, scopeDirectives(finance)] }, select: { id: true } });
    expect(notFound).toBeNull();
  });
});
