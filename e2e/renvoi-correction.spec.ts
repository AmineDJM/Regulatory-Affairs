import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";
import { cliquerDecisif } from "./decisif";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * RENVOYER POUR CORRECTION, PUIS RESOUMETTRE — dans le navigateur (§118.186).
 *
 * Le banc de flux (`workflow/renvoi-flow.test.ts`) prouve les RÈGLES par les vraies actions ;
 * celui-ci prouve qu'elles ont un ÉCRAN qui les déclenche (§118.50), dans la peau de deux personnes :
 *   - la directrice marketing renvoie pour correction une prise en charge de KAM, motif à l'appui ;
 *   - le KAM retrouve la demande « À corriger » dans Mon espace, lit le motif sur la fiche — hors de
 *     l'historique, qui lui reste fermé — et la resoumet.
 *
 * Décor propre à la spec (préfixe `__e2e9__`), retiré au début et à la fin.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const P = "__e2e9__";
const KAM_EMAIL = `${P}kam@test.dz`;
const PM_EMAIL = `${P}pm@test.dz`;
const CONGRES = `${P} Congrès européen de cardiologie`;
const MOTIF = "Joignez le programme du congrès et le devis d'inscription.";
let congresId = "";

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
  const users = await prisma.user.findMany({ where: { email: { startsWith: P } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const congres = await prisma.congressInternational.findMany({ where: { name: { startsWith: P } }, select: { id: true } });
  const cIds = congres.map((c) => c.id);
  await prisma.workflowStepEvent.deleteMany({ where: { instance: { entityId: { in: cIds } } } });
  await prisma.workflowInstance.deleteMany({ where: { entityId: { in: cIds } } });
  await prisma.congressInternational.deleteMany({ where: { id: { in: cIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
  await prisma.userAccess.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await nettoyer();
  const hash = await bcrypt.hash(E2E.password, 10);
  const kam = await prisma.user.create({ data: { email: KAM_EMAIL, name: `${P} KAM`, passwordHash: hash, role: "MEDICAL_DELEGATE" } });
  await prisma.user.create({ data: { email: PM_EMAIL, name: `${P} Directrice marketing`, passwordHash: hash, role: "PRODUCT_MANAGER" } });
  // La prise en charge attend la Direction Marketing : le National Sales l'a validée, la porte du DG
  // est franchie sous le seuil. Le circuit naît à la première lecture de la fiche, à cette étape.
  const c = await prisma.congressInternational.create({
    data: { name: CONGRES, requesterId: kam.id, createdById: kam.id, requestStatus: "AWAITING_FINAL", estimatedBudget: 300_000 },
  });
  congresId = c.id;
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

test("LA DIRECTRICE MARKETING RENVOIE pour correction — la demande passe « À corriger », sans être refusée", async ({ page }) => {
  // Le premier parcours après un build propre paie le démarrage à froid du serveur : MESURÉ au
  // premier passage, le délai de 45 s s'est écoulé avant même la fin de la connexion (§118.124b).
  // Plafond LOCAL, la mesure écrite à côté ; le délai global ne bouge pas.
  test.setTimeout(120_000);
  await login(page, PM_EMAIL);
  await aller(page, `/congress-international/${congresId}`);
  await page.getByRole("button", { name: "Renvoyer pour correction" }).click();
  const envoyer = page.getByRole("button", { name: "Renvoyer au demandeur" });
  await expect(envoyer, "pas de renvoi sans motif").toBeDisabled();
  await page.getByPlaceholder("Ce que le demandeur doit corriger (obligatoire)…").fill(MOTIF);
  await cliquerDecisif(envoyer);
  await expect(page.getByText("À corriger").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Approuver" }), "plus de geste de validatrice : la demande est chez son demandeur").toHaveCount(0);
  const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congresId } } });
  expect(inst.status).toBe("RETURNED");
  expect(inst.currentSlug, "elle reviendra à l'étape qui l'a renvoyée").toBe("marketing");
});

test("LE KAM la retrouve dans Mon espace, lit le motif sur la fiche, et la RESOUMET", async ({ page }) => {
  await login(page, KAM_EMAIL);
  await aller(page, "/mon-espace");
  await expect(page.getByText(`À corriger — ${CONGRES}`)).toBeVisible();
  await aller(page, `/congress-international/${congresId}`);
  await expect(page.getByText(MOTIF), "le motif est lisible du demandeur").toBeVisible();
  await page.getByPlaceholder("Ex. montant ramené à 300 000 DZD, devis joint…").fill("Programme et devis joints.");
  await page.getByRole("button", { name: "Resoumettre la demande" }).click();
  await expect(page.getByRole("button", { name: "Resoumettre la demande" }), "une demande resoumise n'est plus à resoumettre").toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText(MOTIF), "le motif d'hier ne s'affiche plus au-dessus d'une demande vivante").toHaveCount(0);
  const inst = await prisma.workflowInstance.findUniqueOrThrow({ where: { entityType_entityId: { entityType: "CONGRESS_INTERNATIONAL", entityId: congresId } } });
  expect(inst.status).toBe("IN_PROGRESS");
  expect(inst.currentSlug).toBe("marketing");
  expect((await prisma.congressInternational.findUniqueOrThrow({ where: { id: congresId } })).requestStatus).toBe("AWAITING_FINAL");
});
