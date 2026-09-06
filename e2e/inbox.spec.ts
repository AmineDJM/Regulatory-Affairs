import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E } from "./global-setup";
import { MESURE_DEBORDEMENTS } from "./measure";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA BOÎTE DE DÉCISION, DE BOUT EN BOUT — sans aucun appel de modèle (§21).
 *
 * Le seed a posé trois lignes réelles pour le testeur : une validation à son tour dont
 * l'échéance est dépassée, une notification importante non lue, un engagement en retard. La
 * spec vérifie que la boîte les montre dans le bon ordre, se charge dans le budget du mandat,
 * que « Refuser » exige un motif, que « Approuver » ÉCRIT la décision en base, que « Vu »
 * marque la notification lue — et que tout tient sur un téléphone.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(E2E.email);
  await page.getByLabel(/mot de passe/i).fill(E2E.password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

test.describe.configure({ mode: "serial" });
test.afterAll(async () => { await prisma.$disconnect(); });

test("les trois cartes réelles, classées, chargées dans le budget ; les filtres filtrent", async ({ page }) => {
  await login(page);
  const t0 = Date.now();
  await page.goto("/chief-of-staff/inbox");
  const cartes = page.locator("[data-testid='inbox-card']");
  await expect(cartes.first()).toBeVisible({ timeout: 20_000 });
  const navigationMs = Date.now() - t0;
  expect(await cartes.count()).toBeGreaterThanOrEqual(3);

  // La validation — CRITIQUE, elle bloque quelqu'un — sort en tête, devant l'engagement.
  const premiere = cartes.first();
  await expect(premiere).toHaveAttribute("data-genre", "APPROVE");
  await expect(premiere).toHaveAttribute("data-urgence", "CRITIQUE");
  await expect(premiere).toContainText(E2E.inboxValidationTitle);
  await expect(premiere).toContainText(/120/);
  await expect(premiere).toContainText(/en retard/);

  // L'engagement en retard porte sa recommandation, et elle dit pourquoi.
  const engagement = page.locator("[data-testid='inbox-card']", { hasText: E2E.inboxCommitmentWho });
  await expect(engagement).toHaveAttribute("data-genre", "REVIEW");
  await expect(engagement.locator("[data-testid='inbox-reco']")).toContainText(/Relancer/);

  // Le budget : la composition serveur est affichée ; elle doit tenir sous 1,5 s.
  const ms = Number(await page.locator("[data-testid='inbox-timing']").getAttribute("data-ms"));
  console.log(`   · composition ${ms} ms · navigation jusqu'à la première carte ${navigationMs} ms`);
  expect(ms).toBeLessThan(1_500);

  // Les filtres : « Pour information » ne montre que la notification.
  await page.getByTestId("inbox-filter-FYI").click();
  const visibles = page.locator("[data-testid='inbox-card']");
  expect(await visibles.count()).toBeGreaterThanOrEqual(1);
  for (let i = 0; i < await visibles.count(); i++) await expect(visibles.nth(i)).toHaveAttribute("data-genre", "FYI");
  await page.getByTestId("inbox-filter-TOUS").click();
  expect(await page.locator("[data-testid='inbox-card']").count()).toBeGreaterThanOrEqual(3);
});

test("refuser exige un motif ; approuver d'un clic écrit la décision en base", async ({ page }) => {
  await login(page);
  await page.goto("/chief-of-staff/inbox");
  const carte = page.locator("[data-testid='inbox-card']", { hasText: E2E.inboxValidationTitle });
  await expect(carte).toBeVisible({ timeout: 20_000 });

  // « Refuser » sans motif n'exécute rien : une saisie s'ouvre, « Confirmer » reste désarmé.
  await carte.getByTestId("inbox-option-refuser").click();
  await expect(carte.getByTestId("inbox-saisie")).toBeVisible();
  await expect(carte.getByTestId("inbox-confirmer")).toBeDisabled();
  await carte.getByRole("button", { name: "Annuler" }).click();
  const etape = await prisma.validationStep.findFirst({ where: { request: { reference: E2E.inboxValidationRef } } });
  expect(etape?.status).toBe("PENDING");

  // « Approuver » : la carte RESTE à l'écran avec son issue (l'action revalide et Next.js renvoie
  // la page recomposée, où la carte n'est plus — l'écran la garde, §21), et l'étape est APPROVED.
  await carte.getByTestId("inbox-option-approuver").click();
  // L'issue, quelle qu'elle soit, puis le verdict : un refus du serveur doit se LIRE dans l'échec.
  await expect(carte.locator("[data-testid='inbox-fait'], [data-testid='inbox-erreur']")).toBeVisible({ timeout: 15_000 });
  const erreurs = await carte.getByTestId("inbox-erreur").allTextContents();
  expect(erreurs, `le serveur a refusé : ${erreurs.join(" | ")}`).toEqual([]);
  await expect(carte.getByTestId("inbox-fait")).toContainText(/enregistr|approuv/i);
  // La carte tranchée n'offre plus de bouton : on ne décide pas deux fois.
  await expect(carte.getByTestId("inbox-option-approuver")).toHaveCount(0);
  const apres = await prisma.validationStep.findFirst({ where: { request: { reference: E2E.inboxValidationRef } } });
  expect(apres?.status).toBe("APPROVED");
  const demande = await prisma.validationRequest.findUnique({ where: { reference: E2E.inboxValidationRef } });
  expect(demande?.status).toBe("APPROVED");

  // Au rechargement, la carte a disparu : la file est la vérité, pas l'écran.
  await page.reload();
  await expect(page.locator("[data-testid='inbox-card']").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-testid='inbox-card']", { hasText: E2E.inboxValidationTitle })).toHaveCount(0);
});

test("« Vu » marque la notification lue en base", async ({ page }) => {
  await login(page);
  await page.goto("/chief-of-staff/inbox");
  const carte = page.locator("[data-testid='inbox-card']", { hasText: E2E.inboxNotificationTitle });
  await expect(carte).toBeVisible({ timeout: 20_000 });
  await expect(carte).toHaveAttribute("data-genre", "FYI");
  await carte.getByTestId("inbox-option-vu").click();
  await expect(carte.locator("[data-testid='inbox-fait'], [data-testid='inbox-erreur']")).toBeVisible({ timeout: 15_000 });
  expect(await carte.getByTestId("inbox-erreur").allTextContents()).toEqual([]);
  const notif = await prisma.notification.findFirst({ where: { title: E2E.inboxNotificationTitle } });
  expect(notif?.isRead).toBe(true);
});

test("sur un téléphone de 390 px, les cartes tiennent et les boutons restent atteignables", async ({ browser }) => {
  const contexte = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await contexte.newPage();
  await login(page);
  await page.goto("/chief-of-staff/inbox");
  await expect(page.locator("[data-testid='inbox-card']").first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "e2e-screenshots/inbox-mobile-390.png", fullPage: true });
  const debordements = (await page.evaluate(MESURE_DEBORDEMENTS)) as unknown[];
  expect(debordements, JSON.stringify(debordements, null, 1)).toEqual([]);
  // Le premier bouton d'action est dans la fenêtre et assez haut pour un pouce (≥ 40 px).
  const bouton = page.locator("[data-testid='inbox-card']").first().locator("button").first();
  const boite = await bouton.boundingBox();
  expect(boite?.height ?? 0).toBeGreaterThanOrEqual(40);
  expect((boite?.x ?? 0) + (boite?.width ?? 0)).toBeLessThanOrEqual(390);
  await contexte.close();
});

test("sur un téléphone, le retour visuel d'un geste arrive en moins de 150 ms (avant même la réponse du serveur)", async ({ browser }) => {
  // Mandat 4 §30 : « feedback < 150 ms ». La carte passe en « en_cours » de façon SYNCHRONE au
  // toucher (état optimiste), le serveur répond ensuite. On mesure dans la page, du clic au
  // premier rendu de l'attribut `data-etat`, à la précision d'une image (requestAnimationFrame).
  // Le test « Vu » qui précède a marqué la notification LUE : elle a quitté la boîte. On la remet
  // non lue pour que la carte existe — c'est la même carte, le même geste en place (« Vu »), et
  // c'est ce geste-là qu'on chronomètre (pas un bouton « ouvrir », qui navigue au lieu d'agir).
  await prisma.notification.updateMany({ where: { title: E2E.inboxNotificationTitle }, data: { isRead: false } });
  const contexte = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await contexte.newPage();
  await login(page);
  await page.goto("/chief-of-staff/inbox");
  const carte = page.locator("[data-testid='inbox-card']", { hasText: E2E.inboxNotificationTitle }).first();
  await expect(carte).toBeVisible({ timeout: 20_000 });
  await expect(carte.getByTestId("inbox-option-vu")).toBeVisible();
  const delaiMs = await carte.evaluate(async (li) => {
    const bouton = li.querySelector("[data-testid='inbox-option-vu']");
    if (!bouton) return -1;
    const t0 = performance.now();
    (bouton as HTMLButtonElement).click();
    for (let i = 0; i < 60; i++) {
      if (li.getAttribute("data-etat") !== "repos") return performance.now() - t0;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    return 10_000;
  });
  expect(delaiMs, `retour visuel après ${Math.round(delaiMs)} ms`).toBeGreaterThanOrEqual(0);
  expect(delaiMs).toBeLessThan(150);
  await expect(carte).toHaveAttribute("data-etat", /fait|erreur/, { timeout: 15_000 });
  await contexte.close();
});

test("le bureau d'Adam ouvre la boîte depuis « Ce qui t'attend »", async ({ page }) => {
  await login(page);
  await page.goto("/chief-of-staff");
  const porte = page.getByTestId("home-inbox");
  await expect(porte).toBeVisible({ timeout: 20_000 });
  await porte.click();
  await page.waitForURL(/\/chief-of-staff\/inbox/);
  await expect(page.locator("[data-testid='inbox']")).toBeVisible();
});
