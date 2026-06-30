import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { canManageEnvelopes, type SessionUser } from "@/lib/rbac";

/** Une enveloppe est visible d'un non-gestionnaire seulement si son rôle figure
 *  dans `accessRoles` (la Direction des opérations ne voit que celles ouvertes). */
function envelopeVisible(user: SessionUser, accessRoles: string[]): boolean {
  return canManageEnvelopes(user) || accessRoles.includes(user.role);
}

/**
 * Budget « enveloppe » : un total défini par la Direction, réparti en catégories,
 * dont la consommation est calculée à partir des dépenses réelles
 * (FinanceTransaction OUT) attribuées à chaque catégorie, sur une période choisie.
 */

export type BudgetHealth = "ON_TRACK" | "AT_RISK" | "OVER_BUDGET" | "NONE";

export interface BudgetCategoryView {
  id: string;
  name: string;
  module: string | null;
  color: string | null;
  notes: string | null;
  allocated: number;
  consumed: number;
  committed: number;
  remaining: number;
  pct: number;
  health: BudgetHealth;
}

export interface UnattributedTx {
  id: string;
  reference: string;
  date: string;
  label: string;
  amount: number;
  category: string;
  counterparty: string | null;
  status: string;
}

export interface BudgetEnvelopeOption {
  id: string;
  name: string;
  module: string | null;
  modules: string[];
  accessRoles: string[];
  periodStart: string;
  periodEnd: string;
  total: number;
  isActive: boolean;
}

export interface BudgetOverview {
  envelope: { id: string; name: string; module: string | null; modules: string[]; accessRoles: string[]; periodStart: string; periodEnd: string; total: number; notes: string | null; isActive: boolean };
  period: { from: string; to: string };
  categories: BudgetCategoryView[];
  totals: { total: number; allocated: number; unallocated: number; consumed: number; committed: number; remaining: number; pct: number };
  unattributed: { total: number; count: number; transactions: UnattributedTx[] };
}

function health(allocated: number, consumed: number): BudgetHealth {
  if (allocated <= 0) return "NONE";
  const pct = consumed / allocated;
  if (pct >= 1) return "OVER_BUDGET";
  if (pct >= 0.8) return "AT_RISK";
  return "ON_TRACK";
}

export async function getEnvelopes(viewer: SessionUser): Promise<BudgetEnvelopeOption[]> {
  const list = await prisma.budgetEnvelope.findMany({ orderBy: [{ isActive: "desc" }, { periodStart: "desc" }] });
  return list
    .filter((e) => envelopeVisible(viewer, e.accessRoles))
    .map((e) => ({ id: e.id, name: e.name, module: e.module, modules: e.modules, accessRoles: e.accessRoles, periodStart: e.periodStart.toISOString(), periodEnd: e.periodEnd.toISOString(), total: toNumber(e.totalAmount), isActive: e.isActive }));
}

/** Synthèse budgétaire d'une enveloppe sur une période (par défaut la période de l'enveloppe). */
export async function getBudgetOverview(
  viewer: SessionUser,
  envelopeId: string | null,
  fromArg?: Date | null,
  toArg?: Date | null,
): Promise<BudgetOverview | null> {
  const envelope = envelopeId
    ? await prisma.budgetEnvelope.findUnique({ where: { id: envelopeId }, include: { categories: { orderBy: { name: "asc" } } } })
    : await prisma.budgetEnvelope.findFirst({ where: { isActive: true }, orderBy: { periodStart: "desc" }, include: { categories: { orderBy: { name: "asc" } } } });
  if (!envelope) return null;
  // Accès : un non-gestionnaire ne peut ouvrir qu'une enveloppe qui lui est ouverte.
  if (!envelopeVisible(viewer, envelope.accessRoles)) return null;

  const from = fromArg ?? envelope.periodStart;
  const to = toArg ?? envelope.periodEnd;

  const sums = await prisma.financeTransaction.groupBy({
    by: ["budgetCategoryId", "status"],
    where: { direction: "OUT", date: { gte: from, lte: to }, status: { in: ["SETTLED", "PENDING"] } },
    _sum: { amount: true },
  });

  const consumedByCat = new Map<string | null, number>();
  const committedByCat = new Map<string | null, number>();
  for (const s of sums) {
    const amt = toNumber(s._sum.amount);
    const map = s.status === "SETTLED" ? consumedByCat : committedByCat;
    map.set(s.budgetCategoryId, (map.get(s.budgetCategoryId) ?? 0) + amt);
  }

  const categories: BudgetCategoryView[] = envelope.categories.map((c) => {
    const allocated = toNumber(c.allocated);
    const consumed = consumedByCat.get(c.id) ?? 0;
    const committed = committedByCat.get(c.id) ?? 0;
    return {
      id: c.id, name: c.name, module: c.module, color: c.color, notes: c.notes,
      allocated, consumed, committed,
      remaining: allocated - consumed,
      pct: allocated > 0 ? Math.round((consumed / allocated) * 100) : 0,
      health: health(allocated, consumed),
    };
  });

  const total = toNumber(envelope.totalAmount);
  const allocated = categories.reduce((a, c) => a + c.allocated, 0);
  const consumedTotal = [...consumedByCat.values()].reduce((a, v) => a + v, 0);
  const committedTotal = [...committedByCat.values()].reduce((a, v) => a + v, 0);
  const unattributedTotal = consumedByCat.get(null) ?? 0;

  const unattributedTx = await prisma.financeTransaction.findMany({
    where: { direction: "OUT", budgetCategoryId: null, date: { gte: from, lte: to } },
    orderBy: { date: "desc" },
    take: 30,
    select: { id: true, reference: true, date: true, label: true, amount: true, category: true, counterparty: true, status: true },
  });

  return {
    envelope: { id: envelope.id, name: envelope.name, module: envelope.module, modules: envelope.modules, accessRoles: envelope.accessRoles, periodStart: envelope.periodStart.toISOString(), periodEnd: envelope.periodEnd.toISOString(), total, notes: envelope.notes, isActive: envelope.isActive },
    period: { from: from.toISOString(), to: to.toISOString() },
    categories,
    totals: {
      total, allocated, unallocated: total - allocated,
      consumed: consumedTotal, committed: committedTotal,
      remaining: total - consumedTotal,
      pct: total > 0 ? Math.round((consumedTotal / total) * 100) : 0,
    },
    unattributed: {
      total: unattributedTotal,
      count: unattributedTx.length,
      transactions: unattributedTx.map((t) => ({
        id: t.id, reference: t.reference, date: t.date.toISOString(), label: t.label,
        amount: toNumber(t.amount), category: t.category, counterparty: t.counterparty, status: t.status,
      })),
    },
  };
}
