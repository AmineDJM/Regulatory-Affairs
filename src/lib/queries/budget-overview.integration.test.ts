import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getBudgetOverview } from "./budget";
import type { SessionUser } from "@/lib/rbac";

/**
 * NON-RÉGRESSION DU CONSOMMÉ D'UNE ENVELOPPE — le bug réel : le regroupement des dépenses
 * n'était pas filtré sur les catégories de l'enveloppe consultée. Le « consommé » d'Ad & Pro
 * additionnait donc les dépenses de TOUTES les enveloppes **et** les dépenses encore NON
 * IMPUTÉES, affichant des dizaines de millions jamais dépensés sur ce périmètre.
 *
 * Ce test pose le décor minimal — deux enveloppes voisines + une dépense sans catégorie — et
 * exige que chaque enveloppe ne compte QUE la sienne.
 */

const TAG = `test-budget-${Date.now()}`;
let envAId = "";
let envBId = "";
let catAId = "";
let catBId = "";

const SUPER: SessionUser = { id: `${TAG}-admin`, role: "SUPER_ADMIN", access: {} as SessionUser["access"] };

const PERIOD_START = new Date("2026-01-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-12-31T00:00:00.000Z");
const DAY = new Date("2026-03-15T00:00:00.000Z");

async function tx(reference: string, amount: number, budgetCategoryId: string | null, status: "SETTLED" | "PENDING" = "SETTLED") {
  await prisma.financeTransaction.create({
    data: {
      reference, date: DAY, direction: "OUT", category: "EVENEMENT", label: reference,
      amount, status, budgetCategoryId,
    },
  });
}

describe("getBudgetOverview — le consommé d'une enveloppe ne compte QUE ses catégories", () => {
  beforeAll(async () => {
    const envA = await prisma.budgetEnvelope.create({
      data: { name: `${TAG}-AdPro`, modules: ["SPONSORING"], periodStart: PERIOD_START, periodEnd: PERIOD_END, totalAmount: 1_000_000, isActive: true },
      select: { id: true },
    });
    const envB = await prisma.budgetEnvelope.create({
      data: { name: `${TAG}-Autre`, modules: ["REGULATORY"], periodStart: PERIOD_START, periodEnd: PERIOD_END, totalAmount: 90_000_000, isActive: true },
      select: { id: true },
    });
    envAId = envA.id;
    envBId = envB.id;
    catAId = (await prisma.budgetCategoryLine.create({ data: { envelopeId: envAId, name: "Événement", allocated: 800_000 }, select: { id: true } })).id;
    catBId = (await prisma.budgetCategoryLine.create({ data: { envelopeId: envBId, name: "Divers", allocated: 80_000_000 }, select: { id: true } })).id;

    await tx(`${TAG}-a1`, 120_000, catAId); // dépense de l'enveloppe A (réglée)
    await tx(`${TAG}-a2`, 30_000, catAId, "PENDING"); // engagée sur A (pas consommée)
    await tx(`${TAG}-b1`, 42_000_000, catBId); // l'énorme dépense de l'enveloppe VOISINE
    await tx(`${TAG}-none`, 7_000_000, null); // dépense encore NON IMPUTÉE
  });

  afterAll(async () => {
    await prisma.financeTransaction.deleteMany({ where: { reference: { startsWith: TAG } } }).catch(() => undefined);
    await prisma.budgetEnvelope.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => undefined);
  });

  it("n'additionne NI les dépenses des autres enveloppes NI le non-imputé", async () => {
    const a = await getBudgetOverview(SUPER, envAId);
    expect(a).not.toBeNull();
    expect(a!.totals.consumed).toBe(120_000); // et non 120 000 + 42 000 000 + 7 000 000
    expect(a!.totals.committed).toBe(30_000);
    expect(a!.totals.remaining).toBe(1_000_000 - 120_000);
    expect(a!.categories.find((c) => c.id === catAId)?.consumed).toBe(120_000);
  });

  it("chaque enveloppe voit SA propre consommation", async () => {
    const b = await getBudgetOverview(SUPER, envBId);
    expect(b!.totals.consumed).toBe(42_000_000);
    expect(b!.categories.find((c) => c.id === catBId)?.consumed).toBe(42_000_000);
  });

  it("le non-imputé est remonté À PART (alerte « à imputer »), avec un total et un compte exacts", async () => {
    const a = await getBudgetOverview(SUPER, envAId);
    expect(a!.unattributed.total).toBeGreaterThanOrEqual(7_000_000);
    expect(a!.unattributed.count).toBeGreaterThanOrEqual(1);
    // Il n'entre PAS dans le consommé de l'enveloppe.
    expect(a!.totals.consumed).toBe(120_000);
  });
});
