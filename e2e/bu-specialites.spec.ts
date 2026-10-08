import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES SPÉCIALITÉS D'UNE BUSINESS UNIT DANS LE NAVIGATEUR (§118.183) — écrans réels, base réelle.
 *
 * « BU ≠ spécialité » : une BU vise plusieurs spécialités, dont une principale facultative. Le banc
 * de flux prouve la RÈGLE par les vraies actions ; celui-ci prouve que chaque geste a un ÉCRAN qui le
 * déclenche (§118.50) et chaque assertion relit la BASE. L'acteur est le Manager Promotion médicale :
 * il monte les BU, et il n'a pas la vue globale (§118.104).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const P = "__e2e__buspe";
const EMAIL = `${P}-mpm@test.dz`;
const NEURO = `${P} Neurologie`;
const DERMATO = `${P} Dermatologie`;
const URO = `${P} Urologie`;
const BU_EXISTANTE = `${P} BU Existante`;
const BU_NEUVE = `${P} BU Neuve`;

let ids: Record<string, string> = {};

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(E2E.password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  // 60 s : la toute première connexion après un build propre est lente (§118.124b).
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
}

/** Naviguer PUIS attendre l'hydratation : un clic posé avant ne fait rien (§118.168). */
async function aller(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function sansDebordement(page: Page) {
  const { scroll, largeur } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, largeur: window.innerWidth }));
  expect(scroll, `la page déborde de ${scroll - largeur} px à ${largeur} px de large`).toBeLessThanOrEqual(largeur + 1);
}

/** Attendre qu'un fait soit VRAI EN BASE — l'écran peut afficher avant que l'écriture soit faite. */
async function enBase<T>(lire: () => Promise<T>, attendu: T, message: string) {
  await expect.poll(lire, { message, timeout: 15_000 }).toEqual(attendu);
}

/** Les spécialités qu'une BU vise, en base : les noms, triés, et la principale. */
async function visees(nomBu: string): Promise<{ noms: string[]; principale: string | null }> {
  const liens = await prisma.businessUnitSpecialty.findMany({
    where: { businessUnit: { name: nomBu } }, select: { principale: true, specialty: { select: { name: true } } },
  });
  return {
    noms: liens.map((l) => l.specialty.name).sort(),
    principale: liens.find((l) => l.principale)?.specialty.name ?? null,
  };
}

/** LE RAFRAÎCHISSEMENT RETENU (§118.172) — la course que le téléphone fabrique, jouée au lieu d'espérée. */
async function ralentirRafraichissements(page: Page, ms = 2_000) {
  await page.route("**/*", async (route) => {
    const req = route.request();
    const h = req.headers();
    if (req.method() === "GET" && h["rsc"] === "1" && !h["next-router-prefetch"]) {
      const reponse = await route.fetch();
      await new Promise((r) => setTimeout(r, ms));
      await route.fulfill({ response: reponse });
      return;
    }
    await route.continue();
  });
}

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

async function nettoyer() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: P } }, select: { id: true } });
  const uids = users.map((u) => u.id);
  await prisma.businessUnitSpecialty.deleteMany({ where: { businessUnit: { name: { startsWith: P } } } });
  await prisma.businessUnit.deleteMany({ where: { name: { startsWith: P } } });
  await prisma.medicalSpecialty.deleteMany({ where: { name: { startsWith: P } } });
  await prisma.notification.deleteMany({ where: { userId: { in: uids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: uids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: uids } } });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await nettoyer();
  const hash = await bcrypt.hash(E2E.password, 10);
  ids.mpm = (await prisma.user.create({ data: { email: EMAIL, name: `${P} Manager promo`, passwordHash: hash, role: "MEDICAL_PROMOTION_MANAGER" } })).id;
  for (const [cle, nom] of [["neuro", NEURO], ["dermato", DERMATO], ["uro", URO]] as const) {
    ids[cle] = (await prisma.medicalSpecialty.create({ data: { name: nom } })).id;
  }
  ids.bu = (await prisma.businessUnit.create({ data: { name: BU_EXISTANTE } })).id;
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

test("créer une BU AVEC ses spécialités et sa principale — la carte fermée les nomme", async ({ page }) => {
  await login(page, EMAIL);
  await aller(page, "/business-units");
  await page.getByRole("button", { name: "Créer une BU" }).click();
  await page.getByPlaceholder(/Nom de la BU/).fill(BU_NEUVE);
  const choix = page.getByRole("list", { name: "Spécialités du référentiel" });
  await choix.getByRole("checkbox", { name: NEURO }).check();
  await choix.getByRole("checkbox", { name: DERMATO }).check();
  await choix.getByRole("listitem").filter({ hasText: DERMATO }).getByRole("button", { name: /Principale/ }).click();
  await expect(page.getByText(/2 spécialité\(s\) cochée\(s\)/)).toBeVisible();
  await page.getByRole("button", { name: "Créer la BU" }).click();
  await enBase(() => visees(BU_NEUVE), { noms: [DERMATO, NEURO].sort(), principale: DERMATO }, "la BU créée vise ses deux spécialités, dermato en principale");
  // La carte FERMÉE dit ce que la BU vise, la principale d'abord et marquée.
  await expect(page.getByText(`${DERMATO} ★ · ${NEURO}`)).toBeVisible();
});

test("choisir, changer la principale, décocher — chaque geste en base, et l'éditeur fermé pendant le rafraîchissement", async ({ page }) => {
  await login(page, EMAIL);
  await aller(page, "/business-units");
  await page.getByRole("button", { name: new RegExp(BU_EXISTANTE) }).click();
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: /Spécialités visées/ }) });
  // Sans spécialité, la section dit ce qu'on perd — la raison de l'étape, pas « obligatoire ».
  await expect(section.getByText(/rien ne dit à quels médecins/)).toBeVisible();
  await section.getByRole("button", { name: "Choisir les spécialités" }).click();
  await section.getByRole("checkbox", { name: URO }).check();
  await section.getByRole("checkbox", { name: NEURO }).check();
  await section.getByRole("listitem").filter({ hasText: URO }).getByRole("button", { name: /Principale/ }).click();
  await ralentirRafraichissements(page);
  await section.getByRole("button", { name: "Enregistrer les spécialités" }).click();
  await enBase(() => visees(BU_EXISTANTE), { noms: [NEURO, URO].sort(), principale: URO }, "uro principale, neuro associée");
  // PENDANT le rafraîchissement retenu, le geste suivant attend : rouvert sur l'état d'avant, il le réécrirait.
  await expect(section.getByRole("button", { name: /spécialités/ }).first()).toBeDisabled();
  await expect(section.getByRole("button", { name: "Modifier les spécialités" })).toBeEnabled({ timeout: 15_000 });
  await page.unrouteAll({ behavior: "ignoreErrors" });
  // Décocher RETIRE : l'ensemble envoyé est complet.
  await section.getByRole("button", { name: "Modifier les spécialités" }).click();
  await section.getByRole("checkbox", { name: NEURO }).uncheck();
  await section.getByRole("button", { name: "Enregistrer les spécialités" }).click();
  await enBase(() => visees(BU_EXISTANTE), { noms: [URO], principale: URO }, "neuro décochée : retirée");
  // Décocher la PRINCIPALE la retire comme principale — jamais une principale qui n'est plus cochée.
  await section.getByRole("button", { name: "Modifier les spécialités" }).click();
  await section.getByRole("checkbox", { name: DERMATO }).check();
  await section.getByRole("checkbox", { name: URO }).uncheck();
  await section.getByRole("button", { name: "Enregistrer les spécialités" }).click();
  await enBase(() => visees(BU_EXISTANTE), { noms: [DERMATO], principale: null }, "uro décochée : plus de principale, dermato seule");
});

test("le référentiel dit quelles BU visent une spécialité — et son retrait est refusé en les nommant", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await login(page, EMAIL);
  await aller(page, "/annuaires/specialites");
  const ligne = page.getByRole("listitem").filter({ hasText: DERMATO }).first();
  await expect(ligne.getByText(new RegExp(`BU : .*${BU_NEUVE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ★`))).toBeVisible();
  await ligne.getByRole("button", { name: `Retirer ${DERMATO} du référentiel` }).click();
  await expect(page.getByText(new RegExp(`visée par 2 Business Unit`))).toBeVisible();
  expect(await prisma.medicalSpecialty.count({ where: { name: DERMATO } }), "refusé : la spécialité reste").toBe(1);
});

test.describe("au téléphone (375 px)", () => {
  test.use({ viewport: { width: 375, height: 760 } });
  test("la carte et son éditeur tiennent sans déborder", async ({ page }) => {
    await login(page, EMAIL);
    await aller(page, "/business-units");
    await page.getByRole("button", { name: new RegExp(BU_EXISTANTE) }).click();
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: /Spécialités visées/ }) });
    await section.getByRole("button", { name: "Modifier les spécialités" }).click();
    await expect(section.getByRole("checkbox", { name: NEURO })).toBeVisible();
    await sansDebordement(page);
  });
});
