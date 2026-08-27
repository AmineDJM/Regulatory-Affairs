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

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §22 — LES CINQ SCÉNARIOS D'ACCEPTATION.
 *
 * « PASS uniquement si les scénarios sont visuellement ET fonctionnellement différents d'un
 * simple chatbot. » Ce qui suit vérifie précisément ce qu'une capture ne prouve pas seule : que
 * l'objet passe AVANT la prose, que le geste vit SOUS son objet, qu'aucun nom d'outil n'apparaît,
 * et qu'une mission de cinq actions ne demande qu'UNE confirmation.
 *
 * Les captures, elles, servent la revue visuelle — et elles sont produites ici aussi.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
test.describe("Adam — les cinq scénarios d'acceptation (§22)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/chief-of-staff?apercu=blocs");
    await page.waitForSelector('[data-testid="scenarios"]', { timeout: 20_000 });
  });

  test("les cinq scénarios sont rendus comme des espaces de travail", async ({ page }) => {
    for (let i = 1; i <= 5; i += 1) {
      const sc = page.locator(`[data-scenario="${i}"]`);
      await expect(sc, `scénario ${i} absent`).toBeVisible();
      // Un espace de travail, pas une bulle : le rangement a produit un objet de tête.
      await expect(sc.locator('[data-testid="turn-lead"]'), `scénario ${i} sans objet de tête`).toHaveCount(1);
    }
  });

  test("l'OBJET passe avant la prose — dans le DOM, pas seulement à l'œil", async ({ page }) => {
    // Le reproche n°1 fait au chantier précédent. On le vérifie par la POSITION VERTICALE réelle :
    // une assertion sur l'ordre du DOM se contournerait avec un `order` CSS.
    for (let i = 1; i <= 5; i += 1) {
      const sc = page.locator(`[data-scenario="${i}"]`);
      const synth = sc.locator('[data-testid="turn-synthesis"]');
      if ((await synth.count()) === 0) continue;
      const lead = await sc.locator('[data-testid="turn-lead"]').boundingBox();
      const prose = await synth.boundingBox();
      expect(lead, `scénario ${i}`).not.toBeNull();
      expect(prose, `scénario ${i}`).not.toBeNull();
      expect(lead!.y, `scénario ${i} : la prose passe avant l'objet`).toBeLessThan(prose!.y);
    }
  });

  test("le GESTE vit sous son objet, jamais en bas de page", async ({ page }) => {
    // Scénario 2 : « Envoie Regulatory à Amine » — le message, sa pièce jointe, et le geste.
    const sc = page.locator('[data-scenario="2"]');
    const lead = sc.locator('[data-testid="turn-lead"]');
    await expect(lead).toContainText("Situation Regulatory");
    await expect(lead).toContainText("Regulatory_27-08-2026.xlsx");
    // Le geste est DANS le même cadre que le message : c'est structurel, pas une proximité
    // visuelle qui se défait dès qu'un bloc s'allonge.
    await expect(lead.locator('[data-testid="scenario-actions"]')).toHaveCount(1);
  });

  test("AUCUN nom d'outil n'atteint l'écran", async ({ page }) => {
    // §18 : des états métier, pas « calling tool #7 ». On cherche les noms réels des outils.
    const body = (await page.locator('[data-testid="scenarios"]').innerText()).toLowerCase();
    for (const leak of ["gmail_search", "inspect_record", "list_pending_decisions", "directory_lookup", "domain_op", "prepare_email"]) {
      expect(body, `« ${leak} » ne doit jamais s'afficher`).not.toContain(leak);
    }
    // …et les phases métier, elles, sont bien là.
    await expect(page.locator('[data-scenario="2"] [data-testid="turn-phases"]')).toContainText("Préparation du message");
  });

  test("une mission de CINQ actions ne demande qu'UNE confirmation", async ({ page }) => {
    // §10 : « une mission cohérente = une confirmation ». Scénario 5.
    const sc = page.locator('[data-scenario="5"]');
    const bundle = sc.locator('[data-testid="scenario-bundle"]');
    await expect(bundle).toHaveCount(1);
    await expect(bundle).toContainText("5 actions");
    await expect(bundle).toContainText("une seule confirmation");
  });

  test("une planification devient un OBJET, pas une promesse", async ({ page }) => {
    // §11 : sans cette carte, la seule preuve qu'une planification existe serait la phrase
    // d'Adam qui dit l'avoir créée — c'est-à-dire aucune preuve.
    const sc = page.locator('[data-scenario="4"] [data-testid="turn-lead"]');
    await expect(sc).toContainText("Tous les lundis à 07 h");
    await expect(sc).toContainText("lundi 31/08/2026");
    await expect(sc).toContainText("Active");
  });

  test("captures des cinq scénarios, aux quatre tailles exigées", async ({ page }) => {
    test.slow();
    const sizes = [
      { name: "1920", width: 1920, height: 1080 },
      { name: "1440", width: 1440, height: 900 },
      { name: "430", width: 430, height: 932 },
      { name: "390", width: 390, height: 844 },
    ];
    for (const vp of sizes) {
      // Hauteur généreuse : on veut la planche ENTIÈRE sur une image, pas son premier écran.
      await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, 3200) });
      await page.goto("/chief-of-staff?apercu=blocs");
      await page.waitForSelector('[data-testid="scenarios"]', { timeout: 20_000 });
      for (let i = 1; i <= 5; i += 1) {
        await page.locator(`[data-scenario="${i}"]`).screenshot({
          path: `e2e-screenshots/scenario-${i}-${vp.name}.png`,
        });
      }
    }
  });

  test("aucun défilement latéral sur les scénarios, à aucune taille", async ({ page }) => {
    for (const w of [1920, 1440, 430, 390, 360]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto("/chief-of-staff?apercu=blocs");
      await page.waitForSelector('[data-testid="scenarios"]', { timeout: 20_000 });
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `débordement de ${overflow}px à ${w}px`).toBeLessThanOrEqual(1);
    }
  });
});
