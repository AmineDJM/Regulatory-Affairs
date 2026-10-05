import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";
import { cliquerDecisif } from "./decisif";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE MATÉRIEL PROMOTIONNEL SE CORRIGE — dans le navigateur (audit 360°, lot C4b, §118.190).
 *
 * Le banc de flux (`promo-renvoi-flow.test.ts`) prouve les RÈGLES par les vraies actions ; celui-ci
 * prouve qu'elles ont un ÉCRAN qui les déclenche (§118.50), dans la peau de deux personnes :
 *   - la DIRECTRICE MARKETING renvoie une demande pour correction — le motif est exigé AVANT le clic,
 *     et le formulaire se referme une fois le renvoi parti (un formulaire resté ouvert offrirait un
 *     second renvoi que l'action refuse) ;
 *   - le CHEF DE PRODUIT lit le renvoi sur la fiche, resoumet en disant ce qui a changé ; puis, au
 *     choix des lignes d'un autre dossier, REDEMANDE des devis au lieu de tuer sa propre demande —
 *     l'écran ne lui offre pas de « Refuser » que l'action lui refuserait.
 *
 * Décor propre à la spec (préfixe `__e2e13__`), posé en base et retiré au début et à la fin ; les
 * notifications envoyées À D'AUTRES (tout le secrétariat) se retirent par leur lien, bornées à la
 * fenêtre du run (§118.175).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const P = "__e2e13__";
const EMAIL = { dir: `${P}dir@test.dz`, cp: `${P}cp@test.dz` };
const MOTIF = "Précisez le format et le grammage des carnets.";
const CORRECTION = "Format A5, papier 90 g, reliure spirale.";
const CHERCHE = "Un second imprimeur, livraison sous dix jours.";

let dirId = "";
let cpId = "";
let renvoiId = "";
let choixId = "";
let demandeInitiale = "";
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
  const pms = (await prisma.promoMaterial.findMany({ where: { reference: { startsWith: P } }, select: { id: true } })).map((p) => p.id);
  const demandes = (await prisma.administrativeRequest.findMany({ where: { linkedEntityType: "PROMO_MATERIAL", linkedEntityId: { in: pms } }, select: { id: true } })).map((d) => d.id);
  await prisma.comment.deleteMany({ where: { entityId: { in: [...pms, ...demandes] } } });
  await prisma.promoMaterial.updateMany({ where: { id: { in: pms } }, data: { adminRequestId: null } });
  await prisma.administrativeRequest.deleteMany({ where: { id: { in: demandes } } });
  await prisma.promoMaterial.deleteMany({ where: { id: { in: pms } } });
  await prisma.promoCatalogueArticle.deleteMany({ where: { reference: { startsWith: P } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  if (pms.length > 0) {
    await prisma.notification.deleteMany({
      where: { createdAt: { gte: new Date(debut.getTime() - 60 * 60 * 1000) }, OR: pms.map((id) => ({ link: { contains: id } })) },
    });
  }
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: pms } }] } }).catch(() => {});
  await prisma.userAccess.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await nettoyer();
  const hash = await bcrypt.hash(E2E.password, 10);
  const [dir, cp] = await Promise.all([
    prisma.user.create({ data: { email: EMAIL.dir, name: `${P} Directrice marketing`, passwordHash: hash, role: "PRODUCT_MANAGER" }, select: { id: true } }),
    prisma.user.create({ data: { email: EMAIL.cp, name: `${P} Chef de produit`, passwordHash: hash, role: "MEDICAL_PROMOTION_MANAGER" }, select: { id: true } }),
  ]);
  dirId = dir.id;
  cpId = cp.id;
  const carnet = await prisma.promoCatalogueArticle.create({ data: { reference: `${P}CARNET`, nom: `${P} Carnet bilan`, famille: "CONSOMMABLE", unite: "pièce" }, select: { id: true } });
  // Deux dossiers du circuit 2 au point exact que chaque parcours mesure : la demande en validation
  // chez la directrice (figée à la création, §118.152) ; et un dossier au CHOIX des lignes, avec un
  // devis retranscrit et sa demande au secrétariat close — ce que la retranscription produit.
  const commun = { requesterId: cpId, createdById: cpId, circuitVersion: 2, requestValidatorId: dirId, requestValidation: true, marketingValidatorId: dirId };
  renvoiId = (await prisma.promoMaterial.create({ data: { ...commun, reference: `${P}MP-1`, title: `${P} Carnets bilan Nivolex`, circuitState: "REVIEW_REQUEST" }, select: { id: true } })).id;
  choixId = (await prisma.promoMaterial.create({ data: { ...commun, reference: `${P}MP-2`, title: `${P} Carnets bilan Trastuzex`, circuitState: "REVIEW_REQUESTER" }, select: { id: true } })).id;
  for (const id of [renvoiId, choixId]) {
    await prisma.promoRequestItem.create({ data: { promoMaterialId: id, catalogueId: carnet.id, quantite: 500, actions: ["IMPRESSION"], position: 0, createdById: cpId } });
  }
  const article = await prisma.promoRequestItem.findFirstOrThrow({ where: { promoMaterialId: choixId }, select: { id: true } });
  await prisma.promoQuote.create({
    data: {
      promoMaterialId: choixId, supplierName: `${P} Imprimerie Atlas`, tvaRate: 19,
      lines: { create: [{ position: 0, reference: "Carnet A5", unit: "pièce", quantity: 500, unitPrice: 100, action: "IMPRESSION", requestItemId: article.id }] },
    },
  });
  demandeInitiale = (await prisma.administrativeRequest.create({
    data: {
      reference: `${P}DEM-1`, type: "QUOTE", title: `Devis — ${P}MP-2`, status: "DONE", priority: "HIGH",
      requesterId: cpId, linkedEntityType: "PROMO_MATERIAL", linkedEntityId: choixId,
    },
    select: { id: true },
  })).id;
  await prisma.promoMaterial.update({ where: { id: choixId }, data: { adminRequestId: demandeInitiale } });
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

test("RENVOYER — la directrice renvoie la demande pour correction : sans motif le bouton ne part pas, et le formulaire se referme une fois le renvoi parti", async ({ page }) => {
  // Le premier parcours après un build propre paie le démarrage à froid du serveur (§118.124b).
  test.setTimeout(120_000);
  await login(page, EMAIL.dir);
  await aller(page, `/promo-material/${renvoiId}`);
  await expect(page.getByRole("button", { name: "Valider cette étape" }), "les trois issues sont là").toBeVisible();
  await expect(page.getByRole("button", { name: "Refuser" })).toBeVisible();
  await page.getByRole("button", { name: "Renvoyer pour correction" }).click();
  const envoyer = page.getByRole("button", { name: "Renvoyer au demandeur" });
  await expect(envoyer, "pas de renvoi sans motif : le demandeur ne saurait pas quoi corriger").toBeDisabled();
  await page.getByLabel("Ce qu'il faut corriger").fill(MOTIF);
  await expect(envoyer).toBeEnabled();
  await cliquerDecisif(envoyer);
  await expect(page.getByText("Renvoyé au demandeur : il corrige sa demande, puis vous la resoumet.")).toBeVisible({ timeout: 15_000 });
  const pm = await prisma.promoMaterial.findUniqueOrThrow({ where: { id: renvoiId } });
  expect([pm.circuitState, pm.returnNote, pm.returnedById]).toEqual(["REVIEW_REQUEST", MOTIF, dirId]);
  // L'écran suit : le renvoi se lit, et plus rien n'est offert à la directrice tant que la balle est
  // chez le demandeur — ni un second renvoi (que l'action refuserait), ni valider, ni refuser.
  await expect(page.getByRole("status").filter({ hasText: `« ${MOTIF} »` })).toBeVisible();
  await expect(envoyer).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Valider cette étape" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Renvoyer pour correction" })).toHaveCount(0);
});

test("RESOUMETTRE — le chef de produit lit le renvoi sur la fiche et resoumet en disant ce qui a changé", async ({ page }) => {
  await login(page, EMAIL.cp);
  await aller(page, `/promo-material/${renvoiId}`);
  await expect(page.getByRole("status").filter({ hasText: /À corriger — renvoyé à l'étape/ }), "le renvoi se lit, avec son motif").toContainText(MOTIF);
  const resoumettre = page.getByRole("button", { name: "Resoumettre la demande" });
  await expect(resoumettre, "ce qui a changé est exigé").toBeDisabled();
  await page.getByLabel("Ce qui a changé").fill(CORRECTION);
  await resoumettre.click();
  await expect(page.getByText("Demande resoumise : elle revient à la personne qui l'a renvoyée.")).toBeVisible({ timeout: 15_000 });
  const pm = await prisma.promoMaterial.findUniqueOrThrow({ where: { id: renvoiId } });
  expect([pm.circuitState, pm.returnedAt, pm.returnNote]).toEqual(["REVIEW_REQUEST", null, null]);
  const fil = await prisma.comment.findMany({ where: { entityType: "PROMO_MATERIAL", entityId: renvoiId }, select: { body: true } });
  expect(fil.some((l) => l.body.startsWith("Resoumis après correction") && l.body.includes(MOTIF) && l.body.endsWith(CORRECTION))).toBe(true);
});

test("REDEMANDER DES DEVIS — au choix des lignes, le chef de produit relance le secrétariat ; l'écran ne lui offre pas de « Refuser » sa propre demande", async ({ page }) => {
  await login(page, EMAIL.cp);
  await aller(page, `/promo-material/${choixId}`);
  await expect(page.getByRole("button", { name: "Refuser" }), "un refus que l'action lui refuserait n'est pas un geste").toHaveCount(0);
  await page.getByRole("button", { name: "Redemander des devis" }).click();
  const envoyer = page.getByRole("button", { name: "Envoyer la demande" });
  await expect(envoyer, "ce qu'on cherche est exigé : l'assistante rapporterait sinon les mêmes devis").toBeDisabled();
  await page.getByLabel("Ce que vous cherchez").fill(CHERCHE);
  await envoyer.click();
  await expect(page.getByText(/Nouveaux devis demandés au secrétariat \(.+\) — les devis déjà reçus restent sur la fiche\./)).toBeVisible({ timeout: 15_000 });
  const pm = await prisma.promoMaterial.findUniqueOrThrow({ where: { id: choixId }, select: { circuitState: true, adminRequestId: true } });
  expect(pm.circuitState).toBe("QUOTE_REQUESTED");
  expect(pm.adminRequestId).not.toBe(demandeInitiale);
  const nouvelle = await prisma.administrativeRequest.findUniqueOrThrow({ where: { id: pm.adminRequestId! } });
  expect(nouvelle.description).toContain(CHERCHE);
  expect(await prisma.promoQuote.count({ where: { promoMaterialId: choixId } }), "le devis déjà reçu reste").toBe(1);
});
