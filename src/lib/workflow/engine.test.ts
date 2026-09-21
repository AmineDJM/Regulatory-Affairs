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

suite("Moteur — le parcours d'un KAM : National Sales → DG (sous le seuil, franchie) → Direction → Direction Marketing, qui TRANCHE", () => {
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

  it("AUCUNE borne pour un KAM : depuis l'inversion, sa demande parcourt la chaîne ENTIÈRE (§118.138)", async () => {
    // Ce qui le ferait tomber : garder l'ancienne borne `marketing`. Sa demande s'arrêterait
    // AVANT la Direction des opérations, que la Direction a justement placée devant.
    await advanceWorkflowInstance({ viewer: viewer(otherId, "SALES_USER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "COMMENT", note: "ouvre l'instance" });
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.finalSlug).toBeNull();
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
    // LA PORTE DU DG EST FRANCHIE SEULE : 40 000 DZD, très en dessous du seuil. Ce qui le
    // ferait tomber : la laisser ouverte — un Directeur Général devant chaque petit congrès.
    expect(inst.currentSlug, "on se pose sur la Direction des opérations, la porte du DG étant franchie").toBe("final");
    const auto = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "AUTO_SKIP", stepSlug: "dg" } });
    expect(auto, "le franchissement est TRACÉ — un saut silencieux ne se relit pas").not.toBeNull();
    const c = await prisma.congressInternational.findUniqueOrThrow({ where: { id: congressId } });
    expect(c.requestStatus).toBe("PRELIMINARY_APPROVED");
  });

  it("la Direction des opérations valide SANS chiffrer — le montant appartient à Direction Marketing", async () => {
    // C'EST L'INVERSION (§118.138). La Direction donne son accord sur l'opération ; le montant
    // et la sous-catégorie budgétaire ne se décident plus ici. Ce qui le ferait tomber : laisser
    // les émissions financières sur cette étape — l'ordre de dépense partirait AVANT que le
    // montant ne soit arrêté.
    const r = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", note: "Accord de la Direction" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.currentSlug).toBe("marketing");
    expect(inst.status).toBe("IN_PROGRESS");
    expect(await prisma.expenseOrder.count({ where: { sourceId: congressId } }), "rien n'est engagé avant la décision").toBe(0);
  });

  it("l'ÉCRAN d'un KAM montre la chaîne ENTIÈRE — c'est désormais son parcours", async () => {
    // LE DÉFAUT LE PLUS COÛTEUX DE CET ÉCRAN, dans un sens comme dans l'autre : une frise qui
    // annonce une validation qui n'aura pas lieu, ou qui CACHE une étape que la demande devra
    // franchir. L'écran et le moteur lisent la MÊME borne, et c'est ce qui l'empêche.
    const vue = await getWorkflowForEntity(asSession(delegId, "MEDICAL_DELEGATE"), "CONGRESS_INTERNATIONAL", congressId, delegId);
    expect(vue?.steps.map((st) => st.slug)).toEqual(["preliminary", "dg", "final", "marketing"]);
  });

  it("un tiers n'arbitre pas ; Direction Marketing doit fournir le montant ET la sous-catégorie", async () => {
    const bad = await advanceWorkflowInstance({ viewer: viewer(otherId, "SALES_USER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", amount: 30000, budgetCategoryId: catId });
    expect(bad.ok).toBe(false);
    // LE BUDGET EST CHEZ DIRECTION MARKETING, et c'est elle qui TRANCHE désormais.
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
    // La vue caviardée n'expose pas le SLUG (c'est un détail de moteur) : on reconnaît l'étape
    // par son titre, celui que la définition porte réellement en base.
    const decision = vue?.events.find((e) => e.stepTitle.includes("Direction Marketing") && e.action === "APPROVE");
    expect(decision?.amount, "le montant accordé se lit").toBe(35000);
    expect(decision?.note).toContain("Direction Marketing");
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
 * vente), une autre ENTRÉE (la porte du DG au lieu du préliminaire, et franchie DÈS LA NAISSANCE
 * de l'instance), et le montant fixé par l'étape qui conclut.
 */
suite("Moteur — le parcours d'un demandeur NON-KAM : porte du DG → Direction → Direction Marketing", () => {
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

  it("LA PORTE DU DG EST FRANCHIE DÈS LA NAISSANCE de l'instance — le défaut que ce cas ferme", async () => {
    // Un demandeur non-KAM ENTRE sur la porte du DG (pas de superviseur national au-dessus de
    // lui). Les franchissements automatiques ne se réglaient qu'EN TRANSIT : sa demande serait
    // restée posée là pour toujours, à attendre un Directeur Général qui n'a rien à valider sur
    // 60 000 DZD — sans une étape en échec et sans que rien ne le dise (§118.138).
    const vue = await getWorkflowForEntity(asSession(reqId, "DIRECTION_ASSISTANT"), "CONGRESS_INTERNATIONAL", congressId, reqId);
    expect(vue?.currentSlug).toBe("final");
    expect(vue?.steps.map((st) => st.slug)).toEqual(["preliminary", "dg", "final", "marketing"]);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.finalSlug, "un demandeur non-KAM n'a pas de borne : la dernière étape tranche").toBeNull();
    const auto = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "AUTO_SKIP", stepSlug: "dg" } });
    expect(auto, "et le franchissement est TRACÉ, au nom du demandeur qui vient de soumettre").not.toBeNull();
  });

  it("la Direction valide → la demande AVANCE vers Direction Marketing, et RIEN n'est engagé", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", note: "Accord de la Direction" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.status).toBe("IN_PROGRESS");
    expect(inst.currentSlug).toBe("marketing");
    // Ce qui le ferait tomber : laisser les drapeaux d'émission sur cette étape. L'ordre de
    // dépense partirait sur un montant que personne n'a encore fixé.
    expect(await prisma.expenseOrder.count({ where: { sourceId: congressId } })).toBe(0);
  });

  it("DIRECTION MARKETING TRANCHE : montant, sous-catégorie, et la dépense est ENGAGÉE", async () => {
    // Le mot de Direction Marketing est DÉFINITIF, et c'est elle qui choisit le budget
    // d'imputation. Les deux exigences vivaient sur l'étape de la Direction avant l'inversion.
    const sansMontant = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", budgetCategoryId: catId });
    expect(sansMontant.ok, "un accord sans montant n'est pas un accord").toBe(false);
    const r = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", amount: 55000, budgetCategoryId: catId, note: "Accordé" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.status, "l'étape qui tranche CLÔTURE le circuit").toBe("APPROVED");
    const c = await prisma.congressInternational.findUniqueOrThrow({ where: { id: congressId } });
    expect(c.requestStatus).toBe("APPROVED");
    expect(Number(c.finalAmount)).toBe(55000);
    const order = await prisma.expenseOrder.findFirst({ where: { sourceId: congressId } });
    const decl = await prisma.medicalInfoDeclaration.findFirst({ where: { sourceId: congressId } });
    expect(Boolean(order) || Boolean(decl), "une dépense accordée DOIT être engagée").toBe(true);
    expect(Number(order?.amount ?? decl?.amount)).toBe(55000);
  });

  it("le montant accordé se LIT — l'étape qui tranche n'est plus confidentielle", async () => {
    // Elle ne rend plus un AVIS en attente d'une décision d'en haut, elle EST la décision.
    // Caviarder ce montant laisserait le demandeur devant une demande approuvée dont il ne peut
    // pas lire la somme : un accord illisible n'est pas un accord.
    const vue = await getWorkflowForEntity(asSession(reqId, "DIRECTION_ASSISTANT"), "CONGRESS_INTERNATIONAL", congressId, reqId);
    const decision = vue?.events.find((e) => e.stepTitle.includes("Direction Marketing") && e.action === "APPROVE");
    expect(decision?.amount).toBe(55000);
    expect(decision?.note).toBe("Accordé");
  });
});

const TAG2 = "__wfevt__";

suite("Moteur — avis défavorable non éliminatoire + refus final d'événement (sans crash)", () => {
  let nsId = "", pmId = "", dirId = "", eventId = "";

  beforeAll(async () => {
    const mk = (s: string, role: UserRole) => prisma.user.create({ data: { name: `${TAG2}${s}`, email: `${TAG2}${s}@t.dz`, role, passwordHash: "x" } });
    const [ns, pm, dir] = await Promise.all([mk("ns", "NATIONAL_SALES"), mk("pm", "PRODUCT_MANAGER"), mk("dir", "DIRECTION")]);
    nsId = ns.id; pmId = pm.id; dirId = dir.id;
    // UN BUDGET ESTIMÉ SOUS LE SEUIL : la porte du DG se franchit seule, et l'avis défavorable
    // du National Sales fait donc atterrir la demande sur la Direction des opérations.
    const e = await prisma.event.create({ data: { name: `${TAG2}Event`, type: "ROUND_TABLE", scope: "NATIONAL", format: "PRESENTIAL", status: "DRAFT", requestStatus: "AWAITING_PRELIMINARY", estimatedBudget: 80000 } });
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
    expect(inst.currentSlug, "la porte du DG est franchie seule sous le seuil").toBe("final");
    const ev = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "OPINION_AGAINST" } });
    expect(ev).not.toBeNull();
  });

  it("l'avis défavorable de la DIRECTION avance vers Direction Marketing, qui tranche", async () => {
    // La Direction n'a plus le pouvoir « fixer un montant » : son avis défavorable est un AVIS,
    // et la décision revient à Direction Marketing. Ce qui le ferait tomber : rendre ce refus
    // éliminatoire — la demande mourrait avant d'atteindre celle qui décide.
    const r = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "EVENT", entityId: eventId, action: "REJECT", note: "réserve de la Direction" });
    expect(r.ok).toBe(true);
    const e = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(e.requestStatus).toBe("AWAITING_FINAL");
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "EVENT", entityId: eventId } } });
    expect(inst.currentSlug).toBe("marketing");
    const ev = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, stepSlug: "final", action: "OPINION_AGAINST" } });
    expect(ev).not.toBeNull();
  });

  it("le refus de DIRECTION MARKETING (étape qui tranche) est définitif — sans exception serveur (Event sans updatedById)", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "EVENT", entityId: eventId, action: "REJECT", note: "refus définitif" });
    expect(r.ok).toBe(true);
    const e = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(e.requestStatus).toBe("REJECTED");
    // ET L'ÉTAT DE VIE NE MENT PAS : un financement refusé n'annule pas l'événement (il peut se
    // tenir autrement), donc `status` reste ce qu'il était — jamais « Validé » (§118.138).
    // Ni « Annulé » (on n'a refusé que la prise en charge) ni « En attente de validation » (plus
    // rien n'est attendu) : `DRAFT`, le seul état neutre (§118.138).
    expect(e.status, "un refus de prise en charge ne décide pas de la tenue de l'événement").toBe("DRAFT");
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "EVENT", entityId: eventId } } });
    expect(inst.status).toBe("REJECTED");
  });
});

const TAG3 = "__wfskip__";

suite("Moteur — sauter une étape (tracé & noté, anti-bureaucratie)", () => {
  let nsId = "", pmId = "", dirId = "", dgId = "", delegId = "", otherId = "", congressId = "", kamCongressId = "";

  beforeAll(async () => {
    const mk = (s: string, role: UserRole) => prisma.user.create({ data: { name: `${TAG3}${s}`, email: `${TAG3}${s}@t.dz`, role, passwordHash: "x" } });
    const [ns, pm, dir, gm, deleg, ot] = await Promise.all([
      mk("ns", "NATIONAL_SALES"), mk("pm", "PRODUCT_MANAGER"), mk("dir", "DIRECTION"), mk("dg", "GENERAL_MANAGER"), mk("deleg", "MEDICAL_DELEGATE"), mk("other", "SALES_USER"),
    ]);
    nsId = ns.id; pmId = pm.id; dirId = dir.id; dgId = gm.id; delegId = deleg.id; otherId = ot.id;
    // `marketing` est la DERNIÈRE étape et TRANCHE : elle ne se saute jamais. Les étapes
    // intermédiaires — préliminaire, porte du DG, Direction — se sautent, elles. Le montant est
    // laissé à ZÉRO pour que la porte du DG NE soit PAS franchie automatiquement : on veut
    // éprouver le saut MANUEL, pas le franchissement par seuil (un montant inconnu ouvre la
    // porte du DG, §118.138).
    const c = await prisma.congressInternational.create({ data: { name: `${TAG3}Congrès`, requestStatus: "AWAITING_PRELIMINARY", requesterId: dirId } });
    congressId = c.id;
    const kamC = await prisma.congressInternational.create({ data: { name: `${TAG3}KAM`, requestStatus: "AWAITING_FINAL", requesterId: delegId } });
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
    expect(inst.currentSlug, "on arrive sur la porte du DG — montant inconnu, donc elle NE se franchit pas seule").toBe("dg");
  });

  it("la porte du DG se saute AUSSI à la main, avec raison — et c'est tracé", async () => {
    // Le DG n'est pas obligé d'attendre le seuil : il peut décider que ce dossier ne le concerne
    // pas. Ce qui le ferait tomber : refuser le saut sur cette étape — un montant inconnu la
    // rend obligatoire, et sans porte de sortie manuelle le dossier resterait bloqué.
    const r = await advanceWorkflowInstance({ viewer: viewer(dgId, "GENERAL_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "Montant sans enjeu pour la DG" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.currentSlug).toBe("final");
    const ev = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "SKIP", stepSlug: "dg" } });
    expect(ev).not.toBeNull();
  });

  it("le saut exige une raison et n'est ouvert qu'à l'acteur de l'étape", async () => {
    const noReason = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "" });
    expect(noReason.ok).toBe(false);
    const thirdParty = await advanceWorkflowInstance({ viewer: viewer(otherId, "SALES_USER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "je saute" });
    expect(thirdParty.ok).toBe(false);
  });

  it("la Direction saute son étape avec raison → avance vers Direction Marketing, tracé", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "Rien à redire, on file à Direction Marketing" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.status).toBe("IN_PROGRESS");
    expect(inst.currentSlug).toBe("marketing");
    const ev = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "SKIP", stepSlug: "final" } });
    expect(ev).not.toBeNull();
    expect(ev?.note).toContain("Direction Marketing");
  });

  it("on ne peut pas sauter la DÉCISION — c'est Direction Marketing qui tranche", async () => {
    const r = await advanceWorkflowInstance({ viewer: viewer(pmId, "PRODUCT_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "SKIP", note: "raison" });
    expect(r.ok).toBe(false);
    expect(r.ok === false ? r.error : "").toContain("finale");
  });

  it("SUR UNE DEMANDE DE DIRECTION MARKETING, c'est l'étape de la DIRECTION qui tranche — et ne se saute pas", async () => {
    // Le cas symétrique, et celui qui prouve la borne : la demande d'un KAM parcourt tout, donc
    // `marketing` tranche ; celle de Direction Marketing s'arrête une étape plus tôt, donc c'est
    // `final` qui tranche. Cette garde ne coûte pas une ligne : elle tombe de `nextStepAfter` —
    // pas de successeur, donc décision, donc saut refusé. Ce qui le ferait tomber : lire la
    // borne ailleurs que dans « y a-t-il une étape après celle-ci ? ».
    const pmC = await prisma.congressInternational.create({ data: { name: `${TAG3}PM`, requestStatus: "PRELIMINARY_APPROVED", requesterId: pmId } });
    await advanceWorkflowInstance({ viewer: viewer(dgId, "GENERAL_MANAGER"), entityType: "CONGRESS_INTERNATIONAL", entityId: pmC.id, action: "SKIP", note: "sans enjeu" });
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: pmC.id } } });
    expect(inst.finalSlug, "sa chaîne s'arrête chez la Direction").toBe("final");
    expect(inst.currentSlug).toBe("final");
    const r = await advanceWorkflowInstance({ viewer: viewer(dirId, "DIRECTION"), entityType: "CONGRESS_INTERNATIONAL", entityId: pmC.id, action: "SKIP", note: "on saute" });
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
      // MÊME PETIT MONTANT, DEMANDÉ PAR UN KAM : `marketing` est la dernière étape de sa chaîne
      // et TRANCHE, et une décision d'accord ne se franchit pas toute seule.
      prisma.congressInternational.create({ data: { name: `${TAG4}Kam`, requestStatus: "AWAITING_PRELIMINARY", requesterId: delegId, estimatedBudget: 5000 } }),
    ]);
    lowId = low.id; highId = high.id; kamLowId = kamLow.id;
    // Configure un seuil de 10 000 sur l'étape de la DIRECTION (partagée) — restaurée en
    // afterAll. Ce n'est plus « marketing » : depuis l'inversion, c'est elle qui TRANCHE, et une
    // décision d'accord ne se franchit jamais seule. Un seuil écrit à la main sur une étape
    // l'emporte sur le seuil global (`seuilFranchissement`), et c'est cette priorité que ces cas
    // éprouvent en même temps.
    const def = await getDefinition("CONGRESS_INTERNATIONAL");
    await prisma.workflowStep.updateMany({ where: { definitionId: def.id, slug: "final" }, data: { autoSkipMaxAmount: 10000 } });
  });

  afterAll(async () => {
    const def = await getDefinition("CONGRESS_INTERNATIONAL").catch(() => null);
    if (def) await prisma.workflowStep.updateMany({ where: { definitionId: def.id, slug: "final" }, data: { autoSkipMaxAmount: null } }).catch(() => {});
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: { in: [lowId, highId, kamLowId] } } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: { in: [lowId, highId, kamLowId] } } }).catch(() => {});
    await prisma.congressInternational.deleteMany({ where: { name: { startsWith: TAG4 } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG4 } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG4 } } }).catch(() => {});
  });

  it("montant estimé ≤ seuil : la porte du DG ET l'étape de la Direction sont franchies (tracé) → on se pose sur la DÉCISION", async () => {
    // DEUX franchissements d'affilée : la porte du DG (seuil global, 1 000 000) puis l'étape de
    // la Direction (seuil d'étape, 10 000). S'arrêter sur la première laisserait la demande sur
    // une étape franchissable — c'est la boucle de `settleAutoSkips` que ce cas éprouve.
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: lowId, action: "APPROVE", note: "OK" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: lowId } } });
    expect(inst.currentSlug).toBe("marketing");
    expect(inst.status, "franchi n'est pas clôturé : Direction Marketing doit encore trancher").toBe("IN_PROGRESS");
    const sauts = await prisma.workflowStepEvent.findMany({ where: { instanceId: inst.id, action: "AUTO_SKIP" }, select: { stepSlug: true } });
    expect(sauts.map((x) => x.stepSlug).sort()).toEqual(["dg", "final"]);
  });

  it("montant estimé > seuil de l'étape : la validation humaine de la Direction est CONSERVÉE", async () => {
    // 50 000 > 10 000 (seuil de l'étape) mais < 1 000 000 (seuil global du DG) : la porte du DG
    // s'ouvre seule, celle de la Direction NON. C'est la priorité entre les deux seuils, mesurée.
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: highId, action: "APPROVE", note: "OK" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: highId } } });
    expect(inst.currentSlug).toBe("final");
    const sauts = await prisma.workflowStepEvent.findMany({ where: { instanceId: inst.id, action: "AUTO_SKIP" }, select: { stepSlug: true } });
    expect(sauts.map((x) => x.stepSlug)).toEqual(["dg"]);
  });

  it("MÊME SOUS LE SEUIL, l'étape qui TRANCHE n'est jamais franchie automatiquement — un humain accorde", async () => {
    // Le seuil anti-bureaucratie et la borne du parcours se rencontrent ici. Direction Marketing
    // accorde le budget : la franchir automatiquement engagerait une dépense que PERSONNE n'a
    // décidée. Cette garde tombe de `nextStepAfter` — pas de successeur, donc décision, donc
    // jamais de franchissement automatique. Ce qui le ferait tomber : appliquer le seuil sans
    // regarder s'il existe une étape après.
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: kamLowId, action: "APPROVE", note: "OK" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: kamLowId } } });
    expect(inst.currentSlug, "la demande ATTEND la décision de Direction Marketing").toBe("marketing");
    expect(inst.status).toBe("IN_PROGRESS");
    expect(await prisma.workflowStepEvent.count({ where: { instanceId: inst.id, action: "AUTO_SKIP", stepSlug: "marketing" } }), "l'étape décisive n'est JAMAIS franchie").toBe(0);
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
    // Le DEMANDEUR est la Direction Marketing ; budget AU-DESSUS DU SEUIL GLOBAL du DG
    // (1 000 000) pour isoler le motif « autorité ». Avec 90 000, la porte était franchie par le
    // MONTANT avant que l'autorité n'ait son mot à dire — et le cas mesurait alors l'autre
    // mécanisme, sans qu'une ligne ne le dise (§118.111).
    const c = await prisma.congressInternational.create({ data: { name: `${TAG5}Congrès`, requestStatus: "AWAITING_PRELIMINARY", requesterId: reqPmId, estimatedBudget: 5_000_000 } });
    congressId = c.id;
    // Reconfigure temporairement la PORTE DU DG en portée ROLE[PRODUCT_MANAGER] + auto-accord si
    // demandeur. Ce n'est plus « marketing » : depuis l'inversion, c'est elle qui TRANCHE sur une
    // demande de KAM, et l'auto-accord ne franchit jamais une décision. La porte du DG est
    // l'étape intermédiaire dont le demandeur peut détenir le rôle.
    const def = await getDefinition("CONGRESS_INTERNATIONAL");
    const a = await prisma.workflowStep.findFirstOrThrow({ where: { definitionId: def.id, slug: "dg" } });
    original = { actorScope: a.actorScope, actorRoles: a.actorRoles, autoApproveIfRequester: a.autoApproveIfRequester };
    await prisma.workflowStep.update({ where: { id: a.id }, data: { actorScope: "ROLE", actorRoles: ["PRODUCT_MANAGER"], autoApproveIfRequester: true } });
  });

  afterAll(async () => {
    const def = await getDefinition("CONGRESS_INTERNATIONAL").catch(() => null);
    if (def && original) await prisma.workflowStep.updateMany({ where: { definitionId: def.id, slug: "dg" }, data: original }).catch(() => {});
    await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: congressId } } }).catch(() => {});
    await prisma.workflowInstance.deleteMany({ where: { entityId: congressId } }).catch(() => {});
    await prisma.congressInternational.deleteMany({ where: { name: { startsWith: TAG5 } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG5 } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG5 } } }).catch(() => {});
  });

  it("l'étape dont le demandeur détient déjà le rôle est approuvée automatiquement en son nom (tracé), sans franchir la DÉCISION", async () => {
    // Le National Sales approuve le préliminaire ; la porte suivante, dont le DEMANDEUR détient
    // le rôle, est auto-accordée en son nom → on se pose sur l'étape d'après. On ne fait pas
    // valider à quelqu'un sa propre demande, et l'on ne franchit jamais pour autant la décision.
    const r = await advanceWorkflowInstance({ viewer: viewer(nsId, "NATIONAL_SALES"), entityType: "CONGRESS_INTERNATIONAL", entityId: congressId, action: "APPROVE", note: "OK" });
    expect(r.ok).toBe(true);
    const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congressId } } });
    expect(inst.currentSlug).toBe("final");
    expect(inst.status).toBe("IN_PROGRESS");
    const ev = await prisma.workflowStepEvent.findFirst({ where: { instanceId: inst.id, action: "AUTO_APPROVE_REQUESTER", stepSlug: "dg" } });
    expect(ev, "le motif est l'AUTORITÉ du demandeur, pas le seuil — 5 000 000 DZD le dépassent").not.toBeNull();
    expect(await prisma.workflowStepEvent.count({ where: { instanceId: inst.id, action: "AUTO_SKIP" } }), "et aucun franchissement par MONTANT ne s'est mêlé de la mesure").toBe(0);
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
