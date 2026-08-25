import { test, expect } from "@playwright/test";
import { E2E } from "./global-setup";

/**
 * SMOKE E2E — les parcours DÉTERMINISTES (zéro appel IA) :
 *   1. connexion réelle (credentials seedés) → l'application s'ouvre ;
 *   2. invitation de compte : lien invalide refusé, lien expiré expliqué,
 *      lien valable → la personne définit SON mot de passe → et se connecte avec.
 * Le circuit d'invitation est LE flux « jamais de mot de passe en conversation » —
 * ici il se vérifie de bout en bout, écran compris.
 */

test.describe("authentification", () => {
  test("un inconnu est renvoyé à l'écran de connexion ; les identifiants seedés ouvrent l'app", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await page.fill('input[name="email"]', E2E.email);
    await page.fill('input[name="password"]', E2E.password);
    await page.click('button[type="submit"]');
    // Connecté : on quitte /login (accueil « Aujourd'hui » ou onboarding — peu importe l'écran,
    // il ne doit plus être celui de connexion).
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("de mauvais identifiants ne passent JAMAIS", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', E2E.email);
    await page.fill('input[name="password"]', "mauvais-mot-de-passe");
    await page.click('button[type="submit"]');
    // On reste sur /login (avec une erreur) — jamais redirigé dans l'app.
    await page.waitForTimeout(2_500);
    expect(page.url()).toContain("/login");
  });
});

test.describe("invitation de compte (jamais de mot de passe transmis)", () => {
  test("un token INVALIDE n'affiche jamais le formulaire", async ({ page }) => {
    await page.goto("/invite/token-qui-n-existe-pas");
    await expect(page.getByText(/n'existe pas/)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("un token EXPIRÉ est expliqué, sans formulaire", async ({ page }) => {
    await page.goto(`/invite/${E2E.inviteExpired}`);
    await expect(page.getByText(/a expiré/)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("le lien VALABLE fait définir SON mot de passe — puis la connexion marche, et le lien est consommé", async ({ page }) => {
    await page.goto(`/invite/${E2E.inviteValid}`);
    await expect(page.getByText(E2E.inviteeValid)).toBeVisible();

    const newPassword = "MonNouveauMdp#2026";
    await page.fill("#password", newPassword);
    await page.fill("#confirm", newPassword);
    await page.click('button[type="submit"]');
    await expect(page.getByText(/compte est actif/)).toBeVisible();

    // USAGE UNIQUE : rouvrir le lien ne redonne jamais le formulaire.
    await page.goto(`/invite/${E2E.inviteValid}`);
    await expect(page.getByText(/déjà servi/)).toBeVisible();

    // Et le mot de passe DÉFINI PAR LA PERSONNE ouvre l'application.
    await page.goto("/login");
    await page.fill('input[name="email"]', E2E.inviteeValid);
    await page.fill('input[name="password"]', newPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
    expect(page.url()).not.toContain("/login");
  });
});
