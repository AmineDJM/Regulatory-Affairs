import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";
import { cliquerDecisif } from "./decisif";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CORRIGER PLUTÔT QUE TOUT REFAIRE — dans le navigateur (audit 360°, lot C4a, §118.189).
 *
 * Les bancs de flux prouvent les RÈGLES par les vraies actions ; celui-ci prouve qu'elles ont un
 * ÉCRAN qui les déclenche (§118.50), dans la peau de trois personnes :
 *   - CONSULTING : le Directeur Général RENVOIE un contrat pour correction (le motif est exigé AVANT
 *     le clic) ; la directrice marketing lit le renvoi sur la fiche, corrige le montant et le RENVOIE
 *     — à la même personne, présélectionnée, parce qu'une correction revient à qui l'a demandée ;
 *   - « AUTRE DEMANDE » : refusée avec son motif, son demandeur la RESOUMET en disant ce qui a changé,
 *     et l'écran DIT ce que la resoumission a fait ;
 *   - LEGAL : les Finances annulent une facture depuis la liste — le bouton offert est un geste que
 *     l'action accepte, et le motif est demandé.
 *
 * Décor propre à la spec (préfixe `__e2e12__`), retiré au début et à la fin ; les notifications
 * envoyées À D'AUTRES se retirent par leur lien, bornées à la fenêtre du run (§118.175).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const P = "__e2e12__";
const EMAIL = { porteur: `${P}porteur@test.dz`, dg: `${P}dg@test.dz`, fin: `${P}fin@test.dz` };
const CON_TITRE = `${P} Mission d'audit de pharmacovigilance`;
const MOTIF_CON = "Le forfait couvre cinq jours, le cahier des charges en prévoit trois.";
const AUT_TITRE = `${P} Traduction des notices`;
const MOTIF_AUT = "Il manque le devis du traducteur.";
const FAC_TITRE = `${P} Facture Imprimerie Atlas 0412`;

let conId = "";
let autId = "";
let facId = "";
let dgId = "";
let petit = 50_000;
const debut = new Date();

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
  const ids = (await prisma.user.findMany({ where: { email: { startsWith: P } }, select: { id: true } })).map((u) => u.id);
  const contrats = (await prisma.consultingContract.findMany({ where: { reference: { startsWith: P } }, select: { id: true } })).map((c) => c.id);
  const autres = (await prisma.adProOtherRequest.findMany({ where: { title: { startsWith: P } }, select: { id: true } })).map((a) => a.id);
  const pieces = (await prisma.legalDocument.findMany({ where: { title: { startsWith: P } }, select: { id: true } })).map((d) => d.id);
  const lies = [...contrats, ...autres, ...pieces];
  await prisma.comment.deleteMany({ where: { entityId: { in: lies } } });
  await prisma.adProGateVisa.deleteMany({ where: { entityId: { in: lies } } });
  await prisma.consultingTask.deleteMany({ where: { contractId: { in: contrats } } });
  await prisma.consultingContract.deleteMany({ where: { id: { in: contrats } } });
  await prisma.adProOtherRequest.deleteMany({ where: { id: { in: autres } } });
  await prisma.legalDocument.deleteMany({ where: { id: { in: pieces } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  if (lies.length > 0) {
    await prisma.notification.deleteMany({
      where: { createdAt: { gte: new Date(debut.getTime() - 60 * 60 * 1000) }, OR: lies.map((id) => ({ link: { contains: id } })) },
    });
  }
  await prisma.notification.deleteMany({ where: { createdAt: { gte: new Date(debut.getTime() - 60 * 60 * 1000) }, body: { contains: P } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: lies } }] } }).catch(() => {});
  await prisma.userAccess.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await nettoyer();
  const hash = await bcrypt.hash(E2E.password, 10);
  const mk = (email: string, nom: string, role: "PRODUCT_MANAGER" | "GENERAL_MANAGER" | "FINANCE_BUDGET_MANAGER") =>
    prisma.user.create({ data: { email, name: `${P} ${nom}`, passwordHash: hash, role }, select: { id: true } });
  const [porteur, dg] = await Promise.all([
    mk(EMAIL.porteur, "Directrice marketing", "PRODUCT_MANAGER"),
    mk(EMAIL.dg, "Directeur général", "GENERAL_MANAGER"),
    mk(EMAIL.fin, "Gestionnaire budgétaire", "FINANCE_BUDGET_MANAGER"),
  ]);
  dgId = dg.id;
  // SOUS le seuil Ad & Pro EN VIGUEUR : ces parcours ne mesurent pas le centre. Le seuil est un
  // réglage global : on le LIT, sans jamais l'écrire (§118.115).
  const reglage = await prisma.appSetting.findUnique({ where: { id: "global" }, select: { adProDgThreshold: true } });
  if (reglage && Number(reglage.adProDgThreshold) > 0) petit = Math.max(2, Math.floor(Number(reglage.adProDgThreshold) / 10));

  conId = (await prisma.consultingContract.create({
    data: {
      reference: `${P}CON-1`, title: CON_TITRE, counterparty: `${P} Cabinet Atakor`, amount: petit,
      status: "AWAITING_VALIDATION", requesterId: porteur.id, createdById: porteur.id, validatorId: dg.id,
    },
    select: { id: true },
  })).id;
  autId = (await prisma.adProOtherRequest.create({
    data: {
      reference: `${P}AUT-1`, title: AUT_TITRE, description: "Traduire les notices en arabe.", amount: petit,
      status: "AWAITING_DECISION", requesterId: porteur.id, createdById: porteur.id,
    },
    select: { id: true },
  })).id;
  facId = (await prisma.legalDocument.create({
    data: { title: FAC_TITRE, reference: `${P}FAC-1`, kind: "INVOICE", status: "ACTIVE", counterparty: "Imprimerie Atlas", amount: 12_000 },
    select: { id: true },
  })).id;
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

test("CONSULTING — le Directeur Général RENVOIE le contrat pour correction : sans motif, le bouton ne part pas", async ({ page }) => {
  // Le premier parcours après un build propre paie le démarrage à froid du serveur (§118.124b).
  test.setTimeout(120_000);
  await login(page, EMAIL.dg);
  await aller(page, `/consulting/${conId}`);
  const renvoyer = page.getByRole("button", { name: "Renvoyer pour correction" });
  await expect(renvoyer, "pas de renvoi sans motif : le porteur ne saurait pas quoi corriger").toBeDisabled();
  await page.getByLabel("Motif de la décision").fill(MOTIF_CON);
  await expect(renvoyer).toBeEnabled();
  await cliquerDecisif(renvoyer);
  await expect.poll(async () => (await prisma.consultingContract.findUniqueOrThrow({ where: { id: conId } })).status, { timeout: 15_000 })
    .toBe("DRAFT");
  const c = await prisma.consultingContract.findUniqueOrThrow({ where: { id: conId } });
  expect([c.returnNote, c.returnedById]).toEqual([MOTIF_CON, dgId]);
});

test("CONSULTING — la porteuse lit le renvoi, corrige le montant et le RENVOIE pour validation, à la même personne", async ({ page }) => {
  await login(page, EMAIL.porteur);
  await aller(page, `/consulting/${conId}`);
  await expect(page.getByText(`À corriger : « ${MOTIF_CON} ».`), "le renvoi se lit sur la fiche").toBeVisible();
  await page.getByRole("button", { name: "Modifier" }).click();
  const corrige = Math.max(1, Math.floor(petit / 2));
  await page.locator("#edit-amount").fill(String(corrige));
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect.poll(async () => Number((await prisma.consultingContract.findUniqueOrThrow({ where: { id: conId } })).amount), { timeout: 15_000 })
    .toBe(corrige);

  await aller(page, `/consulting/${conId}`);
  const section = page.locator("div.surface", { has: page.getByRole("heading", { name: "Renvoyer pour validation" }) });
  await expect(section.locator("select"), "la correction revient à qui l'a demandée — présélectionné").toHaveValue(dgId);
  await section.getByRole("button", { name: "Envoyer pour validation" }).click();
  await expect.poll(async () => (await prisma.consultingContract.findUniqueOrThrow({ where: { id: conId } })).status, { timeout: 15_000 })
    .toBe("AWAITING_VALIDATION");
  const c = await prisma.consultingContract.findUniqueOrThrow({ where: { id: conId } });
  expect([c.validatorId, c.returnedAt, c.returnNote]).toEqual([dgId, null, null]);
  const fil = await prisma.comment.findMany({ where: { entityType: "CONSULTING_CONTRACT", entityId: conId }, select: { body: true } });
  expect(fil.some((l) => l.body.startsWith("Resoumis après correction") && l.body.includes(MOTIF_CON))).toBe(true);
});

test("« AUTRE DEMANDE » — le Directeur Général la REFUSE : sans motif, le bouton ne part pas", async ({ page }) => {
  await login(page, EMAIL.dg);
  await aller(page, `/ad-pro/autres/${autId}`);
  const refuser = page.getByRole("button", { name: "Refuser" });
  await expect(refuser, "un refus sans motif ne laisse au demandeur rien sur quoi corriger").toBeDisabled();
  await page.getByLabel("Motif de la décision").fill(MOTIF_AUT);
  await cliquerDecisif(refuser);
  await expect.poll(async () => (await prisma.adProOtherRequest.findUniqueOrThrow({ where: { id: autId } })).status, { timeout: 15_000 })
    .toBe("REFUSED");
});

test("« AUTRE DEMANDE » — son demandeur la RESOUMET en disant ce qui a changé, et l'écran dit ce que la resoumission a fait", async ({ page }) => {
  await login(page, EMAIL.porteur);
  await aller(page, `/ad-pro/autres/${autId}`);
  const resoumettre = page.getByRole("button", { name: "Resoumettre la demande" });
  await expect(resoumettre, "ce qui a changé est exigé").toBeDisabled();
  await page.getByLabel("Ce qui a changé").fill("Devis du traducteur joint.");
  await resoumettre.click();
  await expect(page.getByText("Demande resoumise : elle revient à la décision de la Direction.")).toBeVisible({ timeout: 15_000 });
  const d = await prisma.adProOtherRequest.findUniqueOrThrow({ where: { id: autId } });
  expect([d.status, d.decisionNote]).toEqual(["AWAITING_DECISION", null]);
  const fil = await prisma.comment.findMany({ where: { entityType: "AD_PRO_OTHER", entityId: autId }, select: { body: true } });
  expect(fil.some((l) => l.body.includes(`« ${MOTIF_AUT} »`) && l.body.endsWith("Ce qui a changé : Devis du traducteur joint."))).toBe(true);
});

test("LEGAL — les Finances annulent une facture depuis la liste : le bouton offert est accepté, et le motif demandé", async ({ page }) => {
  await login(page, EMAIL.fin);
  await aller(page, "/legal");
  const ligne = page.locator("tr").filter({ hasText: FAC_TITRE });
  await expect(ligne.getByRole("button", { name: "Renouveler" }), "une facture ne se renouvelle pas").toHaveCount(0);
  page.once("dialog", (d) => void d.accept("Doublon de la facture 0411."));
  await ligne.getByRole("button", { name: "Annuler" }).click();
  await expect.poll(async () => (await prisma.legalDocument.findUniqueOrThrow({ where: { id: facId } })).status, { timeout: 15_000 })
    .toBe("CANCELLED");
  expect((await prisma.legalDocument.findUniqueOrThrow({ where: { id: facId } })).cancelReason).toBe("Doublon de la facture 0411.");
});
