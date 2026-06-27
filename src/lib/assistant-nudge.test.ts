import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { getUnreadDigest } from "./assistant-nudge";
import { assistantNudge } from "@/lib/actions/assistant-actions";

// Sans clé IA → l'analyse proactive ne s'exécute pas (chemin gracieux, déterministe).
delete process.env.ANTHROPIC_API_KEY;

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__nudgetest__";
async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

suite("Assistant flottant — suggestion proactive (digest non lus + coût maîtrisé)", () => {
  let aliceId = "", bobId = "", convId = "";

  beforeAll(async () => {
    const [a, b] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG}alice`, email: `${TAG}a@t.dz`, role: "MEDICAL_DELEGATE", passwordHash: "x" } }),
      prisma.user.create({ data: { name: `${TAG}bob`, email: `${TAG}b@t.dz`, role: "HEAD_OF_SALES", passwordHash: "x" } }),
    ]);
    aliceId = a.id; bobId = b.id;
    const conv = await prisma.conversation.create({
      data: { type: "DIRECT", createdById: bobId, members: { create: [{ userId: aliceId }, { userId: bobId }] } },
      select: { id: true },
    });
    convId = conv.id;
    await prisma.message.create({ data: { conversationId: convId, senderId: bobId, kind: "TEXT", body: `${TAG} Peux-tu préparer le dossier PCH pour demain ?` } });
  });

  afterAll(async () => {
    await prisma.conversation.deleteMany({ where: { id: convId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("le digest repère le message non lu adressé à Alice (pas les siens)", async () => {
    const digest = await getUnreadDigest(aliceId);
    expect(digest.count).toBe(1);
    expect(digest.text).toContain("dossier PCH");
    expect(digest.signature).not.toBe("0");
    // Bob n'a aucun non-lu (le message est de lui).
    expect((await getUnreadDigest(bobId)).count).toBe(0);
  });

  it("assistantNudge : signature reflète le nouveau, sans clé IA aucune suggestion (gracieux)", async () => {
    ACTOR = await actorFor(aliceId, "MEDICAL_DELEGATE");
    const r = await assistantNudge("");
    expect(r.signature).not.toBe("0");
    expect(r.suggestion).toBeNull(); // pas de clé → pas d'appel IA
  });

  it("coût maîtrisé : signature inchangée → court-circuit (aucune analyse)", async () => {
    ACTOR = await actorFor(aliceId, "MEDICAL_DELEGATE");
    const digest = await getUnreadDigest(aliceId);
    const r = await assistantNudge(digest.signature);
    expect(r.suggestion).toBeNull();
    expect(r.signature).toBe(digest.signature);
  });

  it("aucun non-lu → rien à suggérer", async () => {
    ACTOR = await actorFor(bobId, "HEAD_OF_SALES");
    const r = await assistantNudge("");
    expect(r).toEqual({ signature: "0", suggestion: null });
  });
});
