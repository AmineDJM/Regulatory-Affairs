import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { buildProposal, performAction, executeReadTool, type ProposedAction } from "./assistant";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__mailasst__";
async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

suite("Assistant IA — outils e-mail (Courrier)", () => {
  let user: CurrentUser;

  beforeAll(async () => {
    const u = await prisma.user.create({ data: { name: `${TAG}user`, email: `${TAG}u@t.dz`, role: "MEDICAL_DELEGATE", passwordHash: "x" } });
    user = await actorFor(u.id, "MEDICAL_DELEGATE"); // utilisateur SANS boîte mail connectée
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("send_email : propose une carte valide (avec avertissement si pas de boîte connectée)", async () => {
    const p = (await buildProposal("send_email", { to: "contact@pch.dz", subject: "Relance", body: "Bonjour, où en est notre commande ?" }, user)) as ProposedAction;
    expect("error" in p).toBe(false);
    expect(p.kind).toBe("send_email");
    expect(p.module).toBe("WORKSPACE");
    expect(p.fields.some((f) => f.value === "contact@pch.dz")).toBe(true);
    expect(p.payload.kind === "send_email" && p.payload.to).toBe("contact@pch.dz");
    // Pas de boîte connectée → avertissement explicite.
    expect(p.warnings.join(" ")).toMatch(/boîte mail/i);
  });

  it("send_email : refuse une adresse invalide ou un corps vide", async () => {
    expect("error" in (await buildProposal("send_email", { to: "pas-une-adresse", subject: "x", body: "y" }, user))).toBe(true);
    expect("error" in (await buildProposal("send_email", { to: "ok@x.dz", subject: "x", body: "" }, user))).toBe(true);
  });

  it("send_email : l'exécution échoue proprement sans boîte connectée (jamais d'envoi fantôme)", async () => {
    const r = await performAction(user, { kind: "send_email", to: "contact@pch.dz", subject: "Test", body: "Corps" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/boîte mail/i);
  });

  it("list_emails / read_email : message clair quand aucune boîte n'est connectée", async () => {
    expect(await executeReadTool("list_emails", {}, user)).toMatch(/Aucune boîte mail connectée/i);
    expect(await executeReadTool("read_email", { uid: 1 }, user)).toMatch(/Aucune boîte mail connectée/i);
  });
});
