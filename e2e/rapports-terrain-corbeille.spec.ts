import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";
import { cliquerDecisif } from "./decisif";

/**
 * ═════════════════════════════════════════════════════════════════
 * SUPPRIMER UN RAPPORT TERRAIN — la double confirmation et la corbeille, dans le navigateur (§118.212).
 *
 * Le banc de flux (`rapport-terrain-suppression-flow.test.ts`) prouve les RÈGLES par les vraies actions ; celui-ci
 * prouve qu'elles ont un ÉCRAN qui les déclenche (§118.50) — et que la double confirmation tient :
 *   - l'icône de la ligne ouvre la fenêtre, qui dit ce qui part avec le rapport (sa pièce jointe) ;
 *   - « Oui, supprimer » ARME le bouton au premier clic : RIEN n'est supprimé ; Échap le désarme ; seul le
 *     second clic supprime — et le rapport part à la corbeille, pas à l'oubli ;
 *   - le seul rapport d'une visite planifiée ne se supprime pas : le refus s'affiche AVANT le clic et le
 *     bouton ne s'arme pas ;
 *   - le Super Admin restaure depuis Administration › Corbeille : le rapport revient avec sa pièce jointe, puis
 *     le supprime lui-même depuis la fiche (le bouton n'est plus réservé au Super Admin, mais lui l'a aussi).
 *
 * Décor propre à la spec (préfixe `__e2e18__`), posé en base et retiré au début et à la fin.
 * ═════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const P = "__e2e18__";
const EMAIL = { kam: `${P}kam@test.dz` };
const NOM_BROUILLON = `${P} Dr Brouillon`;
const NOM_VISITE = `${P} Dr Visite`;

const u: Record<string, string> = {};
let brouillonId = "";
let visiteReportId = "";

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

async function nettoyer() {
  const ids = (await prisma.user.findMany({ where: { email: { startsWith: P } }, select: { id: true } })).map((x) => x.id);
  await prisma.deletedRecord.deleteMany({ where: { kind: "FIELD_REPORT", name: { contains: P } } });
  await prisma.fieldReport.deleteMany({ where: { doctorName: { startsWith: P } } });
  await prisma.medicalVisit.deleteMany({ where: { delegateId: { in: ids } } });
  await prisma.fileBlob.deleteMany({ where: { sha256: { startsWith: P } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await nettoyer();
  const hash = await bcrypt.hash(E2E.password, 10);
  u.kam = (await prisma.user.create({ data: { email: EMAIL.kam, name: `${P} KAM`, passwordHash: hash, role: "MEDICAL_DELEGATE" }, select: { id: true } })).id;
  // Un brouillon avec UNE pièce jointe — ce que la fenêtre doit annoncer.
  const blob = await prisma.fileBlob.create({ data: { sha256: `${P}b1`, size: 3, iv: Buffer.from("iv"), data: Buffer.from("abc"), refCount: 1 } });
  const r = await prisma.fieldReport.create({ data: { delegateId: u.kam, doctorName: NOM_BROUILLON, summary: "Visite chez le Dr Brouillon.", status: "DRAFT" }, select: { id: true } });
  brouillonId = r.id;
  await prisma.fieldReportAttachment.create({ data: { reportId: r.id, blobId: blob.id, name: `${P}ordonnance.pdf`, mime: "application/pdf", size: 3 } });
  // Le SEUL rapport d'une visite planifiée : le supprimer changerait l'état de la visite.
  const visite = await prisma.medicalVisit.create({ data: { delegateId: u.kam, date: new Date(), status: "PLANNED" }, select: { id: true } });
  visiteReportId = (await prisma.fieldReport.create({ data: { delegateId: u.kam, doctorName: NOM_VISITE, status: "DRAFT", visitId: visite.id }, select: { id: true } })).id;
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

// LA LISTE est l'onglet « Rapports » de la Promotion médicale (Direction, 07/10) : une ligne du tableau ouvre la FEUILLE du
// rapport, et c'est la feuille qui porte l'icône de suppression.
const LISTE = "/medical/rapports";
async function ouvrirLigne(page: Page, nom: string) {
  await page.getByRole("button", { name: new RegExp(`Ouvrir le rapport — ${nom}`) }).click();
  return page.getByRole("dialog");
}
const ligne = (page: Page, nom: string) => page.getByRole("button", { name: new RegExp(`Ouvrir le rapport — ${nom}`) });

test("DOUBLE CONFIRMATION — un seul clic ne supprime rien ; Échap désarme ; le second clic supprime, vers la corbeille", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, EMAIL.kam);
  await aller(page, LISTE);
  await (await ouvrirLigne(page, NOM_BROUILLON)).getByTestId("supprimer-rapport").click();
  // Étape 1 : la fenêtre dit ce qui part — la pièce jointe — et que c'est réversible.
  await expect(page.getByText("Part aussi avec lui")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("1 pièce jointe")).toBeVisible();
  await expect(page.getByText(/le Super Admin peut restaurer depuis la corbeille/i).first()).toBeVisible();
  const confirmer = page.getByRole("button", { name: "Oui, supprimer définitivement" });
  await expect(confirmer).toBeEnabled();
  // Étape 2 : le premier clic ARME le bouton — il ne supprime rien.
  const el = await confirmer.elementHandle();
  if (!el) throw new Error("bouton introuvable");
  await el.click();
  await expect.poll(() => el.getAttribute("data-decisif")).toBe("arme");
  expect(await prisma.fieldReport.count({ where: { id: brouillonId } }), "un premier clic ne supprime rien").toBe(1);
  // Échap désarme (et ne ferme pas la fenêtre) : toujours rien de supprimé.
  await el.press("Escape");
  await expect.poll(() => el.getAttribute("data-decisif")).toBe("repos");
  expect(await prisma.fieldReport.count({ where: { id: brouillonId } })).toBe(1);
  // Le second clic, dans les 5 s, supprime.
  await cliquerDecisif(page.getByRole("button", { name: "Oui, supprimer définitivement" }));
  await expect(ligne(page, NOM_BROUILLON)).toHaveCount(0, { timeout: 20_000 });
  expect(await prisma.fieldReport.count({ where: { id: brouillonId } })).toBe(0);
  // Pas à l'oubli : l'entrée de corbeille existe, lot compris, et la pièce jointe y voyage.
  const rec = await prisma.deletedRecord.findFirstOrThrow({ where: { kind: "FIELD_REPORT", sourceId: brouillonId } });
  expect(rec.restoredAt).toBeNull();
  expect(rec.lot).not.toBeNull();
  expect(await prisma.fieldReportAttachment.count({ where: { reportId: brouillonId } })).toBe(0);
});

test("REFUS AVANT LE CLIC — le seul rapport d'une visite planifiée : la fenêtre le dit, le bouton ne s'arme pas", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, EMAIL.kam);
  // Le compte rendu d'une visite n'est pas une ligne à part de la liste (il est rattaché à sa visite) : sa FICHE porte l'icône.
  await aller(page, `${LISTE}/${visiteReportId}`);
  await page.getByTestId("supprimer-rapport").click();
  await expect(page.getByRole("alert").filter({ hasText: /seul rapport de la visite/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Oui, supprimer définitivement" })).toBeDisabled();
  expect(await prisma.fieldReport.count({ where: { id: visiteReportId } })).toBe(1);
});

test("RESTAURATION — le Super Admin rend le rapport avec sa pièce jointe, puis le supprime lui-même depuis sa fiche", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, E2E.superAdminEmail);
  await aller(page, "/admin/corbeille");
  const rangee = page.locator("div.flex.flex-wrap.items-center.gap-3").filter({ hasText: NOM_BROUILLON });
  await expect(rangee).toHaveCount(1, { timeout: 15_000 });
  await expect(rangee.getByText(/1 pièce jointe/)).toBeVisible();
  await cliquerDecisif(rangee.getByRole("button", { name: "Restaurer" }));
  await expect.poll(() => prisma.fieldReport.count({ where: { id: brouillonId } }), { timeout: 20_000 }).toBe(1);
  expect(await prisma.fieldReportAttachment.count({ where: { reportId: brouillonId } }), "la pièce jointe revient avec le rapport").toBe(1);
  expect((await prisma.deletedRecord.findFirstOrThrow({ where: { kind: "FIELD_REPORT", sourceId: brouillonId } })).restoredAt).not.toBeNull();

  // La fiche : le bouton de l'en-tête, même fenêtre, même double confirmation, retour à la liste.
  await aller(page, `${LISTE}/${brouillonId}`);
  await page.getByTestId("supprimer-rapport").click();
  await expect(page.getByText("1 pièce jointe")).toBeVisible({ timeout: 15_000 });
  await cliquerDecisif(page.getByRole("button", { name: "Oui, supprimer définitivement" }));
  await page.waitForURL(/\/medical\/rapports$/, { timeout: 20_000 });
  expect(await prisma.fieldReport.count({ where: { id: brouillonId } })).toBe(0);
});

test("TÉLÉPHONE — l'icône de la corbeille tient dans l'écran à 375 px, sans défilement horizontal", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 375, height: 800 });
  await login(page, EMAIL.kam);
  // Le TABLEAU reste un tableau au téléphone : il défile dans son cadre, la page, elle, ne défile pas.
  await aller(page, LISTE);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "la liste ne fait pas défiler la page").toBe(true);
  // (Le brouillon est parti aux étapes précédentes : la fiche du compte rendu de visite porte l'icône.)
  await aller(page, `${LISTE}/${visiteReportId}`);
  const icone = page.getByTestId("supprimer-rapport");
  await expect(icone).toBeVisible({ timeout: 15_000 });
  const box = await icone.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 375, "l'icône est dans l'écran").toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "pas de défilement horizontal").toBe(true);
});
