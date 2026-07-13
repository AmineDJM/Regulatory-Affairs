import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBudgetCategoryOptions } from "@/lib/queries/budget";
import type { SessionUser } from "@/lib/rbac";

/**
 * Options de (sous-)catégories budgétaires à la validation : RESTREINTES aux enveloppes
 * ACCESSIBLES au décideur (ouvertes par le Super Admin). La Direction ne voit que les
 * siennes ; un rôle non autorisé n'en voit aucune ; le Super Admin les voit toutes.
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__budaccess__${Date.now()}`;
let envId = "";

const mkUser = (role: UserRole, id = role): SessionUser => ({
  id, role, access: { modules: new Map(), rowGrants: new Map(), secondaryRole: null },
});

suite("getBudgetCategoryOptions — restreint aux enveloppes accessibles", () => {
  beforeAll(async () => {
    envId = (await prisma.budgetEnvelope.create({
      data: {
        name: TAG, modules: ["SPONSORING"], accessRoles: ["DIRECTION"], accessUserIds: [],
        periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-12-31"), totalAmount: 1000,
        categories: { create: [{ name: "Promotion", module: "SPONSORING", allocated: 1000 }] },
      },
      select: { id: true },
    })).id;
  });
  afterAll(async () => {
    await prisma.budgetEnvelope.deleteMany({ where: { name: TAG } }).catch(() => {});
  });

  const mine = (opts: { label: string }[]) => opts.filter((o) => o.label.startsWith(TAG));

  it("la Direction (enveloppe ouverte à son rôle) voit la catégorie", async () => {
    const opts = await getBudgetCategoryOptions(undefined, mkUser("DIRECTION"));
    expect(mine(opts).some((o) => o.label.includes("Promotion"))).toBe(true);
  });

  it("un rôle NON autorisé ne voit pas l'enveloppe", async () => {
    const opts = await getBudgetCategoryOptions(undefined, mkUser("SALES_USER"));
    expect(mine(opts)).toHaveLength(0);
  });

  it("le Super Admin voit toutes les enveloppes", async () => {
    const opts = await getBudgetCategoryOptions(undefined, mkUser("SUPER_ADMIN"));
    expect(mine(opts).some((o) => o.label.includes("Promotion"))).toBe(true);
  });

  it("sans viewer (contexte serveur) → non filtré (rétrocompatible)", async () => {
    const opts = await getBudgetCategoryOptions();
    expect(mine(opts).some((o) => o.label.includes("Promotion"))).toBe(true);
  });
});
