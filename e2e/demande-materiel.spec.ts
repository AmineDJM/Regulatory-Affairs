import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * TROIS DEMANDES DU 01/10 DANS LE NAVIGATEUR (§118.169–171) — écrans réels, base réelle, aucun
 * appel de modèle de son fait — hormis le point du matin que tente la page d'arrivée du Super Admin
 * (voir `playwright.config.ts`).
 *
 *   1. « Où se trouvent le stock et le catalogue promotionnels ? » — la page d'accueil d'Ad & Pro
 *      montre enfin sa barre d'onglets (§118.169).
 *   2. Moyens généraux : un seul service à l'écran, et le Super Admin garde de quoi le désigner —
 *      même sans département à lui, même quand aucun service n'est encore désigné (§118.170).
 *   3. La demande de matériel promotionnel se compose de LIGNES dès sa création — article du
 *      catalogue par famille, quantité, actions — sans budget, ni assistante, ni gamme, ni entité
 *      à saisir (§118.171), au bureau comme au téléphone.
 *
 * Le banc de flux prouve la RÈGLE par les vraies actions ; celui-ci prouve qu'elle a un ÉCRAN
 * (§118.50). Décor propre à la spec (préfixe `__e2e__`), retiré à la fin — le réglage global du
 * service des moyens généraux est RESTAURÉ à sa valeur d'origine, que le banc lit avant d'y toucher.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const P = "__e2e__mpl";
const SA_EMAIL = `${P}-sa@test.dz`;
const CP_EMAIL = `${P}-cp@test.dz`;
const DM_EMAIL = `${P}-dm@test.dz`;
const CARNET = `${P} Carnet bilan`;
const EADV = `${P} e-ADV`;
const TITRE = `${P} Carnets octobre`;
const DEPT_A = `${P} Administration`;
const DEPT_B = `${P} Logistique`;

let carnetId = "", eadvId = "", companyId = "", deptA = "", deptB = "";
let serviceAvant: string | null = null;

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

/** Aucun débordement horizontal : un écran de téléphone ne défile pas de côté. */
async function sansDebordement(page: Page) {
  const { scroll, largeur } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, largeur: window.innerWidth }));
  expect(scroll, `la page déborde de ${scroll - largeur} px à ${largeur} px de large`).toBeLessThanOrEqual(largeur + 1);
}

async function nettoyer() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: P } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  // Les lignes demandées partent avec leur dossier (Cascade) — et libèrent les articles du catalogue.
  const pms = await prisma.promoMaterial.findMany({ where: { title: { startsWith: P } }, select: { id: true } });
  await prisma.notification.deleteMany({ where: { link: { in: pms.map((p) => `/promo-material/${p.id}`) } } });
  await prisma.promoMaterial.deleteMany({ where: { id: { in: pms.map((p) => p.id) } } });
  await prisma.promoCatalogueArticle.deleteMany({ where: { reference: { startsWith: P } } });
  await prisma.employee.updateMany({ where: { userId: { in: ids } }, data: { managerId: null } });
  await prisma.employee.deleteMany({ where: { userId: { in: ids } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
  await prisma.userAccess.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.department.deleteMany({ where: { name: { startsWith: P } } });
  await prisma.company.deleteMany({ where: { name: { startsWith: P } } });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  serviceAvant = (await prisma.appSetting.findUnique({ where: { id: "global" }, select: { generalMeansDepartmentId: true } }))?.generalMeansDepartmentId ?? null;
  await nettoyer();
  const hash = await bcrypt.hash(E2E.password, 10);
  const creer = (email: string, name: string, role: string) =>
    prisma.user.create({ data: { email, name, passwordHash: hash, role: role as never } });
  // Le Super Admin N'A PAS de département : c'est le cas où l'écran vide était une impasse.
  await creer(SA_EMAIL, `${P} Super Admin`, "SUPER_ADMIN");
  const dm = await creer(DM_EMAIL, `${P} Directrice Marketing`, "PRODUCT_MANAGER");
  const cp = await creer(CP_EMAIL, `${P} Chef de produit`, "MEDICAL_PROMOTION_MANAGER");
  companyId = (await prisma.company.create({ data: { name: `${P} Pharma`, shortName: "E2EMPL", color: "#1B7F79" } })).id;
  // L'ENTITÉ du demandeur est celle où il TRAVAILLE : c'est elle que la demande portera, sans menu.
  const eDm = await prisma.employee.create({ data: { fullName: `${P} Directrice Marketing`, userId: dm.id, companyId } });
  await prisma.employee.create({ data: { fullName: `${P} Chef de produit`, userId: cp.id, companyId, managerId: eDm.id } });
  carnetId = (await prisma.promoCatalogueArticle.create({ data: { reference: `${P}-CARNET`, nom: CARNET, famille: "CONSOMMABLE", unite: "pièce" } })).id;
  eadvId = (await prisma.promoCatalogueArticle.create({ data: { reference: `${P}-EADV`, nom: EADV, famille: "NUMERIQUE" } })).id;
  deptA = (await prisma.department.create({ data: { name: DEPT_A, code: `${P}A` } })).id;
  deptB = (await prisma.department.create({ data: { name: DEPT_B, code: `${P}B` } })).id;
  // Le réglage part de « aucun service » : c'est l'état d'une plateforme neuve, le pire cas.
  await prisma.appSetting.upsert({ where: { id: "global" }, create: { id: "global", generalMeansDepartmentId: null }, update: { generalMeansDepartmentId: null } });
});

test.afterAll(async () => {
  await prisma.appSetting.update({ where: { id: "global" }, data: { generalMeansDepartmentId: serviceAvant } }).catch(() => {});
  await nettoyer();
  await prisma.$disconnect();
});

test("Stock promotionnel : une entrée À PART du menu Sales & Marketing — ses onglets Stock et Catalogue, et l'ancienne adresse y mène (§118.173)", async ({ page }) => {
  await login(page, SA_EMAIL);
  await aller(page, "/ad-pro");
  // Ad & Pro ne porte plus le stock : sa barre est celle des demandes.
  await expect(page.getByRole("link", { name: "Catalogue promotionnel", exact: true })).toHaveCount(0);
  // On y va comme une personne : par le MENU, où le pôle de la page courante est déplié.
  await page.getByRole("link", { name: "Stock promotionnel", exact: true }).first().click();
  await page.waitForURL(/\/stock-promotionnel(\?|$)/);
  await expect(page.getByRole("link", { name: "Stock", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Catalogue", exact: true }).click();
  await page.waitForURL(/\/stock-promotionnel\/catalogue$/);
  // L'ANCIENNE adresse, que portent des notifications déjà parties, mène au même écran — sa vue comprise.
  await aller(page, "/promo-material/stock?vue=moi");
  await expect(page).toHaveURL(/\/stock-promotionnel\?vue=moi$/);
});

test("Moyens généraux : sans service ni département, le Super Admin DÉSIGNE — puis change — sans voir d'autre caisse", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await login(page, SA_EMAIL);
  await aller(page, "/moyens-generaux");
  // L'IMPASSE D'AVANT : « Aucun département rattaché à votre compte », sans geste possible.
  await expect(page.getByText("Aucun service des moyens généraux n'est désigné")).toBeVisible();
  const choix = page.getByLabel("Département qui tient les moyens généraux");
  await choix.selectOption(deptA);
  await page.getByRole("button", { name: "Désigner" }).click();
  await expect(page.getByRole("heading", { name: `Moyens généraux — ${DEPT_A}` })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Service des moyens généraux de la société")).toBeVisible();
  // PLUS DE SÉLECTEUR DE DÉPARTEMENTS : la liste n'existe que derrière « Changer de service… », et
  // elle DÉSIGNE — elle n'ouvre la caisse d'aucun autre département.
  await expect(page.getByLabel("Département qui tient les moyens généraux")).toHaveCount(0);
  expect(await page.locator('a[href*="dept="]').count(), "un lien ?dept= ouvrirait la caisse d'un autre département").toBe(0);
  await page.getByRole("button", { name: "Changer de service…" }).click();
  await page.getByLabel("Département qui tient les moyens généraux").selectOption(deptB);
  await page.getByRole("button", { name: "Désigner" }).click();
  await expect(page.getByRole("heading", { name: `Moyens généraux — ${DEPT_B}` })).toBeVisible({ timeout: 20_000 });
  expect((await prisma.appSetting.findUnique({ where: { id: "global" } }))?.generalMeansDepartmentId).toBe(deptB);
});

test("Matériel promotionnel : la demande se compose de LIGNES dès sa création — sans budget, assistante, gamme ni entité", async ({ page }) => {
  await login(page, CP_EMAIL);
  await aller(page, "/promo-material?new=1");
  const panneau = page.getByRole("dialog");
  await expect(panneau.getByText("Articles demandés")).toBeVisible();
  // CE QUE LE FORMULAIRE NE DEMANDE PLUS (décision du 01/10).
  // Le « type de matériel » aussi (§118.173) : le catalogue EST la liste des supports, chaque ligne en désigne un.
  for (const retire of [/Budget estimé/, /Assistante de direction \(retranscrit/, /Business Unit/, /^Entité$/, /Type de matériel/]) {
    await expect(panneau.getByText(retire), `le formulaire affiche encore ${retire}`).toHaveCount(0);
  }

  // UN REFUS DIT TOUT CE QUI MANQUE, LIGNE PAR LIGNE — et rien n'est créé.
  await panneau.getByLabel(/Campagne \/ matériel/).fill(TITRE);
  await panneau.getByRole("listitem", { name: "Ligne 1" }).getByLabel("Impression").check();
  await panneau.getByRole("button", { name: "Enregistrer" }).click();
  await expect(panneau.getByRole("alert")).toContainText("Ligne 1 : Choisissez l'article dans le catalogue");
  expect(await prisma.promoMaterial.count({ where: { title: TITRE } })).toBe(0);

  // DEUX LIGNES, DEUX FAMILLES : un consommable quantifié, un support numérique sans quantité.
  const l1 = panneau.getByRole("listitem", { name: "Ligne 1" });
  await l1.getByLabel("Article du catalogue").selectOption(carnetId);
  await l1.getByLabel(/Quantité/).fill("300");
  await panneau.getByRole("button", { name: "Ajouter une ligne" }).click();
  const l2 = panneau.getByRole("listitem", { name: "Ligne 2" });
  await l2.getByLabel("Article du catalogue").selectOption(eadvId);
  await expect(l2.getByLabel(/Quantité/), "un support numérique ne se compte pas").toBeDisabled();
  await l2.getByLabel("Conception").check();
  await panneau.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/promo-material\/[a-z0-9]+$/, { timeout: 30_000 });

  const cree = await prisma.promoMaterial.findFirstOrThrow({
    where: { title: TITRE },
    select: { companyId: true, businessUnitId: true, amount: true, assistantId: true, circuitVersion: true, articlesDemandes: { orderBy: { position: "asc" }, select: { catalogueId: true, quantite: true, actions: true } } },
  });
  expect(cree).toMatchObject({ companyId, businessUnitId: null, amount: null, assistantId: null, circuitVersion: 2 });
  expect(cree.articlesDemandes.map((a) => [a.catalogueId, a.quantite == null ? null : Number(a.quantite), a.actions])).toEqual([
    [carnetId, 300, ["IMPRESSION"]],
    [eadvId, null, ["CONCEPTION"]],
  ]);

  // LA LISTE dit ce que la demande commande — ses lignes, et plus un « type » (§118.173).
  await aller(page, "/promo-material");
  const rangee = page.getByRole("row").filter({ hasText: TITRE });
  const noms = await prisma.promoCatalogueArticle.findMany({ where: { id: { in: [carnetId, eadvId] } }, select: { id: true, nom: true } });
  const nomDe = (id: string) => noms.find((n) => n.id === id)!.nom;
  await expect(rangee).toContainText(`${nomDe(carnetId)}, ${nomDe(eadvId)}`);
});

test("Matériel promotionnel au téléphone : le formulaire tient dans 375 px, et une ligne s'ajoute", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await login(page, CP_EMAIL);
  await aller(page, "/promo-material?new=1");
  const panneau = page.getByRole("dialog");
  await expect(panneau.getByRole("listitem", { name: "Ligne 1" })).toBeVisible();
  await sansDebordement(page);
  await panneau.getByRole("button", { name: "Ajouter une ligne" }).click();
  await expect(panneau.getByRole("listitem", { name: "Ligne 2" })).toBeVisible();
  await expect(panneau.getByRole("button", { name: "Retirer la ligne 2" })).toBeVisible();
  await sansDebordement(page);
});
