import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR, getCurrentUser: async () => ACTOR, getCurrentUserPourEcrire: async () => ACTOR }));

import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccess, hasGlobalView, userCan } from "@/lib/rbac";
import { requestDeclareDecision } from "./medical-info-actions";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RÉFÉRENT DIRECTION MARKETING SIGNE LA DÉCLARATION D'UN SPONSORING — comme celle d'un congrès.
 *
 * La lecture du pharmacien se fait valider par trois signataires (`bv-approval.ts`) : le N+1, le
 * référent Direction Marketing du dossier SOURCE (« sponsoring, congrès, événement »), le centre.
 * MESURÉ par la vraie porte (`requestDeclareDecision`), avant la réparation : pour un sponsoring
 * qui porte son référent, la chaîne partait au seul centre, avec « aucun référent Direction
 * Marketing sur le dossier » écrit dans la demande ; pour un congrès portant le MÊME référent, il
 * signait en premier. `productManagerOfSource` ne lisait pas le sponsoring.
 *
 * L'ACTEUR est un Directeur Général : il porte la validation de l'information médicale SANS la vue
 * globale (§118.104). Un pharmacien actif aurait été l'acteur naturel, mais `emitFinancials` choisit
 * la déclaration dès qu'il en existe un : le créer ici ferait basculer les bancs voisins du moteur
 * Ad & Pro de l'ordre de dépense vers la déclaration. Le référent est posé sur la ligne source, là
 * où `createSponsoring` l'écrit depuis la gamme (§118.144, éprouvé par `referents-db.test.ts`).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__misign${Date.now()}__`;
let referentId = "", acteurId = "";
const declarations: string[] = [];

async function soumettre(sourceType: EntityType, sourceId: string) {
  const d = await prisma.medicalInfoDeclaration.create({
    data: { reference: `DIM-2033-${Math.floor(Math.random() * 900000 + 100000)}`, sourceType, sourceId, label: `${TAG}${sourceType}` },
  });
  declarations.push(d.id);
  const access = await getAccess(acteurId, "GENERAL_MANAGER");
  ACTOR = { id: acteurId, name: `${TAG}dg`, email: `${TAG}dg@t.dz`, role: "GENERAL_MANAGER", secondaryRole: null, access, mustChangePassword: false } as CurrentUser;
  const f = new FormData();
  f.set("id", d.id);
  f.set("intent", "DECLARE");
  const r = await requestDeclareDecision(undefined, f);
  expect(r.ok, r.ok ? "" : r.error).toBe(true);
  const relue = await prisma.medicalInfoDeclaration.findUniqueOrThrow({ where: { id: d.id } });
  const demande = await prisma.validationRequest.findUniqueOrThrow({ where: { id: relue.declareValidationId! } });
  const etapes = await prisma.validationStep.findMany({ where: { requestId: demande.id }, orderBy: { order: "asc" } });
  return { demande, signataires: etapes.map((e) => e.validatorId) };
}

suite("Information médicale — le référent Direction Marketing de la SOURCE signe, sponsoring compris", () => {
  beforeAll(async () => {
    const [referent, acteur] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG}dm`, email: `${TAG}dm@t.dz`, role: "PRODUCT_MANAGER", passwordHash: "x" } }),
      prisma.user.create({ data: { name: `${TAG}dg`, email: `${TAG}dg@t.dz`, role: "GENERAL_MANAGER", passwordHash: "x" } }),
    ]);
    referentId = referent.id;
    acteurId = acteur.id;
  });

  afterAll(async () => {
    const demandes = await prisma.validationRequest.findMany({ where: { requesterId: acteurId }, select: { id: true } }).catch(() => []);
    await prisma.validationStep.deleteMany({ where: { requestId: { in: demandes.map((d) => d.id) } } }).catch(() => {});
    await prisma.validationRequest.deleteMany({ where: { id: { in: demandes.map((d) => d.id) } } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [referentId, acteurId] } } }).catch(() => {});
    await prisma.medicalInfoDeclaration.deleteMany({ where: { id: { in: declarations } } }).catch(() => {});
    await prisma.sponsoringRequest.deleteMany({ where: { institution: { startsWith: TAG } } }).catch(() => {});
    await prisma.congressInternational.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: { in: [referentId, acteurId] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [referentId, acteurId] } } }).catch(() => {});
  });

  it("PRÉMISSE : l'acteur valide l'information médicale sans la vue globale", async () => {
    const access = await getAccess(acteurId, "GENERAL_MANAGER");
    expect(hasGlobalView({ role: "GENERAL_MANAGER" })).toBe(false);
    expect(userCan({ id: acteurId, role: "GENERAL_MANAGER", secondaryRole: null, access }, "MEDICAL_INFO", "VALIDATE")).toBe(true);
  });

  it("LE TÉMOIN : la déclaration d'un CONGRÈS est signée d'abord par son référent", async () => {
    const c = await prisma.congressInternational.create({ data: { name: `${TAG}Congrès`, productManagerId: referentId } });
    const { signataires, demande } = await soumettre("CONGRESS_INTERNATIONAL", c.id);
    expect(signataires[0], "le référent signe en premier — l'acteur n'a pas de N+1").toBe(referentId);
    expect(demande.description ?? "").not.toMatch(/aucun référent Direction Marketing/);
  });

  it("la déclaration d'un SPONSORING est signée par SON référent — la marche n'est plus sautée", async () => {
    const s = await prisma.sponsoringRequest.create({
      data: { reference: `${TAG}SPO`, institution: `${TAG}Association`, type: "Association", productManagerId: referentId },
    });
    const { signataires, demande } = await soumettre("SPONSORING", s.id);
    expect(signataires, "le référent du sponsoring est dans la chaîne").toContain(referentId);
    expect(signataires[0], "et il signe AVANT le centre, comme pour un congrès").toBe(referentId);
    expect(signataires.length, "suivi du centre de validations").toBe(2);
    expect(demande.description ?? "", "la demande ne dit plus qu'il manque").not.toMatch(/aucun référent Direction Marketing/);
  });

  it("un sponsoring SANS référent saute la marche — et la demande le DIT", async () => {
    const s = await prisma.sponsoringRequest.create({
      data: { reference: `${TAG}SPO0`, institution: `${TAG}Association sans référent`, type: "Association" },
    });
    const { signataires, demande } = await soumettre("SPONSORING", s.id);
    expect(signataires).not.toContain(referentId);
    expect(demande.description ?? "").toMatch(/aucun référent Direction Marketing sur le dossier/);
  });
});
