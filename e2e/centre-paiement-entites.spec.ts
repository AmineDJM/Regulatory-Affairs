import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";
import { cliquerDecisif } from "./decisif";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CENTRE DE PAIEMENT : LES ENTITÉS EN HAUT, TROIS SECTIONS DESSOUS (§118.211) — écrans réels,
 * base réelle, aucun appel de modèle de leur fait.
 *
 * « Dans l'interface du centre de paiement, on aura les entités en haut, on pourra changer d'entité
 * en haut, et ensuite chaque entité aura trois types de demandes de paiement : Regulatory /
 * Sales & Marketing / Autres. »
 *
 * Les bancs de flux prouvent le chargeur et la règle de classement ; celui-ci prouve que l'ÉCRAN
 * existe, se lit, change d'entité sans recharger la page, tient à 375 px et ne montre jamais la
 * société qu'un siège n'a pas le droit de voir (§118.50). Deux personnes : le Super Admin (voit les
 * deux sociétés — le témoin sans lequel « B est cachée » ne prouverait rien) et un siège du centre
 * rattaché à UNE société, sans vue globale (§118.104).
 *
 * Décor propre à la spec (préfixe `__e2e9__`), retiré au début et à la fin.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const P = "__e2e9__";
const SA_EMAIL = `${P}sa@test.dz`;
const SIEGE_EMAIL = `${P}siege@test.dz`;
const ALPHA = `${P}Alpha`;
const BETA = `${P}Beta`;
const L = {
  aReg: `${P} Taxe ANPP Alpha`,
  aSm: `${P} Sponsoring congrès Alpha`,
  aAu: `${P} Loyer Alpha`,
  bReg: `${P} Taxe ANPP Beta`,
  bSm: `${P} Sponsoring congrès Beta`,
};

let alphaId = "";
let betaId = "";
let siegeId = "";
let saId = "";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(E2E.password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
}

/** Naviguer PUIS attendre l'hydratation : un clic posé avant ne fait rien (§118.168). */
async function aller(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function sansDebordement(page: Page) {
  const { scroll, largeur } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, largeur: window.innerWidth }));
  expect(scroll, `la page déborde de ${scroll - largeur} px à ${largeur} px de large`).toBeLessThanOrEqual(largeur + 1);
}

async function nettoyer() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: P } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const entites = await prisma.company.findMany({ where: { name: { startsWith: P } }, select: { id: true } });
  const entiteIds = entites.map((c) => c.id);
  const ordres = await prisma.expenseOrder.findMany({ where: { OR: [{ label: { startsWith: P } }, { companyId: { in: entiteIds } }] }, select: { id: true } });
  const ordreIds = ordres.map((o) => o.id);
  await prisma.paymentCentreMessage.deleteMany({ where: { orderId: { in: ordreIds } } }).catch(() => {});
  await prisma.paymentRequest.deleteMany({ where: { OR: [{ expenseOrderId: { in: ordreIds } }, { title: { startsWith: P } }] } }).catch(() => {});
  await prisma.expenseOrder.deleteMany({ where: { id: { in: ordreIds } } });
  await prisma.paymentCentreSeat.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
  await prisma.userCompanyAccess.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.company.deleteMany({ where: { id: { in: entiteIds } } });
}

let seq = 0;
async function ordre(label: string, o: { companyId: string; sourceType: string | null; sourceId?: string; amount: number }) {
  await prisma.expenseOrder.create({
    data: {
      reference: `${P}OD-${++seq}`, label, amount: o.amount, category: "AUTRE", companyId: o.companyId,
      sourceType: o.sourceType as never, sourceId: o.sourceId ?? null, centralStatus: "AWAITING", requestedById: saId,
    },
  });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await nettoyer();
  const hash = await bcrypt.hash(E2E.password, 10);
  const sa = await prisma.user.create({ data: { email: SA_EMAIL, name: `${P} Super Admin`, passwordHash: hash, role: "SUPER_ADMIN" } });
  const siege = await prisma.user.create({ data: { email: SIEGE_EMAIL, name: `${P} Siège`, passwordHash: hash, role: "DIRECTION_ASSISTANT" } });
  saId = sa.id; siegeId = siege.id;
  alphaId = (await prisma.company.create({ data: { name: `${P} Alpha SARL`, shortName: ALPHA, sortOrder: 9001 } })).id;
  betaId = (await prisma.company.create({ data: { name: `${P} Beta SARL`, shortName: BETA, sortOrder: 9002 } })).id;
  // LE SIÈGE : nommé au centre, rattaché à la SEULE société Alpha, sans vue globale.
  await prisma.userCompanyAccess.create({ data: { userId: siegeId, companyId: alphaId } });
  await prisma.paymentCentreSeat.create({ data: { userId: siegeId, note: `${P} siège` } });

  await ordre(L.aReg, { companyId: alphaId, sourceType: "REGULATORY_PRODUCT", sourceId: "x-reg", amount: 120_000 });
  await ordre(L.aSm, { companyId: alphaId, sourceType: "SPONSORING", sourceId: "x-sp", amount: 340_000 });
  await ordre(L.aAu, { companyId: alphaId, sourceType: "PAYROLL", sourceId: "x-paie", amount: 90_000 });
  await ordre(L.bReg, { companyId: betaId, sourceType: "REGULATORY_PRODUCT", sourceId: "x-reg", amount: 55_000 });
  await ordre(L.bSm, { companyId: betaId, sourceType: "SPONSORING", sourceId: "x-sp", amount: 77_000 });
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

test("LES ENTITÉS EN HAUT : une pastille par société avec ses décisions en attente, et trois sections dessous", async ({ page }) => {
  await login(page, SA_EMAIL);
  await aller(page, `/centre-de-paiement?entite=${alphaId}&section=regulatory`);
  const entites = page.getByRole("navigation", { name: "Entités" });
  await expect(entites.getByRole("link", { name: new RegExp(ALPHA) })).toBeVisible();
  await expect(entites.getByRole("link", { name: new RegExp(BETA) })).toBeVisible();
  // Alpha attend 3 décisions ; la pastille le dit, et celle d'Alpha est l'entité courante.
  await expect(entites.getByRole("link", { name: new RegExp(ALPHA) })).toHaveAttribute("aria-current", "page");
  await expect(entites.getByRole("link", { name: new RegExp(`${ALPHA}\\s*3`) })).toBeVisible();
  await expect(entites.getByRole("link", { name: new RegExp(`${BETA}\\s*2`) })).toBeVisible();

  const sections = page.getByRole("navigation", { name: "Types de demandes de paiement" });
  for (const nom of ["Regulatory", "Sales & Marketing", "Autres"]) {
    await expect(sections.getByRole("link", { name: new RegExp(nom.replace("&", "\\&")) })).toBeVisible();
  }
  await expect(sections.getByRole("link", { name: /Regulatory/ })).toHaveAttribute("aria-current", "page");
  // Regulatory d'Alpha : sa taxe, et rien d'autre — ni le sponsoring, ni la paie, ni rien de Beta.
  await expect(page.getByText(L.aReg).first()).toBeVisible();
  await expect(page.getByText(L.aSm)).toHaveCount(0);
  await expect(page.getByText(L.aAu)).toHaveCount(0);
  await expect(page.getByText(L.bReg)).toHaveCount(0);
});

test("CHANGER D'ENTITÉ ET DE SECTION se fait EN HAUT, sans recharger la page — chaque section ne montre que ses lignes", async ({ page }) => {
  await login(page, SA_EMAIL);
  await aller(page, `/centre-de-paiement?entite=${alphaId}&section=regulatory`);
  // Un marqueur posé dans la page : s'il survit, la navigation n'a PAS rechargé le document.
  await page.evaluate(() => { (window as unknown as { __marqueur: string }).__marqueur = "vivant"; });

  await page.getByRole("navigation", { name: "Types de demandes de paiement" }).getByRole("link", { name: /Sales & Marketing/ }).click();
  await expect(page.getByText(L.aSm).first()).toBeVisible();
  await expect(page.getByText(L.aReg)).toHaveCount(0);

  await page.getByRole("navigation", { name: "Types de demandes de paiement" }).getByRole("link", { name: /Autres/ }).click();
  await expect(page.getByText(L.aAu).first()).toBeVisible();
  await expect(page.getByText(L.aSm)).toHaveCount(0);

  // On passe à Beta : la section regardée est CONSERVÉE (on compare « Autres » d'une société à l'autre).
  await page.getByRole("navigation", { name: "Entités" }).getByRole("link", { name: new RegExp(BETA) }).click();
  await expect(page).toHaveURL(new RegExp(`entite=${betaId}`));
  await expect(page).toHaveURL(/section=autres/);
  await expect(page.getByRole("navigation", { name: "Entités" }).getByRole("link", { name: new RegExp(BETA) })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(L.aAu)).toHaveCount(0);
  await page.getByRole("navigation", { name: "Types de demandes de paiement" }).getByRole("link", { name: /Sales & Marketing/ }).click();
  await expect(page.getByText(L.bSm).first()).toBeVisible();
  await expect(page.getByText(L.aSm)).toHaveCount(0);

  expect(await page.evaluate(() => (window as unknown as { __marqueur?: string }).__marqueur), "le document n'a pas été rechargé").toBe("vivant");
});

test("une entité forgée dans l'adresse ne désigne rien : la page s'ouvre sur une entité réelle, sans erreur", async ({ page }) => {
  await login(page, SA_EMAIL);
  await aller(page, "/centre-de-paiement?entite=n-importe-quoi&section=bidon");
  await expect(page.getByRole("heading", { name: "Centre de paiement" }).first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Entités" }).locator('a[aria-current="page"]')).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Types de demandes de paiement" }).locator('a[aria-current="page"]')).toHaveCount(1);
});

test("SIÈGE RATTACHÉ À UNE SOCIÉTÉ : sa pastille, jamais celle de l'autre — même en la demandant dans l'adresse", async ({ page }) => {
  await login(page, SIEGE_EMAIL);
  await aller(page, `/centre-de-paiement?entite=${betaId}&section=regulatory`);
  const entites = page.getByRole("navigation", { name: "Entités" });
  await expect(entites.getByRole("link", { name: new RegExp(ALPHA) })).toBeVisible();
  await expect(entites.getByRole("link", { name: new RegExp(BETA) }), "la société Beta ne lui est pas ouverte").toHaveCount(0);
  await expect(page.getByText(L.bReg)).toHaveCount(0);
  await expect(page.getByText(L.bSm)).toHaveCount(0);
  // Elle tombe sur la sienne.
  await expect(page.getByText(L.aReg).first()).toBeVisible();
});

test("LA DÉCISION RESTE LA MÊME : le siège autorise un paiement de sa société, et la base le dit", async ({ page }) => {
  await login(page, SIEGE_EMAIL);
  await aller(page, `/centre-de-paiement?entite=${alphaId}&section=sales-marketing`);
  const ligne = page.locator("li").filter({ hasText: L.aSm }).filter({ has: page.getByRole("button", { name: "Autoriser" }) }).first();
  await expect(ligne).toBeVisible();
  await ligne.getByRole("button", { name: "Autoriser" }).click();
  await cliquerDecisif(page.getByRole("dialog").getByRole("button", { name: "Autoriser le paiement" }));
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
  const apres = await prisma.expenseOrder.findFirstOrThrow({ where: { label: L.aSm }, select: { centralStatus: true } });
  expect(apres.centralStatus).toBe("APPROVED");
  // Le compte en attente de la pastille et de la section suit la décision.
  await aller(page, `/centre-de-paiement?entite=${alphaId}&section=sales-marketing`);
  await expect(page.getByRole("navigation", { name: "Entités" }).getByRole("link", { name: new RegExp(`${ALPHA}\\s*2`) })).toBeVisible();
});

test("AU TÉLÉPHONE (375 px) : la barre des entités défile dans son cadre, les trois sections tiennent, la page ne déborde pas", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await login(page, SA_EMAIL);
  await aller(page, `/centre-de-paiement?entite=${alphaId}&section=autres`);
  await sansDebordement(page);
  const sections = page.getByRole("navigation", { name: "Types de demandes de paiement" });
  for (const lien of await sections.getByRole("link").all()) {
    const boite = await lien.boundingBox();
    expect(boite && boite.x >= 0 && boite.x + boite.width <= 376, "chaque section est entièrement visible à 375 px").toBe(true);
    expect(boite && boite.height >= 40, "cible tactile de 40 px au moins").toBe(true);
  }
  await expect(page.getByText(L.aAu).first()).toBeVisible();
  await page.getByRole("navigation", { name: "Entités" }).getByRole("link", { name: new RegExp(BETA) }).click();
  await expect(page).toHaveURL(new RegExp(`entite=${betaId}`));
  await sansDebordement(page);
});
