import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * TRANSFÉRER UN CONTRAT DE CONSULTING D'AD & PRO AUX RH — de bout en bout, dans le navigateur
 * (§118.150). Écrans réels, base réelle, zéro appel de modèle.
 *
 * ── CE QUE CETTE SPEC PROUVE, ET QU'AUCUN TEST UNITAIRE NE PEUT PROUVER ─────────────────
 *
 * Que le geste EXISTE pour une personne qui utilise l'ERP normalement (§118.50) : le bouton est
 * sur la fiche, la confirmation dit ce qui bouge, la fiche change de maison sous les yeux de
 * celui qui clique, le contrat QUITTE la liste d'Ad & Pro et REJOINT RH › Consultants — et le
 * geste inverse le ramène. Le banc de flux (`consulting-transfert-flow.test.ts`) prouve la règle
 * par les vrais points d'entrée ; celui-ci prouve que la règle a un ÉCRAN.
 *
 * Et la moitié qui protège, jouée avec un compte SANS vue globale (§118.104) : la Direction
 * Marketing (module Consulting, pas les RH) voit le contrat tant qu'il est à Ad & Pro, puis ne le
 * voit PLUS — ni dans sa liste, ni par l'adresse de la fiche, qui lui répond « introuvable ».
 * C'est exactement ce que la Direction a demandé : ceux qui suivent la promotion ne lisent pas la
 * rémunération d'un consultant de l'équipe.
 *
 * Le décor est propre à la spec et retiré à la fin ; le compte Direction Marketing porte le
 * préfixe du seed, que le démontage global retire aussi en cas d'interruption.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const REF = "__e2e__CONS-ATAKOR";
const TITRE = "__e2e__ Consultant médical";
const PARTIE = "__e2e__ Atakor Minds";
const DM_EMAIL = "__e2e__dm-consulting@test.dz";
let id = "";

async function login(page: Page, email: string = E2E.superAdminEmail) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(E2E.password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  // 60 s et non 20 : MESURÉ, la toute première connexion après un build propre a pris 22,5 s
  // (serveur froid, fichiers du build encore hors du cache disque), les suivantes 5 s. Ce
  // plafond répond à « est-il bloqué ? », jamais à « est-il lent ? » (§118.124b).
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
}

async function poleEnBase(): Promise<string | undefined> {
  return (await prisma.consultingContract.findUnique({ where: { id }, select: { pole: true } }))?.pole;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.consultingContract.deleteMany({ where: { reference: REF } });
  await prisma.user.deleteMany({ where: { email: DM_EMAIL } });
  // La DIRECTION MARKETING : le module Consulting en entier, AUCUN droit RH — le témoin de la
  // porte. Prémisse vérifiée plus bas par l'écran lui-même (elle voit le contrat à Ad & Pro).
  await prisma.user.create({
    data: {
      name: "__e2e__ Direction Marketing", email: DM_EMAIL,
      passwordHash: await bcrypt.hash(E2E.password, 10), role: "PRODUCT_MANAGER",
    },
  });
  const c = await prisma.consultingContract.create({
    data: {
      reference: REF, title: TITRE, counterparty: PARTIE, pole: "AD_PRO", status: "ACTIVE",
      amount: 200_000, billing: "MONTHLY", scope: "Accompagnement médical de l'équipe",
    },
    select: { id: true },
  });
  id = c.id;
});

test.afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityType: "CONSULTING_CONTRACT", entityId: id } }).catch(() => {});
  await prisma.consultingContract.deleteMany({ where: { reference: REF } });
  await prisma.notification.deleteMany({ where: { user: { email: DM_EMAIL } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: DM_EMAIL } }).catch(() => {});
  await prisma.$disconnect();
});

test("à Ad & Pro, la Direction Marketing voit le contrat — la prémisse du témoin", async ({ page }) => {
  await login(page, DM_EMAIL);
  await page.goto("/consulting");
  await expect(page.getByText(TITRE)).toBeVisible();
  await page.goto(`/consulting/${id}`);
  await expect(page.getByText("Suivi par Ad & Pro")).toBeVisible();
  // Elle n'a pas les RH : le transfert ne lui est pas offert (il faut MODIFIER les deux modules).
  await expect(page.getByRole("button", { name: /Transférer vers/ })).toHaveCount(0);
});

test("le Super Admin transfère depuis la fiche : la confirmation dit ce qui bouge, la fiche change de maison", async ({ page }) => {
  await login(page);
  await page.goto(`/consulting/${id}`);
  await expect(page.getByText("Suivi par Ad & Pro")).toBeVisible();

  let confirmation = "";
  page.once("dialog", (d) => { confirmation = d.message(); void d.accept(); });
  await page.getByRole("button", { name: /Transférer vers Ressources humaines/ }).click();
  await expect(page.getByText(/transféré vers Ressources humaines/)).toBeVisible();

  // La confirmation a dit ce qui BOUGE et ce qui NE bouge PAS, AVANT le clic (§118.53).
  expect(confirmation).toMatch(/ne le verront plus/);
  expect(confirmation).toMatch(/Rien n'est perdu/);
  // La base dit ce que l'écran dit.
  expect(await poleEnBase()).toBe("RH");
  await expect(page.getByText("Suivi par Ressources humaines")).toBeVisible();
});

test("le contrat a QUITTÉ Ad & Pro › Consulting et REJOINT RH › Consultants", async ({ page }) => {
  await login(page);
  await page.goto("/consulting");
  await expect(page.getByText(TITRE)).toHaveCount(0);
  await page.goto("/rh/consultants");
  await expect(page.getByText(TITRE)).toBeVisible();
  await expect(page.getByText(PARTIE)).toBeVisible();
});

test("la Direction Marketing ne le voit PLUS — ni dans sa liste, ni par l'adresse de la fiche", async ({ page }) => {
  await login(page, DM_EMAIL);
  await page.goto("/consulting");
  await expect(page.getByText(TITRE)).toHaveCount(0);
  // L'adresse exacte ne rend pas le contrat : la même page qu'un contrat inexistant.
  await page.goto(`/consulting/${id}`);
  await expect(page.getByText(TITRE)).toHaveCount(0);
  await expect(page.getByText(/introuvable|n'existe pas|404/i).first()).toBeVisible();
});

test("le geste inverse le ramène à Ad & Pro, sans rien avoir perdu", async ({ page }) => {
  await login(page);
  await page.goto(`/consulting/${id}`);
  page.once("dialog", (d) => { void d.accept(); });
  await page.getByRole("button", { name: /Transférer vers Ad & Pro/ }).click();
  await expect(page.getByText(/transféré vers Ad & Pro/)).toBeVisible();
  expect(await poleEnBase()).toBe("AD_PRO");
  const apres = await prisma.consultingContract.findUnique({
    where: { id }, select: { reference: true, amount: true, billing: true, scope: true, status: true },
  });
  expect(apres?.reference).toBe(REF);
  expect(Number(apres?.amount)).toBe(200_000);
  expect(apres?.billing).toBe("MONTHLY");
  expect(apres?.status).toBe("ACTIVE");
  expect(apres?.scope).toBe("Accompagnement médical de l'équipe");
});
