import { prisma } from "@/lib/prisma";
import {
  REGULATORY_STATUS, CONGRESS_REQUEST_STATUS, ADMIN_REQUEST_STATUS,
  SPONSORING_STATUS, TASK_STATUS, VALIDATION_STATUS,
} from "@/lib/labels";

/**
 * Process Intelligence — analyse des lenteurs et de la charge, à partir des
 * données déjà présentes : statut + updatedAt de chaque workflow (« sans action
 * depuis X jours ») et AuditLog (actions réalisées). Aucune instrumentation
 * supplémentaire requise ; la couverture s'affine à mesure que les modules
 * journalisent. Réservé au Super Admin (gardé par requireModule).
 */

const STUCK_DAYS = 14;
const DAY = 86_400_000;

function daysSince(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / DAY);
}

export interface WorkItem {
  key: string;
  moduleKey: string;
  moduleName: string;
  label: string;
  reference: string | null;
  statusLabel: string;
  ownerId: string | null;
  ownerName: string | null;
  ageDays: number;
  lastActivity: string;
  link: string;
  overdue: boolean;
}

export interface ModuleStat { moduleKey: string; moduleName: string; count: number; avgAge: number; stuck: number; overdue: number }
export interface StageStat { label: string; count: number; avgAge: number }
export interface PendingValidation { id: string; reference: string; title: string; validatorName: string | null; ageDays: number; link: string }
export interface PiAlert { level: "danger" | "warning" | "info"; title: string; detail: string; link: string }

export interface ProcessOverview {
  stats: { inProgress: number; stuck: number; overdue: number; validationsPending: number };
  topBlockers: WorkItem[];
  byModule: ModuleStat[];
  bottleneckStages: StageStat[];
  staleItems: WorkItem[];
  pendingValidations: PendingValidation[];
  alerts: PiAlert[];
  generatedAt: string;
}

async function userMap(): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name]));
}

const label = (map: Record<string, { label: string }>, k: string) => map[k]?.label ?? k;

async function collectWorkItems(users: Map<string, string>): Promise<WorkItem[]> {
  const now = Date.now();
  const owner = (...ids: (string | null | undefined)[]) => {
    const id = ids.find(Boolean) ?? null;
    return { ownerId: id, ownerName: id ? users.get(id) ?? null : null };
  };

  const [regs, ci, cn, admin, spons, vals, tasks] = await Promise.all([
    prisma.regulatoryProduct.findMany({
      where: { status: { notIn: ["DECISION_OBTAINED", "CLOSED"] } },
      select: { id: true, reference: true, brandName: true, dci: true, status: true, updatedAt: true, targetDate: true, responsibleId: true, assistantId: true },
    }),
    prisma.congressInternational.findMany({
      where: { requestStatus: { notIn: ["APPROVED", "REJECTED", "CANCELLED", "COMPLETED"] } },
      select: { id: true, name: true, requestStatus: true, updatedAt: true, productManagerId: true, requesterId: true },
    }),
    prisma.congressNational.findMany({
      where: { requestStatus: { notIn: ["APPROVED", "REJECTED", "CANCELLED", "COMPLETED"] } },
      select: { id: true, name: true, requestStatus: true, updatedAt: true, productManagerId: true, requesterId: true },
    }),
    prisma.administrativeRequest.findMany({
      where: { status: { notIn: ["DONE", "CANCELLED"] } },
      select: { id: true, reference: true, title: true, status: true, updatedAt: true, deadline: true, assignedToId: true, requesterId: true },
    }),
    prisma.sponsoringRequest.findMany({
      where: { status: { notIn: ["REFUSED", "PAID", "CLOSED"] } },
      select: { id: true, reference: true, institution: true, status: true, updatedAt: true, requesterId: true },
    }),
    prisma.validationRequest.findMany({
      where: { status: { in: ["PENDING", "CHANGES_REQUESTED"] } },
      select: { id: true, reference: true, title: true, status: true, updatedAt: true, deadline: true, requesterId: true, link: true },
    }),
    prisma.task.findMany({
      where: { status: { in: ["TODO", "IN_PROGRESS"] } },
      select: { id: true, title: true, status: true, updatedAt: true, dueDate: true, assignedToId: true },
    }),
  ]);

  const items: WorkItem[] = [];
  for (const r of regs) {
    const o = owner(r.responsibleId, r.assistantId);
    items.push({ key: `REG:${r.id}`, moduleKey: "REGULATORY", moduleName: "Regulatory", label: r.brandName || r.dci, reference: r.reference, statusLabel: label(REGULATORY_STATUS, r.status), ...o, ageDays: daysSince(r.updatedAt), lastActivity: r.updatedAt.toISOString(), link: `/regulatory/${r.id}`, overdue: Boolean(r.targetDate && r.targetDate.getTime() < now) });
  }
  for (const c of ci) {
    const o = owner(c.productManagerId, c.requesterId);
    items.push({ key: `CI:${c.id}`, moduleKey: "CONGRESS_INTERNATIONAL", moduleName: "Congrès int.", label: c.name, reference: null, statusLabel: label(CONGRESS_REQUEST_STATUS, c.requestStatus), ...o, ageDays: daysSince(c.updatedAt), lastActivity: c.updatedAt.toISOString(), link: `/congress-international/${c.id}`, overdue: false });
  }
  for (const c of cn) {
    const o = owner(c.productManagerId, c.requesterId);
    items.push({ key: `CN:${c.id}`, moduleKey: "CONGRESS_NATIONAL", moduleName: "Congrès nat.", label: c.name, reference: null, statusLabel: label(CONGRESS_REQUEST_STATUS, c.requestStatus), ...o, ageDays: daysSince(c.updatedAt), lastActivity: c.updatedAt.toISOString(), link: `/congress-national/${c.id}`, overdue: false });
  }
  for (const a of admin) {
    const o = owner(a.assignedToId, a.requesterId);
    items.push({ key: `ADM:${a.id}`, moduleKey: "ADMIN_REQUESTS", moduleName: "Demandes admin.", label: a.title, reference: a.reference, statusLabel: label(ADMIN_REQUEST_STATUS, a.status), ...o, ageDays: daysSince(a.updatedAt), lastActivity: a.updatedAt.toISOString(), link: `/demandes/${a.id}`, overdue: Boolean(a.deadline && a.deadline.getTime() < now) });
  }
  for (const s of spons) {
    const o = owner(s.requesterId);
    items.push({ key: `SPO:${s.id}`, moduleKey: "SPONSORING", moduleName: "Sponsoring", label: s.institution, reference: s.reference, statusLabel: label(SPONSORING_STATUS, s.status), ...o, ageDays: daysSince(s.updatedAt), lastActivity: s.updatedAt.toISOString(), link: `/sponsoring/${s.id}`, overdue: false });
  }
  for (const v of vals) {
    const o = owner(v.requesterId);
    items.push({ key: `VAL:${v.id}`, moduleKey: "VALIDATIONS", moduleName: "Validations", label: v.title, reference: v.reference, statusLabel: label(VALIDATION_STATUS, v.status), ...o, ageDays: daysSince(v.updatedAt), lastActivity: v.updatedAt.toISOString(), link: v.link || "/validations", overdue: Boolean(v.deadline && v.deadline.getTime() < now) });
  }
  for (const t of tasks) {
    const o = owner(t.assignedToId);
    items.push({ key: `TSK:${t.id}`, moduleKey: "WORKSPACE", moduleName: "Tâches", label: t.title, reference: null, statusLabel: label(TASK_STATUS, t.status), ...o, ageDays: daysSince(t.updatedAt), lastActivity: t.updatedAt.toISOString(), link: "/mon-travail", overdue: Boolean(t.dueDate && t.dueDate.getTime() < now) });
  }
  return items;
}

export async function getProcessOverview(): Promise<ProcessOverview> {
  const users = await userMap();
  const [items, pendingSteps] = await Promise.all([
    collectWorkItems(users),
    prisma.validationStep.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: { id: true, createdAt: true, validatorId: true, request: { select: { reference: true, title: true, link: true } } },
    }),
  ]);

  const stuck = items.filter((i) => i.ageDays >= STUCK_DAYS);
  const overdue = items.filter((i) => i.overdue);

  // Synthèse par module
  const moduleMap = new Map<string, { moduleName: string; ages: number[]; stuck: number; overdue: number }>();
  for (const i of items) {
    const m = moduleMap.get(i.moduleKey) ?? { moduleName: i.moduleName, ages: [], stuck: 0, overdue: 0 };
    m.ages.push(i.ageDays);
    if (i.ageDays >= STUCK_DAYS) m.stuck += 1;
    if (i.overdue) m.overdue += 1;
    moduleMap.set(i.moduleKey, m);
  }
  const byModule: ModuleStat[] = [...moduleMap.entries()].map(([moduleKey, m]) => ({
    moduleKey, moduleName: m.moduleName, count: m.ages.length,
    avgAge: Math.round(m.ages.reduce((a, b) => a + b, 0) / m.ages.length),
    stuck: m.stuck, overdue: m.overdue,
  })).sort((a, b) => b.avgAge - a.avgAge);

  // Étapes les plus lentes (module · statut)
  const stageMap = new Map<string, number[]>();
  for (const i of items) {
    const k = `${i.moduleName} · ${i.statusLabel}`;
    if (!stageMap.has(k)) stageMap.set(k, []);
    stageMap.get(k)!.push(i.ageDays);
  }
  const bottleneckStages: StageStat[] = [...stageMap.entries()]
    .map(([label, ages]) => ({ label, count: ages.length, avgAge: Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.avgAge - a.avgAge)
    .slice(0, 8);

  const pendingValidations: PendingValidation[] = pendingSteps.map((s) => ({
    id: s.id, reference: s.request.reference, title: s.request.title,
    validatorName: s.validatorId ? users.get(s.validatorId) ?? null : null,
    ageDays: daysSince(s.createdAt), link: s.request.link || "/validations",
  }));

  // Alertes prioritaires
  const alerts: PiAlert[] = [];
  for (const i of [...items].sort((a, b) => b.ageDays - a.ageDays)) {
    if (i.overdue) alerts.push({ level: "danger", title: `Échéance dépassée — ${i.moduleName}`, detail: `${i.label}${i.ownerName ? ` · ${i.ownerName}` : ""}`, link: i.link });
    else if (i.ageDays >= 21) alerts.push({ level: "warning", title: `Sans action depuis ${i.ageDays} j — ${i.moduleName}`, detail: `${i.label}${i.ownerName ? ` · ${i.ownerName}` : ""}`, link: i.link });
    if (alerts.length >= 12) break;
  }
  for (const v of pendingValidations) {
    if (v.ageDays >= 5 && alerts.length < 16) alerts.push({ level: "warning", title: `Validation en attente depuis ${v.ageDays} j`, detail: `${v.title}${v.validatorName ? ` · ${v.validatorName}` : ""}`, link: v.link });
  }

  return {
    stats: { inProgress: items.length, stuck: stuck.length, overdue: overdue.length, validationsPending: pendingSteps.length },
    topBlockers: [...items].sort((a, b) => b.ageDays - a.ageDays).slice(0, 12),
    byModule,
    bottleneckStages,
    staleItems: stuck.sort((a, b) => b.ageDays - a.ageDays).slice(0, 20),
    pendingValidations,
    alerts,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────── People & Workload Analyzer ───────────────────────

export interface WorkloadRow {
  userId: string;
  name: string;
  department: string | null;
  openTasks: number;
  overdueTasks: number;
  pendingValidations: number;
  openAdmin: number;
  regulatory: number;
  actions30: number;
  total: number;
  lastActivity: string | null;
}

export interface WorkloadAnalysis {
  rows: WorkloadRow[];
  topLoaded: WorkloadRow[];
  topOverdue: WorkloadRow[];
  tasksWithoutOwner: number;
  byDepartment: { department: string; total: number; overdue: number }[];
  inactive: { name: string; lastActivity: string | null }[];
  generatedAt: string;
}

function countMap(rows: { _count: { id: number } }[], key: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const id = (r as Record<string, unknown>)[key] as string | null;
    if (id) m.set(id, r._count.id);
  }
  return m;
}

export async function getWorkloadAnalysis(): Promise<WorkloadAnalysis> {
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY);

  const [users, departments, openTasks, overdueTasks, pendingVals, openAdmin, regulatory, actions, noOwner] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, departmentId: true, lastSeenAt: true } }),
    prisma.department.findMany({ select: { id: true, name: true } }),
    prisma.task.groupBy({ by: ["assignedToId"], where: { status: { in: ["TODO", "IN_PROGRESS"] } }, _count: { id: true } }),
    prisma.task.groupBy({ by: ["assignedToId"], where: { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: now } }, _count: { id: true } }),
    prisma.validationStep.groupBy({ by: ["validatorId"], where: { status: "PENDING" }, _count: { id: true } }),
    prisma.administrativeRequest.groupBy({ by: ["assignedToId"], where: { status: { notIn: ["DONE", "CANCELLED"] } }, _count: { id: true } }),
    prisma.regulatoryProduct.groupBy({ by: ["responsibleId"], where: { status: { notIn: ["DECISION_OBTAINED", "CLOSED"] } }, _count: { id: true } }),
    prisma.auditLog.groupBy({ by: ["actorId"], where: { createdAt: { gte: since30 } }, _count: { id: true } }),
    prisma.task.count({ where: { assignedToId: null, status: { in: ["TODO", "IN_PROGRESS"] } } }),
  ]);

  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const mOpenTasks = countMap(openTasks, "assignedToId");
  const mOverdue = countMap(overdueTasks, "assignedToId");
  const mPending = countMap(pendingVals, "validatorId");
  const mAdmin = countMap(openAdmin, "assignedToId");
  const mReg = countMap(regulatory, "responsibleId");
  const mActions = countMap(actions, "actorId");

  const rows: WorkloadRow[] = users.map((u) => {
    const openT = mOpenTasks.get(u.id) ?? 0;
    const adminN = mAdmin.get(u.id) ?? 0;
    const regN = mReg.get(u.id) ?? 0;
    const pend = mPending.get(u.id) ?? 0;
    return {
      userId: u.id, name: u.name, department: u.departmentId ? deptName.get(u.departmentId) ?? null : null,
      openTasks: openT, overdueTasks: mOverdue.get(u.id) ?? 0, pendingValidations: pend,
      openAdmin: adminN, regulatory: regN, actions30: mActions.get(u.id) ?? 0,
      total: openT + adminN + regN + pend,
      lastActivity: u.lastSeenAt?.toISOString() ?? null,
    };
  });

  const byDeptMap = new Map<string, { total: number; overdue: number }>();
  for (const r of rows) {
    const d = r.department ?? "Sans département";
    const cur = byDeptMap.get(d) ?? { total: 0, overdue: 0 };
    cur.total += r.total; cur.overdue += r.overdueTasks;
    byDeptMap.set(d, cur);
  }

  const inactiveThreshold = now.getTime() - 7 * DAY;
  return {
    rows: [...rows].sort((a, b) => b.total - a.total),
    topLoaded: [...rows].filter((r) => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 10),
    topOverdue: [...rows].filter((r) => r.overdueTasks > 0).sort((a, b) => b.overdueTasks - a.overdueTasks).slice(0, 10),
    tasksWithoutOwner: noOwner,
    byDepartment: [...byDeptMap.entries()].map(([department, v]) => ({ department, ...v })).sort((a, b) => b.total - a.total),
    inactive: rows.filter((r) => !r.lastActivity || new Date(r.lastActivity).getTime() < inactiveThreshold).map((r) => ({ name: r.name, lastActivity: r.lastActivity })).slice(0, 15),
    generatedAt: new Date().toISOString(),
  };
}
