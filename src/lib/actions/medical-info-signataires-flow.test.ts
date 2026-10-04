import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR, getCurrentUser: async () => ACTOR, getCurrentUserPourEcrire: async () => ACTOR }));

import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccess, hasGlobalView, userCan } from "@/lib/rbac";
import { sitsOnValidationCentre } from "@/lib/validations/centre";
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
 * L'ACTEUR VALIDE L'INFORMATION MÉDICALE SANS LA VUE GLOBALE (§118.104), PAR UN ACCÈS PERSONNEL :
 * une responsable budget à qui la console confie cette validation (`UserAccess`, qui REMPLACE les
 * défauts du rôle pour ce module). Un pharmacien actif aurait été l'acteur naturel, mais
 * `emitFinancials` choisit la déclaration dès qu'il en existe un : le créer ici ferait basculer les
 * bancs voisins du moteur Ad & Pro de l'ordre de dépense vers la déclaration. Le référent est posé
 * sur la ligne source, là où `createSponsoring` l'écrit depuis la gamme (§118.144, éprouvé par
 * `referents-db.test.ts`).
 *
 * ── POURQUOI PLUS UN DIRECTEUR GÉNÉRAL — MESURÉ, PAS SUPPOSÉ ────────────────────────────
 *
 * L'acteur était un DG. Sa ligne de base tombait sous charge (« aucun signataire disponible »,
 * « suivi du centre : 1 au lieu de 2 ») et passait seule — puis elle est tombée seule aussi. Ce
 * n'est pas un autre banc qui désactive le siège : `declarationValidators` lit les sièges SANS
 * ordre, donc dans l'ordre PHYSIQUE de la table, et `centreValidatorFrom` prend le premier DG. Un
 * compte neuf se loge dans un trou laissé par les nettoyages des bancs, AVANT le siège stable que
 * `vitest.global-setup.ts` réécrit à chaque passage (mesuré : ctid (7,44) contre (8,51)). Le centre
 * désigné était alors l'ACTEUR lui-même, que `bvChain` écarte ensuite comme demandeur : la marche du
 * centre sautait alors qu'un autre siège existait. Un acteur qui ne siège pas au centre rend la
 * chaîne indépendante de cet ordre. Le banc ne peut pas posséder « son » siège : le siège est
 * global par construction (§118.148h) — un DG plus ancien que lui volerait les validations de
 * toute la suite. Le défaut de PRODUIT (lecture non ordonnée, demandeur écarté APRÈS le choix) est
 * nommé hors de ce fichier, dans `medical-info-actions.ts` — la règle juste est celle de
 * `bons-de-commande/aiguillage.ts`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__misign${Date.now()}__`;
const ROLE_ACTEUR = "FINANCE_BUDGET_MANAGER" as const;
let referentId = "", acteurId = "";
const declarations: string[] = [];

async function soumettre(sourceType: EntityType, sourceId: string) {
  const d = await prisma.medicalInfoDeclaration.create({
    data: { reference: `DIM-2033-${Math.floor(Math.random() * 900000 + 100000)}`, sourceType, sourceId, label: `${TAG}${sourceType}` },
  });
  declarations.push(d.id);
  const access = await getAccess(acteurId, ROLE_ACTEUR);
  ACTOR = { id: acteurId, name: `${TAG}valideur`, email: `${TAG}valideur@t.dz`, role: ROLE_ACTEUR, secondaryRole: null, access, mustChangePassword: false } as CurrentUser;
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

/** Le signataire siège-t-il au centre de validations (DG ou Super Admin actif) ? */
async function siegeActif(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
  return !!u && u.isActive && sitsOnValidationCentre(u);
}

suite("Information médicale — le référent Direction Marketing de la SOURCE signe, sponsoring compris", () => {
  beforeAll(async () => {
    const [referent, acteur] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG}dm`, email: `${TAG}dm@t.dz`, role: "PRODUCT_MANAGER", passwordHash: "x" } }),
      prisma.user.create({ data: { name: `${TAG}valideur`, email: `${TAG}valideur@t.dz`, role: ROLE_ACTEUR, passwordHash: "x" } }),
    ]);
    referentId = referent.id;
    acteurId = acteur.id;
    // L'ACCÈS PERSONNEL : la validation de l'information médicale, et elle seule.
    await prisma.userAccess.create({
      data: { userId: acteurId, module: "MEDICAL_INFO", canView: true, canValidate: true, canUpload: true },
    });
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

  it("PRÉMISSE : l'acteur valide l'information médicale sans la vue globale, et NE SIÈGE PAS au centre", async () => {
    const access = await getAccess(acteurId, ROLE_ACTEUR);
    expect(hasGlobalView({ role: ROLE_ACTEUR })).toBe(false);
    expect(userCan({ id: acteurId, role: ROLE_ACTEUR, secondaryRole: null, access }, "MEDICAL_INFO", "VALIDATE")).toBe(true);
    // C'est ce qui rend la chaîne indépendante de l'ordre des sièges : le centre désigné ne peut
    // jamais être le demandeur, que `bvChain` écarterait.
    expect(sitsOnValidationCentre({ role: ROLE_ACTEUR })).toBe(false);
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
    expect(await siegeActif(signataires[1]), "la dernière marche est un siège du centre").toBe(true);
    expect(demande.description ?? "", "la demande ne dit plus qu'il manque").not.toMatch(/aucun référent Direction Marketing/);
  });

  it("un sponsoring SANS référent saute la marche — et la demande le DIT", async () => {
    const s = await prisma.sponsoringRequest.create({
      data: { reference: `${TAG}SPO0`, institution: `${TAG}Association sans référent`, type: "Association" },
    });
    const { signataires, demande } = await soumettre("SPONSORING", s.id);
    expect(signataires).not.toContain(referentId);
    expect(signataires, "seul le centre signe").toHaveLength(1);
    expect(await siegeActif(signataires[0])).toBe(true);
    expect(demande.description ?? "").toMatch(/aucun référent Direction Marketing sur le dossier/);
  });
});
