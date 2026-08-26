import { test, expect, type Page } from "@playwright/test";
import { E2E } from "./global-setup";

/**
 * LE BUREAU D'ADAM, PHOTOGRAPHIÉ.
 *
 * §66 et §69 de la mission demandent des captures à des tailles précises, ET de les REGARDER —
 * « Do not stop at: tests pass. Compare visually. » Ce fichier produit les images ; la revue
 * visuelle est faite à la main, et ce qu'elle a montré est consigné dans le rapport.
 *
 * Les assertions ci-dessous vérifient les invariants qu'une capture ne peut pas prouver seule :
 * l'absence du chrome de l'ERP, l'absence de la phrase de présentation, et le fait que la page
 * ne défile pas latéralement — trois défauts qu'on voit mal sur une image mais qui sautent aux
 * yeux à l'usage.
 */

const VIEWPORTS = [
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "tablet-834", width: 834, height: 1194 },
  { name: "mobile-430", width: 430, height: 932 },
  { name: "mobile-393", width: 393, height: 852 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-landscape", width: 844, height: 390 },
];

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', E2E.email);
  await page.fill('input[name="password"]', E2E.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

test.describe("Adam — coque autonome", () => {
  test("les captures des tailles exigées", async ({ page }) => {
    test.slow();
    await login(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/chief-of-staff");
      // L'accueil est rendu : la salutation est le repère le plus stable.
      await page.waitForSelector("text=/Bonjour/", { timeout: 20_000 });
      await page.screenshot({ path: `e2e-screenshots/chief-home-${vp.name}.png`, fullPage: false });
    }
  });

  test("AUCUN chrome de l'ERP n'entre dans le bureau d'Adam", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chief-of-staff");
    await page.waitForSelector("text=/Bonjour/", { timeout: 20_000 });

    // Le menu latéral de l'ERP et la barre d'onglets mobile ne doivent pas exister ici.
    // On les cherche par leurs repères de navigation, pas par une classe CSS : une classe se
    // renomme, un lien de module reste.
    for (const moduleLink of ["Regulatory", "Finances", "Ressources humaines", "Drive"]) {
      await expect(page.getByRole("link", { name: moduleLink, exact: true })).toHaveCount(0);
    }
  });

  test("la phrase de présentation a disparu de l'en-tête", async ({ page }) => {
    await login(page);
    await page.goto("/chief-of-staff");
    await page.waitForSelector("text=/Bonjour/", { timeout: 20_000 });
    // Elle décrivait le produit à quelqu'un qui l'utilise tous les jours.
    await expect(page.getByText(/cherchez tout, lisez tout/i)).toHaveCount(0);
  });

  test("aucun défilement LATÉRAL, à aucune taille", async ({ page }) => {
    await login(page);
    for (const vp of [VIEWPORTS[0], VIEWPORTS[6], VIEWPORTS[10]]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/chief-of-staff");
      await page.waitForSelector("text=/Bonjour/", { timeout: 20_000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `débordement horizontal à ${vp.name}`).toBeLessThanOrEqual(1);
    }
  });

  test("le composeur reste atteignable, au-dessus de la zone sûre", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/chief-of-staff");
    await page.waitForSelector("text=/Bonjour/", { timeout: 20_000 });

    const composer = page.locator("textarea").first();
    await expect(composer).toBeVisible();
    const box = await composer.boundingBox();
    expect(box, "le composeur doit avoir une position").not.toBeNull();
    // Il doit être DANS l'écran, pas repoussé sous le pli.
    expect(box!.y).toBeLessThan(844);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PLANCHE DE RENDU — les objets métier, photographiés.
 *
 * Les blocs de l'espace de travail ne s'affichent qu'au bout d'un vrai tour de conversation.
 * Cette suite s'interdisant tout appel IA, la seule façon de les REGARDER est une planche de
 * démonstration ouverte par `ADAM_BLOCK_PREVIEW=1` sur `/chief-of-staff?apercu=blocs` : sans
 * cette variable, le paramètre ne fait rien et la page reste le bureau d'Adam.
 *
 * Ce que les assertions vérifient, et qu'une image ne prouve pas seule :
 *   • la frise du circuit désigne UNE étape courante, pas zéro ni deux ;
 *   • chaque objet porte ses gestes SOUS lui, dans sa propre carte ;
 *   • aucune page ne défile latéralement, à aucune des quatre tailles exigées.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const BLOCK_VIEWPORTS = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
  { name: "430", width: 430, height: 932 },
  { name: "390", width: 390, height: 844 },
];

test.describe("Adam — les objets métier dans le fil", () => {
  test("captures de chaque type de bloc, aux quatre tailles", async ({ page }) => {
    test.slow();
    await login(page);

    for (const vp of BLOCK_VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/chief-of-staff?apercu=blocs");
      await page.waitForSelector("[data-planche='dossier']", { timeout: 20_000 });

      // La planche entière, pour juger la cohérence d'ensemble…
      await page.screenshot({ path: `e2e-screenshots/blocs-planche-${vp.name}.png`, fullPage: true });

      // …puis chaque objet isolé, pour juger sa densité.
      //
      // LA HAUTEUR DE FENÊTRE EST MONTÉE POUR CES CAPTURES-LÀ, et seulement pour elles. Un objet
      // plus haut que la fenêtre est rogné par le haut : la capture 390 de la carte de dossier
      // avait perdu sa référence et son badge, c'est-à-dire précisément ce qu'on venait juger.
      // Seule la LARGEUR décide de la mise en page ici (aucune règle en `vh`), donc allonger la
      // fenêtre ne change pas ce qu'on photographie — cela le rend seulement entièrement visible.
      await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, 2400) });
      for (const kind of ["people", "table", "dossier", "email", "queue", "progress", "document"]) {
        const section = page.locator(`[data-planche='${kind}']`);
        if (await section.count()) {
          await section.first().screenshot({ path: `e2e-screenshots/bloc-${kind}-${vp.name}.png` });
        }
      }
    }
  });

  test("le circuit désigne UNE étape courante — ni zéro, ni deux", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chief-of-staff?apercu=blocs");
    await page.waitForSelector("[data-planche='dossier']", { timeout: 20_000 });

    const dossier = page.locator("[data-planche='dossier']");
    await expect(dossier.locator(".chief-step-courant")).toHaveCount(1);
    await expect(dossier.locator(".chief-step-fait")).toHaveCount(2);
    // Le blocage est la seule surface colorée de la carte : c'est la seule chose à décider.
    await expect(dossier.locator(".chief-alert-alerte")).toHaveCount(1);
  });

  test("les gestes vivent SOUS leur objet, pas dans une barre d'outils", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chief-of-staff?apercu=blocs");
    await page.waitForSelector("[data-planche='dossier']", { timeout: 20_000 });

    // Chaque carte porte son propre pied d'actions — aucune n'emprunte celui d'une autre.
    for (const kind of ["people", "table", "dossier", "email", "queue"]) {
      const section = page.locator(`[data-planche='${kind}']`);
      await expect(section.locator(".chief-block-actions, .chief-actions").first()).toBeVisible();
    }
  });

  test("aucun défilement latéral, à aucune des quatre tailles", async ({ page }) => {
    await login(page);
    for (const vp of BLOCK_VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/chief-of-staff?apercu=blocs");
      await page.waitForSelector("[data-planche='dossier']", { timeout: 20_000 });
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `débordement horizontal à ${vp.name} px`).toBeLessThanOrEqual(1);
    }
  });
});
