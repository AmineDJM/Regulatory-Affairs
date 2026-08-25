import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess, Module, Action } from "@/lib/rbac";
import { buildProposal, performAction, type AssistantActionPayload } from "@/lib/assistant";
import { DOMAIN_TOOLS } from "@/lib/assistant/ops";
import { OPS_CATALOG } from "@/lib/assistant/ops/catalog";
import { actionsForUser } from "@/lib/assistant/action-registry";

/**
 * GOLDEN OPS DE DOMAINE — le mécanisme SYSTÉMIQUE qui ferme les trous de parité en série :
 *
 *   • INTÉGRITÉ : chaque op du catalogue a une implémentation (le zip échoue au chargement
 *     sinon) et une définition d'outil générée cohérente (énumération `op`).
 *   • RÉSOLUTION Drive par NOM : exact/unique proposé, ambigu LISTÉ avec l'emplacement,
 *     inaccessible refusé — l'ACL réelle (`resolveDriveAccess`) dès la proposition.
 *   • CRITIQUE : la suppression Drive définitive exige la RESSAISIE du nom.
 *   • TÂCHES côté « moi » : seules les tâches où le geste est possible se proposent
 *     (accepter = demande REQUESTED qui m'est adressée, jamais celle d'un collègue).
 *   • LOT (`bulk_action`) : UNE carte pour N cibles par RÉCURSION de buildProposal (mêmes
 *     portes, même résolution), niveau = max des items, CRITIQUE → ressaisie « LOT n »,
 *     exécution best-effort avec reçu par cible.
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

// ── Intégrité catalogue ↔ implémentations ↔ défs (PUR, sans base) ──

describe("ops de domaine — intégrité du catalogue", () => {
  it("chaque op du catalogue est implémentée et énumérée dans la définition d'outil", () => {
    for (const meta of OPS_CATALOG) {
      const spec = DOMAIN_TOOLS[meta.tool];
      expect(spec, `outil ${meta.tool} absent de DOMAIN_TOOLS`).toBeDefined();
      expect(spec.ops[meta.op], `${meta.tool}/${meta.op} sans implémentation`).toBeDefined();
      const schema = spec.def.input_schema as { properties: { op: { enum: string[] } } };
      expect(schema.properties.op.enum, `${meta.tool}/${meta.op} absent de l'enum`).toContain(meta.op);
    }
  });

  it("découverte par les droits : le Drive ouvre les ops Drive, un compte sans droits ne les voit pas", () => {
    const withDrive = userWith({ DRIVE: ["VIEW", "CREATE"], WORKSPACE: ["VIEW", "UPDATE"] }, "DIRECTION", "u-d", "D");
    const ids = actionsForUser(withDrive).map((a) => a.id);
    expect(ids).toContain("OP_DRIVE_OPERATION_MOVE");
    expect(ids).toContain("OP_DRIVE_OPERATION_DELETE");
    expect(ids).toContain("OP_TASK_OPERATION_ACCEPT");
    const bare = userWith({}, "MEDICAL_DELEGATE", "u-b", "B");
    const bareIds = actionsForUser(bare).map((a) => a.id);
    expect(bareIds).not.toContain("OP_DRIVE_OPERATION_MOVE");
    expect(bareIds).not.toContain("OP_TASK_OPERATION_ACCEPT");
  });
});

// ── Goldens avec base (résolution réelle, fixtures nettoyées) ──

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__ops__${Date.now()}`;
let ownerId = "";
let colleagueId = "";
let outsiderId = "";
let folderId = "";
let fileId = "";
let requestedTaskId = "";

const owner = () => userWith({ DRIVE: ["VIEW", "CREATE"], WORKSPACE: ["VIEW", "CREATE", "UPDATE"] }, "DIRECTION", ownerId, `${TAG} Karim`);
const outsider = () => userWith({ DRIVE: ["VIEW"], WORKSPACE: ["VIEW", "UPDATE"] }, "MEDICAL_DELEGATE", outsiderId, `${TAG} Walid`);

suite("ops de domaine & lots — goldens (fixtures partagées)", () => {
  beforeAll(async () => {
    const [o, c, x] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG} Karim`, email: `${TAG}o@t.dz`, passwordHash: "x", role: "DIRECTION" } }),
      prisma.user.create({ data: { name: `${TAG} Lina`, email: `${TAG}c@t.dz`, passwordHash: "x", role: "REGULATORY_ASSISTANT" } }),
      prisma.user.create({ data: { name: `${TAG} Walid`, email: `${TAG}x@t.dz`, passwordHash: "x", role: "MEDICAL_DELEGATE" } }),
    ]);
    ownerId = o.id; colleagueId = c.id; outsiderId = x.id;
    const folder = await prisma.driveNode.create({
      data: { name: `${TAG} Campagne`, type: "FOLDER", ownerId, createdById: ownerId },
    });
    folderId = folder.id;
    const file = await prisma.driveNode.create({
      data: { name: `${TAG} Rapport ANPP.docx`, type: "FILE", ownerId, createdById: ownerId, parentId: folderId },
    });
    fileId = file.id;
    await prisma.driveNode.create({
      data: { name: `${TAG} Rapport ventes.xlsx`, type: "FILE", ownerId, createdById: ownerId },
    });
    const task = await prisma.task.create({
      data: {
        title: `${TAG} Préparer la synthèse`, assignedToId: ownerId, createdById: colleagueId,
        status: "REQUESTED", requestedAt: new Date(),
      },
    });
    requestedTaskId = task.id;
    await prisma.task.create({
      data: { title: `${TAG} Relire le contrat`, assignedToId: colleagueId, createdById: ownerId, status: "REQUESTED", requestedAt: new Date() },
    });
  });

  afterAll(async () => {
    const tasks = await prisma.task.findMany({ where: { title: { startsWith: TAG } }, select: { id: true } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: tasks.map((t) => t.id) } } }).catch(() => {});
    await prisma.task.deleteMany({ where: { title: { startsWith: TAG } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { body: { startsWith: TAG } } }).catch(() => {});
    await prisma.driveNode.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  describe("ops Drive — résolution par nom, ACL réelle, CRITIQUE", () => {
  it("rename : élément résolu par nom (exact), payload domain_op avec les args rejouables", async () => {
    const p = await buildProposal("drive_operation", { op: "rename", name: `${TAG} Rapport ANPP.docx`, newName: `${TAG} Rapport ANPP v2.docx` }, owner());
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(p.kind).toBe("domain_op");
    expect(p.module).toBe("DRIVE");
    expect(p.title).toContain("Renommer");
    const payload = p.payload as Extract<AssistantActionPayload, { kind: "domain_op" }>;
    expect(payload.tool).toBe("drive_operation");
    expect(payload.op).toBe("rename");
    expect(payload.args.id).toBe(fileId);
    expect(payload.args.newName).toBe(`${TAG} Rapport ANPP v2.docx`);
  });

  it("ambigu : « Rapport » correspond à deux fichiers → la liste est montrée, rien n'est proposé", async () => {
    const p = await buildProposal("drive_operation", { op: "trash", name: `${TAG} Rapport` }, owner());
    expect("error" in p).toBe(true);
    if (!("error" in p)) return;
    expect(p.error).toContain("Plusieurs éléments");
    expect(p.error).toContain("Rapport ANPP");
    expect(p.error).toContain("Rapport ventes");
  });

  it("ACL : un compte SANS accès au nœud ne peut pas le viser — même avec le droit module Drive", async () => {
    const p = await buildProposal("drive_operation", { op: "rename", name: `${TAG} Rapport ANPP.docx`, newName: "X" }, outsider());
    expect("error" in p).toBe(true);
    if ("error" in p) expect(p.error).toMatch(/Aucun élément|droit d'ÉDITION/);
  });

  it("delete : NIVEAU CRITIQUE — la confirmation exige de RESSAISIR le nom exact", async () => {
    const p = await buildProposal("drive_operation", { op: "delete", name: `${TAG} Rapport ventes.xlsx` }, owner());
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(p.level).toBe("CRITICAL");
    expect(p.confirmText).toBe(`${TAG} Rapport ventes.xlsx`);
    expect(p.warnings.join(" ")).toMatch(/IRRÉVERSIBLE/);
  });

  it("create_folder : le dossier parent se résout par nom, l'emplacement est montré", async () => {
    const p = await buildProposal("drive_operation", { op: "create_folder", name: `${TAG} Sous-dossier`, folder: `${TAG} Campagne` }, owner());
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(JSON.stringify(p.fields)).toContain(`${TAG} Campagne`);
    const payload = p.payload as Extract<AssistantActionPayload, { kind: "domain_op" }>;
    expect(payload.args.parentId).toBe(folderId);
  });

  it("share : personnes résolues par nom (introuvable = averti, jamais deviné), droit lecture/modification", async () => {
    const p = await buildProposal("drive_operation", {
      op: "share", name: `${TAG} Campagne`, people: `${TAG} Lina, Personne Inexistante Zz`, access: "modification",
    }, owner());
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(JSON.stringify(p.fields)).toContain(`${TAG} Lina`);
    expect(JSON.stringify(p.fields)).toContain("Modification");
    expect(p.warnings.join(" ")).toContain("introuvable");
    const payload = p.payload as Extract<AssistantActionPayload, { kind: "domain_op" }>;
    expect(payload.args.userIds).toBe(colleagueId);
    expect(payload.args.access).toBe("EDIT");
  });

  it("porte du catalogue : sans le droit module Drive, l'op est refusée à la proposition", async () => {
    const noDrive = userWith({ WORKSPACE: ["VIEW"] }, "MEDICAL_DELEGATE", outsiderId, `${TAG} Walid`);
    const p = await buildProposal("drive_operation", { op: "trash", name: "x" }, noDrive);
    expect("error" in p).toBe(true);
    if ("error" in p) expect(p.error).toMatch(/pas le droit/);
  });

  it("op inconnue : refus net avec la liste des ops disponibles", async () => {
    const p = await buildProposal("drive_operation", { op: "explode", name: "x" }, owner());
    expect("error" in p).toBe(true);
    if ("error" in p) expect(p.error).toContain("create_folder");
  });
  });

  describe("ops Tâches — le côté « moi » du circuit de demande", () => {
  it("accept : seule MA demande REQUESTED se propose ; celle d'un collègue reste introuvable", async () => {
    const p = await buildProposal("task_operation", { op: "accept", title: `${TAG} Préparer la synthèse` }, owner());
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(p.title).toContain("Accepter");
    expect(p.warnings.join(" ")).toMatch(/commencer/);
    const payload = p.payload as Extract<AssistantActionPayload, { kind: "domain_op" }>;
    expect(payload.args.id).toBe(requestedTaskId);

    // La demande adressée à Lina n'est PAS acceptable par Karim — accepter à la place de
    // quelqu'un, c'est lui attribuer un engagement qu'il n'a pas pris.
    const other = await buildProposal("task_operation", { op: "accept", title: `${TAG} Relire le contrat` }, owner());
    expect("error" in other).toBe(true);
  });

  it("refuse : le motif (facultatif) est montré et rejoué dans les args", async () => {
    const p = await buildProposal("task_operation", { op: "refuse", title: `${TAG} Préparer la synthèse`, reason: "Surchargé cette semaine" }, owner());
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(JSON.stringify(p.fields)).toContain("Surchargé cette semaine");
    const payload = p.payload as Extract<AssistantActionPayload, { kind: "domain_op" }>;
    expect(payload.args.reason).toBe("Surchargé cette semaine");
  });

  it("submit_work : une demande encore REQUESTED ne se « valide » pas (il faut l'accepter d'abord)", async () => {
    const p = await buildProposal("task_operation", { op: "submit_work", title: `${TAG} Préparer la synthèse` }, owner());
    expect("error" in p).toBe(true);
  });

  it("comment : le message est exigé, le cercle de la tâche fait foi", async () => {
    const missing = await buildProposal("task_operation", { op: "comment", title: `${TAG} Préparer la synthèse` }, owner());
    expect("error" in missing && missing.error).toMatch(/message/);
    const p = await buildProposal("task_operation", { op: "comment", title: `${TAG} Préparer la synthèse`, comment: "Vu — je regarde demain." }, owner());
    expect("error" in p).toBe(false);
  });
  });

  describe("bulk_action — une carte pour N cibles, reçus par cible", () => {
  it("LOT CRITIQUE : 2 suppressions définitives → UNE carte, niveau CRITICAL, ressaisie « LOT 2 », 2 items résolus", async () => {
    await prisma.regulatoryProduct.createMany({
      data: [
        { reference: `${TAG}-RB-1`, dci: `${TAG} Alpha`, status: "SUBMITTED" },
        { reference: `${TAG}-RB-2`, dci: `${TAG} Beta`, status: "SUBMITTED" },
      ],
    });
    const sa = userWith({}, "SUPER_ADMIN", ownerId, `${TAG} Karim`);
    const p = await buildProposal("bulk_action", {
      tool: "delete_record",
      targets: [`${TAG}-RB-1`, `${TAG}-RB-2`],
      params: { kind: "REGULATORY_PRODUCT" },
    }, sa);
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(p.kind).toBe("bulk_action");
    expect(p.level).toBe("CRITICAL");
    expect(p.confirmText).toBe("LOT 2");
    const payload = p.payload as Extract<AssistantActionPayload, { kind: "bulk_action" }>;
    expect(payload.innerTool).toBe("delete_record");
    expect(payload.items).toHaveLength(2);
    expect(payload.items.every((i) => i.payload.kind === "delete_record")).toBe(true);
    await prisma.regulatoryProduct.deleteMany({ where: { reference: { startsWith: `${TAG}-RB` } } });
  });

  it("cible fautive : le lot se prépare SANS elle et le dit (jamais une carte muette)", async () => {
    await prisma.regulatoryProduct.create({ data: { reference: `${TAG}-RB-3`, dci: `${TAG} Gamma`, status: "SUBMITTED" } });
    const sa = userWith({}, "SUPER_ADMIN", ownerId, `${TAG} Karim`);
    const p = await buildProposal("bulk_action", {
      tool: "delete_record",
      targets: [`${TAG}-RB-3`, `${TAG}-INEXISTANT`],
      params: { kind: "REGULATORY_PRODUCT" },
    }, sa);
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    const payload = p.payload as Extract<AssistantActionPayload, { kind: "bulk_action" }>;
    expect(payload.items).toHaveLength(1);
    expect(p.warnings.join(" ")).toContain("Non préparé");
    expect(p.warnings.join(" ")).toContain(`${TAG}-INEXISTANT`);
    await prisma.regulatoryProduct.deleteMany({ where: { reference: `${TAG}-RB-3` } });
  });

  it("EXÉCUTION réelle : « demande la même tâche à Lina et Walid » → 2 demandes REQUESTED par le cœur canonique, reçu par cible", async () => {
    const requester = userWith({ WORKSPACE: ["VIEW", "CREATE"] }, "DIRECTION", ownerId, `${TAG} Karim`);
    const p = await buildProposal("bulk_action", {
      tool: "create_task",
      targets: [`${TAG} Lina`, `${TAG} Walid`],
      params: { title: `${TAG} Pointer les stocks`, priority: "HIGH" },
    }, requester);
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(p.level).toBeUndefined();

    const r = await performAction(requester, p.payload);
    expect(r.ok).toBe(true);
    expect(r.message).toContain("2/2");
    expect(r.message).toContain("✓");
    const created = await prisma.task.findMany({ where: { title: `${TAG} Pointer les stocks` } });
    expect(created).toHaveLength(2);
    expect(created.every((t) => t.status === "REQUESTED" && t.requestedAt !== null)).toBe(true);
    expect(new Set(created.map((t) => t.assignedToId))).toEqual(new Set([colleagueId, outsiderId]));
  });

  it("garde-fous : outil non groupable refusé, cible unique renvoyée vers l'outil direct", async () => {
    const sa = userWith({}, "SUPER_ADMIN", ownerId, `${TAG} Karim`);
    const bad = await buildProposal("bulk_action", { tool: "update_salary", targets: ["a", "b"] }, sa);
    expect("error" in bad && bad.error).toContain("groupables");
    const single = await buildProposal("bulk_action", { tool: "create_task", targets: [`${TAG} Lina`] }, sa);
    expect("error" in single && single.error).toMatch(/DEUX cibles/);
  });
  });
});
