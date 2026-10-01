import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE STOCK PROMOTIONNEL DANS LE NAVIGATEUR (§118.164) — écrans réels, base réelle, zéro appel de
 * modèle, dans la peau de trois personnes.
 *
 * Le banc de flux (`promo-stock-flow.test.ts`) prouve la RÈGLE par les vraies actions ; celui-ci
 * prouve qu'elle a un ÉCRAN (§118.50) : le Super Admin crée l'article au catalogue et l'entre au
 * magasin, la directrice de la Direction Marketing dote un délégué, le délégué voit le matériel
 * « en route » et confirme lui-même la réception — et rien de tout cela ne déborde d'un écran de
 * téléphone.
 *
 * Décor propre à la spec (préfixe `__e2e__`), retiré à la fin.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const SA_EMAIL = "__e2e__sa-stock@test.dz";
const DM_EMAIL = "__e2e__dm-stock@test.dz";
const KAM_EMAIL = "__e2e__kam-stock@test.dz";
const KAM_NOM = "__e2e__ Karim Stock";
const ARTICLE = "__e2e__ Fiche posologique stock";
const CAPTURES = process.env.E2E_CAPTURES ?? "";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(E2E.password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  // 60 s : la toute première connexion après un build propre est lente (§118.124b).
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
}

/**
 * NAVIGUER PUIS ATTENDRE QUE LA PAGE SOIT INTERACTIVE. Un bouton cliqué avant l'hydratation ne fait
 * RIEN — aucune requête ne part (mesuré sur la trace du premier passage : le clic « J'ai tout reçu »
 * n'a déclenché aucun POST) — et le banc accuse alors l'écran d'un défaut qu'il n'a pas.
 */
async function aller(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function capture(page: Page, nom: string) {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.png`, fullPage: true });
}

/** Aucun débordement horizontal : un écran de téléphone ne défile pas de côté. */
async function sansDebordement(page: Page) {
  const { scroll, largeur } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, largeur: window.innerWidth }));
  expect(scroll, `la page déborde de ${scroll - largeur} px à ${largeur} px de large`).toBeLessThanOrEqual(largeur + 1);
}

async function solde(holderId: string | null): Promise<number> {
  const r = await prisma.promoStockMovement.aggregate({
    where: { holderId, item: { catalogue: { nom: ARTICLE } } },
    _sum: { delta: true },
  });
  return Number(r._sum.delta ?? 0);
}

async function nettoyer() {
  const users = await prisma.user.findMany({ where: { email: { in: [SA_EMAIL, DM_EMAIL, KAM_EMAIL] } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const cat = await prisma.promoCatalogueArticle.findMany({ where: { nom: ARTICLE }, select: { id: true } });
  // L'article de stock emporte lots, mouvements, transferts et demandes (Cascade).
  if (cat.length) await prisma.promoStockItem.deleteMany({ where: { catalogueId: { in: cat.map((c) => c.id) } } });
  await prisma.promoCatalogueArticle.deleteMany({ where: { nom: ARTICLE } });
  await prisma.employee.deleteMany({ where: { userId: { in: ids } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

test.describe.configure({ mode: "serial" });

let kamId = "";

test.beforeAll(async () => {
  await nettoyer();
  const hash = await bcrypt.hash(E2E.password, 10);
  const creer = (email: string, name: string, role: string) =>
    prisma.user.create({ data: { email, name, passwordHash: hash, role: role as never } });
  await creer(SA_EMAIL, "__e2e__ Super Admin Stock", "SUPER_ADMIN");
  const dm = await creer(DM_EMAIL, "__e2e__ Directrice Marketing", "PRODUCT_MANAGER");
  const kam = await creer(KAM_EMAIL, KAM_NOM, "MEDICAL_DELEGATE");
  kamId = kam.id;
  // La directrice est la CHEFFE de la Direction Marketing : personne de son rôle au-dessus d'elle
  // dans l'organigramme. C'est ce fait, pas son rôle, qui lui donne le magasin.
  await prisma.employee.create({ data: { fullName: "__e2e__ Directrice Marketing", userId: dm.id } });
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

test("le Super Admin crée l'article au catalogue — un seul onglet allumé, le sien", async ({ page }) => {
  await login(page, SA_EMAIL);
  await aller(page, "/promo-material/catalogue");
  await expect(page.getByRole("heading", { name: /Catalogue promotionnel/ })).toBeVisible();
  // L'onglet ACTIF est le plus précis : « Matériel promotionnel » (/promo-material) ne s'allume pas
  // sous /promo-material/catalogue (§118.164).
  await expect(page.locator("a[aria-current='page']")).toHaveCount(1);
  await expect(page.locator("a[aria-current='page']")).toHaveText("Catalogue promotionnel");

  await page.getByRole("button", { name: /Nouvel article/ }).click();
  // Le formulaire vit dans un panneau : on le vise LUI — la barre de filtres derrière porte aussi
  // un champ « Famille ».
  const panneau = page.getByRole("dialog");
  await panneau.getByLabel(/Nom de l'article/).fill(ARTICLE);
  await panneau.getByLabel(/^Famille/).selectOption({ label: "Consommable" });
  await panneau.getByRole("button", { name: "Ajouter au catalogue" }).click();
  await expect(page.getByRole("status").filter({ hasText: /CAT-\d{4,} — __e2e__ Fiche posologique stock ajouté au catalogue/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: new RegExp(ARTICLE) })).toBeVisible();
  await capture(page, "1-catalogue");
});

test("le Super Admin entre 50 fiches au magasin — un lot, et le chiffre à l'écran", async ({ page }) => {
  await login(page, SA_EMAIL);
  await aller(page, "/promo-material/stock?vue=magasin");
  await expect(page.locator("a[aria-current='page']")).toHaveText("Stock promotionnel");
  await page.getByRole("button", { name: "Entrée manuelle" }).click();
  const panneau = page.getByRole("dialog");
  const choix = panneau.getByLabel(/Article du catalogue/);
  const valeur = await choix.locator("option", { hasText: ARTICLE }).getAttribute("value");
  await choix.selectOption(valeur!);
  await panneau.getByLabel(/^Quantité/).fill("50");
  await panneau.getByLabel(/D'où vient ce matériel/).fill("E2E — don du laboratoire");
  await panneau.getByRole("button", { name: "Entrer au magasin" }).click();
  await expect(page.getByRole("status").filter({ hasText: "+50 au magasin central (lot 1)." })).toBeVisible();
  const ligne = page.locator("li", { hasText: ARTICLE }).first();
  await expect(ligne).toContainText("50");
  expect(await solde(null)).toBe(50);
  await capture(page, "2-magasin");
});

test("la directrice marketing dote le délégué : rien n'entre chez lui avant SA confirmation", async ({ page }) => {
  await login(page, DM_EMAIL);
  await aller(page, "/promo-material/stock");
  // Elle tient le magasin : c'est la vue d'arrivée.
  await expect(page.getByRole("tab", { name: /Magasin/ })).toHaveAttribute("aria-selected", "true");
  const ligne = page.locator("li", { hasText: ARTICLE }).first();
  await ligne.getByRole("button", { name: "Doter" }).click();
  const panneau = page.getByRole("dialog");
  await panneau.getByLabel(/Personne dotée/).selectOption({ label: KAM_NOM });
  await panneau.getByLabel(/^Quantité/).fill("10");
  await panneau.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("status").filter({ hasText: `10 en route vers ${KAM_NOM}` })).toBeVisible();
  expect(await solde(null)).toBe(40);
  expect(await solde(kamId), "rien n'entre chez le délégué avant sa confirmation").toBe(0);
  await expect(page.getByText("Dotations en route")).toBeVisible();
  await capture(page, "3-dotation");
});

test("le délégué arrive sur sa réception à confirmer, et l'atteste lui-même — au format téléphone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, KAM_EMAIL);
  await aller(page, "/promo-material/stock");
  // Ni le magasin ni la vue générale : il ne voit que le sien.
  await expect(page.getByRole("tab", { name: /Magasin/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Vue générale/ })).toHaveCount(0);
  const carte = page.locator("li", { hasText: `10 × ${ARTICLE}` });
  await expect(carte).toBeVisible();
  await sansDebordement(page);
  await capture(page, "4-kam-a-confirmer");
  await carte.getByRole("button", { name: "J'ai tout reçu" }).click();
  await expect(page.getByRole("status").filter({ hasText: "10 reçues." })).toBeVisible();
  expect(await solde(kamId)).toBe(10);
  await expect(page.getByRole("button", { name: "J'ai tout reçu" })).toHaveCount(0);
  await sansDebordement(page);
  await capture(page, "5-kam-recu");
});

test("la vue du magasin tient aussi au format téléphone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, DM_EMAIL);
  await aller(page, "/promo-material/stock?vue=magasin");
  await expect(page.locator("li", { hasText: ARTICLE }).first()).toContainText("40");
  await sansDebordement(page);
  await capture(page, "6-magasin-mobile");
});
