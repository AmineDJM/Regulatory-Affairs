import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E } from "./global-setup";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « VOIR COMME CET UTILISATEUR » — il fallait rafraîchir, sortir et rentrer pour que ça marche.
 *
 * Une action serveur qui `redirect()` ne renvoie pas une redirection : Next rend la page cible DANS
 * la réponse de l'action, en rejouant les en-têtes de la requête — `Next-Action` compris. La session
 * lisait cet en-tête pour savoir si « cette requête écrit » (§118.184) et, dans ce cas, ignorait la
 * vue : la page affichée juste après le clic était celle du Super Admin, sans bandeau. Un
 * rechargement (une vraie requête GET, sans l'en-tête) montrait enfin la vue — d'où « rafraîchis,
 * sors, rentre ».
 *
 * Aucun test unitaire ne pouvait le voir : le défaut est dans ce que Next fait ENTRE l'action et la
 * page. Cette spec joue le clic réel, contre le build de production, et ne recharge JAMAIS.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(E2E.password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** Navigation qui attend l'hydratation : un clic posé avant elle ne déclenche rien (§118.164). */
async function aller(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

let cibleId = "";
let cibleNom = "";
test.beforeAll(async () => {
  const u = await prisma.user.findUnique({ where: { email: E2E.email }, select: { id: true, name: true } });
  if (!u) throw new Error("le seed E2E n'a pas posé son utilisateur");
  cibleId = u.id;
  cibleNom = u.name;
});
test.afterAll(async () => { await prisma.$disconnect(); });

test("« Voir comme » : la vue s'ouvre du premier coup, sans rechargement ; « Quitter » la ferme de même", async ({ page }) => {
  await login(page, E2E.superAdminEmail);
  await aller(page, `/admin/users/${cibleId}`);

  // Marqueur posé sur le document : un rechargement complet l'EFFACE. S'il survit, on n'a pas rechargé.
  await page.evaluate(() => { (window as unknown as { __sansRechargement: boolean }).__sansRechargement = true; });

  await page.getByRole("button", { name: /voir comme cet utilisateur/i }).click();

  // La vue est là tout de suite : le bandeau nomme la personne visualisée, la page est celle de SON espace.
  const bandeau = page.getByText(/Vue exacte : vous voyez l.OS exactement comme/);
  await expect(bandeau).toBeVisible({ timeout: 15_000 });
  await expect(bandeau).toContainText(cibleNom);
  await expect(page).toHaveURL(/\/mon-espace/);
  expect(await page.evaluate(() => (window as unknown as { __sansRechargement?: boolean }).__sansRechargement)).toBe(true);

  // Naviguer dans la vue garde la vue (le routeur ne ressert pas une page d'avant).
  await page.getByRole("link", { name: /mon espace/i }).first().click().catch(() => undefined);
  await expect(bandeau).toBeVisible();

  // Quitter la vue : le bandeau disparaît du premier coup et on retrouve la console.
  await page.getByRole("button", { name: /quitter la vue/i }).click();
  await expect(page).toHaveURL(/\/admin(\?|$|\/)/, { timeout: 15_000 });
  await expect(page.getByText(/Vue exacte : vous voyez l.OS exactement comme/)).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __sansRechargement?: boolean }).__sansRechargement)).toBe(true);
});

test("« Voir comme » : un second passage sur une autre personne ne ressert pas la première", async ({ page }) => {
  const autre = await prisma.user.findUnique({ where: { email: E2E.lecteurEmail }, select: { id: true, name: true } });
  if (!autre) throw new Error("le seed E2E n'a pas posé son lecteur");
  await login(page, E2E.superAdminEmail);

  await aller(page, `/admin/users/${cibleId}`);
  await page.getByRole("button", { name: /voir comme cet utilisateur/i }).click();
  await expect(page.getByText(/Vue exacte : vous voyez l.OS exactement comme/)).toContainText(cibleNom, { timeout: 15_000 });
  await page.getByRole("button", { name: /quitter la vue/i }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });

  // Retour sur la page d'une AUTRE personne, sans recharger.
  await page.goto(`/admin/users/${autre.id}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /voir comme cet utilisateur/i }).click();
  await expect(page.getByText(/Vue exacte : vous voyez l.OS exactement comme/)).toContainText(autre.name, { timeout: 15_000 });
  await page.getByRole("button", { name: /quitter la vue/i }).click();
  await expect(page.getByText(/Vue exacte : vous voyez l.OS exactement comme/)).toHaveCount(0);
});
