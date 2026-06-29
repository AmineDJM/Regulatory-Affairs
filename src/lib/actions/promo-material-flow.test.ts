import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import {
  createPromoMaterial, submitQuotes, chooseAgency, submitBcForFinance, validateBc, confirmBcSent,
  initiatePayment, confirmPayment, submitMaterial, directionReview, confirmConformity, startBat,
  submitFinalMaterial, recordInvoice, settle,
} from "./promo-material-actions";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__promotest__";
async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}
function form(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

suite("Matériel promotionnel — circuit complet (Marketing → Assistante → Finances → Info médicale → Direction)", () => {
  let mkt = "", asst = "", fin = "", med = "", dir = "", pmId = "";

  beforeAll(async () => {
    const mk = (s: string, role: SessionUser["role"]) =>
      prisma.user.create({ data: { name: `${TAG}${s}`, email: `${TAG}${s}@t.dz`, role, passwordHash: "x" } });
    const [a, b, c, d, e] = await Promise.all([
      mk("mkt", "MEDICAL_PROMOTION_MANAGER"),
      mk("asst", "DIRECTION_ASSISTANT"),
      mk("fin", "FINANCE_BUDGET_MANAGER"),
      mk("med", "MEDICAL_INFO_PHARMACIST"),
      mk("dir", "DIRECTION"),
    ]);
    mkt = a.id; asst = b.id; fin = c.id; med = d.id; dir = e.id;
  });

  afterAll(async () => {
    await prisma.expenseOrder.deleteMany({ where: { sourceType: "PROMO_MATERIAL", sourceId: pmId } }).catch(() => {});
    await prisma.comment.deleteMany({ where: { entityType: "PROMO_MATERIAL", entityId: pmId } }).catch(() => {});
    await prisma.promoMaterial.deleteMany({ where: { reference: { startsWith: "MP-" }, title: { contains: TAG } } }).catch(() => {});
    await prisma.administrativeRequest.deleteMany({ where: { title: { contains: TAG } } }).catch(() => {});
    await prisma.userAccess.deleteMany({ where: { user: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("Marketing crée la demande de prospection", async () => {
    ACTOR = await actorFor(mkt, "MEDICAL_PROMOTION_MANAGER");
    const r = await createPromoMaterial(undefined, form({ title: `Brochure ${TAG}`, assistantId: asst, amount: "120000" }));
    expect(r.ok).toBe(true);
    pmId = r.id!;
    const pm = await prisma.promoMaterial.findUniqueOrThrow({ where: { id: pmId } });
    expect(pm.status).toBe("PROSPECTION_REQUESTED");
    expect(pm.requesterId).toBe(mkt);
  });

  it("un acteur hors rôle ne peut pas faire avancer l'étape", async () => {
    ACTOR = await actorFor(fin, "FINANCE_BUDGET_MANAGER");
    const r = await submitQuotes(form({ id: pmId })); // c'est à l'assistante, pas aux finances
    expect(r.ok).toBe(false);
  });

  it("Assistante dépose les devis → Marketing choisit l'agence → Assistante transmet le BC", async () => {
    ACTOR = await actorFor(asst, "DIRECTION_ASSISTANT");
    expect((await submitQuotes(form({ id: pmId }))).ok).toBe(true);

    ACTOR = await actorFor(mkt, "MEDICAL_PROMOTION_MANAGER");
    expect((await chooseAgency(form({ id: pmId, chosenAgency: "Agence Pub DZ", chosenAmount: "118000" }))).ok).toBe(true);

    ACTOR = await actorFor(asst, "DIRECTION_ASSISTANT");
    expect((await submitBcForFinance(form({ id: pmId, bcReference: "BC-2026-9" }))).ok).toBe(true);
    const pm = await prisma.promoMaterial.findUniqueOrThrow({ where: { id: pmId } });
    expect(pm.status).toBe("BC_FINANCE_REVIEW");
    expect(pm.chosenAgency).toBe("Agence Pub DZ");
  });

  it("Finances valident le BC → Assistante le transmet à l'agence", async () => {
    ACTOR = await actorFor(fin, "FINANCE_BUDGET_MANAGER");
    expect((await validateBc(form({ id: pmId }))).ok).toBe(true);
    ACTOR = await actorFor(asst, "DIRECTION_ASSISTANT");
    expect((await confirmBcSent(form({ id: pmId }))).ok).toBe(true);
    expect((await prisma.promoMaterial.findUniqueOrThrow({ where: { id: pmId } })).status).toBe("BC_SENT");
  });

  it("Info médicale initie le bordereau (ordre de dépense) → Finances paient", async () => {
    ACTOR = await actorFor(med, "MEDICAL_INFO_PHARMACIST");
    expect((await initiatePayment(form({ id: pmId }))).ok).toBe(true);
    const pmAfter = await prisma.promoMaterial.findUniqueOrThrow({ where: { id: pmId } });
    expect(pmAfter.status).toBe("PAYMENT_INITIATED");
    expect(pmAfter.paymentOrderId).toBeTruthy();
    const orders = await prisma.expenseOrder.findMany({ where: { sourceType: "PROMO_MATERIAL", sourceId: pmId } });
    expect(orders).toHaveLength(1);

    ACTOR = await actorFor(fin, "FINANCE_BUDGET_MANAGER");
    expect((await confirmPayment(form({ id: pmId, comment: "Réglé par virement" }))).ok).toBe(true);
    expect((await prisma.promoMaterial.findUniqueOrThrow({ where: { id: pmId } })).status).toBe("PAYMENT_DONE");
  });

  it("Marketing dépose le matériel → Direction valide → Info médicale obtient le visa", async () => {
    ACTOR = await actorFor(mkt, "MEDICAL_PROMOTION_MANAGER");
    expect((await submitMaterial(form({ id: pmId }))).ok).toBe(true);
    ACTOR = await actorFor(dir, "DIRECTION");
    expect((await directionReview(form({ id: pmId, comment: "Conforme à la charte" }))).ok).toBe(true);
    ACTOR = await actorFor(med, "MEDICAL_INFO_PHARMACIST");
    expect((await confirmConformity(form({ id: pmId, visaReference: "VISA-2026-42", authorityRef: "DEP-77" }))).ok).toBe(true);
    expect((await prisma.promoMaterial.findUniqueOrThrow({ where: { id: pmId } })).status).toBe("VISA_OBTAINED");
  });

  it("Marketing imprime → matériel final → facture → Finances règlent (clôture)", async () => {
    ACTOR = await actorFor(mkt, "MEDICAL_PROMOTION_MANAGER");
    expect((await startBat(form({ id: pmId }))).ok).toBe(true);
    expect((await submitFinalMaterial(form({ id: pmId }))).ok).toBe(true);
    ACTOR = await actorFor(asst, "DIRECTION_ASSISTANT");
    expect((await recordInvoice(form({ id: pmId }))).ok).toBe(true);

    ACTOR = await actorFor(fin, "FINANCE_BUDGET_MANAGER");
    expect((await settle(form({ id: pmId, amount: "118000" }))).ok).toBe(true);
    const pm = await prisma.promoMaterial.findUniqueOrThrow({ where: { id: pmId } });
    expect(pm.status).toBe("SETTLED");
    expect(pm.settlementOrderId).toBeTruthy();
    const orders = await prisma.expenseOrder.findMany({ where: { sourceType: "PROMO_MATERIAL", sourceId: pmId } });
    expect(orders).toHaveLength(2); // bordereau de paiement + règlement final
  });
});
