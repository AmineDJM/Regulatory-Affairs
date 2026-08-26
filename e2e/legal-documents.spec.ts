import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E } from "./global-setup";

/**
 * LE BOGUE DES BONS DE COMMANDE « DISPARUS », REJOUÉ DANS UN VRAI NAVIGATEUR.
 *
 * La suite vitest prouve la règle ; celle-ci prouve l'ÉCRAN — parce que le bogue vivait
 * précisément dans ce que la règle seule ne montrait pas : la navigation par `<Link>` conserve
 * le composant monté, donc son état de filtrage survit au changement de dossier.
 *
 * La séquence suit la mission : ouvrir, changer d'onglet, revenir, aller ailleurs, revenir,
 * recharger — et à chaque étape les six documents doivent être là. Une seule absence suffit à
 * faire échouer le test.
 *
 * Aucune attente arbitraire : on attend des ÉTATS (`waitForURL`, `toBeVisible`), jamais un
 * délai. Un `waitForTimeout` transformerait un bogue de course en test qui échoue au hasard.
 */

const DB_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public";

async function connecter(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', E2E.email);
  await page.fill('input[name="password"]', E2E.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** Le nombre de lignes RÉELLEMENT affichées dans le tableau Legal. */
async function documentsAffiches(page: Page): Promise<number> {
  await page.waitForSelector("table tbody", { timeout: 15_000 });
  return page.locator(`table tbody tr:has-text("${E2E.legalDocPrefix}")`).count();
}

test.describe("Legal — les documents d'un dossier ne disparaissent pas", () => {
  test("les six bons de commande restent visibles à travers navigation, onglets et rechargement", async ({ page }) => {
    const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    try {
      // ── LA DONNÉE : le rattachement existe en base AVANT toute manipulation d'écran ──
      const folder = await prisma.legalFolder.findFirstOrThrow({
        where: { name: E2E.legalFolder },
        select: { id: true },
      });
      const liesAvant = await prisma.legalDocument.count({ where: { folderId: folder.id } });
      expect(liesAvant).toBe(E2E.legalDocCount);

      await connecter(page);

      // ── 1. Ouverture du dossier : les six documents s'affichent ──
      await page.goto(`/legal?dossier=${folder.id}`);
      expect(await documentsAffiches(page)).toBe(E2E.legalDocCount);

      // ── 2. LE CHEMIN QUI CASSAIT : arriver par un rappel d'échéance, puis ouvrir le dossier ──
      // Le filtre « à surveiller » se pose ; aucun BC n'expire, donc l'écran est vide — c'est
      // NORMAL sur cet écran-là.
      await page.goto("/legal?echeances=1");
      await page.waitForSelector("table tbody");
      // …puis on clique le dossier dans la barre (navigation <Link>, composant NON remonté).
      await page.click(`a[href="/legal?dossier=${folder.id}"]`);
      await page.waitForURL(`**/legal?dossier=${folder.id}`);
      // Sans le correctif : 0. Avec : 6.
      expect(await documentsAffiches(page)).toBe(E2E.legalDocCount);

      // ── 3. Onglet « Tous les engagements », puis retour au dossier ──
      await page.click('a[href="/legal"]');
      await page.waitForURL((u) => u.pathname === "/legal" && !u.search);
      expect(await documentsAffiches(page)).toBe(E2E.legalDocCount);
      await page.click(`a[href="/legal?dossier=${folder.id}"]`);
      await page.waitForURL(`**/legal?dossier=${folder.id}`);
      expect(await documentsAffiches(page)).toBe(E2E.legalDocCount);

      // ── 4. Aller sur un AUTRE écran, puis revenir ──
      await page.goto("/dashboard");
      await page.goto(`/legal?dossier=${folder.id}`);
      expect(await documentsAffiches(page)).toBe(E2E.legalDocCount);

      // ── 5. Rechargement complet du navigateur ──
      await page.reload();
      expect(await documentsAffiches(page)).toBe(E2E.legalDocCount);

      // ── 6. Le retour en arrière du navigateur (historique client) ──
      await page.goto("/legal?echeances=1");
      await page.waitForSelector("table tbody");
      await page.goBack();
      await page.waitForURL(`**/legal?dossier=${folder.id}`);
      expect(await documentsAffiches(page)).toBe(E2E.legalDocCount);

      // ── 7. Répétition : le bogue se disait « intermittent » ──
      for (let i = 0; i < 3; i += 1) {
        await page.goto("/legal?echeances=1");
        await page.waitForSelector("table tbody");
        await page.click(`a[href="/legal?dossier=${folder.id}"]`);
        await page.waitForURL(`**/legal?dossier=${folder.id}`);
        expect(await documentsAffiches(page), `itération ${i}`).toBe(E2E.legalDocCount);
      }

      // ── LA DONNÉE, ENCORE : rien n'a été détaché par toute cette navigation ──
      const liesApres = await prisma.legalDocument.count({ where: { folderId: folder.id } });
      expect(liesApres).toBe(E2E.legalDocCount);
    } finally {
      await prisma.$disconnect();
    }
  });

  test("le filtre « à surveiller » reste utilisable — le correctif ne l'a pas neutralisé", async ({ page }) => {
    const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    try {
      const folder = await prisma.legalFolder.findFirstOrThrow({ where: { name: E2E.legalFolder }, select: { id: true } });
      await connecter(page);
      await page.goto(`/legal?dossier=${folder.id}`);
      expect(await documentsAffiches(page)).toBe(E2E.legalDocCount);

      // On l'active À LA MAIN, dans ce dossier : il doit filtrer (aucun BC n'expire).
      await page.click('button:has-text("À surveiller")');
      expect(await documentsAffiches(page)).toBe(0);
      // Et l'écran vide DIT pourquoi il est vide, au lieu d'accuser les données.
      await expect(page.getByText(/masqué/)).toBeVisible();

      // « Tout afficher » les ramène.
      await page.click('button:has-text("Tout afficher")');
      expect(await documentsAffiches(page)).toBe(E2E.legalDocCount);
    } finally {
      await prisma.$disconnect();
    }
  });
});

test.describe("Feedback — une pièce jointe déposée survit au rechargement", () => {
  test("dépôt, relecture après refresh, ouverture, puis retrait", async ({ page }) => {
    const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    try {
      await connecter(page);
      await page.goto("/feedback");

      const message = `__e2e__ retour avec pièce ${Date.now()}`;
      await page.click('button:has-text("Envoyer un feedback")');
      await page.fill('textarea[name="message"]', message);

      // Un vrai PNG (signature comprise) : la politique serveur vérifie les OCTETS.
      const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from("contenu de capture e2e"),
      ]);
      await page.setInputFiles('input[name="files"]', {
        name: "capture-e2e.png", mimeType: "image/png", buffer: png,
      });
      await page.click('button[type="submit"]');

      // La pièce apparaît, nommée.
      await expect(page.getByText("capture-e2e.png").first()).toBeVisible({ timeout: 20_000 });

      // ── LA DONNÉE : la pièce existe en base, avec son contenu ──
      const fb = await prisma.feedback.findFirstOrThrow({
        where: { message },
        include: { attachments: true },
      });
      expect(fb.attachments).toHaveLength(1);
      expect(fb.attachments[0].name).toBe("capture-e2e.png");
      expect(fb.attachments[0].mime).toBe("image/png");

      // ── LE RECHARGEMENT : elle est toujours là ──
      await page.reload();
      await expect(page.getByText("capture-e2e.png").first()).toBeVisible();

      // ── L'OUVERTURE : le fichier est réellement servi (200, bon type) ──
      const res = await page.request.get(`/api/feedback/attachment/${fb.attachments[0].id}`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
      expect(res.headers()["x-content-type-options"]).toBe("nosniff");

      // ── LE RETRAIT ──
      page.once("dialog", (d) => void d.accept());
      await page.click('button[aria-label="Retirer capture-e2e.png"]');
      await expect(page.getByText("capture-e2e.png")).toHaveCount(0, { timeout: 15_000 });
      expect(await prisma.feedbackAttachment.count({ where: { feedbackId: fb.id } })).toBe(0);
    } finally {
      await prisma.$disconnect();
    }
  });
});
