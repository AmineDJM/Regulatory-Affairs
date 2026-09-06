import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E } from "./global-setup";

/**
 * « D'OÙ TU TIENS ÇA ? » — DE BOUT EN BOUT, SANS UN SEUL APPEL DE MODÈLE (F8).
 *
 * Le seed a consigné un tour pour le testeur : une fiche Regulatory et un total calculé avec sa
 * lignée. La spec tape la question dans le bureau d'Adam et vérifie que la réponse vient du
 * code : elle cite les deux faits, dit d'où et de quand, arrive vite — et le journal des appels
 * de modèle n'a pas bougé.
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

/** Pose une phrase dans le bureau d'Adam et attend la fin du tour (champ à nouveau actif). */
async function poser(page: Page, texte: string, timeoutMs: number): Promise<{ reponse: string; totalMs: number }> {
  const compter = () => page.evaluate(() => document.querySelectorAll(".chief-turn-author, .rounded-tl-sm").length);
  const avant = await compter();
  const saisie = page.locator("textarea").first();
  await expect(saisie).toBeEnabled({ timeout: 20_000 });
  await saisie.fill(texte);
  const t0 = Date.now();
  await saisie.press("Enter");
  for (;;) {
    const etat = await page.evaluate(() => {
      const ta = document.querySelector("textarea") as HTMLTextAreaElement | null;
      return { adam: document.querySelectorAll(".chief-turn-author, .rounded-tl-sm").length, occupe: ta ? ta.disabled : true };
    });
    if (etat.adam > avant && !etat.occupe) break;
    if (Date.now() - t0 > timeoutMs) throw new Error(`Adam n'a pas rendu son tour en ${Math.round(timeoutMs / 1000)} s`);
    await page.waitForTimeout(100);
  }
  const totalMs = Date.now() - t0;
  const auteurs = page.locator(".chief-turn-author");
  const reponse = (await auteurs.count()) > 0
    ? await auteurs.last().locator("xpath=ancestor::div[contains(@class,'min-w-0')][1]").innerText()
    : await page.locator(".rounded-tl-sm").last().innerText();
  return { reponse: reponse.trim(), totalMs };
}

test.afterAll(async () => { await prisma.$disconnect(); });

test("« D'où tu tiens ça ? » cite les faits du dernier tour, avec source et date, sans appel de modèle", async ({ page }) => {
  const testeur = await prisma.user.findUnique({ where: { email: E2E.email }, select: { id: true } });
  expect(testeur).not.toBeNull();
  const appelsAvant = await prisma.modelCallLog.count({ where: { userId: testeur!.id } });

  await login(page);
  await page.goto("/chief-of-staff");
  await page.waitForSelector("text=/Bonjour/", { timeout: 20_000 });
  const r = await poser(page, "D'où tu tiens ça ?", 20_000);
  console.log(`   · provenance dans l'interface : ${r.totalMs} ms · ${r.reponse.length} caractères`);

  // Le contenu : les deux faits, leur source, leur date propre, la lignée du calcul.
  expect(r.reponse).toMatch(/d'où je tiens/i);
  expect(r.reponse).toContain(E2E.provenanceLabel);
  expect(r.reponse).toMatch(/ERP · Regulatory/);
  expect(r.reponse).toMatch(/donnée du 12\/08\/2026/);
  expect(r.reponse).toContain(E2E.provenanceTotal);
  expect(r.reponse).toMatch(/somme côté base de 3 écriture/);
  expect(r.reponse).toMatch(/formule Σ montant/);
  expect(r.reponse).toMatch(/avec vos droits/);
  expect(r.reponse).toMatch(/tables vivantes/);

  // Le budget : la relecture est indexée — le tour entier tient largement sous les 5 s de navigateur.
  expect(r.totalMs).toBeLessThan(5_000);

  // ZÉRO appel de modèle : le journal n'a pas bougé (le puits d'usage se vide sous 1,5 s).
  await page.waitForTimeout(2_000);
  expect(await prisma.modelCallLog.count({ where: { userId: testeur!.id } })).toBe(appelsAvant);
  // Et le tour de provenance lui-même n'a rien consigné : la ligne du seed reste seule.
  expect(await prisma.assistantProvenance.count({ where: { userId: testeur!.id } })).toBe(1);
});
