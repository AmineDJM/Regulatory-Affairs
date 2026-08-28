import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { E2E } from "./global-setup";

/**
 * Les identifiants des documents déposés par le seed. Ils sont dans un fichier et non dans une
 * variable d'environnement : `process.env` posé par `globalSetup` ne traverse pas jusqu'aux
 * workers Playwright, qui sont des processus distincts.
 */
const NOEUDS: { docxNode: string; pdfNode: string } = JSON.parse(readFileSync(".e2e-office.json", "utf8"));

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LIVE OFFICE — le document, à l'écran, pour de vrai (§94, §96).
 *
 * Ce fichier ouvre un VRAI `.docx` et un VRAI `.pdf` déposés dans le Drive par le seed, les
 * modifie depuis la barre de commande du workspace, et CAPTURE l'écran avant et après — sur
 * desktop et sur téléphone.
 *
 * ── POURQUOI DES CAPTURES, ET PAS SEULEMENT DES ASSERTIONS ─────────────────────────────
 *
 * Une assertion dit « le paragraphe porte `text-align: center` ». Une capture dit si la page
 * ressemble à une page. Les deux sont ici : les assertions verrouillent le comportement, les
 * images (`e2e-screenshots/`) permettent de REGARDER, ce que §96 demande explicitement.
 *
 * ── AUCUN APPEL DE MODÈLE ──────────────────────────────────────────────────────────────
 *
 * L'écran Office Focus ouvre le document par un appel de fonction, et les phrases jouées ici
 * sont toutes reconnues par le décodeur direct (§30). Le parcours est donc entièrement
 * déterministe — la règle que se donne cette suite E2E depuis le début.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const TELEPHONE = { width: 390, height: 844 };
const BUREAU = { width: 1440, height: 900 };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(E2E.email);
  await page.getByLabel(/mot de passe/i).fill(E2E.password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** Tape une instruction dans la barre du workspace et attend que la vue ait bougé. */
async function instruire(page: Page, phrase: string) {
  const saisie = page.getByLabel("Instruction sur le document");
  await saisie.fill(phrase);
  await page.getByRole("button", { name: "Appliquer" }).click();
  // La scène passe en demi-teinte pendant le travail : on attend qu'elle revienne.
  await expect(page.locator(".artifact-scene")).toHaveAttribute("data-occupe", "0", { timeout: 15_000 });
}

test.describe("Live Office — Word", () => {
  test("ouvre, centre le titre, réduit à 16, supprime un paragraphe, annule", async ({ page }) => {
    await login(page);
    await page.goto(`/office/live/${NOEUDS.docxNode}`);

    // Le document est là, avec ses paragraphes numérotés dans la marge.
    await expect(page.locator(".artifact")).toBeVisible();
    await expect(page.locator(".artifact")).toHaveAttribute("data-format", "DOCX");
    const titre = page.locator(".artifact-bloc").first();
    await expect(titre).toContainText("Contrat Consulting Mouffok");
    const paragraphesAvant = await page.locator(".artifact-bloc").count();

    await page.setViewportSize(BUREAU);
    await page.screenshot({ path: "e2e-screenshots/office-docx-avant-bureau.png", fullPage: false });

    // ── « Centre le titre. » ────────────────────────────────────────────────────────
    await instruire(page, "Centre le titre");
    await expect(titre.locator("p")).toHaveCSS("text-align", "center");

    // ── « Réduis-le à 16. » ─────────────────────────────────────────────────────────
    await instruire(page, "Réduis le titre à 16");
    // 16 pt = 21,333 px à 96 ppp. On tolère l'arrondi du navigateur.
    const taille = await titre.locator("p").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(taille).toBeGreaterThan(20.5);
    expect(taille).toBeLessThan(22);

    // ── « Supprime le troisième paragraphe. » ───────────────────────────────────────
    await instruire(page, "Supprime le troisième paragraphe");
    await expect(page.locator(".artifact-bloc")).toHaveCount(paragraphesAvant - 1);

    await page.screenshot({ path: "e2e-screenshots/office-docx-apres-bureau.png", fullPage: false });

    // ── « Annule. » ─────────────────────────────────────────────────────────────────
    await instruire(page, "Annule");
    await expect(page.locator(".artifact-bloc")).toHaveCount(paragraphesAvant);
    // Les modifications PRÉCÉDENTES survivent à l'annulation de la dernière.
    await expect(titre.locator("p")).toHaveCSS("text-align", "center");

    // Le document est « sale » : le bandeau le dit, et le bouton Enregistrer est actif.
    await expect(page.locator(".artifact-etat-sale")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
  });

  test("le workspace tient sur un téléphone", async ({ page }) => {
    await page.setViewportSize(TELEPHONE);
    await login(page);
    await page.goto(`/office/live/${NOEUDS.docxNode}`);
    await expect(page.locator(".artifact")).toBeVisible();

    // LA PAGE NE DOIT PAS DÉFILER HORIZONTALEMENT — c'est le défaut mobile le plus visible,
    // et le plus facile à réintroduire en ajoutant une colonne fixe.
    const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(debord).toBeLessThanOrEqual(1);

    await instruire(page, "Centre le titre");
    await page.screenshot({ path: "e2e-screenshots/office-docx-telephone.png", fullPage: false });
  });
});

test.describe("Live Office — PDF", () => {
  test("supprime les pages 2, 4 et 6, puis annule", async ({ page }) => {
    await login(page);
    await page.goto(`/office/live/${NOEUDS.pdfNode}`);
    await expect(page.locator(".artifact")).toHaveAttribute("data-format", "PDF");

    const miniatures = page.locator(".artifact-miniature");
    const pagesAvant = await miniatures.count();
    expect(pagesAvant).toBeGreaterThanOrEqual(8);
    // La page rendue est une VRAIE image, produite par MuPDF depuis l'état courant.
    await expect(page.locator(".artifact-pdf-image")).toBeVisible();
    await page.setViewportSize(BUREAU);
    await page.screenshot({ path: "e2e-screenshots/office-pdf-avant-bureau.png" });

    await instruire(page, "Supprime les pages 2, 4 et 6");
    await expect(miniatures).toHaveCount(pagesAvant - 3);
    // Les rangs sont RENUMÉROTÉS de 1 à n : c'est ce que la personne voit et compte ensuite.
    await expect(miniatures.nth(1).locator(".artifact-miniature-num")).toHaveText("2");
    await page.screenshot({ path: "e2e-screenshots/office-pdf-apres-bureau.png" });

    await instruire(page, "Annule");
    await expect(miniatures).toHaveCount(pagesAvant);
  });

  test("les miniatures passent en bande horizontale sur téléphone", async ({ page }) => {
    await page.setViewportSize(TELEPHONE);
    await login(page);
    await page.goto(`/office/live/${NOEUDS.pdfNode}`);
    await expect(page.locator(".artifact-miniatures")).toBeVisible();
    const direction = await page.locator(".artifact-miniatures").evaluate((el) => getComputedStyle(el).flexDirection);
    expect(direction).toBe("row");
    const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(debord).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "e2e-screenshots/office-pdf-telephone.png" });
  });
});
