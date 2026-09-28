import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { advanceWorkflowInstance, ensureInstance } from "./engine";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__spokam__";
const viewer = (id: string, role: UserRole) => ({ id, role, secondaryRole: null, name: role });

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE SPONSORING D'UN KAM : National Sales PUIS Direction des opérations, puis Direction Marketing
 * (décision de la Direction, 28/09/2026 — §118.156).
 *
 * Par le VRAI moteur : le parcours se fige à la naissance de l'instance (`ensureInstance`), et
 * chaque pas passe par `advanceWorkflowInstance`, avec les rôles qui agissent réellement. Un test
 * de la fonction pure seule dirait que la règle est écrite, pas que le moteur la lit (§118.49).
 *
 * LE TÉMOIN est un congrès national du MÊME KAM : il garde la règle du 22/09 (le National Sales
 * seul). Sans lui, une règle appliquée à toutes les natures passerait pour la bonne (§118.17).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
suite("le sponsoring d'un KAM traverse le National Sales PUIS la Direction des opérations", () => {
  let kamId = "", nsId = "", dirId = "", dgId = "", spoId = "", congresId = "";

  async function nettoyer() {
    const comptes = (await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } })).map((c) => c.id);
    const spos = (await prisma.sponsoringRequest.findMany({ where: { reference: { startsWith: TAG } }, select: { id: true } })).map((s) => s.id);
    const congres = (await prisma.congressNational.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } })).map((c) => c.id);
    const entites = [...spos, ...congres];
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: { in: entites } } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: { in: entites } } }).catch(() => {});
    await prisma.adProItem.deleteMany({ where: { sponsoringId: { in: spos } } }).catch(() => {});
    await prisma.sponsoringRequest.deleteMany({ where: { id: { in: spos } } }).catch(() => {});
    await prisma.congressNational.deleteMany({ where: { id: { in: congres } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: { in: comptes } } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { actorId: { in: comptes } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: comptes } } }).catch(() => {});
  }

  beforeAll(async () => {
    await nettoyer();
    const mk = async (s: string, role: UserRole) =>
      (await prisma.user.create({ data: { name: `${TAG}${s}`, email: `${TAG}${s}@t.dz`, role, passwordHash: "x" } })).id;
    kamId = await mk("kam", "MEDICAL_DELEGATE");
    nsId = await mk("ns", "NATIONAL_SALES");
    dirId = await mk("dir", "DIRECTION");
    await mk("dm", "PRODUCT_MANAGER");
    dgId = await mk("dg", "GENERAL_MANAGER");
    spoId = (await prisma.sponsoringRequest.create({
      data: {
        reference: `${TAG}SPO`, institution: `${TAG} CHU`, type: "Journée scientifique",
        // Le statut de départ d'un KAM (`adProInit`), et un montant très en dessous du seuil du DG.
        requesterId: kamId, status: "AWAITING_PRELIMINARY", amountRequested: 30_000, amountProposed: 30_000,
      },
    })).id;
    congresId = (await prisma.congressNational.create({
      data: { name: `${TAG}Congrès`, requesterId: kamId, requestStatus: "AWAITING_PRELIMINARY", estimatedBudget: 30_000 },
    })).id;
  }, 60_000);

  afterAll(nettoyer);

  /** Franchit la porte du DG si elle est ouverte : le seuil est un réglage partagé de la base. */
  async function passerLaPorteDuDg() {
    const inst = await ensureInstance("SPONSORING", spoId);
    if (inst?.currentSlug !== "dg") return;
    const r = await advanceWorkflowInstance({ viewer: viewer(dgId, "GENERAL_MANAGER"), entityType: "SPONSORING", entityId: spoId, action: "APPROVE", note: "OK DG" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
  }

  it("le parcours FIGÉ du sponsoring ne saute rien : ni le National Sales, ni la Direction des opérations", async () => {
    // Ce qui le ferait tomber : la règle du 22/09 appliquée au sponsoring — `final` dans le tamis,
    // et la Direction des opérations sautée alors que la Direction vient de la demander.
    const inst = await ensureInstance("SPONSORING", spoId);
    expect(inst?.currentSlug, "un KAM entre par son superviseur national").toBe("preliminary");
    expect(inst?.skippedSlugs, "rien n'est sauté : les deux filtres sont sur la route").toEqual([]);
    expect(inst?.finalSlug, "Direction Marketing est la dernière étape : aucune borne avant elle").toBeNull();
  });

  it("TÉMOIN : le congrès du MÊME KAM garde la règle du 22/09 — la Direction des opérations est sautée", async () => {
    // Ce qui le ferait tomber : appliquer la décision du 28/09 à toutes les natures. Elle a été
    // prise pour le sponsoring ; les congrès et les événements gardent le National Sales seul.
    const inst = await ensureInstance("CONGRESS_NATIONAL", congresId);
    expect(inst?.skippedSlugs).toEqual(["final"]);
  });

  it("de bout en bout : National Sales → [porte du DG] → Direction des opérations → Direction Marketing", async () => {
    const pre = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "SPONSORING", entityId: spoId, action: "APPROVE", note: "OK National Sales" });
    expect(pre.ok, pre.ok ? "" : pre.error).toBe(true);
    await passerLaPorteDuDg();
    const apresNs = await ensureInstance("SPONSORING", spoId);
    expect(apresNs?.currentSlug, "après le National Sales : la Direction des opérations, PAS encore la Direction Marketing").toBe("final");

    const dir = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "SPONSORING", entityId: spoId, action: "APPROVE", note: "OK Direction des opérations" });
    expect(dir.ok, dir.ok ? "" : dir.error).toBe(true);
    const apresDir = await ensureInstance("SPONSORING", spoId);
    expect(apresDir?.currentSlug, "puis la Direction Marketing, qui pré-valide ou refuse la tenue").toBe("marketing");
    expect(apresDir?.status).toBe("IN_PROGRESS");

    // LA TRACE : les deux validations sont écrites à leur nom — un filtre franchi sans trace ne
    // se relirait pas.
    const approuvees = await prisma.workflowStepEvent.findMany({
      where: { instanceId: apresDir!.id, action: "APPROVE" }, select: { stepSlug: true }, orderBy: { createdAt: "asc" },
    });
    expect(approuvees.map((e) => e.stepSlug)).toEqual(expect.arrayContaining(["preliminary", "final"]));
  });
});
