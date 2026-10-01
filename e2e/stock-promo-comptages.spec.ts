import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * COMPTAGES, TABLEAU DE BORD ET REFONTES DANS LE NAVIGATEUR (§118.168) — écrans réels, base
 * réelle, aucun appel de modèle de son fait — hormis le point du matin que tente la page d'arrivée du Super Admin (voir `playwright.config.ts`), dans la peau de quatre personnes.
 *
 * Le banc de flux (`promo-comptage-flow.test.ts`) prouve la RÈGLE par les vraies actions ; celui-ci
 * prouve qu'elle a un ÉCRAN (§118.50) : le directeur des opérations demande un comptage à un
 * délégué de son équipe, le délégué le saisit lui-même — au format téléphone — et l'ÉCART corrigé
 * lui est DIT ; il propose la refonte d'un support durable, et la directrice de la Direction
 * Marketing la retient depuis son tableau de bord.
 *
 * Décor propre à la spec (préfixe `__e2e5__`), retiré au début et à la fin.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const P = "__e2e5__";
const SA_EMAIL = `${P}sa@test.dz`;
const DM_EMAIL = `${P}dm@test.dz`;
const OPS_EMAIL = `${P}ops@test.dz`;
const KAM_EMAIL = `${P}kam@test.dz`;
const KAM_NOM = `${P} Kenza Comptage`;
const FICHE = `${P} Fiche à compter`;
const KAKEMONO = `${P} Kakémono à refaire`;
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

async function solde(holderId: string | null, nom: string): Promise<number> {
  const r = await prisma.promoStockMovement.aggregate({ where: { holderId, item: { catalogue: { nom } } }, _sum: { delta: true } });
  return Number(r._sum.delta ?? 0);
}

async function nettoyer() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: P } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const cat = await prisma.promoCatalogueArticle.findMany({ where: { nom: { startsWith: P } }, select: { id: true } });
  if (ids.length) {
    // Les comptages ne pendent pas aux articles : ils pendent aux personnes (demandeur, détenteur).
    await prisma.promoStockComptage.deleteMany({ where: { OR: [{ demandeurId: { in: ids } }, { holderId: { in: ids } }] } });
    await prisma.promoStockComptageRecurrence.deleteMany({ where: { OR: [{ auteurId: { in: ids } }, { holderId: { in: ids } }] } });
  }
  // L'article de stock emporte lots, mouvements, transferts, lignes de comptage et refontes (Cascade).
  if (cat.length) await prisma.promoStockItem.deleteMany({ where: { catalogueId: { in: cat.map((c) => c.id) } } });
  await prisma.promoCatalogueArticle.deleteMany({ where: { nom: { startsWith: P } } });
  await prisma.employee.updateMany({ where: { userId: { in: ids } }, data: { managerId: null } });
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
  await creer(SA_EMAIL, `${P} Super Admin`, "SUPER_ADMIN");
  const dm = await creer(DM_EMAIL, `${P} Directrice Marketing`, "PRODUCT_MANAGER");
  const ops = await creer(OPS_EMAIL, `${P} Directeur des Opérations`, "OPERATIONS_DIRECTOR");
  const kam = await creer(KAM_EMAIL, KAM_NOM, "MEDICAL_DELEGATE");
  kamId = kam.id;
  // La directrice est la CHEFFE de la Direction Marketing (personne de son rôle au-dessus d'elle) ;
  // le délégué est dans l'ÉQUIPE du directeur des opérations — c'est l'organigramme qui le dit.
  await prisma.employee.create({ data: { fullName: `${P} Directrice Marketing`, userId: dm.id } });
  const eOps = await prisma.employee.create({ data: { fullName: `${P} Directeur des Opérations`, userId: ops.id } });
  await prisma.employee.create({ data: { fullName: KAM_NOM, userId: kam.id, managerId: eOps.id } });
  await prisma.promoCatalogueArticle.create({ data: { reference: `${P}FICHE`, nom: FICHE, famille: "CONSOMMABLE", unite: "pièce" } });
  await prisma.promoCatalogueArticle.create({ data: { reference: `${P}KAKEMONO`, nom: KAKEMONO, famille: "DURABLE", unite: "pièce" } });
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

test("le décor par les vrais écrans : le magasin reçoit, la directrice dote, le délégué confirme", async ({ page }) => {
  await login(page, SA_EMAIL);
  await aller(page, "/promo-material/stock?vue=magasin");
  for (const [nom, quantite] of [[FICHE, "30"], [KAKEMONO, "2"]] as const) {
    await page.getByRole("button", { name: "Entrée manuelle" }).click();
    const panneau = page.getByRole("dialog");
    const choix = panneau.getByLabel(/Article du catalogue/);
    const valeur = await choix.locator("option", { hasText: nom }).getAttribute("value");
    await choix.selectOption(valeur!);
    await panneau.getByLabel(/^Quantité/).fill(quantite);
    await panneau.getByLabel(/D'où vient ce matériel/).fill("E2E — décor des comptages");
    await panneau.getByRole("button", { name: "Entrer au magasin" }).click();
    await expect(page.getByRole("status").filter({ hasText: `+${quantite} au magasin central` })).toBeVisible();
  }

  await login(page, DM_EMAIL);
  await aller(page, "/promo-material/stock?vue=magasin");
  for (const [nom, quantite] of [[FICHE, "12"], [KAKEMONO, "1"]] as const) {
    await page.locator("li", { hasText: nom }).first().getByRole("button", { name: "Doter" }).click();
    const panneau = page.getByRole("dialog");
    await panneau.getByLabel(/Personne dotée/).selectOption({ label: KAM_NOM });
    await panneau.getByLabel(/^Quantité/).fill(quantite);
    await panneau.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${quantite} en route vers ${KAM_NOM}` })).toBeVisible();
  }

  await login(page, KAM_EMAIL);
  await aller(page, "/promo-material/stock");
  const boutons = page.getByRole("button", { name: "J'ai tout reçu" });
  await expect(boutons).toHaveCount(2);
  for (const reste of [1, 0]) {
    await boutons.first().click();
    // On attend que l'écran ait REDESSINÉ la liste avant le clic suivant : sinon le second clic
    // viserait la réception qui vient d'être confirmée.
    await expect(boutons).toHaveCount(reste);
  }
  expect(await solde(kamId, FICHE)).toBe(12);
  expect(await solde(kamId, KAKEMONO)).toBe(1);
});

test("le directeur des opérations demande un comptage à un délégué de son équipe", async ({ page }) => {
  await login(page, OPS_EMAIL);
  await aller(page, "/promo-material/stock?vue=comptages");
  await expect(page.getByRole("tab", { name: /Comptages/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Demander un comptage" }).click();
  const panneau = page.getByRole("dialog");
  await panneau.getByLabel(/^Qui compte/).selectOption({ label: "Une personne" });
  // Le menu ne propose QUE les personnes de son équipe qui ont le stock (§118.168).
  await panneau.getByLabel(/La personne/).selectOption({ label: KAM_NOM });
  await panneau.getByLabel(/Quoi compter/).selectOption({ label: "Tout le matériel" });
  await panneau.getByRole("button", { name: "Demander" }).click();
  await expect(page.getByRole("status").filter({ hasText: /1 comptage\(s\) demandé\(s\)/ })).toBeVisible();
  await expect(page.getByText("Comptages en attente")).toBeVisible();
  await capture(page, "c1-demande");
});

test("le délégué arrive sur son comptage, le saisit lui-même au format téléphone — et l'écart corrigé lui est DIT", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, KAM_EMAIL);
  await aller(page, "/promo-material/stock");
  // Un comptage à saisir passe avant tout : c'est la vue d'arrivée.
  await expect(page.getByRole("tab", { name: /Comptages/ })).toHaveAttribute("aria-selected", "true");
  // Ni tableau de bord ni magasin pour un délégué.
  await expect(page.getByRole("tab", { name: /Tableau de bord/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Magasin/ })).toHaveCount(0);
  await sansDebordement(page);
  await page.getByRole("button", { name: "Saisir le comptage" }).click();
  const panneau = page.getByRole("dialog");
  // Rien n'est pré-rempli : « tout est juste » ne doit pas être un clic.
  await expect(panneau.getByLabel(`Quantité comptée — ${FICHE}`)).toHaveValue("");
  await panneau.getByLabel(`Quantité comptée — ${FICHE}`).fill("10");
  await panneau.getByLabel(`Quantité comptée — ${KAKEMONO}`).fill("1");
  await sansDebordement(page);
  await capture(page, "c2-saisie-mobile");
  await panneau.getByRole("button", { name: "Enregistrer le comptage" }).click();
  await expect(page.getByRole("status").filter({ hasText: /2 article\(s\) comptés, 1 écart\(s\)/ })).toBeVisible();
  expect(await solde(kamId, FICHE), "l'écart est corrigé au registre").toBe(10);
  expect(await solde(kamId, KAKEMONO)).toBe(1);
  await expect(page.getByRole("button", { name: "Saisir le comptage" })).toHaveCount(0);
  await sansDebordement(page);
});

test("le délégué propose de refaire son kakémono", async ({ page }) => {
  await login(page, KAM_EMAIL);
  await aller(page, "/promo-material/stock?vue=moi");
  await page.locator("li", { hasText: KAKEMONO }).first().getByRole("button", { name: "Proposer une refonte" }).click();
  const panneau = page.getByRole("dialog");
  await panneau.getByLabel(/Ce qui ne va pas/).fill("Toile usée, visuel de l'ancienne charte");
  await panneau.getByRole("button", { name: "Proposer" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Proposition envoyée" })).toBeVisible();
  await expect(page.locator("li", { hasText: KAKEMONO }).first()).toContainText("Refonte proposée");
});

test("la directrice marketing la retient depuis son tableau de bord — qui tient aussi au format téléphone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, DM_EMAIL);
  await aller(page, "/promo-material/stock?vue=tableau");
  await expect(page.getByRole("tab", { name: /Tableau de bord/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Valeur du stock").first()).toBeVisible();
  await expect(page.getByText("Refontes proposées").first()).toBeVisible();
  await sansDebordement(page);
  await capture(page, "c3-tableau-mobile");
  const proposition = page.locator("li", { hasText: KAKEMONO }).filter({ hasText: "Toile usée" });
  await proposition.getByRole("button", { name: "Retenir" }).click();
  const panneau = page.getByRole("dialog");
  await panneau.getByRole("button", { name: "Retenir" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Refonte retenue" })).toBeVisible();
  const r = await prisma.promoStockRefonte.findFirstOrThrow({ where: { item: { catalogue: { nom: KAKEMONO } } } });
  expect(r.statut).toBe("RETENUE");
  await sansDebordement(page);
});

test("le directeur des opérations lit le résultat du comptage : ce que le registre attendait, ce qui a été compté", async ({ page }) => {
  await login(page, OPS_EMAIL);
  await aller(page, "/promo-material/stock?vue=comptages");
  const resultat = page.locator("li", { hasText: KAM_NOM }).filter({ hasText: "1 écart(s)" });
  await expect(resultat).toBeVisible();
  await resultat.getByRole("button").first().click();
  const ligne = resultat.locator("tr", { hasText: FICHE });
  await expect(ligne).toContainText("12");
  await expect(ligne).toContainText("10");
  // Le signe moins du français est U+2212 : on lit le NOMBRE, pas le glyphe.
  await expect(ligne).toContainText(/[-−]2\b/);
  await capture(page, "c4-resultat");
});
