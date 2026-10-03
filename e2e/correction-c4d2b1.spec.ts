import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";

/**
 * ═════════════════════════════════════════════════════════════════
 * UNE PIÈCE ÉMISE SE RÉVISE DEPUIS SA FICHE — dans le navigateur (audit 360°, lot C4d2b1, §118.194).
 *
 * Le banc de flux (`legal-revision-flow.test.ts`) prouve les RÈGLES par les vraies actions ; celui-ci prouve
 * qu'elles ont un ÉCRAN qui les déclenche (§118.50), dans la peau d'une personne des Finances :
 *   - elle compose un bon de commande depuis « Bons de commande », comme au quotidien ;
 *   - sur la fiche de la pièce, « Réviser la pièce » n'émet la version 2 qu'une fois ce qui change écrit, et
 *     la fiche dit ensuite « Version 2 » ;
 *   - « Modifier » dit que le montant vient du fichier et ne le propose plus.
 *
 * Décor propre à la spec (préfixe `__e2e17__`), posé en base et retiré au début et à la fin.
 * ═════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const P = "__e2e17__";
const EMAIL_FIN = `${P}fin@test.dz`;
const FOURNISSEUR = `${P} Imprimerie du Port`;
const MOTIF = "Quantité ramenée à 80 à la demande du fournisseur.";

let companyId = "";
let finId = "";
let pieceId = "";

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
  const societes = (await prisma.company.findMany({ where: { name: { startsWith: P } }, select: { id: true } })).map((c) => c.id);
  const comptes = (await prisma.user.findMany({ where: { email: { startsWith: P } }, select: { id: true } })).map((u) => u.id);
  const pieces = (await prisma.legalDocument.findMany({ where: { companyId: { in: societes } }, select: { id: true } })).map((d) => d.id);
  const vIds = (await prisma.validationRequest.findMany({ where: { entityType: "LEGAL_DOCUMENT", entityId: { in: pieces } }, select: { id: true } })).map((v) => v.id);
  await prisma.validationStep.deleteMany({ where: { requestId: { in: vIds } } });
  await prisma.validationRequest.deleteMany({ where: { id: { in: vIds } } });
  await prisma.adProGateVisa.deleteMany({ where: { entityType: "LEGAL_DOCUMENT", entityId: { in: pieces } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ entityId: { in: pieces } }, { actorId: { in: comptes } }] } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: comptes } } });
  await prisma.legalDocument.deleteMany({ where: { id: { in: pieces } } });
  await prisma.documentSequence.deleteMany({ where: { companyId: { in: societes } } }).catch(() => {});
  await prisma.fileVersion.deleteMany({ where: { node: { ownerId: { in: comptes } } } });
  await prisma.driveNode.deleteMany({ where: { ownerId: { in: comptes }, type: "FILE" } });
  await prisma.driveNode.deleteMany({ where: { ownerId: { in: comptes } } });
  await prisma.userCompanyAccess.deleteMany({ where: { companyId: { in: societes } } });
  await prisma.companyLegalIdentity.deleteMany({ where: { companyId: { in: societes } } });
  await prisma.company.deleteMany({ where: { id: { in: societes } } });
  await prisma.user.deleteMany({ where: { id: { in: comptes } } });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await nettoyer();
  const hash = await bcrypt.hash(E2E.password, 10);
  finId = (await prisma.user.create({ data: { email: EMAIL_FIN, name: `${P} Finances`, passwordHash: hash, role: "FINANCE_BUDGET_MANAGER" }, select: { id: true } })).id;
  companyId = (await prisma.company.create({ data: { name: `${P} Pharma`, shortName: "E2E17", color: "#1B7F79" }, select: { id: true } })).id;
  await prisma.companyLegalIdentity.create({
    data: {
      companyId, legalName: `${P} Pharma SARL`, legalForm: "SARL", shareCapital: "10 000 000 DZD", rcNumber: "16/00-1234567B21", nif: "001916012345678",
      nis: "001916012345690", taxArticle: "16012345678", headOffice: "12 rue des Frères Bouadou, Alger", phone: "+213 21 00 00 00", email: "contact@test.dz",
      bankName: "BNA", bankAgency: "Hydra", rib: "001 00123 0123456789 45", managerName: "Gérant de test", managerTitle: "Gérant",
    },
  });
  // Les Finances ENGAGENT cette société : c'est ce qui leur ouvre la composition et la révision de ses pièces.
  await prisma.userCompanyAccess.create({ data: { userId: finId, companyId, canEdit: true } });
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

test("COMPOSER — les Finances émettent un bon de commande depuis « Bons de commande »", async ({ page }) => {
  // Le premier parcours après un build propre paie le démarrage à froid du serveur (§118.124b).
  test.setTimeout(150_000);
  await login(page, EMAIL_FIN);
  await aller(page, "/bons-de-commande");
  await page.getByRole("button", { name: "Composer un bon de commande" }).click();
  await page.locator("#cp-societe").selectOption(companyId);
  await page.locator("#cp-tiers-nom").fill(FOURNISSEUR);
  await page.getByLabel("Désignation 1").fill("Fiches posologiques — impression quadri");
  await page.getByLabel("Quantité").first().fill("100");
  await page.getByLabel("Prix unitaire HT").first().fill("250");
  const emettre = page.getByRole("button", { name: "Émettre le bon de commande" });
  await expect(emettre).toBeEnabled({ timeout: 30_000 });
  await emettre.click();
  await expect(page.getByText("Pièce émise.")).toBeVisible({ timeout: 60_000 });
  const doc = await prisma.legalDocument.findFirstOrThrow({ where: { companyId, kind: "PURCHASE_ORDER" }, select: { id: true } });
  pieceId = doc.id;
});

test("RÉVISER — la version 2 ne part qu'une fois ce qui change écrit, et la fiche dit « Version 2 »", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, EMAIL_FIN);
  await aller(page, `/legal/${pieceId}`);
  await expect(page.getByText("Version 1", { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Réviser la pièce" }).click();
  const envoyer = page.getByRole("button", { name: "Émettre la version 2" });
  // Sans motif, le geste n'est pas offert : c'est ce que retiendra l'historique de la pièce.
  await expect(envoyer).toBeDisabled();
  await page.getByLabel("Quantité de la ligne 1").fill("80");
  await page.getByLabel("Ce qui change dans la pièce").fill(MOTIF);
  await envoyer.click();
  await expect(page.getByText(/révisé : version 2, .* TTC — le Word, le PDF et la fiche disent la même chose\./)).toBeVisible({ timeout: 60_000 });
  // Le texte, pas le nom : la croix du panneau s'annonce aussi « Fermer ».
  await page.getByText("Fermer", { exact: true }).click();
  await expect(page.getByText("Version 2", { exact: true })).toBeVisible({ timeout: 30_000 });
  const d = await prisma.legalDocument.findUniqueOrThrow({ where: { id: pieceId }, select: { custom: true, amount: true } });
  const f = (d.custom as { fabrique: { version: number; totaux: { totalTtc: number }; historique: { resume: string }[] } }).fabrique;
  expect(f.version).toBe(2);
  expect(Number(d.amount)).toBe(f.totaux.totalTtc);
  expect(f.historique.at(-1)?.resume).toBe(`v2 — ${MOTIF}`);
});

test("MODIFIER — le formulaire dit que le montant vient du fichier, et ne le propose plus", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, EMAIL_FIN);
  await aller(page, `/legal/${pieceId}`);
  await page.getByRole("button", { name: "Modifier" }).click();
  await expect(page.getByText(/Pièce émise par la plateforme \(.+\) : son montant, sa partie, son numéro, sa nature et ses dates viennent de son fichier/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Montant (DZD)")).toHaveCount(0);
  await expect(page.getByLabel("Titre exact du document")).toBeVisible();
});
