import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { advanceWorkflowInstance, ensureInstance, getDefinition, orderedSteps } from "./engine";
import { defaultDefinition } from "./defaults";
import { getWorkflowForEntity } from "@/lib/queries/workflow";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__wftest__";
const viewer = (id: string, role: UserRole) => ({ id, role, secondaryRole: null, name: role });
const asSession = (id: string, role: UserRole): SessionUser => ({ id, role, secondaryRole: null, access: { modules: new Map(), rowGrants: new Map(), secondaryRole: null } });

suite("Moteur — le parcours d'un KAM : National Sales → Direction Marketing, qui TRANCHE", () => {
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

  it("la borne de sortie est POSÉE à la naissance de l'instance : Direction Marketing tranche", async () => {
    // Ce qui le ferait tomber : dériver la borne du rôle courant au lieu de la figer, ou ne pas
    // la poser du tout — la demande du KAM repartirait alors vers la Direction, qui n'est pas
    // dans son parcours.
    await advanceWorkflowInstance({ viewer: viewer(otherId, "SALES_USER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "COMMENT", note: "ouvre l'instance" });
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.finalSlug).toBe("marketing");
  });

  it("le demandeur (KAM) ne peut pas agir à l'étape préliminaire", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(delegId, "MEDICAL_DELEGATE"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE" });
    expect(r.ok).toBe(false);
  });

  it("le National Sales approuve le préliminaire — SANS avoir à désigner personne", async () => {
    // La désignation exigeait de remplir une étape à portée « personne désignée ». Cette étape
    // est portée par le RÔLE Direction Marketing : exiger une désignation serait une friction
    // sans destinataire, et le moteur refusait l'approbation tant que personne n'était nommé.
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", note: "OK" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.currentSlug).toBe("marketing");
    const c = await prisma.congressInternational.findUniqueOrThrow({ where: { id: congressId } });
    expect(c.requestStatus).toBe("PRELIMINARY_APPROVED");
  });

  it("l'ÉCRAN d'un KAM ne montre PAS l'étape de la Direction — elle n'est pas dans son parcours", async () => {
    // LE DÉFAUT LE PLUS COÛTEUX DE CET ÉCRAN, s'il revenait : une frise qui annonce une
    // validation qui n'aura pas lieu — un demandeur qui attend, et une Direction qui croit avoir
    // un dossier à traiter.
    const vue = await getWorkflowForEntity(asSession(delegId, "MEDICAL_DELEGATE"), "CONGRESS_INTERNATIONAL", congressId, delegId);
    expect(vue?.steps.map((st) => st.slug)).toEqual(["preliminary", "marketing"]);
  });

  it("un tiers n'arbitre pas ; Direction Marketing doit fournir le montant ET la sous-catégorie", async () => {
    const bad = await advanceWorkflowInstance({ viewer: viewer(otherId, "SALES_USER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", amount: 30000, budgetCategoryId: catId });
    expect(bad.ok).toBe(false);
    // LE BUDGET A CHANGÉ DE MAIN : ces deux exigences étaient sur l'étape de la Direction.
    const sansMontant = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", budgetCategoryId: catId });
    expect(sansMontant.ok).toBe(false);
    const sansCategorie = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", amount: 35000 });
    expect(sansCategorie.ok).toBe(false);
  });

  it("Direction Marketing tranche → circuit CLÔTURÉ, budget accordé, et la dépense est ÉMISE", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", amount: 35000, budgetCategoryId: catId, note: "Accordé par Direction Marketing" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.status, "l'étape qui tranche CLÔTURE le circuit").toBe("APPROVED");
    expect(inst.currentSlug).toBeNull();
    const c = await prisma.congressInternational.findUniqueOrThrow({ where: { id: congressId } });
    expect(c.requestStatus).toBe("APPROVED");
    expect(Number(c.finalAmount)).toBe(35000);

    // L'ÉMISSION HÉRITÉE DE LA QUEUE COUPÉE. Sans elle, la demande sortirait APPROUVÉE avec son
    // budget accordé écrit en base et Finance ne recevrait RIEN : l'argent accordé, rien
    // d'engagé, et aucune étape en échec.
    const order = await prisma.expenseOrder.findFirst({ where: { sourceId: congressId } });
    const decl = await prisma.medicalInfoDeclaration.findFirst({ where: { sourceId: congressId } });
    expect(Boolean(order) || Boolean(decl), "une dépense accordée DOIT être engagée").toBe(true);
    expect(order?.budgetCategoryId ?? decl?.budgetCategoryId).toBe(catId);
  });

  it("le budget accordé par l'étape qui TRANCHE est VISIBLE du demandeur — un accord illisible n'est pas un accord", async () => {
    // La confidentialité protège une PROPOSITION en cours d'arbitrage. Quand l'étape tranche, sa
    // décision EST la décision : caviarder ce montant laisserait le KAM devant une demande
    // approuvée dont il ne peut pas lire la somme.
    const vue = await getWorkflowForEntity(asSession(delegId, "MEDICAL_DELEGATE"), "CONGRESS_INTERNATIONAL", congressId, delegId);
    const arbitrage = vue?.events.find((e) => e.stepTitle.includes("Arbitrage") && e.action === "APPROVE");
    expect(arbitrage?.amount, "le montant accordé se lit").toBe(35000);
    expect(arbitrage?.note).toContain("Direction Marketing");
  });

  it("le circuit clôturé refuse toute nouvelle action", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", amount: 1, budgetCategoryId: catId });
    expect(r.ok).toBe(false);
  });
});

const TAG1B = "__wfnonkam__";

/**
 * LA SECONDE CHAÎNE. Une chaîne qui marche ne prouve rien ; deux chaînes qui marchent prouvent le
 * moteur (§118.21). Celle-ci ne partage RIEN avec la première : un autre demandeur (hors force de
 * vente), une autre entrée (Direction Marketing au lieu du préliminaire), une autre sortie (la
 * Direction), et un montant que l'étape qui conclut ne fixe PAS.
 */
suite("Moteur — le parcours d'un demandeur NON-KAM : Direction Marketing → Direction", () => {
  let pmId = "", dirId = "", reqId = "", congressId = "", catId = "";

  beforeAll(async () => {
    const mk = (s: string, role: UserRole) => prisma.user.create({ data: { name: `${TAG1B}${s}`, email: `${TAG1B}${s}@t.dz`, role, passwordHash: "x" } });
    const [pm, dir, req] = await Promise.all([mk("pm", "PRODUCT_MANAGER"), mk("dir", "DIRECTION"), mk("req", "DIRECTION_ASSISTANT")]);
    pmId = pm.id; dirId = dir.id; reqId = req.id;
    const c = await prisma.congressInternational.create({
      data: { name: `${TAG1B}Congrès`, requestStatus: "PRELIMINARY_APPROVED", requesterId: reqId, estimatedBudget: 60000 },
    });
    congressId = c.id;
    const env = await prisma.budgetEnvelope.create({
      data: { name: `${TAG1B}Env`, periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-12-31"), totalAmount: 1000000, modules: ["CONGRESS_INTERNATIONAL"], isActive: true },
    });
    const cat = await prisma.budgetCategoryLine.create({ data: { envelopeId: env.id, name: `${TAG1B}Cat`, module: "CONGRESS_INTERNATIONAL", allocated: 500000 } });
    catId = cat.id;
  });

  afterAll(async () => {
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: congressId } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: congressId } }).catch(() => {});
    await prisma.medicalInfoDeclaration.deleteMany({ where: { sourceId: congressId } }).catch(() => {});
    await prisma.expenseOrder.deleteMany({ where: { sourceId: congressId } }).catch(() => {});
    await prisma.congressInternational.deleteMany({ where: { name: { startsWith: TAG1B } } }).catch(() => {});
    await prisma.budgetCategoryLine.deleteMany({ where: { name: { startsWith: TAG1B } } }).catch(() => {});
    await prisma.budgetEnvelope.deleteMany({ where: { name: { startsWith: TAG1B } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG1B } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG1B } } }).catch(() => {});
  });

  it("aucune borne : la chaîne va jusqu'à la Direction, et l'écran la MONTRE", async () => {
    const vue = await getWorkflowForEntity(asSession(reqId, "DIRECTION_ASSISTANT"), "CONGRESS_INTERNATIONAL", congressId, reqId);
    expect(vue?.currentSlug).toBe("marketing");
    expect(vue?.steps.map((st) => st.slug)).toEqual(["preliminary", "marketing", "final"]);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.finalSlug, "un demandeur non-KAM n'a pas de borne : la dernière étape tranche").toBeNull();
  });

  it("Direction Marketing arbitre → la demande AVANCE vers la Direction, et l'arbitrage reste CONFIDENTIEL", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", amount: 55000, budgetCategoryId: catId, note: "Arbitrage confidentiel" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.status).toBe("IN_PROGRESS");
    expect(inst.currentSlug).toBe("final");
    expect(Number(inst.amount), "le montant arbitré devient le montant de TRAVAIL de l'instance").toBe(55000);
    const c = await prisma.congressInternational.findUniqueOrThrow({ where: { id: congressId } });
    expect(Number(c.productManagerBudget)).toBe(55000);
    // AUCUNE ÉMISSION ICI : l'étape n'est pas celle qui tranche, donc rien n'est engagé avant
    // l'accord de la Direction.
    expect(await prisma.expenseOrder.count({ where: { sourceId: congressId } })).toBe(0);
    // Et le montant reste caviardé pour le demandeur : c'est une PROPOSITION, pas une décision.
    const vue = await getWorkflowForEntity(asSession(reqId, "DIRECTION_ASSISTANT"), "CONGRESS_INTERNATIONAL", congressId, reqId);
    const arb = vue?.events.find((e) => e.stepTitle.includes("Arbitrage"));
    expect(arb?.note).toBe("— confidentiel —");
    expect(arb?.amount).toBeNull();
  });

  it("la Direction tranche SANS fixer de montant — et le budget accordé est celui de l'instance", async () => {
    // LE DÉFAUT QUE CE CAS ATTRAPE : la Direction n'a plus le pouvoir « fixer un montant », donc
    // son approbation n'en porte aucun. Sans repli sur le montant de TRAVAIL, `finalAmount`
    // restait vide — la demande passait APPROUVÉE, l'ordre de dépense partait avec 55 000 DZD, et
    // la fiche n'affichait aucun budget accordé.
    const r = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", note: "Accordé" });
    expect(r.ok).toBe(true);
    const c = await prisma.congressInternational.findUniqueOrThrow({ where: { id: congressId } });
    expect(c.requestStatus).toBe("APPROVED");
    expect(Number(c.finalAmount), "le montant accordé est celui qu'a arbitré Direction Marketing").toBe(55000);
    const order = await prisma.expenseOrder.findFirst({ where: { sourceId: congressId } });
    const decl = await prisma.medicalInfoDeclaration.findFirst({ where: { sourceId: congressId } });
    expect(Boolean(order) || Boolean(decl)).toBe(true);
    expect(Number(order?.amount ?? decl?.amount)).toBe(55000);
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

  it("l'avis défavorable du National Sales n'est PAS éliminatoire : le circuit avance", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "EVENT", entityId: eventId, action: "REJECT", note: "avis défavorable" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "EVENT", entityId: eventId } } });
    expect(inst.status).toBe("IN_PROGRESS");
    expect(inst.currentSlug).toBe("marketing");
    const ev = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "OPINION_AGAINST" } });
    expect(ev).not.toBeNull();
  });

  it("l'avis défavorable de Direction Marketing avance vers la Direction, avec montant révisé optionnel tracé", async () => {
    // Direction Marketing joint, EN OPTION, un montant révisé (« revu à la hausse ») à son avis
    // défavorable — l'étape « marketing » porte le pouvoir SET_AMOUNT.
    const r = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "EVENT", entityId: eventId, action: "REJECT", note: "Montant revu à la hausse", amount: 1_500_000 });
    expect(r.ok).toBe(true);
    const e = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(e.requestStatus).toBe("AWAITING_FINAL");
    // Le montant révisé est consigné : budget Direction Marketing + montant de travail de l'instance…
    expect(Number(e.productManagerBudget)).toBe(1_500_000);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "EVENT", entityId: eventId } } });
    expect(Number(inst.amount)).toBe(1_500_000);
    // …et l'événement d'historique porte ce montant (visible de la Direction).
    const ev = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, stepSlug: "marketing", action: "OPINION_AGAINST" } });
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
  let nsId = "", pmId = "", dirId = "", delegId = "", otherId = "", congressId = "", kamCongressId = "";

  beforeAll(async () => {
    const mk = (s: string, role: UserRole) => prisma.user.create({ data: { name: `${TAG3}${s}`, email: `${TAG3}${s}@t.dz`, role, passwordHash: "x" } });
    const [ns, pm, dir, dg, ot] = await Promise.all([
      mk("ns", "NATIONAL_SALES"), mk("pm", "PRODUCT_MANAGER"), mk("dir", "DIRECTION"), mk("deleg", "MEDICAL_DELEGATE"), mk("other", "SALES_USER"),
    ]);
    nsId = ns.id; pmId = pm.id; dirId = dir.id; delegId = dg.id; otherId = ot.id;
    // DEMANDEUR NON-KAM : la chaîne va jusqu'à la Direction, donc « marketing » est une étape
    // INTERMÉDIAIRE — c'est la seule situation où le saut d'étape a un objet. Le cas d'un KAM,
    // dont l'étape tranche et ne se saute donc pas, est le dernier cas de cette suite.
    const c = await prisma.congressInternational.create({ data: { name: `${TAG3}Congrès`, requestStatus: "AWAITING_PRELIMINARY", requesterId: dirId, estimatedBudget: 20000 } });
    congressId = c.id;
    const kamC = await prisma.congressInternational.create({ data: { name: `${TAG3}KAM`, requestStatus: "PRELIMINARY_APPROVED", requesterId: delegId, estimatedBudget: 20000 } });
    kamCongressId = kamC.id;
  });

  afterAll(async () => {
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: congressId } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: congressId } }).catch(() => {});
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: kamCongressId } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: kamCongressId } }).catch(() => {});
    await prisma.congressInternational.deleteMany({ where: { name: { startsWith: TAG3 } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG3 } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG3 } } }).catch(() => {});
  });

  it("le préliminaire n'est plus une désignation : il se saute AVEC raison, et c'est tracé", async () => {
    // Il ne se sautait pas parce qu'il DÉSIGNAIT le responsable de la suite : sauter aurait
    // laissé l'étape suivante sans acteur. Direction Marketing est portée par un RÔLE — plus
    // rien à protéger. La raison, elle, reste obligatoire.
    const sansRaison = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "" });
    expect(sansRaison.ok).toBe(false);
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "Déjà arbitré en réunion" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.currentSlug).toBe("marketing");
  });

  it("le saut exige une raison et n'est ouvert qu'à l'acteur de l'étape", async () => {
    const noReason = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "" });
    expect(noReason.ok).toBe(false);
    const thirdParty = await advanceWorkflowInstance({ viewer: viewer(otherId, "SALES_USER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "je saute" });
    expect(thirdParty.ok).toBe(false);
  });

  it("Direction Marketing saute son étape avec raison → avance vers la Direction, tracé", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "Rien à redire, on file à la Direction" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.status).toBe("IN_PROGRESS");
    expect(inst.currentSlug).toBe("final");
    const ev = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "SKIP", stepSlug: "marketing" } });
    expect(ev).not.toBeNull();
    expect(ev?.note).toContain("Direction");
  });

  it("on ne peut pas sauter la décision finale (Direction)", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "raison" });
    expect(r.ok).toBe(false);
  });

  it("SUR UNE DEMANDE DE KAM, l'étape de Direction Marketing NE SE SAUTE PAS : elle TRANCHE", async () => {
    // Cette garde ne coûte pas une ligne de plus : elle tombe de la borne posée dans
    // `nextStepAfter` — pas de successeur, donc décision finale, donc saut refusé. Ce qui le
    // ferait tomber : lire la borne ailleurs que dans « y a-t-il une étape après celle-ci ? ».
    // On aurait alors une décision d'accord franchie SANS qu'un humain la prenne.
    const r = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: kamCongressId, action: "SKIP", note: "on saute" });
    expect(r.ok).toBe(false);
    expect(r.ok === false ? r.error : "").toContain("finale");
  });
});

const TAG4 = "__wfauto__";

suite("Moteur — franchissement automatique par seuil de montant (anti-bureaucratie configurable)", () => {
  let nsId = "", pmId = "", dirId = "", delegId = "", lowId = "", highId = "", kamLowId = "";

  beforeAll(async () => {
    const mk = (s: string, role: UserRole) => prisma.user.create({ data: { name: `${TAG4}${s}`, email: `${TAG4}${s}@t.dz`, role, passwordHash: "x" } });
    const [ns, pm, dir, dg] = await Promise.all([
      mk("ns", "NATIONAL_SALES"), mk("pm", "PRODUCT_MANAGER"), mk("dir", "DIRECTION"), mk("deleg", "MEDICAL_DELEGATE"),
    ]);
    nsId = ns.id; pmId = pm.id; dirId = dir.id; delegId = dg.id;
    // Petit budget estimé (5 000) sous le seuil / gros budget (50 000) au-dessus.
    const [low, high, kamLow] = await Promise.all([
      prisma.congressInternational.create({ data: { name: `${TAG4}Low`, requestStatus: "AWAITING_PRELIMINARY", requesterId: dirId, estimatedBudget: 5000 } }),
      prisma.congressInternational.create({ data: { name: `${TAG4}High`, requestStatus: "AWAITING_PRELIMINARY", requesterId: dirId, estimatedBudget: 50000 } }),
      // MÊME PETIT MONTANT, MAIS DEMANDÉ PAR UN KAM : l'étape de Direction Marketing TRANCHE, et
      // une décision d'accord ne se franchit pas toute seule.
      prisma.congressInternational.create({ data: { name: `${TAG4}Kam`, requestStatus: "AWAITING_PRELIMINARY", requesterId: delegId, estimatedBudget: 5000 } }),
    ]);
    lowId = low.id; highId = high.id; kamLowId = kamLow.id;
    // Configure un seuil de 10 000 sur l'étape « marketing » (partagée) — restaurée en afterAll.
    const def = await getDefinition("CONGRESS_INTERNATIONAL");
    await prisma.workflowStep.updateMany({ where: { definitionId: def.id, slug: "marketing" }, data: { autoSkipMaxAmount: 10000 } });
  });

  afterAll(async () => {
    const def = await getDefinition("CONGRESS_INTERNATIONAL").catch(() => null);
    if (def) await prisma.workflowStep.updateMany({ where: { definitionId: def.id, slug: "marketing" }, data: { autoSkipMaxAmount: null } }).catch(() => {});
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: { in: [lowId, highId, kamLowId] } } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: { in: [lowId, highId, kamLowId] } } }).catch(() => {});
    await prisma.congressInternational.deleteMany({ where: { name: { startsWith: TAG4 } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG4 } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG4 } } }).catch(() => {});
  });

  it("montant estimé ≤ seuil : l'étape « marketing » est franchie automatiquement (tracé) → on se pose sur la décision finale", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: lowId, action: "APPROVE", note: "OK" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: lowId } } });
    // L'arbitrage a été franchi automatiquement : on est sur la décision finale, PAS clôturé.
    expect(inst.currentSlug).toBe("final");
    expect(inst.status).toBe("IN_PROGRESS");
    const auto = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "AUTO_SKIP", stepSlug: "marketing" } });
    expect(auto).not.toBeNull();
  });

  it("montant estimé > seuil : l'étape n'est PAS franchie automatiquement (validation humaine conservée)", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: highId, action: "APPROVE", note: "OK" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: highId } } });
    expect(inst.currentSlug).toBe("marketing");
    const auto = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "AUTO_SKIP" } });
    expect(auto).toBeNull();
  });

  it("MÊME SOUS LE SEUIL, l'étape qui TRANCHE n'est jamais franchie automatiquement — un humain accorde", async () => {
    // Le seuil anti-bureaucratie et la borne du parcours se rencontrent ici. Sur une demande de
    // KAM, Direction Marketing accorde le budget : la franchir automatiquement engagerait une
    // dépense que PERSONNE n'a décidée. Cette garde tombe de `nextStepAfter` — pas de
    // successeur, donc décision finale, donc jamais de franchissement automatique.
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: kamLowId, action: "APPROVE", note: "OK" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: kamLowId } } });
    expect(inst.currentSlug, "la demande ATTEND la décision de Direction Marketing").toBe("marketing");
    expect(inst.status).toBe("IN_PROGRESS");
    expect(await prisma.workflowStepEvent.count({ where: { instanceId: inst.id, action: "AUTO_SKIP" } })).toBe(0);
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
    // Le DEMANDEUR est la Direction Marketing ; budget au-dessus de tout seuil pour isoler le motif « autorité ».
    const c = await prisma.congressInternational.create({ data: { name: `${TAG5}Congrès`, requestStatus: "AWAITING_PRELIMINARY", requesterId: reqPmId, estimatedBudget: 90000 } });
    congressId = c.id;
    // Reconfigure temporairement l'étape « marketing » en portée ROLE[PRODUCT_MANAGER] + auto-accord si demandeur.
    const def = await getDefinition("CONGRESS_INTERNATIONAL");
    const a = await prisma.workflowStep.findFirstOrThrow({ where: { definitionId: def.id, slug: "marketing" } });
    original = { actorScope: a.actorScope, actorRoles: a.actorRoles, autoApproveIfRequester: a.autoApproveIfRequester };
    await prisma.workflowStep.update({ where: { id: a.id }, data: { actorScope: "ROLE", actorRoles: ["PRODUCT_MANAGER"], autoApproveIfRequester: true } });
  });

  afterAll(async () => {
    const def = await getDefinition("CONGRESS_INTERNATIONAL").catch(() => null);
    if (def && original) await prisma.workflowStep.updateMany({ where: { definitionId: def.id, slug: "marketing" }, data: original }).catch(() => {});
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: congressId } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: congressId } }).catch(() => {});
    await prisma.congressInternational.deleteMany({ where: { name: { startsWith: TAG5 } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG5 } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG5 } } }).catch(() => {});
  });

  it("l'étape dont le demandeur détient déjà le rôle est approuvée automatiquement en son nom (tracé), sans franchir la décision finale", async () => {
    // Le National Sales approuve le préliminaire et désigne le demandeur (Direction Marketing) ; l'étape d'analyse,
    // dont il détient le rôle, est auto-accordée → on se pose directement sur la décision finale (Direction).
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", assigneeId: reqPmId, note: "OK" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.currentSlug).toBe("final");
    expect(inst.status).toBe("IN_PROGRESS");
    const ev = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "AUTO_APPROVE_REQUESTER", stepSlug: "marketing" } });
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

// ─────────────────── Une définition SANS ÉTAPE n'est pas un circuit ───────────────────

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * MESURÉ EN BASE : une ligne `WorkflowDefinition` avec ZÉRO `WorkflowStep`.
 *
 * `getDefinition` ne regardait que la présence de la LIGNE (`if (existing) return existing`) et
 * rendait donc ce circuit vide comme s'il était configuré. Le prix : `ensureInstance` pose la
 * demande sur un `currentSlug` qu'aucune étape ne porte — la demande existe, apparaît dans les
 * listes, n'a AUCUNE étape en échec, et personne, à aucun rôle, ne peut la faire avancer.
 *
 * Ce que ce banc EXIGE, et ce qui le ferait tomber :
 *   • le resemis remet la colonne vertébrale par défaut (mesurée sur `defaults.ts`), avec des
 *     POSITIONS correctes — passer `stepCreate` sans son index rendait `position: undefined`,
 *     et un circuit sans ordre n'a pas de première étape ;
 *   • une définition DÉJÀ pourvue n'est jamais touchée : resemer par-dessus une configuration
 *     voulue (l'écran d'administration en pose de sur mesure) écraserait la décision d'un humain ;
 *   • et la demande créée après resemis est RÉELLEMENT actionnable — c'est le seul critère qui
 *     compte, le reste n'étant que du comptage de lignes (§118.14).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
suite("Moteur — une définition VIDE est resemée, jamais rendue telle quelle", () => {
  const TAGV = "__wfvide__";
  let categorie: "CONGRESS_NATIONAL" = "CONGRESS_NATIONAL";
  let defId = "";
  // LA RÉFÉRENCE VIENT DE `defaults.ts`, PAS DE LA BASE — et c'est la moitié qui compte.
  // La première version lisait la colonne vertébrale ATTENDUE dans la base juste avant de la
  // vider : une base laissée sale par un run précédent devenait donc à la fois l'état de départ
  // ET l'attendu, et l'assertion ne pouvait plus tomber. C'est §118.91 (« un banc partagé n'est
  // pas reproductible ») appliqué à mon propre banc, et c'est un sabotage qui l'a montré :
  // resemer toutes les étapes en `position: 0` passait au vert.
  const attendu = defaultDefinition("CONGRESS_NATIONAL").steps.map((st) => st.slug);

  beforeAll(async () => {
    // On part de la définition RÉELLE de la catégorie, puis on la vide — c'est l'état mesuré.
    const def = await getDefinition(categorie);
    defId = def.id;
    await prisma.workflowStep.deleteMany({ where: { definitionId: def.id } });
  });

  afterAll(async () => {
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: { startsWith: TAGV } } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: { startsWith: TAGV } } }).catch(() => {});
    await prisma.congressNational.deleteMany({ where: { name: { startsWith: TAGV } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAGV } } }).catch(() => {});
  });

  it("le circuit vidé est RESEMÉ à la lecture suivante — avec ses positions", async () => {
    // Le point de départ est bien l'état fautif : zéro étape en base.
    expect(await prisma.workflowStep.count({ where: { definitionId: defId } }), "le décor doit partir d'un circuit VIDE").toBe(0);

    const def = await getDefinition(categorie);
    const etapes = orderedSteps(def);
    expect(etapes.length, "un circuit sans étape ne peut rien approuver").toBeGreaterThan(0);
    expect(etapes.map((st) => st.slug)).toEqual(attendu);
    // Les POSITIONS, et non seulement le compte : sans index, `stepCreate` rendait la même
    // position pour toutes les étapes, et un circuit sans ordre n'a pas de PREMIÈRE étape.
    // Le tri de `orderedSteps` étant stable, les slugs seraient restés justes — seule cette
    // ligne fait tomber ce défaut.
    expect(etapes.map((st) => st.position)).toEqual(attendu.map((_, i) => i));
  });

  it("une demande créée ensuite est RÉELLEMENT posée sur une étape qui existe", async () => {
    const dem = await prisma.user.create({
      data: { name: `${TAGV}kam`, email: `${TAGV}kam@t.dz`, role: "MEDICAL_DELEGATE" as never, passwordHash: "x" },
    });
    const c = await prisma.congressNational.create({
      data: { name: `${TAGV}Séminaire`, requestStatus: "AWAITING_PRELIMINARY", requesterId: dem.id },
    });
    const inst = await ensureInstance("CONGRESS_NATIONAL", c.id);
    expect(inst, "l'instance doit naître").not.toBeNull();
    const def = await getDefinition(categorie);
    // LE CRITÈRE : le slug porté par l'instance est un slug que le circuit CONNAÎT. Sans cela,
    // la demande est vivante et inavançable — aucune étape en échec, aucun signal.
    expect(orderedSteps(def).map((st) => st.slug)).toContain(inst?.currentSlug ?? "");
  });

  it("une définition DÉJÀ pourvue n'est pas retouchée — on n'écrase pas une configuration voulue", async () => {
    const avantLecture = await prisma.workflowStep.findMany({ where: { definitionId: defId }, select: { id: true }, orderBy: { position: "asc" } });
    await getDefinition(categorie);
    const apres = await prisma.workflowStep.findMany({ where: { definitionId: defId }, select: { id: true }, orderBy: { position: "asc" } });
    expect(apres.map((x) => x.id)).toEqual(avantLecture.map((x) => x.id));
  });
});
