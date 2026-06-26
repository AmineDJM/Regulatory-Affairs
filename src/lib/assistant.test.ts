import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccess, type EffectiveAccess } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import {
  runAssistant, executeReadTool, buildProposal, performAction,
  type ProposedAction,
} from "@/lib/assistant";

const MARK = "[SMOKE-ASSISTANT]";

async function asUser(name: string): Promise<CurrentUser> {
  const u = await prisma.user.findFirstOrThrow({ where: { name }, select: { id: true, name: true, email: true, role: true } });
  const access = await getAccess(u.id, u.role as UserRole);
  return { id: u.id, name: u.name, email: u.email, role: u.role, access, mustChangePassword: false };
}

let bob: CurrentUser; // HEAD_OF_SALES — pas d'accès Médical
let carla: CurrentUser; // MEDICAL_DELEGATE

beforeAll(async () => {
  bob = await asUser("Bob Hadj");
  carla = await asUser("Carla Meziane");
});

afterAll(async () => {
  await prisma.task.deleteMany({ where: { title: { startsWith: MARK } } });
  await prisma.administrativeRequest.deleteMany({ where: { title: { startsWith: MARK } } });
  await prisma.auditLog.deleteMany({ where: { module: "Assistant IA", summary: { contains: MARK } } });
  await prisma.$disconnect();
});

describe("Assistant — dégradation sans clé IA", () => {
  it("runAssistant renvoie configured:false sans ANTHROPIC_API_KEY", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await runAssistant(bob, [{ role: "user", content: "Bonjour" }]);
    expect(r.configured).toBe(false);
    expect(r.ok).toBe(false);
  });
});

describe("Outils de lecture — RBAC", () => {
  it("my_overview liste les modules accessibles + compteurs", async () => {
    const out = await executeReadTool("my_overview", {}, bob);
    const data = JSON.parse(out);
    expect(Array.isArray(data.modulesAccessibles)).toBe(true);
    expect(data.modulesAccessibles).toContain("Ventes");
    expect(typeof data.tachesOuvertes).toBe("number");
  });

  it("search_doctors refuse l'accès à un rôle sans module Médical", async () => {
    const out = await executeReadTool("search_doctors", { query: "" }, bob);
    expect(out).toContain("Accès non autorisé");
  });

  it("search_doctors est autorisé pour un délégué (scopé, sans erreur)", async () => {
    const out = await executeReadTool("search_doctors", { query: "" }, carla);
    expect(out).not.toContain("Accès non autorisé");
  });

  it("search_people retrouve un collègue par son nom", async () => {
    const out = await executeReadTool("search_people", { query: "Carla" }, bob);
    expect(out).toContain("Carla");
  });
});

describe("Construction d'action proposée (confirmation)", () => {
  it("create_task résout le destinataire par son nom", async () => {
    const p = (await buildProposal("create_task", { title: `${MARK} Préparer dossier`, assigneeName: "Carla" }, bob)) as ProposedAction;
    expect("error" in p).toBe(false);
    expect(p.kind).toBe("create_task");
    expect(p.payload.kind === "create_task" && p.payload.assigneeId).toBe(carla.id);
    expect(p.warnings.length).toBe(0);
  });

  it("create_task signale un destinataire introuvable (jamais inventé)", async () => {
    const p = (await buildProposal("create_task", { title: `${MARK} X`, assigneeName: "Personne Inexistante ZZZ" }, bob)) as ProposedAction;
    expect(p.warnings.length).toBeGreaterThan(0);
    expect(p.payload.kind === "create_task" && p.payload.assigneeId).toBeNull();
  });

  it("create_admin_request TRAVEL produit une carte avec un type", async () => {
    const p = (await buildProposal("create_admin_request", { type: "travel", title: `${MARK} Billet Pr Mouffok Alger→Rio`, description: "Du 2 au 5 janvier 2027", assigneeName: "Carla" }, bob)) as ProposedAction;
    expect("error" in p).toBe(false);
    expect(p.kind).toBe("create_admin_request");
    expect(p.fields.some((f) => f.label === "Type")).toBe(true);
    expect(p.payload.kind === "create_admin_request" && p.payload.assigneeId).toBe(carla.id);
  });

  it("create_admin_request rejette un type invalide", async () => {
    const p = await buildProposal("create_admin_request", { type: "FOO", title: "X" }, bob);
    expect("error" in p).toBe(true);
  });
});

describe("Exécution après confirmation — ré-autorisation + audit", () => {
  it("refuse l'exécution si l'utilisateur n'a pas le droit (jamais sur la confiance du client)", async () => {
    const stripped: CurrentUser = { ...bob, access: { modules: new Map(), rowGrants: new Map() } as EffectiveAccess };
    const r = await performAction(stripped, { kind: "create_task", title: `${MARK} interdit` });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/droit/i);
  });

  it("crée une tâche assignée à un collègue + journalise", async () => {
    const title = `${MARK} Relance PCH`;
    const r = await performAction(bob, { kind: "create_task", title, assigneeId: carla.id, priority: "HIGH" });
    expect(r.ok).toBe(true);
    const task = await prisma.task.findFirstOrThrow({ where: { title } });
    expect(task.assignedToId).toBe(carla.id);
    expect(task.createdById).toBe(bob.id);
    expect(task.priority).toBe("HIGH");
    const audit = await prisma.auditLog.findFirst({ where: { entityType: "TASK", entityId: task.id, module: "Assistant IA" } });
    expect(audit).not.toBeNull();
  });

  it("retombe sur soi-même si le destinataire est invalide", async () => {
    const title = `${MARK} Tâche perso`;
    const r = await performAction(bob, { kind: "create_task", title, assigneeId: "id-bidon-inexistant" });
    expect(r.ok).toBe(true);
    const task = await prisma.task.findFirstOrThrow({ where: { title } });
    expect(task.assignedToId).toBe(bob.id);
  });

  it("crée une demande administrative TRAVEL avec référence REQ-AAAA-NNN", async () => {
    const title = `${MARK} Billet Pr Mouffok`;
    const r = await performAction(bob, { kind: "create_admin_request", type: "TRAVEL", title, description: "Alger → Rio, 2–5 janv. 2027", assigneeId: carla.id });
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/REQ-\d{4}-\d{3}/);
    const req = await prisma.administrativeRequest.findFirstOrThrow({ where: { title } });
    expect(req.requesterId).toBe(bob.id);
    expect(req.assignedToId).toBe(carla.id);
    expect(req.type).toBe("TRAVEL");
  });
});
