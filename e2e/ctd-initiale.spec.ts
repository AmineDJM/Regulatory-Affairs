import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import JSZip from "jszip";
import { E2E } from "./global-setup";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA CTD INITIALE D'UN DOSSIER REGULATORY — de bout en bout, dans le navigateur (§118.213).
 *
 * « Lors de la création d'un dossier, on doit pouvoir mettre un dossier ZIP complet (ou un dossier
 * entier) : il est mis dans la première étape du process, nommé « CTD initiale ». Elle pourra être
 * supprimée, remplacée, ou recevoir des fichiers dans un sous-dossier. »
 *
 * Le banc de flux (`ctd-initiale-flow.test.ts`) prouve les règles par les vraies routes et actions ; celui-ci
 * prouve qu'elles ont un ÉCRAN, joué comme le fait une personne — et sur la TÉLÉPHONE, où le bloc doit
 * rester lisible. Le dépôt est jugé EN BASE (ce que le navigateur a réellement fait envoyer), pas à ce que
 * l'écran annonce.
 *
 * Le décor est propre à la spec : le dossier créé par le formulaire, sa société, ses pièces et sa corbeille
 * sont retirés à la fin.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const DCI = `__E2E__CTDINIT${Date.now()}`;
const SOCIETE = "__e2e__ Société CTD";
let produit = "";
let societe = "";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(E2E.superAdminEmail);
  await page.getByLabel(/mot de passe/i).fill(E2E.password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  // 60 s et non 20 : la première connexion après un build propre est un démarrage à froid (§118.150).
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
}

/** Naviguer puis attendre le réseau au repos : un clic posé avant l'hydratation ne fait rien (§118.164). */
async function aller(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

const vivantes = () => prisma.document.findMany({ where: { entityId: produit, stepKey: "ctd", category: "CTD_FULL" }, orderBy: { name: "asc" } });

async function petitZip(): Promise<Buffer> {
  const z = new JSZip();
  z.file("0000/Module 1/lettre.txt", "bonjour ".repeat(100));
  z.file("0000/Module 3/qualite.txt", "qualité ".repeat(100));
  return z.generateAsync({ type: "nodebuffer" });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  societe = (await prisma.company.create({ data: { name: SOCIETE, shortName: "CTD", isActive: true } })).id;
});

test.afterAll(async () => {
  if (produit) {
    const docs = await prisma.document.findMany({ where: { entityId: produit }, select: { id: true, fileKey: true } });
    const recs = await prisma.deletedRecord.findMany({ where: { kind: "REGULATORY_CTD", sourceId: produit }, select: { documents: true } });
    const cles = [
      ...docs.map((d) => d.fileKey),
      ...recs.flatMap((r) => ((r.documents as { fileKey?: string | null }[] | null) ?? []).map((x) => x.fileKey)),
    ].filter((k): k is string => Boolean(k));
    const stored = await prisma.storedFile.findMany({ where: { key: { in: cles } }, select: { blobId: true } });
    await prisma.document.deleteMany({ where: { entityId: produit } });
    await prisma.deletedRecord.deleteMany({ where: { kind: "REGULATORY_CTD", sourceId: produit } });
    await prisma.storedFile.deleteMany({ where: { key: { in: cles } } });
    await prisma.fileBlob.deleteMany({ where: { id: { in: stored.map((s) => s.blobId) } } });
    await prisma.auditLog.deleteMany({ where: { entityType: "REGULATORY_PRODUCT", entityId: produit } }).catch(() => {});
    await prisma.regulatoryProduct.deleteMany({ where: { id: produit } }).catch(() => {});
  }
  await prisma.company.deleteMany({ where: { id: societe } }).catch(() => {});
  await prisma.$disconnect();
});

test("à la création, un .zip choisi dans le formulaire monte vers l'étape 1 et apparaît sous « CTD initiale »", async ({ page }) => {
  await login(page);
  await aller(page, "/regulatory");
  await page.getByRole("button", { name: /^Nouveau dossier$/ }).click();
  await page.getByLabel(/DCI \(molécule ou association\)/).fill(DCI);
  await page.getByLabel(/Entité/).selectOption({ label: "CTD" });

  // La CTD se choisit DANS le formulaire : un .zip. (Le champ n'a pas de nom : il ne part pas avec le formulaire.)
  await page.getByTestId("ctd-creation-fichiers").setInputFiles({ name: `${DCI}.zip`, mimeType: "application/zip", buffer: await petitZip() });
  await expect(page.getByText(/1 fichier\b/)).toBeVisible();

  await page.getByRole("button", { name: "Créer le dossier" }).click();
  await page.waitForURL(/\/regulatory\/[a-z0-9]+(\?ctd=envoi)?$/, { timeout: 60_000 });
  produit = new URL(page.url()).pathname.split("/").pop()!;

  // L'envoi continue en arrière-plan : c'est la BASE qui dit s'il a eu lieu, pas l'écran qui l'annonce.
  await expect.poll(async () => (await vivantes()).map((d) => d.name), { timeout: 30_000 }).toEqual([`${DCI}.zip`]);
  const [doc] = await vivantes();
  expect(doc).toMatchObject({ entityType: "REGULATORY_PRODUCT", entityId: produit, stepKey: "ctd", category: "CTD_FULL" });

  // Le bloc est visible sur la fiche, nommé comme demandé, avec son contenu.
  const bloc = page.getByTestId("ctd-initiale");
  await expect(bloc).toBeVisible();
  await expect(bloc.getByText("CTD initiale", { exact: true })).toBeVisible();
  await page.reload();
  await expect(bloc.getByText(`${DCI}.zip`)).toBeVisible();
});

test("AJOUTER des fichiers dans un nouveau sous-dossier de la CTD", async ({ page }) => {
  await login(page);
  await aller(page, `/regulatory/${produit}`);
  const bloc = page.getByTestId("ctd-initiale");
  await bloc.getByRole("button", { name: "Ajouter à la CTD" }).click();
  await bloc.getByLabel("Dossier de destination dans la CTD").selectOption({ label: "Nouveau sous-dossier…" });
  await bloc.getByLabel("Nom du nouveau sous-dossier").fill("Compléments/Module 3");
  // Le premier champ fichier du panneau est celui des fichiers ; le second, celui d'un dossier.
  await bloc.locator('input[type="file"]').first().setInputFiles({ name: "complement.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 complement") });
  await bloc.getByRole("button", { name: /Ajouter à la CTD \(1\)/ }).click();

  await expect.poll(async () => (await vivantes()).find((d) => d.name === "complement.pdf")?.folder, { timeout: 30_000 }).toBe("Compléments/Module 3");
  // Toujours UNE CTD : le zip d'origine et le complément vivent ensemble.
  expect((await vivantes()).map((d) => d.name).sort()).toEqual(["complement.pdf", `${DCI}.zip`].sort());
});

test("SUPPRIMER la CTD : l'aperçu dit ce qui part, la confirmation est double, la corbeille la garde", async ({ page }) => {
  await login(page);
  await aller(page, `/regulatory/${produit}`);
  const bloc = page.getByTestId("ctd-initiale");
  await bloc.getByRole("button", { name: "Supprimer la CTD" }).click();

  // L'APERÇU, avant tout geste : le compte, le .zip, et où ça va.
  await expect(bloc.getByText("Ce qui partira à la corbeille")).toBeVisible();
  await expect(bloc.getByText(/2 fichiers/).first()).toBeVisible();
  await expect(bloc.getByText(/Super Admin/).first()).toBeVisible();

  // Un seul clic n'efface rien ; le second confirme.
  const decisif = bloc.getByRole("button", { name: "Supprimer la CTD" }).last();
  const el = await decisif.elementHandle();
  await el!.click();
  await expect.poll(() => el!.getAttribute("data-decisif")).toBe("arme");
  expect(await vivantes()).toHaveLength(2);
  await el!.click();

  await expect.poll(async () => (await vivantes()).length, { timeout: 15_000 }).toBe(0);
  const rec = await prisma.deletedRecord.findMany({ where: { kind: "REGULATORY_CTD", sourceId: produit } });
  expect(rec).toHaveLength(1);
  expect((rec[0].documents as unknown[]).length).toBe(2);
  await expect(bloc.getByText(/aucune CTD déposée/)).toBeVisible();
  await expect(bloc.getByText(/corbeille/).first()).toBeVisible();
});

test("au téléphone (375 px), le bloc de la CTD reste lisible : rien ne déborde, le dépôt est atteignable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await login(page);
  await aller(page, `/regulatory/${produit}`);
  const bloc = page.getByTestId("ctd-initiale");
  await expect(bloc).toBeVisible();
  await expect(bloc.getByRole("button", { name: "Déposer la CTD" })).toBeVisible();
  // Aucun défilement horizontal de la page, et le bloc tient dans l'écran.
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(deborde).toBe(false);
  const boite = await bloc.boundingBox();
  expect(boite!.x + boite!.width).toBeLessThanOrEqual(376);
});

