import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getBudgetOverview } from "./budget";
import { generalMeansConsumption } from "./budget-general-means";
import type { SessionUser } from "@/lib/rbac";

/**
 * LES ACHATS DU QUOTIDIEN ARRIVENT DANS LE BUDGET — de bout en bout, sur une vraie base.
 *
 * L'enveloppe « Moyens généraux » restait vide alors que l'assistante enregistrait des tickets
 * toute l'année : les deux modules ne se parlaient pas. Ce test pose le décor réel — un
 * département, une enveloppe, un ticket à plusieurs articles classés séparément — et exige que
 * la page Budgets en rende compte exactement, y compris quand un même ticket se partage entre
 * deux catégories.
 */

const TAG = `test-gm-budget-${Date.now()}`;
const SUPER: SessionUser = { id: `${TAG}-admin`, role: "SUPER_ADMIN", access: {} as SessionUser["access"] };

const PERIOD_START = new Date("2026-01-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-12-31T00:00:00.000Z");
const DAY = new Date("2026-04-10T00:00:00.000Z");

let envId = "";
let papeterieId = "";
let transportId = "";
let departmentId = "";

describe("Moyens généraux → Budget : le ticket de caisse consomme l'enveloppe", () => {
  beforeAll(async () => {
    const env = await prisma.budgetEnvelope.create({
      data: {
        name: `${TAG}-MoyensGeneraux`, modules: ["GENERAL_MEANS"],
        periodStart: PERIOD_START, periodEnd: PERIOD_END, totalAmount: 1_000_000, isActive: true,
      },
      select: { id: true },
    });
    envId = env.id;
    papeterieId = (await prisma.budgetCategoryLine.create({
      data: { envelopeId: envId, name: "Papeterie", allocated: 600_000 }, select: { id: true },
    })).id;
    transportId = (await prisma.budgetCategoryLine.create({
      data: { envelopeId: envId, name: "Transport", allocated: 400_000 }, select: { id: true },
    })).id;

    departmentId = (await prisma.department.create({
      data: { name: `${TAG}-Direction`, code: `${TAG}-dir` }, select: { id: true },
    })).id;

    // Un ticket de 10 000 : 6 000 de papeterie classés à l'article, le RESTE sur le ticket.
    await prisma.departmentBudgetExpense.create({
      data: {
        departmentId, year: 2026, kind: "OPERATING", label: `${TAG}-courses`,
        amount: 10_000, date: DAY, budgetCategoryId: transportId,
        lines: { create: [{ label: "Ramettes", quantity: 10, amount: 6_000, budgetCategoryId: papeterieId }] },
      },
    });
    // Un achat classé d'un bloc, sans détail.
    await prisma.departmentBudgetExpense.create({
      data: {
        departmentId, year: 2026, kind: "OPERATING", label: `${TAG}-taxi`,
        amount: 2_500, date: DAY, budgetCategoryId: transportId,
      },
    });
    // Un achat NON classé : il ne doit entrer dans aucune enveloppe.
    await prisma.departmentBudgetExpense.create({
      data: { departmentId, year: 2026, kind: "OPERATING", label: `${TAG}-orphelin`, amount: 9_999, date: DAY },
    });
  });

  afterAll(async () => {
    await prisma.departmentBudgetExpense.deleteMany({ where: { departmentId } }).catch(() => undefined);
    await prisma.department.deleteMany({ where: { id: departmentId } }).catch(() => undefined);
    await prisma.budgetEnvelope.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => undefined);
  });

  it("répartit un ticket entre l'article classé et le reste", async () => {
    const c = await generalMeansConsumption([papeterieId, transportId], PERIOD_START, PERIOD_END);
    expect(c.byCategory.get(papeterieId)).toBe(6_000);
    // 4 000 de reste sur le premier ticket + 2 500 du taxi.
    expect(c.byCategory.get(transportId)).toBe(6_500);
  });

  it("l'enveloppe affiche ces achats comme consommation", async () => {
    const o = await getBudgetOverview(SUPER, envId);
    expect(o).not.toBeNull();
    expect(o!.totals.consumed).toBe(12_500);
    expect(o!.categories.find((c) => c.id === papeterieId)?.consumed).toBe(6_000);
    expect(o!.categories.find((c) => c.id === transportId)?.consumed).toBe(6_500);
  });

  it("ne compte JAMAIS l'achat non classé — il n'appartient à aucune catégorie", async () => {
    const o = await getBudgetOverview(SUPER, envId);
    expect(o!.totals.consumed).toBe(12_500); // et non 22 499
  });

  it("les fait apparaître dans la liste des dépenses imputées, marquées comme telles", async () => {
    const o = await getBudgetOverview(SUPER, envId);
    const rows = o!.attributed.transactions.filter((t) => t.kind === "GENERAL_MEANS");
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.some((r) => r.label.includes("courses"))).toBe(true);
  });

  it("la courbe mensuelle raconte la même histoire que le compteur", async () => {
    const o = await getBudgetOverview(SUPER, envId);
    const total = o!.monthly.reduce((a, m) => a + m.consumed, 0);
    expect(total).toBe(o!.totals.consumed);
  });
});
