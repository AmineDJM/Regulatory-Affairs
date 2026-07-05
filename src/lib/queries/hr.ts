import { prisma } from "@/lib/prisma";
import { currentCompanyWhere } from "@/lib/company";
import { toNumber } from "@/lib/utils";

/** Personalised workspace data for the signed-in user ("Mon espace"). */
export async function getMyWorkspace(userId: string) {
  const [employee, myTasks, delegated, myLeaves, myAdvances, activity] = await Promise.all([
    prisma.employee.findUnique({
      where: { userId },
      select: { id: true, leaveBalanceDays: true, contractType: true, contractEnd: true, position: true, department: true },
    }),
    prisma.task.findMany({
      where: { assignedToId: userId, status: { in: ["TODO", "IN_PROGRESS"] } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 50,
    }),
    prisma.task.findMany({
      where: { createdById: userId, assignedToId: { not: userId }, status: { in: ["TODO", "IN_PROGRESS"] } },
      include: { assignedTo: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }],
      take: 20,
    }),
    prisma.leaveRequest.findMany({
      where: { employee: { userId } },
      orderBy: { startDate: "desc" },
      take: 12,
    }),
    prisma.salaryAdvance.findMany({
      where: { employee: { userId } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.activityLog.findMany({
      where: { userId, type: "PAGE_VIEW" },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const now = Date.now();
  const overdue = myTasks.filter((t) => t.dueDate && t.dueDate.getTime() < now).length;
  const pendingLeaves = myLeaves.filter((l) => l.status === "PENDING").length;
  const pendingAdvances = myAdvances.filter((a) => a.status === "PENDING").length;

  return {
    employee,
    myTasks,
    delegated,
    myLeaves,
    myAdvances,
    activity,
    stats: {
      openTasks: myTasks.length,
      overdue,
      pendingLeaves,
      pendingAdvances,
      leaveBalance: employee ? toNumber(employee.leaveBalanceDays) : null,
    },
  };
}

/** Back-office HR data for the /rh page. */
export async function getRhData() {
  const now = new Date();
  const in60 = new Date();
  in60.setDate(now.getDate() + 60);

  const [employees, pendingLeaves, recentLeaves, advances] = await Promise.all([
    prisma.employee.findMany({
      where: { ...currentCompanyWhere() },
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
      include: { user: { select: { id: true, email: true } }, company: { select: { id: true, name: true, shortName: true, color: true } }, _count: { select: { leaveRequests: true } } },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      include: { employee: { select: { id: true, fullName: true } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: { status: { not: "PENDING" } },
      include: { employee: { select: { fullName: true } } },
      orderBy: { decidedAt: "desc" },
      take: 15,
    }),
    prisma.salaryAdvance.findMany({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      include: { employee: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const active = employees.filter((e) => e.isActive);
  const masseSalariale = active.reduce((a, e) => a + toNumber(e.baseSalary), 0);
  const contractsExpiring = employees.filter(
    (e) => e.contractEnd && e.contractEnd >= now && e.contractEnd <= in60,
  );

  const deptMap = new Map<string, number>();
  for (const e of active) {
    const key = e.department || "Non affecté";
    deptMap.set(key, (deptMap.get(key) ?? 0) + 1);
  }
  const byDepartment = [...deptMap.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  return {
    employees,
    pendingLeaves,
    recentLeaves,
    advances,
    contractsExpiring,
    byDepartment,
    stats: {
      total: employees.length,
      active: active.length,
      pending: pendingLeaves.length,
      expiring: contractsExpiring.length,
      advances: advances.filter((a) => a.status === "PENDING").length,
      masseSalariale,
    },
  };
}
