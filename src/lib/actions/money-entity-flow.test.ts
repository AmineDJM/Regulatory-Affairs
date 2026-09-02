import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));

let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { moneyEntityOf } from "@/lib/company";
import { createPaymentRequest } from "./payment-request-actions";
import { transferPayrollToBudget } from "./payroll-hr-actions";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__moneyent__";

async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

const withPiece = (fields: Record<string, string>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  fd.set("kind_0", "INVOICE");
  fd.set("paymentMethodStated", "1");
  fd.append("files", new File([new Uint8Array([1, 2, 3])], "facture.pdf", { type: "application/pdf" }));
  return fd;
};

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ENTITÉ EST LA COLONNE VERTÉBRALE DE L'ARGENT.
 *
 * Elle était facultative et implicite : la demande de paiement prenait celle du demandeur en
 * silence — et, pire, celle de sa PORTÉE D'AFFICHAGE. Un délégué de Pharmagène qui consultait
 * Adventum imputait sa demande à Adventum : la société qui paie était décidée par un cookie.
 *
 * Et la masse salariale du budget restait un montant SAISI À LA MAIN, qu'on remontait à chaque
 * embauche et qu'on oubliait à chaque départ.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
suite("L'entité de l'argent", () => {
  let advId = "", phaId = "", deptId = "", rhId = "", demandeurId = "", employeId = "";

  beforeAll(async () => {
    const [adv, pha] = await Promise.all([
      prisma.company.create({ data: { name: `${TAG} Adventum`, shortName: `${TAG}ADV` } }),
      prisma.company.create({ data: { name: `${TAG} Pharmagène`, shortName: `${TAG}PHA` } }),
    ]);
    advId = adv.id; phaId = pha.id;
    const dept = await prisma.department.create({ data: { name: `${TAG} Ventes`, code: `${TAG}V`, companyId: phaId } });
    deptId = dept.id;

    const [rh, dem] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG}rh`, email: `${TAG}rh@t.dz`, role: "SUPER_ADMIN", passwordHash: "x" } }),
      prisma.user.create({ data: { name: `${TAG}dem`, email: `${TAG}dem@t.dz`, role: "MEDICAL_DELEGATE", passwordHash: "x" } }),
    ]);
    rhId = rh.id; demandeurId = dem.id;

    // LE DEMANDEUR TRAVAILLE CHEZ PHARMAGÈNE : c'est cette société qui doit payer ses dépenses.
    const emp = await prisma.employee.create({
      data: {
        fullName: `${TAG} Délégué`, userId: demandeurId, companyId: phaId, departmentId: deptId,
        employerCost: 120_000,
      },
    });
    employeId = emp.id;
    // On lui ouvre les DEUX entités : sans cela, la règle ne pourrait pas se tromper de société,
    // et le test ne prouverait rien.
    await prisma.userCompanyAccess.createMany({
      data: [
        { userId: demandeurId, companyId: advId, canEdit: true },
        { userId: demandeurId, companyId: phaId, canEdit: true },
      ],
    });
    await prisma.userAccess.create({
      data: { userId: demandeurId, module: "VALIDATIONS", canView: true, canCreate: true, scope: "ALL" },
    });
  });

  afterAll(async () => {
    await prisma.departmentBudget.deleteMany({ where: { departmentId: deptId } }).catch(() => {});
    await prisma.financeTransaction.deleteMany({ where: { employeeId: employeId } }).catch(() => {});
    await prisma.payrollEntry.deleteMany({ where: { employeeId: employeId } }).catch(() => {});
    await prisma.paymentRequest.deleteMany({ where: { requesterId: demandeurId } }).catch(() => {});
    await prisma.employee.deleteMany({ where: { id: employeId } }).catch(() => {});
    await prisma.userCompanyAccess.deleteMany({ where: { userId: demandeurId } }).catch(() => {});
    await prisma.userAccess.deleteMany({ where: { userId: { in: [rhId, demandeurId] } } }).catch(() => {});
    await prisma.department.deleteMany({ where: { id: deptId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: { in: [advId, phaId] } } }).catch(() => {});
  });

  describe("la demande de paiement", () => {
    it("L'ARGENT SUIT LA PERSONNE — sa société, pas la portée de son écran", async () => {
      expect(await moneyEntityOf(demandeurId)).toBe(phaId);
    });

    it("l'entité CHOISIE l'emporte : la Direction ou le demandeur peut désigner l'autre société", async () => {
      ACTOR = await actorFor(demandeurId, "MEDICAL_DELEGATE");
      const r = await createPaymentRequest(undefined, withPiece({
        title: `${TAG} Facture imprimeur`, payee: "Imprimeur", amount: "40000", companyId: advId,
      }));
      expect(r.ok, r.error).toBe(true);
      const req = await prisma.paymentRequest.findUniqueOrThrow({ where: { id: r.id! } });
      expect(req.companyId).toBe(advId);
    });

    it("sans choix, elle prend celle du DEMANDEUR — pas celle qu'il regarde", async () => {
      ACTOR = await actorFor(demandeurId, "MEDICAL_DELEGATE");
      const r = await createPaymentRequest(undefined, withPiece({
        title: `${TAG} Facture transporteur`, payee: "Transporteur", amount: "12000",
      }));
      expect(r.ok, r.error).toBe(true);
      expect((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: r.id! } })).companyId).toBe(phaId);
    });

    it("UNE ENTITÉ QUI N'EST PAS LA SIENNE EST REFUSÉE, et le motif envoie à la bonne porte", async () => {
      const autre = await prisma.company.create({ data: { name: `${TAG} Tierce`, shortName: `${TAG}T` } });
      ACTOR = await actorFor(demandeurId, "MEDICAL_DELEGATE");
      const r = await createPaymentRequest(undefined, withPiece({
        title: `${TAG} Hors périmètre`, payee: "X", amount: "1000", companyId: autre.id,
      }));
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/ne vous est pas ouverte/i);
      await prisma.company.delete({ where: { id: autre.id } }).catch(() => {});
    });

    it("UN BROUILLON se garde incomplet — c'est sa raison d'être", async () => {
      ACTOR = await actorFor(demandeurId, "MEDICAL_DELEGATE");
      const fd = withPiece({ title: `${TAG} Brouillon`, payee: "X", amount: "500", companyId: "" });
      fd.set("submit", "0");
      expect((await createPaymentRequest(undefined, fd)).ok).toBe(true);
    });
  });

  describe("la masse salariale au budget", () => {
    it("S'ACTUALISE, ELLE NE S'AJOUTE PAS — et rejouer le transfert ne double rien", async () => {
      await prisma.payrollEntry.create({
        data: {
          employeeId: employeId, year: 2031, month: 3, status: "PAID", paidDate: new Date(),
          gross: 100_000, net: 80_000, bonuses: 0, deductions: 0, employerCost: 120_000,
        },
      });
      const envelope = await prisma.budgetEnvelope.create({
        data: {
          name: `${TAG} Enveloppe`, periodStart: new Date("2031-01-01"), periodEnd: new Date("2031-12-31"),
          totalAmount: 1_000_000,
        },
      });
      const cat = await prisma.budgetCategoryLine.create({
        data: { envelopeId: envelope.id, name: `${TAG} Salaires`, allocated: 1_000_000 },
      });

      ACTOR = await actorFor(rhId, "SUPER_ADMIN");
      const fd = new FormData();
      fd.set("year", "2031"); fd.set("month", "3"); fd.set("budgetCategoryId", cat.id);
      const r = await transferPayrollToBudget(fd);
      expect(r.ok, r.error).toBe(true);

      const apres = await prisma.departmentBudget.findUniqueOrThrow({
        where: { departmentId_year_kind: { departmentId: deptId, year: 2031, kind: "HR" } },
      });
      expect(Number(apres.amount), "la masse salariale vaut le coût employeur payé").toBe(120_000);

      // REJOUER : rien de neuf à transférer, et surtout aucune addition.
      const encore = await transferPayrollToBudget(fd);
      expect(encore.ok).toBe(false);
      const inchange = await prisma.departmentBudget.findUniqueOrThrow({
        where: { departmentId_year_kind: { departmentId: deptId, year: 2031, kind: "HR" } },
      });
      expect(Number(inchange.amount), "un second transfert ne doit rien ADDITIONNER").toBe(120_000);

      await prisma.budgetCategoryLine.delete({ where: { id: cat.id } }).catch(() => {});
      await prisma.budgetEnvelope.delete({ where: { id: envelope.id } }).catch(() => {});
    });
  });
});
