import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { canManageEnvelopes, type SessionUser } from "@/lib/rbac";

/** Une enveloppe est visible d'un non-gestionnaire seulement si le Super Admin l'a
 *  ouverte à son rôle (`accessRoles`) ou à lui personnellement (`accessUserIds`). */
function envelopeVisible(user: SessionUser, accessRoles: string[], accessUserIds: string[] = []): boolean {
  return canManageEnvelopes(user) || accessRoles.includes(user.role) || accessUserIds.includes(user.id);
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
  parentId: string | null;
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
  accessUserIds: string[];
  periodStart: string;
  periodEnd: string;
  total: number;
  isActive: boolean;
}

/** Ligne d'une enveloppe dans la vue consolidée (« total des enveloppes »). */
export interface EnvelopeSummaryItem {
  id: string;
  name: string;
  isActive: boolean;
  modules: string[];
  total: number;
  allocated: number;
  consumed: number;
  remaining: number;
}

export interface EnvelopesGrandTotal {
  count: number;
  total: number;
  allocated: number;
  consumed: number;
  remaining: number;
  items: EnvelopeSummaryItem[];
}

export interface BudgetOverview {
  envelope: { id: string; name: string; module: string | null; modules: string[]; accessRoles: string[]; accessUserIds: string[]; periodStart: string; periodEnd: string; total: number; notes: string | null; isActive: boolean };
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
    .filter((e) => envelopeVisible(viewer, e.accessRoles, e.accessUserIds))
    .map((e) => ({ id: e.id, name: e.name, module: e.module, modules: e.modules, accessRoles: e.accessRoles, accessUserIds: e.accessUserIds, periodStart: e.periodStart.toISOString(), periodEnd: e.periodEnd.toISOString(), total: toNumber(e.totalAmount), isActive: e.isActive }));
}

/**
 * Vue consolidée « total des enveloppes » : agrège TOUTES les enveloppes que le
 * spectateur est autorisé à voir (le gestionnaire les voit toutes ; les autres ne
 * voient que celles ouvertes par le Super Admin à leur rôle ou à eux-mêmes). La
 * consommation par enveloppe est la somme des dépenses réelles (OUT réglées)
 * attribuées à ses catégories. L'alloué ne compte que les catégories de 1er niveau.
 */
export async function getEnvelopesGrandTotal(viewer: SessionUser): Promise<EnvelopesGrandTotal> {
  const envelopes = await prisma.budgetEnvelope.findMany({
    orderBy: [{ isActive: "desc" }, { periodStart: "desc" }],
    include: { categories: { select: { id: true, allocated: true, parentId: true } } },
  });
  const visible = envelopes.filter((e) => envelopeVisible(viewer, e.accessRoles, e.accessUserIds));

  const catIds = visible.flatMap((e) => e.categories.map((c) => c.id));
  const sums = catIds.length
    ? await prisma.financeTransaction.groupBy({
        by: ["budgetCategoryId"],
        where: { direction: "OUT", status: "SETTLED", budgetCategoryId: { in: catIds } },
        _sum: { amount: true },
      })
    : [];
  const consumedByCat = new Map<string | null, number>(sums.map((s) => [s.budgetCategoryId, toNumber(s._sum.amount)]));

  const items: EnvelopeSummaryItem[] = visible.map((e) => {
    const total = toNumber(e.totalAmount);
    const allocated = e.categories.filter((c) => c.parentId === null).reduce((a, c) => a + toNumber(c.allocated), 0);
    const consumed = e.categories.reduce((a, c) => a + (consumedByCat.get(c.id) ?? 0), 0);
    return { id: e.id, name: e.name, isActive: e.isActive, modules: e.modules, total, allocated, consumed, remaining: total - consumed };
  });

  const total = items.reduce((a, i) => a + i.total, 0);
  const allocated = items.reduce((a, i) => a + i.allocated, 0);
  const consumed = items.reduce((a, i) => a + i.consumed, 0);
  return { count: items.length, total, allocated, consumed, remaining: total - consumed, items };
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
  if (!envelopeVisible(viewer, envelope.accessRoles, envelope.accessUserIds)) return null;

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
      id: c.id, name: c.name, module: c.module, parentId: c.parentId, color: c.color, notes: c.notes,
      allocated, consumed, committed,
      remaining: allocated - consumed,
      pct: allocated > 0 ? Math.round((consumed / allocated) * 100) : 0,
      health: health(allocated, consumed),
    };
  });

  const total = toNumber(envelope.totalAmount);
  // L'alloué de l'enveloppe ne compte que les catégories de 1er niveau (les
  // sous-catégories sont une répartition À L'INTÉRIEUR de leur catégorie parente).
  const allocated = categories.filter((c) => c.parentId === null).reduce((a, c) => a + c.allocated, 0);
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
    envelope: { id: envelope.id, name: envelope.name, module: envelope.module, modules: envelope.modules, accessRoles: envelope.accessRoles, accessUserIds: envelope.accessUserIds, periodStart: envelope.periodStart.toISOString(), periodEnd: envelope.periodEnd.toISOString(), total, notes: envelope.notes, isActive: envelope.isActive },
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
