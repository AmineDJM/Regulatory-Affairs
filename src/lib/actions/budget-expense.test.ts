import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { getBudgetOverview } from "@/lib/queries/budget";
import { addBudgetExpense, deleteBudgetExpense } from "./budget-envelope-actions";

/**
 * Ajout rapide d'une ligne de dépense depuis le module Budget (référence + montant) : crée une
 * ligne PUREMENT BUDGÉTAIRE (BudgetExpenseLine) imputée à la catégorie → la CONSOMMATION se met
 * à jour aussitôt, SANS créer de mouvement de trésorerie (aucune FinanceTransaction). Elle est
 * ensuite SUPPRIMABLE (la consommation est réajustée). Contrôles : référence/montant obligatoires,
 * montant positif, et droit d'imputer (accès budget).
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

suite("addBudgetExpense — dépense budgétaire (découplée des Finances) qui consomme un budget", () => {
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
    await prisma.budgetEnvelope.deleteMany({ where: { name: TAG } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("crée une ligne budgétaire (sans FinanceTransaction) → consommation reflétée", async () => {
    ACTOR = await actorFor(adminId, "SUPER_ADMIN");
    const r = await addBudgetExpense(form({ budgetCategoryId: catId, reference: `${TAG} Facture 042`, amount: "300" }));
    expect(r.ok).toBe(true);

    // Ligne purement budgétaire créée…
    const lines = await prisma.budgetExpenseLine.findMany({ where: { categoryId: catId } });
    expect(lines).toHaveLength(1);
    expect(Number(lines[0].amount)).toBe(300);
    expect(lines[0].reference).toBe(`${TAG} Facture 042`);

    // …et AUCUN mouvement de trésorerie (découplage strict des Finances).
    const txs = await prisma.financeTransaction.findMany({ where: { budgetCategoryId: catId } });
    expect(txs).toHaveLength(0);

    const ov = await getBudgetOverview(ACTOR, envId);
    const cat = ov!.categories.find((c) => c.id === catId)!;
    expect(cat.consumed).toBe(300);
    const attributed = ov!.attributed.transactions.find((t) => t.amount === 300);
    expect(attributed?.kind).toBe("BUDGET");
  });

  it("supprime la ligne → la consommation revient à zéro", async () => {
    ACTOR = await actorFor(adminId, "SUPER_ADMIN");
    const line = await prisma.budgetExpenseLine.findFirstOrThrow({ where: { categoryId: catId } });
    const r = await deleteBudgetExpense(form({ id: line.id }));
    expect(r.ok).toBe(true);
    expect(await prisma.budgetExpenseLine.count({ where: { categoryId: catId } })).toBe(0);

    const ov = await getBudgetOverview(ACTOR, envId);
    const cat = ov!.categories.find((c) => c.id === catId)!;
    expect(cat.consumed).toBe(0);
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
