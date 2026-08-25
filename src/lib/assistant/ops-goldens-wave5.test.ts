import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess, Module, Action } from "@/lib/rbac";
import { buildProposal, type AssistantActionPayload } from "@/lib/assistant";

/**
 * GOLDEN OPS VAGUE 5a — Events (FUSION intégrale de la fiche — enums à défauts pièges —,
 * suppression CRITIQUE avec inscriptions comptées, participants par nom), circuit SPONSORING
 * (préliminaire avec chef de produit obligatoire à l'accord, analyse avec budget obligatoire
 * SAUF appel, décision finale CRITIQUE avec montant, appel motivé), circuit CONGRÈS
 * multi-types (« kind » tranche, sponsoring refusé ici), POSTES (résolution par libellé dans
 * l'opération, imputation par nom de catégorie, chaîne BC demande→visa→émission), CONSULTING
 * (co-contractant obligatoire, tâches par libellé).
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

const TAG = `__ops5__${Date.now()}`;
const domainArgs = (p: { payload: unknown }) => (p.payload as Extract<AssistantActionPayload, { kind: "domain_op" }>).args;

let saId = "";
let pmUserId = "";
let eventId = "";
let regId = "";
let spoId = "";
let congressId = "";
let itemId = "";
let contractId = "";
let taskId = "";

const sa = () => userWith({
  EVENTS: ["VIEW", "CREATE", "UPDATE", "DELETE", "VALIDATE"],
  SPONSORING: ["VIEW", "CREATE", "UPDATE", "VALIDATE"],
  CONGRESS_NATIONAL: ["VIEW", "CREATE", "UPDATE", "VALIDATE"],
  CONGRESS_INTERNATIONAL: ["VIEW", "CREATE", "UPDATE", "VALIDATE"],
  AD_PRO_OTHER: ["VIEW", "CREATE", "VALIDATE"],
  CONSULTING: ["VIEW", "CREATE", "UPDATE", "VALIDATE"],
  FINANCES: ["VIEW", "UPDATE"],
}, "SUPER_ADMIN", saId, `${TAG} Amine`);

suite("ops vague 5a — Events, circuits Ad&Pro, postes, Consulting", () => {
  beforeAll(async () => {
    const [s, pm] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG} Amine`, email: `${TAG}s@t.dz`, passwordHash: "x", role: "SUPER_ADMIN" } }),
      prisma.user.create({ data: { name: `${TAG} Nadia CDP`, email: `${TAG}p@t.dz`, passwordHash: "x", role: "PRODUCT_MANAGER" } }),
    ]);
    saId = s.id; pmUserId = pm.id;

    const event = await prisma.event.create({
      data: {
        name: `${TAG} Journée HTA Alger`, type: "SCIENTIFIC_DAY", scope: "NATIONAL", format: "PRESENTIAL",
        status: "REGISTRATION_OPEN", location: "Hôtel El Aurassi", city: "Alger", specialty: "Cardiologie",
        capacity: 120, estimatedBudget: 900_000,
      },
    });
    eventId = event.id;
    const reg = await prisma.eventRegistration.create({
      data: { eventId: event.id, firstName: "Salim", lastName: `${TAG}Merbah`, status: "REGISTERED" },
    });
    regId = reg.id;

    const spo = await prisma.sponsoringRequest.create({
      data: { reference: `${TAG}-SPO-1`, institution: `${TAG} Association cardio Blida`, type: "Sponsoring", status: "AWAITING_PRELIMINARY", amountRequested: 300_000 },
    });
    spoId = spo.id;

    const congress = await prisma.congressNational.create({
      data: { name: `${TAG} Congrès SAHA 2026`, requestStatus: "AWAITING_FINAL", productManagerBudget: 500_000 },
    });
    congressId = congress.id;
    const item = await prisma.adProItem.create({
      data: { congressNationalId: congress.id, kind: "OTHER", label: `${TAG} Location de salle`, amountEstimated: 250_000, status: "DRAFT", position: 1 },
    });
    itemId = item.id;

    const contract = await prisma.consultingContract.create({
      data: {
        reference: `${TAG}-CONS-1`, title: `${TAG} Étude de marché oncologie`, counterparty: `${TAG} Cabinet Meziane`,
        status: "DRAFT", requesterId: s.id,
        tasks: { create: [{ label: `${TAG} Rapport intermédiaire`, position: 0 }] },
      },
      include: { tasks: true },
    });
    contractId = contract.id;
    taskId = contract.tasks[0].id;
  });

  afterAll(async () => {
    await prisma.consultingTask.deleteMany({ where: { label: { startsWith: TAG } } }).catch(() => {});
    await prisma.consultingContract.deleteMany({ where: { reference: { startsWith: TAG } } }).catch(() => {});
    await prisma.adProItem.deleteMany({ where: { label: { startsWith: TAG } } }).catch(() => {});
    await prisma.congressNational.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.sponsoringRequest.deleteMany({ where: { reference: { startsWith: TAG } } }).catch(() => {});
    await prisma.eventRegistration.deleteMany({ where: { lastName: { startsWith: TAG } } }).catch(() => {});
    await prisma.event.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  describe("Events — FUSION de la fiche, inscriptions", () => {
    it("update_event : changer le SEUL statut rejoue type, format, lieu, capacité et budget (les enums-pièges compris)", async () => {
      const p = await buildProposal("event_operation", {
        op: "update_event", target: "Journée HTA", status: "complet",
      }, sa());
      expect("error" in p).toBe(false);
      if ("error" in p) return;
      const a = domainArgs(p);
      expect(a.id).toBe(eventId);
      expect(a.status).toBe("FULL");
      expect(a.type).toBe("SCIENTIFIC_DAY");
      expect(a.format).toBe("PRESENTIAL");
      expect(a.location).toBe("Hôtel El Aurassi");
      expect(a.capacity).toBe("120");
      expect(a.estimatedBudget).toBe("900000");
    });

    it("delete_event : CRITIQUE — confirmText = nom, inscriptions emportées comptées", async () => {
      const p = await buildProposal("event_operation", { op: "delete_event", target: "Journée HTA" }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        expect(p.confirmText).toBe(`${TAG} Journée HTA Alger`);
        expect(p.fields.map((f) => f.value).join(" ")).toContain("1");
      }
    });

    it("set_registration_status : le participant se résout par NOM, le statut FR → enum (présent)", async () => {
      const p = await buildProposal("event_operation", {
        op: "set_registration_status", target: "Journée HTA", person: `${TAG}Merbah`, status: "présent",
      }, sa());
      expect("error" in p).toBe(false);
      if ("error" in p) return;
      expect(domainArgs(p).id).toBe(regId);
      expect(domainArgs(p).status).toBe("PRESENT");
    });
  });

  describe("Sponsoring — le circuit complet", () => {
    it("decide_sponsoring_preliminary : l'ACCORD exige le chef de produit résolu par nom ; le refus, un motif", async () => {
      const noPm = await buildProposal("adpro_operation", {
        op: "decide_sponsoring_preliminary", reference: `${TAG}-SPO-1`, decision: "approuver",
      }, sa());
      expect("error" in noPm).toBe(true);

      const p = await buildProposal("adpro_operation", {
        op: "decide_sponsoring_preliminary", reference: `${TAG}-SPO-1`, decision: "approuver", person: "Nadia CDP",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        expect(domainArgs(p).productManagerId).toBe(pmUserId);
        expect(domainArgs(p).decision).toBe("APPROVE");
      }

      const noReason = await buildProposal("adpro_operation", {
        op: "decide_sponsoring_preliminary", reference: `${TAG}-SPO-1`, decision: "refuser",
      }, sa());
      expect("error" in noReason && noReason.error).toMatch(/motif/i);
    });

    it("analyze_sponsoring : avis obligatoire, budget obligatoire (hors appel)", async () => {
      const noBudget = await buildProposal("adpro_operation", {
        op: "analyze_sponsoring", reference: `${TAG}-SPO-1`, note: "Bonne visibilité produit",
      }, sa());
      expect("error" in noBudget && noBudget.error).toMatch(/budget/i);
      const p = await buildProposal("adpro_operation", {
        op: "analyze_sponsoring", reference: `${TAG}-SPO-1`, note: "Bonne visibilité produit", amount: "250000",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) expect(domainArgs(p).productManagerBudget).toBe("250000");
    });

    it("decide_sponsoring_final : CRITIQUE — l'accord EXIGE le montant ; la déclaration PRIM est annoncée", async () => {
      const noAmount = await buildProposal("adpro_operation", {
        op: "decide_sponsoring_final", reference: `${TAG}-SPO-1`, decision: "accorder",
      }, sa());
      expect("error" in noAmount && noAmount.error).toMatch(/budget final/i);
      const p = await buildProposal("adpro_operation", {
        op: "decide_sponsoring_final", reference: `${TAG}-SPO-1`, decision: "accorder", amount: "200000",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        expect(domainArgs(p).amountGranted).toBe("200000");
        expect(p.warnings.join(" ")).toMatch(/information médicale/);
      }
    });
  });

  describe("Congrès — décisions multi-types & postes", () => {
    it("decide_congress_final : la cible se résout par nom (kind congrès national), montant obligatoire", async () => {
      const p = await buildProposal("adpro_operation", {
        op: "decide_congress_final", target: "Congrès SAHA", kind: "congrès national", decision: "valider", amount: "450000",
      }, sa());
      expect("error" in p).toBe(false);
      if ("error" in p) return;
      expect(domainArgs(p).id).toBe(congressId);
      expect(domainArgs(p).type).toBe("NATIONAL");
      expect(domainArgs(p).finalAmount).toBe("450000");
    });

    it("decide_congress_final : un SPONSORING passé par les ops congrès est refusé net (chacun son circuit)", async () => {
      const p = await buildProposal("adpro_operation", {
        op: "decide_congress_final", target: `${TAG}-SPO-1`, kind: "sponsoring", decision: "valider", amount: "100",
      }, sa());
      expect("error" in p && p.error).toMatch(/propres ops/);
    });

    it("update_item : le poste se résout par LIBELLÉ dans son opération ; seuls les champs donnés partent", async () => {
      const p = await buildProposal("adpro_operation", {
        op: "update_item", target: "Congrès SAHA", kind: "congrès national", label: "Location", grantedAmount: "240000",
      }, sa());
      expect("error" in p).toBe(false);
      if ("error" in p) return;
      expect(domainArgs(p).id).toBe(itemId);
      expect(domainArgs(p).amountGranted).toBe("240000");
      expect(domainArgs(p).label).toBeNull();
      expect(p.warnings.join(" ")).toMatch(/Direction/);
    });

    it("delete_item : CRITIQUE — confirmText = libellé du poste", async () => {
      const p = await buildProposal("adpro_operation", {
        op: "delete_item", target: "Congrès SAHA", kind: "congrès national", label: "Location",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) expect(p.confirmText).toBe(`${TAG} Location de salle`);
    });

    it("add_congress_beneficiary : nom libre accepté ; « EVENT » refusé (prises en charge = congrès)", async () => {
      const p = await buildProposal("adpro_operation", {
        op: "add_congress_beneficiary", target: "Congrès SAHA", kind: "congrès national", person: "Pr Hamdani Lyes", role: "Intervenant",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) {
        expect(domainArgs(p).kind).toBe("NATIONAL");
        expect(domainArgs(p).name).toBe("Pr Hamdani Lyes");
      }
      const onEvent = await buildProposal("adpro_operation", {
        op: "add_congress_beneficiary", target: "Journée HTA", kind: "événement", person: "X",
      }, sa());
      expect("error" in onEvent && onEvent.error).toMatch(/CONGRÈS/);
    });
  });

  describe("Consulting — contrat à deux parties", () => {
    it("create_contract : le CO-CONTRACTANT est obligatoire ; les tâches en virgules deviennent des lignes", async () => {
      const noParty = await buildProposal("consulting_operation", { op: "create_contract", label: "Étude X" }, sa());
      expect("error" in noParty && noParty.error).toMatch(/deux parties/);
      const p = await buildProposal("consulting_operation", {
        op: "create_contract", label: `${TAG} Accompagnement lancement`, counterparty: "Cabinet Idir", tasks: "Cadrage, Rapport final",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) expect(domainArgs(p).tasks).toBe("Cadrage\nRapport final");
    });

    it("decide_contract : CRITIQUE — valider rend le contrat ACTIF ; toggle_contract_task résout la tâche par libellé", async () => {
      const p = await buildProposal("consulting_operation", {
        op: "decide_contract", reference: `${TAG}-CONS-1`, decision: "valider",
      }, sa());
      expect("error" in p).toBe(false);
      if (!("error" in p)) expect(domainArgs(p).approve).toBe("1");

      const t = await buildProposal("consulting_operation", {
        op: "toggle_contract_task", reference: `${TAG}-CONS-1`, label: "Rapport intermédiaire",
      }, sa());
      expect("error" in t).toBe(false);
      if (!("error" in t)) expect(domainArgs(t).taskId).toBe(taskId);
    });
  });
});
