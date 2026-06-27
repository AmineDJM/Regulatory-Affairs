import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

// Mocks hoisted before the action module is imported.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, scopeMedicalInfo, type SessionUser } from "@/lib/rbac";
import { createMedicalInfoDeclaration } from "@/lib/medical-info";
import { canViewDeclaration, getDeclaration } from "@/lib/queries/medical-info";
import { requestDocument, fulfillDocRequest, validateDeclaration } from "./medical-info-actions";

// Probe DB once; skip the whole suite cleanly when unreachable (CI without a DB).
let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__mitest__";
async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

suite("PRIM — circuit information médicale (déclaration → pièces → validation → ordre)", () => {
  let pharmacistId = "", delegateId = "", otherId = "", sponsoringId = "", declId = "";

  beforeAll(async () => {
    const mk = (suffix: string, role: SessionUser["role"]) =>
      prisma.user.create({ data: { name: `${TAG}${suffix}`, email: `${TAG}${suffix}@t.dz`, role, passwordHash: "x" } });
    const [ph, dg, ot] = await Promise.all([
      mk("pharm", "MEDICAL_INFO_PHARMACIST"),
      mk("deleg", "MEDICAL_DELEGATE"),
      mk("other", "SALES_USER"),
    ]);
    pharmacistId = ph.id; delegateId = dg.id; otherId = ot.id;

    const spo = await prisma.sponsoringRequest.create({
      data: { reference: `${TAG}SPO`, institution: "Hôpital Test", type: "Congrès", status: "APPROVED", amountGranted: 50000, requesterId: delegateId },
    });
    sponsoringId = spo.id;
  });

  afterAll(async () => {
    await prisma.expenseOrder.deleteMany({ where: { reference: { startsWith: "OD-" }, label: { contains: TAG } } }).catch(() => {});
    await prisma.medicalInfoDeclaration.deleteMany({ where: { OR: [{ reference: { contains: "DIM-" }, sourceId: sponsoringId }] } }).catch(() => {});
    await prisma.document.deleteMany({ where: { entityType: "MEDICAL_INFO_DECLARATION", entityId: declId } }).catch(() => {});
    await prisma.sponsoringRequest.deleteMany({ where: { reference: { startsWith: TAG } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("la validation définitive crée une déclaration et NE crée PAS encore d'ordre de dépense", async () => {
    const decl = await createMedicalInfoDeclaration({
      sourceType: "SPONSORING", sourceId: sponsoringId, label: `Sponsoring ${TAG}`, beneficiary: "Hôpital Test", amount: 50000, requesterId: delegateId,
    });
    declId = decl.id;
    expect(decl.status).toBe("AWAITING_REVIEW");
    expect(decl.pharmacistId).toBe(pharmacistId); // auto-assigné au pharmacien actif
    const orders = await prisma.expenseOrder.findMany({ where: { sourceType: "SPONSORING", sourceId: sponsoringId } });
    expect(orders).toHaveLength(0); // déféré !
  });

  it("le pharmacien demande une pièce → statut DOCS_REQUESTED, demande adressée au délégué", async () => {
    ACTOR = await actorFor(pharmacistId, "MEDICAL_INFO_PHARMACIST");
    const fd = new FormData();
    fd.set("declarationId", declId); fd.set("label", "Convention signée"); fd.set("targetUserId", delegateId);
    const r = await requestDocument(fd);
    expect(r.ok).toBe(true);
    const decl = await prisma.medicalInfoDeclaration.findUniqueOrThrow({ where: { id: declId }, include: { requests: true } });
    expect(decl.status).toBe("DOCS_REQUESTED");
    expect(decl.requests).toHaveLength(1);
    expect(decl.requests[0].targetUserId).toBe(delegateId);
    expect(decl.requests[0].status).toBe("PENDING");
  });

  it("accès : pharmacien (portée ALL) et délégué sollicité voient ; un tiers non", async () => {
    const declDetail = await getDeclaration(declId);
    const pharmUser = await actorFor(pharmacistId, "MEDICAL_INFO_PHARMACIST");
    const delegateUser = await actorFor(delegateId, "MEDICAL_DELEGATE");
    const otherUser = await actorFor(otherId, "SALES_USER");
    // Détail (page) : visible par le pharmacien et le délégué sollicité (via sa demande), pas par un tiers.
    expect(canViewDeclaration(pharmUser, declDetail!)).toBe(true);
    expect(canViewDeclaration(delegateUser, declDetail!)).toBe(true);
    expect(canViewDeclaration(otherUser, declDetail!)).toBe(false);
    // Liste (scope) : le pharmacien (portée ALL) remonte la déclaration ; un tiers sans module non.
    const inScope = await prisma.medicalInfoDeclaration.findFirst({ where: { AND: [{ id: declId }, scopeMedicalInfo(pharmUser)] }, select: { id: true } });
    expect(inScope?.id).toBe(declId);
    const outScope = await prisma.medicalInfoDeclaration.findFirst({ where: { AND: [{ id: declId }, scopeMedicalInfo(otherUser)] }, select: { id: true } });
    expect(outScope).toBeNull();
  });

  it("le délégué dépose la pièce → statut READY, document rattaché", async () => {
    ACTOR = await actorFor(delegateId, "MEDICAL_DELEGATE");
    const req = await prisma.medicalInfoDocRequest.findFirstOrThrow({ where: { declarationId: declId } });
    const fd = new FormData();
    fd.set("requestId", req.id);
    fd.set("file", new File([Buffer.from("%PDF-1.4 test")], "convention.pdf", { type: "application/pdf" }));
    const r = await fulfillDocRequest(undefined, fd);
    expect(r.ok).toBe(true);
    const decl = await prisma.medicalInfoDeclaration.findUniqueOrThrow({ where: { id: declId }, include: { requests: true } });
    expect(decl.status).toBe("READY");
    expect(decl.requests[0].status).toBe("FULFILLED");
    expect(decl.requests[0].documentId).toBeTruthy();
    const docs = await prisma.document.findMany({ where: { entityType: "MEDICAL_INFO_DECLARATION", entityId: declId } });
    expect(docs).toHaveLength(1);
  });

  it("un délégué NE peut PAS valider (réservé au pharmacien / Direction)", async () => {
    ACTOR = await actorFor(delegateId, "MEDICAL_DELEGATE");
    const fd = new FormData(); fd.set("id", declId);
    const r = await validateDeclaration(fd);
    expect(r.ok).toBe(false);
  });

  it("le pharmacien valide → ordre de dépense créé MAINTENANT et reporté sur le sponsoring", async () => {
    ACTOR = await actorFor(pharmacistId, "MEDICAL_INFO_PHARMACIST");
    const fd = new FormData(); fd.set("id", declId);
    const r = await validateDeclaration(fd);
    expect(r.ok).toBe(true);
    const decl = await prisma.medicalInfoDeclaration.findUniqueOrThrow({ where: { id: declId } });
    expect(decl.status).toBe("VALIDATED");
    expect(decl.expenseOrderId).toBeTruthy();
    const orders = await prisma.expenseOrder.findMany({ where: { sourceType: "SPONSORING", sourceId: sponsoringId } });
    expect(orders).toHaveLength(1);
    expect(Number(orders[0].amount)).toBe(50000);
    const spo = await prisma.sponsoringRequest.findUniqueOrThrow({ where: { id: sponsoringId } });
    expect(spo.expenseOrderId).toBe(orders[0].id); // interconnexion
  });
});
