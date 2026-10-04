import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";
import { cliquerDecisif } from "./decisif";

/**
 * ═════════════════════════════════════════════════════════════════
 * LE RECRUTEMENT SE CORRIGE — dans le navigateur (audit 360°, lot C4d1, §118.192).
 *
 * Le banc de flux (`recruitment-correction-flow.test.ts`) prouve les RÈGLES par les vraies actions ;
 * celui-ci prouve qu'elles ont un ÉCRAN qui les déclenche (§118.50), dans la peau de trois personnes :
 *   - le VALIDATEUR de la deuxième marche renvoie la demande pour correction, avec son motif ;
 *   - le DEMANDEUR la retrouve dans « Mon espace », lit le motif, relève la rémunération sur un
 *     formulaire PRÉ-REMPLI : la chaîne repart de sa première marche, et l'historique le dit ;
 *   - les RH rouvrent une demande refusée (la phrase dit à quelle marche elle repart) et annulent une
 *     embauche avant sa fiche employé.
 *
 * Décor propre à la spec (préfixe `__e2e15__`), posé en base et retiré au début et à la fin.
 * ═════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const P = "__e2e15__";
const EMAIL = { dem: `${P}dem@test.dz`, n1: `${P}n1@test.dz`, n2: `${P}n2@test.dz`, rh: `${P}rh@test.dz` };
const MOTIF = "La fourchette est trop basse pour le marché d'Oran.";
const CHANGE = "Fourchette relevée à 130 000 DZD.";
const REOUVERTURE = "Budget débloqué au comité du 30/09.";
const DESISTEMENT = "Le candidat a accepté une autre offre.";

const u: Record<string, string> = {};
let renvoiId = "";
let refuseeId = "";
let integrationId = "";
let candidatId = "";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(E2E.password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  // 60 s : la toute première connexion après un build propre est lente (§118.124b).
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
}

/** Naviguer PUIS attendre l'hydratation : un clic posé avant ne fait rien (§118.168). */
async function aller(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function nettoyer() {
  const ids = (await prisma.user.findMany({ where: { email: { startsWith: P } }, select: { id: true } })).map((x) => x.id);
  const reqs = (await prisma.recruitmentRequest.findMany({ where: { reference: { startsWith: P } }, select: { id: true } })).map((r) => r.id);
  await prisma.comment.deleteMany({ where: { entityType: "RECRUITMENT_REQUEST", entityId: { in: reqs } } });
  await prisma.recruitmentCandidate.deleteMany({ where: { requestId: { in: reqs } } });
  await prisma.recruitmentRequest.deleteMany({ where: { id: { in: reqs } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: reqs } }] } }).catch(() => {});
  await prisma.userAccess.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await nettoyer();
  const hash = await bcrypt.hash(E2E.password, 10);
  for (const [k, nom] of [["dem", "Demandeur"], ["n1", "Premier validateur"], ["n2", "Second validateur"], ["rh", "RH"]] as const) {
    u[k] = (await prisma.user.create({ data: { email: EMAIL[k], name: `${P} ${nom}`, passwordHash: hash, role: "VIEWER" }, select: { id: true } })).id;
    await prisma.userAccess.create({ data: { userId: u[k]!, module: "RECRUITMENT", canView: true, canCreate: k === "dem", scope: "ASSIGNED" } });
  }
  // Les RH sans vue globale : un accès personnalisé au module RH (§118.104).
  await prisma.userAccess.create({ data: { userId: u.rh!, module: "RH", canView: true, canUpdate: true, scope: "ALL" } });

  const commun = { requesterId: u.dem!, position: `${P} Délégué médical Oran`, headcount: 2, contractType: "CDI" as const, salaryMin: 80_000, salaryMax: 100_000 };
  const marches = { create: [{ order: 1, approverId: u.n1! }, { order: 2, approverId: u.n2! }] };
  // La marche 1 a validé ; c'est le tour de la marche 2 — l'état exact que produit la chaîne.
  renvoiId = (await prisma.recruitmentRequest.create({ data: { ...commun, reference: `${P}REC-1`, stage: "CHAIN", approvals: marches }, select: { id: true } })).id;
  await prisma.recruitmentApproval.updateMany({ where: { requestId: renvoiId, order: 1 }, data: { status: "APPROVED", decidedAt: new Date() } });
  // Refusée à la marche 2, avec son motif.
  refuseeId = (await prisma.recruitmentRequest.create({ data: { ...commun, reference: `${P}REC-2`, stage: "REJECTED", closingNote: "Pas cette année.", approvals: marches }, select: { id: true } })).id;
  await prisma.recruitmentApproval.updateMany({ where: { requestId: refuseeId, order: 1 }, data: { status: "APPROVED", decidedAt: new Date() } });
  await prisma.recruitmentApproval.updateMany({ where: { requestId: refuseeId, order: 2 }, data: { status: "REJECTED", reason: "Pas cette année.", decidedAt: new Date() } });
  // En intégration : un candidat recruté, sans fiche employé.
  integrationId = (await prisma.recruitmentRequest.create({ data: { ...commun, reference: `${P}REC-3`, stage: "ONBOARDING", approvals: marches }, select: { id: true } })).id;
  await prisma.recruitmentApproval.updateMany({ where: { requestId: integrationId }, data: { status: "APPROVED", decidedAt: new Date() } });
  candidatId = (await prisma.recruitmentCandidate.create({ data: { requestId: integrationId, fullName: `${P} Candidate retenue`, status: "HIRED" }, select: { id: true } })).id;
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

test("RENVOYER — le second validateur renvoie la demande à son demandeur, avec son motif", async ({ page }) => {
  // Le premier parcours après un build propre paie le démarrage à froid du serveur (§118.124b).
  test.setTimeout(120_000);
  await login(page, EMAIL.n2);
  await aller(page, `/recrutement/${renvoiId}`);
  const renvoyer = page.getByRole("button", { name: "Renvoyer pour correction" });
  // Sans motif, le geste n'est pas offert : c'est ce que le demandeur lira.
  await expect(renvoyer).toBeDisabled();
  await page.getByPlaceholder("Ex. Budget non prévu cette année.").fill(MOTIF);
  await cliquerDecisif(renvoyer);
  await expect(page.getByText(`Renvoyée pour correction par ${P} Second validateur`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(`« ${MOTIF} »`)).toBeVisible();
  const r = await prisma.recruitmentRequest.findUniqueOrThrow({ where: { id: renvoiId }, select: { stage: true, returnedById: true, returnedFrom: true } });
  expect(r).toEqual({ stage: "RETURNED", returnedById: u.n2, returnedFrom: "CHAIN" });
});

test("CORRIGER — le demandeur retrouve sa demande dans « Mon espace », relève la rémunération : la chaîne repart de sa première marche", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, EMAIL.dem);
  await aller(page, "/mon-espace");
  await expect(page.getByText(`À corriger — ${P}REC-1 — ${P} Délégué médical Oran`)).toBeVisible({ timeout: 15_000 });
  await aller(page, `/recrutement/${renvoiId}`);
  await expect(page.getByText(`« ${MOTIF} »`)).toBeVisible();
  // Le formulaire part du besoin ENREGISTRÉ, jamais d'un formulaire vide.
  const max = page.locator('input[name="salaryMax"]');
  await expect(max).toHaveValue("100000");
  await expect(page.locator('input[name="position"]')).toHaveValue(`${P} Délégué médical Oran`);
  await max.fill("130000");
  const envoyer = page.getByRole("button", { name: "Corriger et renvoyer" });
  await expect(envoyer).toBeDisabled();
  await page.getByPlaceholder(/Fourchette ramenée/).fill(CHANGE);
  await envoyer.click();
  await expect(page.getByText(/la chaîne repart de sa première marche : rémunération maximale/)).toBeVisible({ timeout: 15_000 });
  const r = await prisma.recruitmentRequest.findUniqueOrThrow({
    where: { id: renvoiId },
    select: { stage: true, salaryMax: true, returnNote: true, approvals: { orderBy: { order: "asc" }, select: { status: true } } },
  });
  expect(r.stage).toBe("CHAIN");
  expect(Number(r.salaryMax)).toBe(130_000);
  expect(r.returnNote).toBeNull();
  expect(r.approvals.map((a) => a.status), "la marche 1 avait validé 100 000, pas 130 000").toEqual(["PENDING", "PENDING"]);
});

test("ROUVRIR — les RH rouvrent une demande refusée : la phrase dit où elle repart, l'historique garde la décision", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, EMAIL.rh);
  await aller(page, `/recrutement/${refuseeId}`);
  await expect(page.getByText(`Elle repartira à la marche qui l'a refusée (${P} Second validateur), et à elle seule.`)).toBeVisible({ timeout: 15_000 });
  const rouvrir = page.getByRole("button", { name: "Rouvrir" });
  await expect(rouvrir).toBeDisabled();
  await page.getByPlaceholder(/erreur reconnue/).fill(REOUVERTURE);
  await rouvrir.click();
  await expect(page.getByText(`Rouverte — ${REOUVERTURE} · la décision précédente : « Pas cette année. »`)).toBeVisible({ timeout: 15_000 });
  const r = await prisma.recruitmentRequest.findUniqueOrThrow({
    where: { id: refuseeId },
    select: { stage: true, closingNote: true, approvals: { orderBy: { order: "asc" }, select: { status: true } } },
  });
  expect(r).toEqual({ stage: "CHAIN", closingNote: null, approvals: [{ status: "APPROVED" }, { status: "PENDING" }] });
});

test("ANNULER L'EMBAUCHE — les RH annulent une embauche avant sa fiche : le poste se rouvre", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, EMAIL.rh);
  await aller(page, `/recrutement/${integrationId}`);
  const annuler = page.getByRole("button", { name: "Annuler l'embauche" });
  await expect(annuler).toBeDisabled();
  await page.getByPlaceholder("Motif", { exact: true }).fill(DESISTEMENT);
  await cliquerDecisif(annuler);
  await expect(page.getByText(`Embauche de ${P} Candidate retenue annulée — ${DESISTEMENT}`)).toBeVisible({ timeout: 15_000 });
  const r = await prisma.recruitmentRequest.findUniqueOrThrow({ where: { id: integrationId }, select: { stage: true } });
  expect(r.stage).toBe("SOURCING");
  expect((await prisma.recruitmentCandidate.findUniqueOrThrow({ where: { id: candidatId } })).status).toBe("SELECTED");
});
