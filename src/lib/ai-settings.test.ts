import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { aiFeatureEnabled, logAiUsage, getAiSettings } from "./ai-settings";
import { updateAiSettings } from "./actions/ai-settings-actions";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__aitest__";
async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

function fd(obj: Record<string, boolean>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) if (v) f.set(k, "on");
  return f;
}

suite("Centre de contrôle IA — bascules & journal d'usage", () => {
  let adminId = "", userId = "";

  beforeAll(async () => {
    const mk = (s: string, role: SessionUser["role"]) =>
      prisma.user.create({ data: { name: `${TAG}${s}`, email: `${TAG}${s}@t.dz`, role, passwordHash: "x" } });
    const [admin, user] = await Promise.all([mk("admin", "SUPER_ADMIN"), mk("user", "VIEWER")]);
    adminId = admin.id; userId = user.id;
  });

  afterAll(async () => {
    await prisma.aiUsageLog.deleteMany({ where: { feature: { startsWith: TAG } } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { actor: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("le Super Admin enregistre les bascules ; un non-admin est refusé", async () => {
    ACTOR = await actorFor(userId, "VIEWER");
    expect((await updateAiSettings(fd({ masterEnabled: true, assistantEnabled: true }))).ok).toBe(false);

    ACTOR = await actorFor(adminId, "SUPER_ADMIN");
    const r = await updateAiSettings(fd({
      masterEnabled: true, assistantEnabled: true, brainEnabled: false,
      proactiveNudgesEnabled: true, processIntelEnabled: true, fieldReportAiEnabled: true, voiceTranscriptEnabled: true,
    }));
    expect(r.ok).toBe(true);
    const row = await prisma.aiSetting.findUniqueOrThrow({ where: { id: "global" } });
    expect(row.masterEnabled).toBe(true);
    expect(row.assistantEnabled).toBe(true);
    expect(row.brainEnabled).toBe(false);
  });

  it("aiFeatureEnabled respecte la bascule de fonction (master ON, brain OFF)", async () => {
    // État posé par le test précédent : master ON, assistant ON, brain OFF.
    const s = await getAiSettings();
    expect(s.masterEnabled).toBe(true);
    expect(await aiFeatureEnabled("assistant")).toBe(true);
    expect(await aiFeatureEnabled("brain")).toBe(false);
  });

  it("logAiUsage écrit une ligne (best-effort)", async () => {
    await logAiUsage({ feature: `${TAG}feat` as never, userId: adminId, ok: true, latencyMs: 123, model: "claude-test" });
    const row = await prisma.aiUsageLog.findFirst({ where: { feature: `${TAG}feat` } });
    expect(row).not.toBeNull();
    expect(row!.ok).toBe(true);
    expect(row!.latencyMs).toBe(123);
  });
});
