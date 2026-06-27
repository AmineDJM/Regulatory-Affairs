import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { getRisks } from "./risks";
import { runAutopilot } from "@/lib/actions/adventum-actions";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__braintest__";
async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

suite("Adventum Brain — Risk Radar + Autopilot", () => {
  let adminId = "", financeId = "", tenderId = "", taskId = "";
  const ref = `${TAG}AO-001`;

  beforeAll(async () => {
    const [admin, finance] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG}admin`, email: `${TAG}a@t.dz`, role: "SUPER_ADMIN", passwordHash: "x" } }),
      prisma.user.create({ data: { name: `${TAG}finance`, email: `${TAG}f@t.dz`, role: "FINANCE_BUDGET_MANAGER", passwordHash: "x" } }),
    ]);
    adminId = admin.id; financeId = finance.id;
    // Caution PCH qui expire dans 5 jours → risque critique attendu.
    const t = await prisma.pchTender.create({
      data: { reference: ref, status: "IN_PROGRESS", cautionDeposited: true, cautionEnd: new Date(Date.now() + 5 * 86_400_000), cautionAmount: 100000, supplier: "Test Supplier" },
    });
    tenderId = t.id;
  });

  afterAll(async () => {
    if (taskId) await prisma.task.deleteMany({ where: { id: taskId } }).catch(() => {});
    await prisma.task.deleteMany({ where: { title: { contains: ref } } }).catch(() => {});
    await prisma.pchTender.deleteMany({ where: { reference: { startsWith: TAG } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("détecte la caution PCH proche de l'expiration (risque critique + action Autopilot)", async () => {
    const risks = await getRisks();
    const r = risks.find((x) => x.id === `pch-caution-${tenderId}`);
    expect(r).toBeTruthy();
    expect(r!.level).toBe("critical"); // 5 j restants → critique
    expect(r!.category).toBe("PCH");
    expect(r!.evidence.length).toBeGreaterThan(0);
    // Une action Autopilot « tâche » est proposée, ciblant la Finance.
    const taskAction = r!.actions.find((a) => a.payload?.kind === "task");
    expect(taskAction).toBeTruthy();
    expect(taskAction!.payload && taskAction!.payload.kind === "task" && taskAction!.payload.assigneeId).toBe(financeId);
  });

  it("Autopilot : le Super Admin peut exécuter (crée une tâche réelle) ; un non-admin est refusé", async () => {
    const risks = await getRisks();
    const r = risks.find((x) => x.id === `pch-caution-${tenderId}`)!;
    const payload = r.actions.find((a) => a.payload?.kind === "task")!.payload!;

    // Non-admin → refusé.
    ACTOR = await actorFor(financeId, "FINANCE_BUDGET_MANAGER");
    expect((await runAutopilot(payload)).ok).toBe(false);

    // Super Admin → crée la tâche, assignée à la Finance.
    ACTOR = await actorFor(adminId, "SUPER_ADMIN");
    const res = await runAutopilot(payload);
    expect(res.ok).toBe(true);
    const task = await prisma.task.findFirstOrThrow({ where: { title: { contains: ref } } });
    taskId = task.id;
    expect(task.assignedToId).toBe(financeId);
    expect(task.createdById).toBe(adminId);
  });

  it("Autopilot notify : relance par rôle exécutée par le Super Admin", async () => {
    ACTOR = await actorFor(adminId, "SUPER_ADMIN");
    const res = await runAutopilot({ kind: "notify", role: "DIRECTION", title: "Test relance", body: "corps", link: "/pch" });
    expect(res.ok).toBe(true);
  });
});
