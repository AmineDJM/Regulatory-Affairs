import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { getBudgetOverview } from "@/lib/queries/budget";
import { addBudgetExpense } from "./budget-envelope-actions";

/**
 * Ajout rapide d'une ligne de dépense depuis le module Budget (référence + montant) : crée une
 * dépense RÉELLE (OUT, réglée) imputée à la catégorie → la CONSOMMATION se met à jour aussitôt.
 * Contrôles : référence/montant obligatoires, montant positif, et droit d'imputer (accès budget).
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__budexp__${Date.now()}`;
let envId = "", catId = "", adminId = "", salesId = "";

async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}
function form(extra: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

suite("addBudgetExpense — dépense rapide qui consomme un budget", () => {
  beforeAll(async () => {
    adminId = (await prisma.user.create({ data: { name: `${TAG}a`, email: `${TAG}a@t.dz`, passwordHash: "x", role: "SUPER_ADMIN" } })).id;
    salesId = (await prisma.user.create({ data: { name: `${TAG}s`, email: `${TAG}s@t.dz`, passwordHash: "x", role: "SALES_USER" } })).id;
    const env = await prisma.budgetEnvelope.create({
      data: {
        name: TAG, modules: ["SPONSORING"], periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-12-31"), totalAmount: 1000,
        categories: { create: [{ name: "Promotion", module: "SPONSORING", allocated: 1000 }] },
      },
      include: { categories: true },
    });
    envId = env.id;
    catId = env.categories[0].id;
  });

  afterAll(async () => {
    await prisma.financeTransaction.deleteMany({ where: { label: { startsWith: TAG } } }).catch(() => {});
    await prisma.budgetEnvelope.deleteMany({ where: { name: TAG } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("crée une dépense OUT réglée imputée à la catégorie → consommation reflétée", async () => {
    ACTOR = await actorFor(adminId, "SUPER_ADMIN");
    const r = await addBudgetExpense(form({ budgetCategoryId: catId, reference: `${TAG} Facture 042`, amount: "300" }));
    expect(r.ok).toBe(true);

    const txs = await prisma.financeTransaction.findMany({ where: { budgetCategoryId: catId } });
    expect(txs).toHaveLength(1);
    expect(txs[0].direction).toBe("OUT");
    expect(txs[0].status).toBe("SETTLED"); // réglée → comptée comme consommée
    expect(Number(txs[0].amount)).toBe(300);
    expect(txs[0].label).toBe(`${TAG} Facture 042`);
    expect(txs[0].reference).toMatch(/^FIN-\d{4}-/); // référence interne unique auto-générée

    const ov = await getBudgetOverview(ACTOR, envId);
    const cat = ov!.categories.find((c) => c.id === catId)!;
    expect(cat.consumed).toBe(300);
    expect(ov!.attributed.transactions.some((t) => t.amount === 300)).toBe(true);
  });

  it("refuse une saisie incomplète ou un montant non positif", async () => {
    ACTOR = await actorFor(adminId, "SUPER_ADMIN");
    expect((await addBudgetExpense(form({ budgetCategoryId: catId, amount: "100" }))).ok).toBe(false); // pas de référence
    expect((await addBudgetExpense(form({ budgetCategoryId: catId, reference: "X" }))).ok).toBe(false); // pas de montant
    expect((await addBudgetExpense(form({ reference: "X", amount: "100" }))).ok).toBe(false); // pas de catégorie
    expect((await addBudgetExpense(form({ budgetCategoryId: catId, reference: "X", amount: "-5" }))).ok).toBe(false); // négatif
  });

  it("refuse un utilisateur sans droit sur le budget", async () => {
    ACTOR = await actorFor(salesId, "SALES_USER");
    const r = await addBudgetExpense(form({ budgetCategoryId: catId, reference: `${TAG} X`, amount: "100" }));
    expect(r.ok).toBe(false);
  });
});
