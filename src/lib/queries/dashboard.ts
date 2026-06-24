import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import {
  userCan,
  scopeRegulatory,
  scopeSales,
  scopeMedicalVisits,
  scopeBusinessDevelopment,
  type SessionUser,
} from "@/lib/rbac";

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1);
}
function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86400000);
}
const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export async function getDashboardData(user: SessionUser) {
  const now = new Date();
  const result: {
    regulatory?: Awaited<ReturnType<typeof regulatorySection>>;
    logistics?: Awaited<ReturnType<typeof logisticsSection>>;
    sales?: Awaited<ReturnType<typeof salesSection>>;
    sponsoring?: Awaited<ReturnType<typeof sponsoringSection>>;
    budgets?: Awaited<ReturnType<typeof budgetsSection>>;
    medical?: Awaited<ReturnType<typeof medicalSection>>;
    bd?: Awaited<ReturnType<typeof bdSection>>;
    congress?: Awaited<ReturnType<typeof congressSection>>;
  } = {};

  const tasks: Promise<void>[] = [];

  if (userCan(user, "REGULATORY", "VIEW"))
    tasks.push(regulatorySection(user, now).then((r) => void (result.regulatory = r)));
  if (userCan(user, "LOGISTICS", "VIEW"))
    tasks.push(logisticsSection(now).then((r) => void (result.logistics = r)));
  if (userCan(user, "SALES", "VIEW"))
    tasks.push(salesSection(user).then((r) => void (result.sales = r)));
  if (userCan(user, "SPONSORING", "VIEW"))
    tasks.push(sponsoringSection().then((r) => void (result.sponsoring = r)));
  if (userCan(user, "BUDGETS", "VIEW"))
    tasks.push(budgetsSection().then((r) => void (result.budgets = r)));
  if (userCan(user, "MEDICAL", "VIEW"))
    tasks.push(medicalSection(user, now).then((r) => void (result.medical = r)));
  if (userCan(user, "BUSINESS_DEVELOPMENT", "VIEW"))
    tasks.push(bdSection(user).then((r) => void (result.bd = r)));
  if (
    userCan(user, "CONGRESS_INTERNATIONAL", "VIEW") ||
    userCan(user, "CONGRESS_NATIONAL", "VIEW")
  )
    tasks.push(congressSection(user, now).then((r) => void (result.congress = r)));

  await Promise.all(tasks);
  return result;
}

async function regulatorySection(user: SessionUser, now: Date) {
  const where = scopeRegulatory(user);
  const [byStatus, total, late] = await Promise.all([
    prisma.regulatoryProduct.groupBy({ by: ["status"], where, _count: true }),
    prisma.regulatoryProduct.count({ where }),
    prisma.regulatoryProduct.count({
      where: {
        ...where,
        targetDate: { lt: now },
        status: { notIn: ["DECISION_OBTAINED", "CLOSED"] },
      },
    }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  return {
    total,
    preSubmission: count("PRE_SUBMISSION"),
    submitted: count("SUBMITTED"),
    awaitingBV: count("AWAITING_BV_PAYMENT"),
    awaitingANPP: count("AWAITING_ANPP"),
    decisions: count("DECISION_OBTAINED") + count("CLOSED"),
    blocked: count("BLOCKED"),
    late,
    byStatus: byStatus.map((b) => ({ status: b.status, count: b._count as number })),
  };
}

async function logisticsSection(now: Date) {
  const weekAhead = addDays(now, 7);
  const [inProgress, arrivingThisWeek, lateOrders, pchPlanned, valueAgg] = await Promise.all([
    prisma.logisticsOrder.count({ where: { status: { notIn: ["DELIVERED", "BLOCKED"] } } }),
    prisma.logisticsOrder.count({
      where: { estimatedArrival: { gte: now, lte: weekAhead }, status: { not: "DELIVERED" } },
    }),
    prisma.logisticsOrder.count({
      where: { estimatedArrival: { lt: now }, status: { notIn: ["DELIVERED"] } },
    }),
    prisma.logisticsOrder.count({ where: { pchDeliveryDate: { gte: now } } }),
    prisma.logisticsOrder.aggregate({ _sum: { orderValue: true } }),
  ]);
  return {
    inProgress,
    arrivingThisWeek,
    lateOrders,
    pchPlanned,
    totalValue: toNumber(valueAgg._sum.orderValue),
  };
}

async function salesSection(user: SessionUser) {
  const where = scopeSales(user);
  const yearStart = startOfYear();
  const monthStart = startOfMonth();
  const rows = await prisma.sale.findMany({
    where: { ...where, date: { gte: yearStart } },
    select: { date: true, revenue: true, isPch: true, product: true, client: true },
  });
  let caYear = 0;
  let caMonth = 0;
  let pchRevenue = 0;
  const monthly = new Array(12).fill(0);
  const byProduct = new Map<string, number>();
  for (const r of rows) {
    const rev = toNumber(r.revenue);
    caYear += rev;
    monthly[r.date.getMonth()] += rev;
    if (r.date >= monthStart) caMonth += rev;
    if (r.isPch) pchRevenue += rev;
    byProduct.set(r.product, (byProduct.get(r.product) ?? 0) + rev);
  }
  const currentMonth = new Date().getMonth();
  const monthlySeries = [];
  for (let i = 5; i >= 0; i--) {
    const idx = (currentMonth - i + 12) % 12;
    monthlySeries.push({ label: MONTHS_FR[idx], value: Math.round(monthly[idx]) });
  }
  const topProducts = [...byProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value: Math.round(value) }));
  return { caYear, caMonth, pchRevenue, orders: rows.length, monthlySeries, topProducts };
}

async function sponsoringSection() {
  const [pending, accepted, grantedAgg] = await Promise.all([
    prisma.sponsoringRequest.count({
      where: { status: { in: ["RECEIVED", "IN_ANALYSIS", "AWAITING_DIRECTION"] } },
    }),
    prisma.sponsoringRequest.count({ where: { status: { in: ["ACCEPTED", "PAID"] } } }),
    prisma.sponsoringRequest.aggregate({
      _sum: { amountGranted: true },
      where: { status: { in: ["ACCEPTED", "PAID"] } },
    }),
  ]);
  return { pending, accepted, granted: toNumber(grantedAgg._sum.amountGranted) };
}

async function budgetsSection() {
  const year = new Date().getFullYear();
  const grouped = await prisma.budgetLine.groupBy({
    by: ["department"],
    where: { year },
    _sum: { initialBudget: true, consumedBudget: true },
  });
  const totals = grouped.reduce(
    (acc, g) => {
      acc.initial += toNumber(g._sum.initialBudget);
      acc.consumed += toNumber(g._sum.consumedBudget);
      return acc;
    },
    { initial: 0, consumed: 0 },
  );
  return {
    initial: totals.initial,
    consumed: totals.consumed,
    remaining: totals.initial - totals.consumed,
    byDepartment: grouped.map((g) => ({
      label: g.department,
      initial: toNumber(g._sum.initialBudget),
      consumed: toNumber(g._sum.consumedBudget),
    })),
  };
}

async function medicalSection(user: SessionUser, now: Date) {
  const where = scopeMedicalVisits(user);
  const monthStart = startOfMonth();
  const [planned, completed, upcoming] = await Promise.all([
    prisma.medicalVisit.count({ where: { ...where, status: "PLANNED" } }),
    prisma.medicalVisit.count({
      where: { ...where, status: "COMPLETED", date: { gte: monthStart } },
    }),
    prisma.medicalVisit.count({ where: { ...where, status: "PLANNED", date: { gte: now } } }),
  ]);
  return { planned, completed, upcoming };
}

async function bdSection(user: SessionUser) {
  const where = scopeBusinessDevelopment(user);
  const [inProgress, priority, byStatus] = await Promise.all([
    prisma.businessDevelopmentOpportunity.count({
      where: { ...where, status: { notIn: ["VALIDATED", "ABANDONED"] } },
    }),
    prisma.businessDevelopmentOpportunity.count({
      where: { ...where, priority: { in: ["HIGH", "CRITICAL"] } },
    }),
    prisma.businessDevelopmentOpportunity.groupBy({ by: ["status"], where, _count: true }),
  ]);
  return {
    inProgress,
    priority,
    byStatus: byStatus.map((b) => ({ status: b.status, count: b._count as number })),
  };
}

async function congressSection(user: SessionUser, now: Date) {
  const tasks: Promise<number>[] = [];
  if (userCan(user, "CONGRESS_INTERNATIONAL", "VIEW")) {
    tasks.push(
      prisma.congressInternational.count({
        where: { startDate: { gte: now }, status: { not: "CANCELLED" } },
      }),
    );
  } else tasks.push(Promise.resolve(0));
  if (userCan(user, "CONGRESS_NATIONAL", "VIEW")) {
    tasks.push(
      prisma.congressNational.count({ where: { date: { gte: now }, status: { not: "CANCELLED" } } }),
    );
  } else tasks.push(Promise.resolve(0));
  const [intl, national] = await Promise.all(tasks);
  return { upcomingInternational: intl, upcomingNational: national, upcoming: intl + national };
}
