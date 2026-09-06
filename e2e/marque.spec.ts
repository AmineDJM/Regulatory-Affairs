import zlib from "node:zlib";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E } from "./global-setup";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE REGISTRE DE MARQUE, DE BOUT EN BOUT — sans aucun appel de modèle (mandat 4 §26).
 *
 * Le seed a posé un compte qui TIENT la papeterie (assistante de direction) et un simple
 * lecteur qui ne la tient pas (la Direction, elle, règle la charte : c'est sa décision). La spec vérifie que l'écran lit pour l'un et règle pour
 * l'autre, que la charte enregistrée est RELUE (accent, police, mention, signataire des devis),
 * qu'un logo PNG déposé s'affiche et se retire, qu'une couleur trop pâle déclenche l'alerte de
 * contraste, et que le registre en base porte bien ce que l'écran a montré.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});
/**
 * UN PNG UNIQUE À CHAQUE RUN. Le stockage du Drive dédoublonne par empreinte : un pixel identique
 * déposé par un test sous une AUTRE clé de chiffrement (la suite unitaire, un ancien run) serait
 * réutilisé tel quel — illisible pour ce serveur. Des pixels aléatoires font une empreinte neuve.
 */
function pngAleatoire(): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const lignes = Buffer.concat([0, 1].map(() => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: 8 }, () => Math.floor(Math.random() * 256)))])));
  const idat = zlib.deflateSync(lignes);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}

let companyId: string | null = null;
let settingsAvant: unknown = null;
let profilExistait = false;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const c = await prisma.company.findFirst({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true } }).catch(() => null);
  companyId = c?.id ?? null;
  if (companyId) {
    const p = await prisma.companyDocumentProfile.findUnique({ where: { companyId }, select: { settings: true } });
    profilExistait = Boolean(p);
    settingsAvant = p?.settings ?? null;
  }
});

test.afterAll(async () => {
  if (companyId) {
    if (profilExistait) await prisma.companyDocumentProfile.update({ where: { companyId }, data: { settings: (settingsAvant ?? undefined) as object | undefined } }).catch(() => undefined);
    else await prisma.companyDocumentProfile.deleteMany({ where: { companyId } }).catch(() => undefined);
  }
  await prisma.auditLog.deleteMany({ where: { summary: { contains: "__e2e__marque" } } }).catch(() => undefined);
  await prisma.$disconnect();
});

test("un simple lecteur LIT le registre ; il ne le règle pas", async ({ page }) => {
  await login(page, E2E.lecteurEmail, E2E.password);
  await page.goto("/admin/marque");
  await expect(page.getByTestId("marque-lecture-seule")).toBeVisible({ timeout: 20_000 });
  // Le lecteur n'est rattaché à aucune société : il voit l'avis de lecture seule (et l'état vide)
  // sans jamais voir un formulaire — c'est le droit qui est testé ici, pas le périmètre.
  expect(await page.getByTestId("marque-form").count()).toBe(0);
});

test("l'assistante de direction règle la charte : accent, police des titres, mention, signataire des devis — relus après rechargement", async ({ page }) => {
  test.skip(!companyId, "aucune société active");
  await login(page, E2E.papeterieEmail, E2E.password);
  await page.goto("/admin/marque");
  const carte = page.locator(`[data-testid="marque-carte"][data-societe="${companyId}"]`);
  await expect(carte).toBeVisible({ timeout: 20_000 });
  const form = carte.getByTestId("marque-form");
  await form.getByTestId("marque-accent").fill("#0b6e4f");
  await form.getByTestId("marque-police-titres").selectOption("Georgia");
  await form.getByTestId("marque-mentions").fill("Agrément ANPP n° __e2e__marque-042");
  await form.locator('input[name="sig_DEVIS_nom"]').fill("Amel Haddad");
  await form.locator('input[name="sig_DEVIS_qualite"]').fill("Directrice commerciale");
  const t0 = Date.now();
  await form.getByRole("button", { name: /enregistrer la charte/i }).click();
  const message = carte.getByTestId("marque-message");
  await expect(message).toContainText(/Enregistré/, { timeout: 20_000 });
  const enregistrementMs = Date.now() - t0;
  expect(enregistrementMs, "l'enregistrement répond vite").toBeLessThan(10_000);

  await page.reload();
  const carte2 = page.locator(`[data-testid="marque-carte"][data-societe="${companyId}"]`);
  await expect(carte2).toBeVisible({ timeout: 20_000 });
  await expect(carte2.getByTestId("marque-resume")).toContainText(/accent 0B6E4F \(registre de marque\)/);
  await expect(carte2.getByTestId("marque-resume")).toContainText(/Georgia/);
  await expect(carte2.getByTestId("marque-resume")).toContainText(/devis : Amel Haddad/);
  await expect(carte2.getByTestId("marque-mentions")).toHaveValue(/__e2e__marque-042/);

  // LE REGISTRE EN BASE porte ce que l'écran a montré.
  const p = await prisma.companyDocumentProfile.findUnique({ where: { companyId: companyId! }, select: { settings: true } });
  const marque = (p?.settings as { marque?: { couleurs?: { accent?: string }; polices?: { titres?: string }; signatures?: { parType?: { DEVIS?: { nom?: string } } } } } | null)?.marque;
  expect(marque?.couleurs?.accent).toBe("0B6E4F");
  expect(marque?.polices?.titres).toBe("Georgia");
  expect(marque?.signatures?.parType?.DEVIS?.nom).toBe("Amel Haddad");
});

test("une couleur trop pâle déclenche l'alerte de contraste ; le logo PNG se dépose, s'affiche, se retire", async ({ page }) => {
  test.skip(!companyId, "aucune société active");
  await login(page, E2E.papeterieEmail, E2E.password);
  await page.goto("/admin/marque");
  const carte = page.locator(`[data-testid="marque-carte"][data-societe="${companyId}"]`);
  await expect(carte).toBeVisible({ timeout: 20_000 });
  await carte.getByTestId("marque-accent").fill("#ffee88");
  await carte.getByRole("button", { name: /enregistrer la charte/i }).click();
  await expect(carte.getByTestId("marque-message")).toContainText(/Enregistré/, { timeout: 20_000 });
  await page.reload();
  const carte2 = page.locator(`[data-testid="marque-carte"][data-societe="${companyId}"]`);
  await expect(carte2.getByTestId("marque-alertes")).toContainText(/trop clair/, { timeout: 20_000 });

  // Le logo : un vrai PNG (un pixel), déposé par le formulaire.
  await carte2.getByTestId("logo-fichier").setInputFiles({ name: "logo-__e2e__marque.png", mimeType: "image/png", buffer: pngAleatoire() });
  await carte2.getByRole("button", { name: /déposer/i }).click();
  await expect(carte2.getByTestId("logo-message")).toContainText(/Logo déposé/, { timeout: 20_000 });
  await page.reload();
  const carte3 = page.locator(`[data-testid="marque-carte"][data-societe="${companyId}"]`);
  const apercu = carte3.getByTestId("logo-apercu");
  await expect(apercu).toBeVisible({ timeout: 20_000 });
  const src = await apercu.getAttribute("src");
  const reponse = await page.request.get(src!);
  expect(reponse.status(), `l'aperçu du logo est servi sous le droit de voir la société (src ${src}, corps ${(await reponse.text()).slice(0, 120)})`).toBe(200);
  expect(reponse.headers()["content-type"]).toBe("image/png");

  await carte3.getByTestId("logo-retirer").check();
  await carte3.getByRole("button", { name: /déposer/i }).click();
  await expect(carte3.getByTestId("logo-message")).toContainText(/Logo retiré/, { timeout: 20_000 });
});

test("téléphone 390 px : l'écran Marque ne déborde pas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, E2E.papeterieEmail, E2E.password);
  await page.goto("/admin/marque");
  await expect(page.getByTestId("marque-carte").first()).toBeVisible({ timeout: 20_000 });
  const debordement = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(debordement, "aucun défilement horizontal").toBeLessThanOrEqual(1);
});
