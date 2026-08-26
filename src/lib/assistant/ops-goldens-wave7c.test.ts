import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess, Module, Action } from "@/lib/rbac";
import { buildProposal, type AssistantActionPayload } from "@/lib/assistant";

/**
 * GOLDEN OPS VAGUE 7c — messagerie : édition limitée à SES messages (désignés par extrait),
 * fiche de conversation en FUSION (un DIRECT ne se renomme pas), rôles réservés au
 * propriétaire (annoncé), rejoindre un canal non archivé (déjà membre → refus), niveau de
 * notification FR → enum, statut de présence FR → enum avec retour automatique ; relance
 * Regulatory réservée Super Admin / DG par la porte du catalogue.
 */

function userWith(perms: Partial<Record<Module, Action[]>>, role: CurrentUser["role"], id: string, name: string): CurrentUser {
  const modules = new Map(
    Object.entries(perms).map(([m, actions]) => [
      m as Module,
      { module: m as Module, actions: new Set(actions as Action[]), scope: "ALL" as const },
    ]),
  );
  return {
    id, name, email: `${id}@t.dz`, role,
    access: { modules, rowGrants: new Map() } as unknown as EffectiveAccess,
    mustChangePassword: false,
  };
}

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__ops7c__${Date.now()}`;
const domainArgs = (p: { payload: unknown }) => (p.payload as Extract<AssistantActionPayload, { kind: "domain_op" }>).args;

let saId = "";
let memberId = "";
let groupId = "";
let channelId = "";
let myMsgId = "";

const sa = () => userWith({
  MESSAGING: ["VIEW", "CREATE"],
}, "SUPER_ADMIN", saId, `${TAG} Amine`);

suite("ops vague 7c — messagerie complète + relance Regulatory", () => {
  beforeAll(async () => {
    const [s, m] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG} Amine`, email: `${TAG}s@t.dz`, passwordHash: "x", role: "SUPER_ADMIN" } }),
      prisma.user.create({ data: { name: `${TAG} Nabil Ventes`, email: `${TAG}m@t.dz`, passwordHash: "x", role: "MEDICAL_DELEGATE" } }),
    ]);
    saId = s.id; memberId = m.id;

    const group = await prisma.conversation.create({
      data: {
        type: "GROUP", title: `${TAG} Groupe Lancement`, description: "Préparer le lancement",
        members: { create: [{ userId: s.id, role: "OWNER" }, { userId: m.id, role: "MEMBER" }] },
      },
    });
    groupId = group.id;
    const myMsg = await prisma.message.create({
      data: { conversationId: group.id, senderId: s.id, kind: "TEXT", body: "Le planning de lancement est validé." },
    });
    myMsgId = myMsg.id;
    await prisma.message.create({
      data: { conversationId: group.id, senderId: m.id, kind: "TEXT", body: "Reçu, je prépare les visuels." },
    });

    const channel = await prisma.conversation.create({
      data: { type: "CHANNEL", title: `${TAG} Canal Annonces`, members: { create: [{ userId: m.id, role: "OWNER" }] } },
    });
    channelId = channel.id;
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { conversation: { title: { startsWith: TAG } } } }).catch(() => {});
    await prisma.conversationMember.deleteMany({ where: { conversation: { title: { startsWith: TAG } } } }).catch(() => {});
    await prisma.conversation.deleteMany({ where: { title: { startsWith: TAG } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("edit_message : seuls MES messages se résolvent — l'extrait d'un message d'un autre ne matche pas", async () => {
    const notMine = await buildProposal("messaging_operation", {
      op: "edit_message", target: "Groupe Lancement", comment: "je prépare les visuels", note: "X",
    }, sa());
    expect("error" in notMine && notMine.error).toMatch(/Aucun message/);

    const p = await buildProposal("messaging_operation", {
      op: "edit_message", target: "Groupe Lancement", comment: "planning de lancement", note: "Le planning V2 est validé.",
    }, sa());
    expect("error" in p).toBe(false);
    if (!("error" in p)) {
      expect(domainArgs(p).id).toBe(myMsgId);
      expect(domainArgs(p).body).toBe("Le planning V2 est validé.");
    }
  });

  it("update_conversation : FUSION — renommer seul rejoue le sujet ; un DIRECT refuserait", async () => {
    const p = await buildProposal("messaging_operation", {
      op: "update_conversation", target: "Groupe Lancement", newName: `${TAG} Groupe Lancement Q4`,
    }, sa());
    expect("error" in p).toBe(false);
    if (!("error" in p)) {
      expect(domainArgs(p).conversationId).toBe(groupId);
      expect(domainArgs(p).title).toBe(`${TAG} Groupe Lancement Q4`);
      expect(domainArgs(p).description).toBe("Préparer le lancement");
    }
  });

  it("set_member_role : la personne se résout, la réserve « propriétaire seulement » est annoncée", async () => {
    const p = await buildProposal("messaging_operation", {
      op: "set_member_role", target: "Groupe Lancement", person: "Nabil", role: "admin",
    }, sa());
    expect("error" in p).toBe(false);
    if (!("error" in p)) {
      expect(domainArgs(p).userId).toBe(memberId);
      expect(domainArgs(p).role).toBe("ADMIN");
      expect(p.warnings.join(" ")).toMatch(/PROPRIÉTAIRE/);
    }
  });

  it("join_channel : un canal ouvert se rejoint ; déjà membre → refus clair", async () => {
    const p = await buildProposal("messaging_operation", {
      op: "join_channel", target: "Canal Annonces",
    }, sa());
    expect("error" in p).toBe(false);
    if (!("error" in p)) expect(domainArgs(p).conversationId).toBe(channelId);

    const already = userWith({ MESSAGING: ["VIEW"] }, "MEDICAL_DELEGATE", memberId, "Nabil");
    const dup = await buildProposal("messaging_operation", { op: "join_channel", target: "Canal Annonces" }, already);
    expect("error" in dup && dup.error).toMatch(/déjà membre/);
  });

  it("set_notify_level : « mentions » → MENTIONS ; niveau illisible → refus qui liste les choix", async () => {
    const p = await buildProposal("messaging_operation", {
      op: "set_notify_level", target: "Groupe Lancement", mode: "mentions seulement",
    }, sa());
    expect("error" in p).toBe(false);
    if (!("error" in p)) expect(domainArgs(p).level).toBe("MENTIONS");

    const bad = await buildProposal("messaging_operation", {
      op: "set_notify_level", target: "Groupe Lancement", mode: "parfois",
    }, sa());
    expect("error" in bad && bad.error).toMatch(/tout, mentions/);
  });

  it("set_messaging_status : « ne pas déranger » → DND ; « automatique » efface le statut", async () => {
    const p = await buildProposal("messaging_operation", {
      op: "set_messaging_status", status: "ne pas déranger", note: "En réunion budget",
    }, sa());
    expect("error" in p).toBe(false);
    if (!("error" in p)) {
      expect(domainArgs(p).status).toBe("DND");
      expect(domainArgs(p).message).toBe("En réunion budget");
    }

    const auto = await buildProposal("messaging_operation", { op: "set_messaging_status", status: "automatique" }, sa());
    expect("error" in auto).toBe(false);
    if (!("error" in auto)) expect(domainArgs(auto).status).toBeNull();
  });

  it("send_update_reminder : porte Super Admin / DG — un délégué est refusé par le catalogue ; « tous » = tous les porteurs", async () => {
    const delegate = userWith({}, "MEDICAL_DELEGATE", memberId, "Nabil");
    const denied = await buildProposal("regulatory_operation", { op: "send_update_reminder" }, delegate);
    expect("error" in denied && denied.error).toMatch(/droit/);

    const p = await buildProposal("regulatory_operation", { op: "send_update_reminder", note: "Point avant le comité" }, sa());
    expect("error" in p).toBe(false);
    if (!("error" in p)) {
      expect(domainArgs(p).recipientId).toBeNull();
      expect(p.fields.map((f) => f.value).join(" ")).toMatch(/TOUS les porteurs/);
      expect(p.warnings.join(" ")).toMatch(/recalculés côté serveur/);
    }
  });
});
