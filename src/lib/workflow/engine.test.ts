import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { advanceWorkflowInstance, getDefinition } from "./engine";
import { getWorkflowForEntity } from "@/lib/queries/workflow";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__wftest__";
const viewer = (id: string, role: UserRole) => ({ id, role, secondaryRole: null, name: role });
const asSession = (id: string, role: UserRole): SessionUser => ({ id, role, secondaryRole: null, access: { modules: new Map(), rowGrants: new Map(), secondaryRole: null } });

suite("Moteur de workflow — circuit Ad & Pro de bout en bout (congrès international)", () => {
  let nsId = "", pmId = "", dirId = "", delegId = "", otherId = "", congressId = "", catId = "";

  beforeAll(async () => {
    const mk = (s: string, role: UserRole) => prisma.user.create({ data: { name: `${TAG}${s}`, email: `${TAG}${s}@t.dz`, role, passwordHash: "x" } });
    const [ns, pm, dir, dg, ot] = await Promise.all([
      mk("ns", "NATIONAL_SALES"), mk("pm", "PRODUCT_MANAGER"), mk("dir", "DIRECTION"), mk("deleg", "MEDICAL_DELEGATE"), mk("other", "SALES_USER"),
    ]);
    nsId = ns.id; pmId = pm.id; dirId = dir.id; delegId = dg.id; otherId = ot.id;

    const congress = await prisma.congressInternational.create({
      data: { name: `${TAG}Congrès`, requestStatus: "AWAITING_PRELIMINARY", requesterId: delegId, estimatedBudget: 40000 },
    });
    congressId = congress.id;

    const env = await prisma.budgetEnvelope.create({
      data: { name: `${TAG}Env`, periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-12-31"), totalAmount: 1000000, modules: ["CONGRESS_INTERNATIONAL"], isActive: true },
    });
    const cat = await prisma.budgetCategoryLine.create({ data: { envelopeId: env.id, name: `${TAG}Cat`, module: "CONGRESS_INTERNATIONAL", allocated: 500000 } });
    catId = cat.id;
  });

  afterAll(async () => {
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: congressId } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: congressId } }).catch(() => {});
    await prisma.medicalInfoDeclaration.deleteMany({ where: { sourceId: congressId } }).catch(() => {});
    await prisma.expenseOrder.deleteMany({ where: { sourceId: congressId } }).catch(() => {});
    await prisma.congressInternational.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.budgetCategoryLine.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.budgetEnvelope.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("le demandeur (délégué) ne peut pas agir à l'étape préliminaire", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(delegId, "MEDICAL_DELEGATE"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", assigneeId: pmId });
    expect(r.ok).toBe(false);
  });

  it("le National Sales approuve le préliminaire et désigne le chef de produit", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", assigneeId: pmId, note: "OK" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.currentSlug).toBe("analysis");
    expect(inst.assigneeId).toBe(pmId);
    const c = await prisma.congressInternational.findUniqueOrThrow({ where: { id: congressId } });
    expect(c.requestStatus).toBe("PRELIMINARY_APPROVED");
    expect(c.productManagerId).toBe(pmId);
  });

  it("un tiers ne peut pas faire l'analyse ; le chef de produit désigné approuve", async () => {
    const bad = await advanceWorkflowInstance({ viewer: viewer(otherId, "SALES_USER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", amount: 30000 });
    expect(bad.ok).toBe(false);
    const ok = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", amount: 35000, note: "Avis chef de produit — confidentiel" });
    expect(ok.ok).toBe(true);
    const c = await prisma.congressInternational.findUniqueOrThrow({ where: { id: congressId } });
    expect(c.requestStatus).toBe("AWAITING_FINAL");
    expect(Number(c.productManagerBudget)).toBe(35000);
  });

  it("l'avis confidentiel du chef de produit est masqué au demandeur, visible de la Direction", async () => {
    const asDelegate = await getWorkflowForEntity(asSession(delegId, "MEDICAL_DELEGATE"), "CONGRESS_INTERNATIONAL", congressId, delegId);
    const analysisEventD = asDelegate?.events.find((e) => e.stepTitle.includes("Analyse"));
    expect(analysisEventD?.note).toBe("— confidentiel —");
    expect(analysisEventD?.amount).toBeNull();
    const asDir = await getWorkflowForEntity(asSession(dirId, "DIRECTION"), "CONGRESS_INTERNATIONAL", congressId, delegId);
    const analysisEventDir = asDir?.events.find((e) => e.stepTitle.includes("Analyse"));
    expect(analysisEventDir?.note).toContain("confidentiel");
    expect(analysisEventDir?.amount).toBe(35000);
  });

  it("le National Sales ne peut pas trancher la validation définitive (réservée à la Direction)", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", amount: 35000, budgetCategoryId: catId });
    expect(r.ok).toBe(false);
  });

  it("la validation définitive exige le montant ET la (sous-)catégorie budgétaire", async () => {
    const noCat = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", amount: 35000 });
    expect(noCat.ok).toBe(false);
  });

  it("la Direction valide définitivement → circuit clôturé + imputation budgétaire", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", amount: 42000, budgetCategoryId: catId, note: "Accordé" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.status).toBe("APPROVED");
    expect(inst.currentSlug).toBeNull();
    const c = await prisma.congressInternational.findUniqueOrThrow({ where: { id: congressId } });
    expect(c.requestStatus).toBe("APPROVED");
    expect(Number(c.finalAmount)).toBe(42000);

    // Sans pharmacien PRIM → ordre de dépense direct ; sinon déclaration info médicale.
    // Dans les deux cas, la (sous-)catégorie choisie par la Direction est portée.
    const order = await prisma.expenseOrder.findFirst({ where: { sourceId: congressId } });
    const decl = await prisma.medicalInfoDeclaration.findFirst({ where: { sourceId: congressId } });
    expect(Boolean(order) || Boolean(decl)).toBe(true);
    expect(order?.budgetCategoryId ?? decl?.budgetCategoryId).toBe(catId);
  });

  it("le circuit clôturé refuse toute nouvelle action", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", amount: 1, budgetCategoryId: catId });
    expect(r.ok).toBe(false);
  });
});

const TAG2 = "__wfevt__";

suite("Moteur — avis défavorable non éliminatoire + refus final d'événement (sans crash)", () => {
  let nsId = "", pmId = "", dirId = "", eventId = "";

  beforeAll(async () => {
    const mk = (s: string, role: UserRole) => prisma.user.create({ data: { name: `${TAG2}${s}`, email: `${TAG2}${s}@t.dz`, role, passwordHash: "x" } });
    const [ns, pm, dir] = await Promise.all([mk("ns", "NATIONAL_SALES"), mk("pm", "PRODUCT_MANAGER"), mk("dir", "DIRECTION")]);
    nsId = ns.id; pmId = pm.id; dirId = dir.id;
    const e = await prisma.event.create({ data: { name: `${TAG2}Event`, type: "ROUND_TABLE", scope: "NATIONAL", format: "PRESENTIAL", status: "DRAFT", requestStatus: "AWAITING_PRELIMINARY" } });
    eventId = e.id;
  });

  afterAll(async () => {
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: eventId } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: eventId } }).catch(() => {});
    await prisma.event.deleteMany({ where: { name: { startsWith: TAG2 } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG2 } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG2 } } }).catch(() => {});
  });

  it("l'avis défavorable du National Sales n'est PAS éliminatoire : le circuit avance (désignation requise)", async () => {
    const noAssign = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "EVENT", entityId: eventId, action: "REJECT", note: "avis défavorable" });
    expect(noAssign.ok).toBe(false); // il doit quand même désigner le chef de produit
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "EVENT", entityId: eventId, action: "REJECT", note: "avis défavorable", assigneeId: pmId });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "EVENT", entityId: eventId } } });
    expect(inst.status).toBe("IN_PROGRESS");
    expect(inst.currentSlug).toBe("analysis");
    const ev = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "OPINION_AGAINST" } });
    expect(ev).not.toBeNull();
  });

  it("l'avis défavorable du chef de produit avance vers la Direction, avec montant révisé optionnel tracé", async () => {
    // Le chef de produit joint, EN OPTION, un montant révisé (« revu à la hausse ») à son avis
    // défavorable — l'étape « analysis » porte le pouvoir SET_AMOUNT.
    const r = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "EVENT", entityId: eventId, action: "REJECT", note: "Montant revu à la hausse", amount: 1_500_000 });
    expect(r.ok).toBe(true);
    const e = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(e.requestStatus).toBe("AWAITING_FINAL");
    // Le montant révisé est consigné : budget chef de produit + montant de travail de l'instance…
    expect(Number(e.productManagerBudget)).toBe(1_500_000);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "EVENT", entityId: eventId } } });
    expect(Number(inst.amount)).toBe(1_500_000);
    // …et l'événement d'historique porte ce montant (visible de la Direction).
    const ev = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, stepSlug: "analysis", action: "OPINION_AGAINST" } });
    expect(ev).not.toBeNull();
    expect(Number(ev!.amount)).toBe(1_500_000);
  });

  it("le refus de la Direction (dernière étape) est définitif — sans exception serveur (Event sans updatedById)", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "EVENT", entityId: eventId, action: "REJECT", note: "refus définitif" });
    expect(r.ok).toBe(true);
    const e = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(e.requestStatus).toBe("REJECTED");
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "EVENT", entityId: eventId } } });
    expect(inst.status).toBe("REJECTED");
  });
});

const TAG3 = "__wfskip__";

suite("Moteur — sauter une étape (tracé & noté, anti-bureaucratie)", () => {
  let nsId = "", pmId = "", dirId = "", delegId = "", otherId = "", congressId = "";

  beforeAll(async () => {
    const mk = (s: string, role: UserRole) => prisma.user.create({ data: { name: `${TAG3}${s}`, email: `${TAG3}${s}@t.dz`, role, passwordHash: "x" } });
    const [ns, pm, dir, dg, ot] = await Promise.all([
      mk("ns", "NATIONAL_SALES"), mk("pm", "PRODUCT_MANAGER"), mk("dir", "DIRECTION"), mk("deleg", "MEDICAL_DELEGATE"), mk("other", "SALES_USER"),
    ]);
    nsId = ns.id; pmId = pm.id; dirId = dir.id; delegId = dg.id; otherId = ot.id;
    const c = await prisma.congressInternational.create({ data: { name: `${TAG3}Congrès`, requestStatus: "AWAITING_PRELIMINARY", requesterId: delegId, estimatedBudget: 20000 } });
    congressId = c.id;
  });

  afterAll(async () => {
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: congressId } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: congressId } }).catch(() => {});
    await prisma.congressInternational.deleteMany({ where: { name: { startsWith: TAG3 } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG3 } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG3 } } }).catch(() => {});
  });

  it("on ne peut pas sauter une étape de désignation (préliminaire)", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "raison" });
    expect(r.ok).toBe(false);
    // On avance normalement le préliminaire (désigne le chef de produit).
    const ok = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", assigneeId: pmId, note: "OK" });
    expect(ok.ok).toBe(true);
  });

  it("le saut exige une raison et n'est ouvert qu'à l'acteur de l'étape", async () => {
    const noReason = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "" });
    expect(noReason.ok).toBe(false);
    const thirdParty = await advanceWorkflowInstance({ viewer: viewer(otherId, "SALES_USER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "je saute" });
    expect(thirdParty.ok).toBe(false);
  });

  it("le chef de produit saute son étape avec raison → avance vers la Direction, tracé", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "Rien à redire, on file à la Direction" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.status).toBe("IN_PROGRESS");
    expect(inst.currentSlug).not.toBe("analysis"); // on a bien avancé
    const ev = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "SKIP" } });
    expect(ev).not.toBeNull();
    expect(ev?.note).toContain("Direction");
  });

  it("on ne peut pas sauter la décision finale (Direction)", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "raison" });
    expect(r.ok).toBe(false);
  });
});

const TAG4 = "__wfauto__";

suite("Moteur — franchissement automatique par seuil de montant (anti-bureaucratie configurable)", () => {
  let nsId = "", pmId = "", dirId = "", delegId = "", lowId = "", highId = "";

  beforeAll(async () => {
    const mk = (s: string, role: UserRole) => prisma.user.create({ data: { name: `${TAG4}${s}`, email: `${TAG4}${s}@t.dz`, role, passwordHash: "x" } });
    const [ns, pm, dir, dg] = await Promise.all([
      mk("ns", "NATIONAL_SALES"), mk("pm", "PRODUCT_MANAGER"), mk("dir", "DIRECTION"), mk("deleg", "MEDICAL_DELEGATE"),
    ]);
    nsId = ns.id; pmId = pm.id; dirId = dir.id; delegId = dg.id;
    // Petit budget estimé (5 000) sous le seuil / gros budget (50 000) au-dessus.
    const [low, high] = await Promise.all([
      prisma.congressInternational.create({ data: { name: `${TAG4}Low`, requestStatus: "AWAITING_PRELIMINARY", requesterId: delegId, estimatedBudget: 5000 } }),
      prisma.congressInternational.create({ data: { name: `${TAG4}High`, requestStatus: "AWAITING_PRELIMINARY", requesterId: delegId, estimatedBudget: 50000 } }),
    ]);
    lowId = low.id; highId = high.id;
    // Configure un seuil de 10 000 sur l'étape « analysis » (partagée) — restaurée en afterAll.
    const def = await getDefinition("CONGRESS_INTERNATIONAL");
    await prisma.workflowStep.updateMany({ where: { definitionId: def.id, slug: "analysis" }, data: { autoSkipMaxAmount: 10000 } });
  });

  afterAll(async () => {
    const def = await getDefinition("CONGRESS_INTERNATIONAL").catch(() => null);
    if (def) await prisma.workflowStep.updateMany({ where: { definitionId: def.id, slug: "analysis" }, data: { autoSkipMaxAmount: null } }).catch(() => {});
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: { in: [lowId, highId] } } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: { in: [lowId, highId] } } }).catch(() => {});
    await prisma.congressInternational.deleteMany({ where: { name: { startsWith: TAG4 } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG4 } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG4 } } }).catch(() => {});
  });

  it("montant estimé ≤ seuil : l'étape « analysis » est franchie automatiquement (tracé) → on se pose sur la décision finale", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: lowId, action: "APPROVE", assigneeId: pmId, note: "OK" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: lowId } } });
    // L'analyse chef de produit a été franchie automatiquement : on est sur la décision finale, PAS clôturé.
    expect(inst.currentSlug).toBe("final");
    expect(inst.status).toBe("IN_PROGRESS");
    const auto = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "AUTO_SKIP", stepSlug: "analysis" } });
    expect(auto).not.toBeNull();
  });

  it("montant estimé > seuil : l'étape n'est PAS franchie automatiquement (validation humaine conservée)", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: highId, action: "APPROVE", assigneeId: pmId, note: "OK" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: highId } } });
    expect(inst.currentSlug).toBe("analysis");
    const auto = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "AUTO_SKIP" } });
    expect(auto).toBeNull();
  });
});

const TAG5 = "__wfreqauth__";

suite("Moteur — auto-accord si le demandeur détient l'autorité de l'étape (skip-demandeur généralisé)", () => {
  let nsId = "", reqPmId = "", congressId = "";
  let original: { actorScope: string; actorRoles: string[]; autoApproveIfRequester: boolean } | null = null;

  beforeAll(async () => {
    const mk = (s: string, role: UserRole) => prisma.user.create({ data: { name: `${TAG5}${s}`, email: `${TAG5}${s}@t.dz`, role, passwordHash: "x" } });
    const [ns, reqPm] = await Promise.all([mk("ns", "NATIONAL_SALES"), mk("reqpm", "PRODUCT_MANAGER")]);
    nsId = ns.id; reqPmId = reqPm.id;
    // Le DEMANDEUR est un chef de produit ; budget au-dessus de tout seuil pour isoler le motif « autorité ».
    const c = await prisma.congressInternational.create({ data: { name: `${TAG5}Congrès`, requestStatus: "AWAITING_PRELIMINARY", requesterId: reqPmId, estimatedBudget: 90000 } });
    congressId = c.id;
    // Reconfigure temporairement l'étape « analysis » en portée ROLE[PRODUCT_MANAGER] + auto-accord si demandeur.
    const def = await getDefinition("CONGRESS_INTERNATIONAL");
    const a = await prisma.workflowStep.findFirstOrThrow({ where: { definitionId: def.id, slug: "analysis" } });
    original = { actorScope: a.actorScope, actorRoles: a.actorRoles, autoApproveIfRequester: a.autoApproveIfRequester };
    await prisma.workflowStep.update({ where: { id: a.id }, data: { actorScope: "ROLE", actorRoles: ["PRODUCT_MANAGER"], autoApproveIfRequester: true } });
  });

  afterAll(async () => {
    const def = await getDefinition("CONGRESS_INTERNATIONAL").catch(() => null);
    if (def && original) await prisma.workflowStep.updateMany({ where: { definitionId: def.id, slug: "analysis" }, data: original }).catch(() => {});
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: congressId } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: congressId } }).catch(() => {});
    await prisma.congressInternational.deleteMany({ where: { name: { startsWith: TAG5 } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG5 } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG5 } } }).catch(() => {});
  });

  it("l'étape dont le demandeur détient déjà le rôle est approuvée automatiquement en son nom (tracé), sans franchir la décision finale", async () => {
    // Le National Sales approuve le préliminaire et désigne le demandeur (chef de produit) ; l'étape d'analyse,
    // dont il détient le rôle, est auto-accordée → on se pose directement sur la décision finale (Direction).
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", assigneeId: reqPmId, note: "OK" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.currentSlug).toBe("final");
    expect(inst.status).toBe("IN_PROGRESS");
    const ev = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "AUTO_APPROVE_REQUESTER", stepSlug: "analysis" } });
    expect(ev).not.toBeNull();
  });
});

// ─────────────────────────── Validation par le N+1 (départements) ───────────────────────────

const TAG_MGR = "__wfmgr__";

/**
 * Étape à portée `DEPARTMENT_MANAGER` : c'est le **responsable hiérarchique du demandeur**
 * qui valide — résolu depuis les départements (et non depuis un rôle figé). On vérifie
 * qu'un collègue du même département ne peut pas valider, que le N+1 le peut, et que la
 * hiérarchie au-dessus (escalade) le peut aussi.
 */
suite("Moteur — étape validée par le N+1 réel du demandeur", () => {
  let deptId = "", subId = "";
  let chefUser = "", dgUser = "", agentUser = "", collegueUser = "";
  let eventId = "", instanceId = "", stepSlug = "";
  let originalStep: { id: string; actorScope: string; powers: string[]; assignRole: string | null } | null = null;

  beforeAll(async () => {
    const mkUser = (s: string, role: UserRole) =>
      prisma.user.create({ data: { name: `${TAG_MGR}${s}`, email: `${TAG_MGR}${s}@t.dz`, role, passwordHash: "x" } });
    const [dg, chef, agent, collegue] = await Promise.all([
      mkUser("dg", "SALES_USER"), mkUser("chef", "SALES_USER"), mkUser("agent", "SALES_USER"), mkUser("collegue", "SALES_USER"),
    ]);
    dgUser = dg.id; chefUser = chef.id; agentUser = agent.id; collegueUser = collegue.id;

    const dept = await prisma.department.create({ data: { name: `${TAG_MGR} Direction`, code: `${TAG_MGR}_DIR` } });
    const sub = await prisma.department.create({ data: { name: `${TAG_MGR} Équipe`, code: `${TAG_MGR}_EQ`, parentId: dept.id } });
    deptId = dept.id; subId = sub.id;

    const mkEmp = (s: string, userId: string, departmentId: string) =>
      prisma.employee.create({ data: { fullName: `${TAG_MGR} ${s}`, userId, departmentId } });
    const [empDg, empChef] = await Promise.all([mkEmp("DG", dgUser, deptId), mkEmp("Chef", chefUser, subId)]);
    await Promise.all([mkEmp("Agent", agentUser, subId), mkEmp("Collègue", collegueUser, subId)]);
    await prisma.department.update({ where: { id: deptId }, data: { headId: empDg.id } });
    await prisma.department.update({ where: { id: subId }, data: { headId: empChef.id } });

    // Un événement demandé par l'agent, positionné sur une étape « N+1 ».
    const ev = await prisma.event.create({
      data: { name: `${TAG_MGR}Event`, type: "ROUND_TABLE", scope: "NATIONAL", format: "PRESENTIAL", status: "DRAFT", requestStatus: "AWAITING_PRELIMINARY", requesterId: agentUser },
    });
    eventId = ev.id;

    const def = await getDefinition("EVENTS");
    const first = [...def.steps].sort((a, b) => a.position - b.position)[0];
    stepSlug = first.slug;
    // La définition EVENTS est PARTAGÉE avec les autres suites (et persiste en base) :
    // on mémorise la configuration d'origine pour la restaurer intégralement après.
    originalStep = { id: first.id, actorScope: first.actorScope, powers: [...first.powers], assignRole: first.assignRole };
    await prisma.workflowStep.update({ where: { id: first.id }, data: { actorScope: "DEPARTMENT_MANAGER", powers: ["APPROVE", "REJECT"], assignRole: null } });
    const inst = await prisma.workflowInstance.create({
      data: { definitionId: def.id, entityType: "EVENT", entityId: eventId, category: "EVENTS", currentSlug: stepSlug, status: "IN_PROGRESS" },
    });
    instanceId = inst.id;
  });

  afterAll(async () => {
    // Restauration INTÉGRALE de l'étape partagée (portée, pouvoirs, désignation) :
    // sans cela, les autres suites — et les exécutions suivantes — héritent d'un circuit modifié.
    if (originalStep) {
      await prisma.workflowStep.update({
        where: { id: originalStep.id },
        data: { actorScope: originalStep.actorScope, powers: originalStep.powers, assignRole: originalStep.assignRole },
      }).catch(() => {});
    }
    await prisma.workflowStepEvent.deleteMany({ where: { instanceId } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: eventId } }).catch(() => {});
    await prisma.event.deleteMany({ where: { name: { startsWith: TAG_MGR } } }).catch(() => {});
    await prisma.department.updateMany({ where: { code: { startsWith: TAG_MGR } }, data: { headId: null, deputyId: null } }).catch(() => {});
    await prisma.employee.deleteMany({ where: { fullName: { startsWith: TAG_MGR } } }).catch(() => {});
    await prisma.department.deleteMany({ where: { code: { startsWith: TAG_MGR } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG_MGR } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG_MGR } } }).catch(() => {});
  });

  it("un COLLÈGUE du même département ne peut pas valider", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(collegueUser, "SALES_USER"), entityType: "EVENT", entityId: eventId, action: "APPROVE", note: "ok" });
    expect(r.ok).toBe(false);
  });

  it("le DEMANDEUR ne peut pas se valider lui-même", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(agentUser, "SALES_USER"), entityType: "EVENT", entityId: eventId, action: "APPROVE", note: "auto" });
    expect(r.ok).toBe(false);
  });

  it("le N+1 (responsable du sous-département) voit l'action dans sa vue", async () => {
    const view = await getWorkflowForEntity(asSession(chefUser, "SALES_USER"), "EVENT", eventId, agentUser);
    expect(view?.action?.slug).toBe(stepSlug);
    // Le collègue, lui, n'a aucune action disponible.
    const collegueView = await getWorkflowForEntity(asSession(collegueUser, "SALES_USER"), "EVENT", eventId, agentUser);
    expect(collegueView?.action).toBeNull();
  });

  it("la hiérarchie AU-DESSUS du N+1 peut aussi trancher (escalade)", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(dgUser, "SALES_USER"), entityType: "EVENT", entityId: eventId, action: "APPROVE", note: "escalade" });
    expect(r.ok).toBe(true);
  });
});
