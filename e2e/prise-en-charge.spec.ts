import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";

/**
 * PRISES EN CHARGE — DÉCISIONS DE LA DIRECTION DU 04/10 DANS LE NAVIGATEUR.
 *
 * Le formulaire ne demande plus « Pays » (national), ni délégués présents, spécialité, produits
 * promus ; il propose des PROFESSIONNELS (recherche + création de profil). La fiche montre
 * « Professionnels proposés pour la prise en charge » et plus « Personnes prises en charge » ;
 * « + Pièce jointe » vit dans la carte « Informations » ; la pièce attendue est le passeport
 * (national), passeport + visa + voyage (international). Décor propre (préfixe `__e2e__`), retiré à la fin.
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const P = "__e2e__pec";
const SA_EMAIL = `${P}-sa@test.dz`;
const NOM_NAT = `${P} Congres national`;
const NOM_INT = `${P} Congres international`;
const MED_NAT = `${P} Dr Benali`;
const MED_INT = `${P} Dr Haddad`;

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(E2E.password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  // 60 s : la toute première connexion après un build propre est lente.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
}

async function aller(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function sansDebordement(page: Page) {
  const { scroll, largeur } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, largeur: window.innerWidth }));
  expect(scroll, `la page déborde de ${scroll - largeur} px à ${largeur} px de large`).toBeLessThanOrEqual(largeur + 1);
}

async function nettoyer() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: P } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  // Les professionnels proposés partent avec leur demande (Cascade).
  await prisma.congressNational.deleteMany({ where: { name: { startsWith: P } } }).catch(() => {});
  await prisma.congressInternational.deleteMany({ where: { name: { startsWith: P } } }).catch(() => {});
  await prisma.medicalDoctor.deleteMany({ where: { name: { startsWith: P } } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
  await prisma.userAccess.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
}

test.describe.configure({ mode: "serial" });

let natId = "";
let intId = "";

test.beforeAll(async () => {
  await nettoyer();
  await prisma.user.create({
    data: { email: SA_EMAIL, name: `${P} Super Admin`, passwordHash: await bcrypt.hash(E2E.password, 10), role: "SUPER_ADMIN" },
  });
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

/** Ouvre « Nouvelle demande » et rend le formulaire du panneau. */
async function ouvrirFormulaire(page: Page, url: string, titrePanneau: string) {
  await aller(page, url);
  await page.getByRole("button", { name: "Nouvelle demande" }).click();
  await expect(page.getByText(titrePanneau)).toBeVisible();
  const form = page.locator("form", { has: page.getByText("Professionnels proposés pour la prise en charge") });
  await expect(form).toBeVisible();
  return form;
}

async function remplirEtEnvoyer(page: Page, form: ReturnType<Page["locator"]>, nom: string, medecin: string, debut: string, fin: string, national: boolean) {
  await form.getByPlaceholder("Ex. ECCMID 2026").fill(nom);
  await form.locator(national ? 'input[name="date"]' : 'input[name="startDate"]').fill(debut);
  await form.locator('input[name="endDate"]').fill(fin);
  // AUCUN FICHIER JOINT : le champ vide arrive au serveur nommé « undefined » (action serveur) — ce n'est pas une pièce,
  // et la demande doit partir (`estUnePiece`, src/lib/attach-files.ts).
  // Une gamme obligatoire (si la plateforme en porte) : on choisit la première.
  const obligatoires = form.locator("select[required]");
  for (let i = 0; i < (await obligatoires.count()); i++) {
    const s = obligatoires.nth(i);
    if (!(await s.inputValue())) await s.selectOption({ index: 1 });
  }
  // Profil créé depuis le formulaire, comme une personne.
  await form.getByRole("button", { name: "Créer un profil de médecin" }).click();
  await form.getByLabel("Nom du médecin").fill(medecin);
  await form.getByRole("button", { name: "Créer et proposer" }).click();
  await expect(form.getByText(medecin).first()).toBeVisible({ timeout: 20_000 });
  await form.getByRole("button", { name: "Envoyer la demande" }).click();
  // Un refus du serveur s'affiche dans le formulaire : on le lit au lieu d'attendre une redirection qui ne vient pas.
  const refus = form.locator("div.text-destructive");
  await Promise.race([
    page.waitForURL(/\/congress-(national|international)\/[a-z0-9]{20,}$/, { timeout: 30_000 }),
    refus.first().waitFor({ state: "visible", timeout: 30_000 }).then(async () => { throw new Error(`Refus affiché : ${await refus.first().innerText()}`); }),
  ]);
}

test("National : le formulaire n'a plus Pays, délégués, spécialité ni produits — il propose des professionnels, et la demande se crée", async ({ page }) => {
  await login(page, SA_EMAIL);
  const form = await ouvrirFormulaire(page, "/congress-national", "Nouvelle prise en charge — nationale");

  // Négatif : ce qui a été retiré (AVANT d'ouvrir « nouveau profil », qui porte son propre menu « Spécialité du médecin »).
  for (const retire of ["Pays", "Délégués présents", "Spécialité", "Produits promus"]) {
    await expect(form.getByText(retire, { exact: true }), `« ${retire} » ne doit plus figurer`).toHaveCount(0);
  }
  await expect(form.locator('[name="country"]')).toHaveCount(0);
  // Positif.
  await expect(form.getByText("Date de début", { exact: false }).first()).toBeVisible();
  await expect(form.getByText("Date de fin", { exact: false }).first()).toBeVisible();
  await expect(form.getByLabel("Rechercher un praticien")).toBeVisible();
  await expect(form.getByRole("button", { name: "Créer un profil de médecin" })).toBeVisible();

  await remplirEtEnvoyer(page, form, NOM_NAT, MED_NAT, "2026-11-10", "2026-11-12", true);
  await page.waitForURL(/\/congress-national\/[a-z0-9]{20,}$/, { timeout: 30_000 });
  natId = page.url().split("/").pop()!;
});

test("National : la fiche liste les professionnels proposés, pas « Personnes prises en charge » ; « Pièce jointe » est dans « Informations » ; la pièce attendue est le passeport", async ({ page }) => {
  expect(natId, "la demande nationale doit exister").not.toBe("");
  await login(page, SA_EMAIL);
  await aller(page, `/congress-national/${natId}`);

  await expect(page.getByText("Professionnels proposés pour la prise en charge").first()).toBeVisible();
  await expect(page.getByText("Personnes prises en charge")).toHaveCount(0);
  await expect(page.getByText(MED_NAT).first()).toBeVisible();

  // « + Pièce jointe » est DANS la carte « Informations » (même carte que son titre).
  const carteInfos = page.locator("div", { has: page.getByText("Informations", { exact: true }) })
    .filter({ has: page.getByRole("button", { name: "Pièce jointe" }) })
    .last();
  await expect(carteInfos.getByRole("button", { name: "Pièce jointe" })).toBeVisible();
  // …et un seul bouton « Pièce jointe » sur la page : plus de second emplacement.
  await expect(page.getByRole("button", { name: "Pièce jointe", exact: true })).toHaveCount(1);

  // Demande des pièces d'identité + pièces suivies : national = passeport seul.
  await expect(page.getByRole("button", { name: /Demander les pièces/ })).toBeVisible();
  const pieces = page.getByLabel("Pièces des professionnels");
  await expect(pieces.getByText("Passeport", { exact: true }).first()).toBeVisible();
  await expect(pieces.getByText("Visa", { exact: true })).toHaveCount(0);
  await expect(pieces.getByText("Informations de voyage")).toHaveCount(0);
});

test("International : « Pays » est présent, et le visa fait partie des pièces suivies", async ({ page }) => {
  await login(page, SA_EMAIL);
  const form = await ouvrirFormulaire(page, "/congress-international", "Nouvelle prise en charge — internationale");
  await expect(form.getByText("Pays", { exact: true })).toBeVisible();
  await expect(form.locator('[name="country"]')).toHaveCount(1);
  for (const retire of ["Délégués présents", "Spécialité", "Produits promus"]) {
    await expect(form.getByText(retire, { exact: true }), `« ${retire} » ne doit plus figurer`).toHaveCount(0);
  }
  await remplirEtEnvoyer(page, form, NOM_INT, MED_INT, "2026-12-01", "2026-12-04", false);
  await page.waitForURL(/\/congress-international\/[a-z0-9]{20,}$/, { timeout: 30_000 });
  intId = page.url().split("/").pop()!;

  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Professionnels proposés pour la prise en charge").first()).toBeVisible();
  await expect(page.getByText("Personnes prises en charge")).toHaveCount(0);
  await expect(page.getByText(MED_INT).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Pièce jointe", exact: true })).toHaveCount(1);
  const pieces = page.getByLabel("Pièces des professionnels");
  await expect(pieces.getByText("Passeport", { exact: true }).first()).toBeVisible();
  await expect(pieces.getByText("Visa", { exact: true }).first()).toBeVisible();
  await expect(pieces.getByText("Informations de voyage").first()).toBeVisible();
});

test("375 px : le formulaire de prise en charge ne déborde pas, ni nationale ni internationale", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await login(page, SA_EMAIL);
  for (const [url, titre] of [
    ["/congress-national", "Nouvelle prise en charge — nationale"],
    ["/congress-international", "Nouvelle prise en charge — internationale"],
  ] as const) {
    const form = await ouvrirFormulaire(page, url, titre);
    await form.getByRole("button", { name: "Créer un profil de médecin" }).click();
    await expect(form.getByLabel("Nom du médecin")).toBeVisible();
    await sansDebordement(page);
    // Le formulaire lui-même tient dans la largeur de l'écran.
    const boite = await form.boundingBox();
    expect(boite && boite.x >= -1 && boite.x + boite.width <= 376, `le formulaire sort de l'écran : ${JSON.stringify(boite)}`).toBeTruthy();
  }
});
