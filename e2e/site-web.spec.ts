import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE SITE PUBLIC DANS LE NAVIGATEUR (§118.158) — écrans réels, base réelle, AUCUNE requête vers
 * le site : le serveur de cette suite tourne avec `ADAM_SORTIE_INTERDITE=1` et sans les variables
 * `ADVENTUM_*`, donc un contenu publié attend en file — et l'écran doit le DIRE, pas afficher
 * « En ligne ».
 *
 * Le banc de flux (`site-web/publication.test.ts`) prouve la FILE et la RÉCONCILIATION par les
 * vraies actions ; celui-ci prouve que la règle a un ÉCRAN (§118.50) : la Direction trouve le
 * module, un `# Titre` est refusé AVANT l'envoi en nommant la ligne, l'aperçu rend le Markdown, une
 * offre se prépare depuis une demande de recrutement sans jamais porter la rémunération — et un
 * délégué ne trouve rien, ni au menu ni par l'adresse.
 *
 * Décor propre à la spec (préfixe `__e2e__`), retiré à la fin — y compris la file et son journal.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const DIR_EMAIL = "__e2e__dir-siteweb@test.dz";
const DEL_EMAIL = "__e2e__delegue-siteweb@test.dz";
const REF = "__e2e__REC-SITEWEB";
const POSTE = "__e2e__ Délégué médical Oran";
const SALAIRE = 987654;
const JUSTIFICATION = "__e2e__ justification confidentielle du poste";
const TITRE_ARTICLE = "__e2e__ Traçabilité des lots en 2027";
const CAPTURES = process.env.E2E_CAPTURES ?? "";
let demandeId = "";
let articleId = "";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/mot de passe/i).fill(E2E.password);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  // 60 s : la toute première connexion après un build propre est lente (§118.124b).
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
}

async function capture(page: Page, nom: string) {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/site-web-${nom}.png`, fullPage: true });
}

/** Aucun défilement horizontal : la page tient dans la largeur de l'écran (360 → 4K). */
async function tientEnLargeur(page: Page) {
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(debord, "la page déborde horizontalement").toBeLessThanOrEqual(1);
}

async function nettoyer() {
  const users = await prisma.user.findMany({ where: { email: { in: [DIR_EMAIL, DEL_EMAIL] } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const offres = await prisma.jobPosting.findMany({ where: { title: { startsWith: "__e2e__" } }, select: { id: true } });
  const articles = await prisma.blogArticle.findMany({ where: { title: { startsWith: "__e2e__" } }, select: { id: true } });
  const externes = [...offres.map((o) => o.id), ...articles.map((a) => a.id)];
  const pubs = await prisma.sitePublication.findMany({ where: { externalId: { in: externes } }, select: { id: true } });
  await prisma.sitePushAttempt.deleteMany({ where: { publicationId: { in: pubs.map((p) => p.id) } } });
  await prisma.sitePublication.deleteMany({ where: { id: { in: pubs.map((p) => p.id) } } });
  await prisma.jobPosting.deleteMany({ where: { id: { in: offres.map((o) => o.id) } } });
  await prisma.blogArticle.deleteMany({ where: { id: { in: articles.map((a) => a.id) } } });
  await prisma.recruitmentRequest.deleteMany({ where: { reference: REF } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await nettoyer();
  const hash = await bcrypt.hash(E2E.password, 10);
  const dir = await prisma.user.create({ data: { email: DIR_EMAIL, name: "__e2e__ Direction Site", passwordHash: hash, role: "DIRECTION" } });
  await prisma.user.create({ data: { email: DEL_EMAIL, name: "__e2e__ Délégué Site", passwordHash: hash, role: "MEDICAL_DELEGATE" } });
  const demande = await prisma.recruitmentRequest.create({
    data: {
      reference: REF, requesterId: dir.id, position: POSTE, contractType: "CDI",
      salaryMin: SALAIRE, justification: JUSTIFICATION,
      missions: "Animer le réseau de prescripteurs\nPréparer les congrès régionaux",
      skills: "Formation en pharmacie\nPermis B", stage: "SOURCING",
    },
  });
  demandeId = demande.id;
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

test("la Direction trouve « Site web » dans le menu, et la connexion DIT ce qui manque", async ({ page }) => {
  await login(page, DIR_EMAIL);
  await page.goto("/site-web");
  await expect(page.getByRole("heading", { name: "Site web — adventumdz.com" })).toBeVisible();
  // L'entrée du menu existe (pôle Administration) : c'est par elle qu'on y arrive.
  expect(await page.locator('a[href="/site-web"]').count()).toBeGreaterThan(0);
  // Le serveur de cette suite n'a pas la clé : l'écran le dit, avec la variable qui manque.
  await expect(page.getByText("Non configurée", { exact: true })).toBeVisible();
  await expect(page.getByText(/Intégration au site non configurée/)).toBeVisible();
  await expect(page.getByText("Mise en service", { exact: true })).toBeVisible();
  await capture(page, "1-hub");
});

test("un article : le `# Titre` est refusé AVANT l'envoi en nommant la ligne, l'aperçu rend le Markdown, et « publier » ne ment pas", async ({ page }) => {
  await login(page, DIR_EMAIL);
  await page.goto("/site-web");
  await page.getByRole("link", { name: /Nouvel article/ }).click();
  await expect(page).toHaveURL(/\/site-web\/articles\/nouveau$/);

  await page.getByLabel("Titre").fill(TITRE_ARTICLE);
  await page.getByLabel("Description (moteurs de recherche)").fill("Ce que la sérialisation change pour les établissements, les grossistes et les pharmacies.");
  const corps = page.getByLabel("Corps (Markdown)");
  await corps.fill("# Titre interdit\n\nTexte.");
  // Refusé À L'ENDROIT EXACT, avant tout envoi — et le bouton reste fermé tant que la faute est là.
  await expect(page.getByText(/ligne 1/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Publier sur le site" })).toBeDisabled();
  await capture(page, "2-refus");

  await corps.fill("La sérialisation arrive.\n\n## Contexte\n\nLa **traçabilité** change tout.\n\n## Ce qui change\n\n- un identifiant par boîte\n- un registre partagé");
  await expect(page.getByText("Le site acceptera cet article.")).toBeVisible();
  // Le sommaire se lit sous les yeux de l'auteur.
  await expect(page.getByText("Ce qui change", { exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Aperçu" }).click();
  await expect(page.getByRole("heading", { name: "Contexte", level: 2 })).toBeVisible();
  await capture(page, "3-apercu");

  await page.getByRole("button", { name: "Publier sur le site" }).click();
  // `/nouveau` correspond aussi à « un identifiant » : on attend EXPLICITEMENT d'en être sorti
  // (§118.157 — un juge qui se résout avant l'évènement qu'il attend lit la mauvaise page).
  await page.waitForURL((url) => /^\/site-web\/articles\/(?!nouveau$)[a-z0-9]+$/.test(url.pathname), { timeout: 30_000 });
  articleId = page.url().split("/").pop()!;
  // RIEN N'EST PARTI (pas de clé, sorties interdites) : l'écran dit « en attente », jamais « en ligne ».
  await expect(page.getByText("En attente", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/n'est pas configurée : l'envoi partira dès qu'elle le sera/).first()).toBeVisible();
  await expect(page.getByText("En ligne", { exact: true })).toHaveCount(0);

  const article = await prisma.blogArticle.findUniqueOrThrow({ where: { id: articleId } });
  expect(article.published).toBe(true);
  const ligne = await prisma.sitePublication.findUniqueOrThrow({ where: { kind_externalId: { kind: "POST", externalId: articleId } } });
  expect(ligne).toMatchObject({ state: "PENDING", attempts: 0, operation: "PUT" });
  await capture(page, "4-article-en-file");
});

test("une offre se prépare depuis la demande de recrutement — ni rémunération ni justification, jamais", async ({ page }) => {
  await login(page, DIR_EMAIL);
  await page.goto(`/recrutement/${demandeId}`);
  await expect(page.getByText("Offre sur le site", { exact: true })).toBeVisible();
  await expect(page.getByText(/Le poste est ouvert et n'est pas encore annoncé/)).toBeVisible();
  // TÉMOIN : la demande de recrutement MONTRE sa justification à la Direction, légitimement. La même
  // lecture du document doit donc l'y trouver — sans ce témoin, l'assertion négative plus bas
  // pourrait être vraie parce que `page.content()` ne contient pas ce qu'on croit (§118.17).
  expect(await page.content(), "la lecture du document ne voit pas le contenu rendu par le serveur").toContain(JUSTIFICATION);
  await page.getByRole("link", { name: /Préparer l'offre/ }).click();
  await expect(page).toHaveURL(new RegExp(`/site-web/offres/nouvelle\\?demande=${demandeId}$`));
  await expect(page.getByLabel("Intitulé du poste")).toHaveValue(POSTE);

  // CE QUI RESTE INTERNE n'atteint pas le navigateur. Le lien ci-dessus navigue CÔTÉ CLIENT : le
  // document garde alors la charge serveur de la page de RECRUTEMENT (qui porte la justification,
  // voir le témoin), et la charge de CETTE page arrive par une requête que le DOM ne contient pas.
  // Mesuré au premier passage : la vérification accusait la page d'avant et ne pouvait pas voir
  // celle-ci (§118.92). Rechargée en document complet, la page porte SON rendu serveur ET sa charge
  // de composants — tout ce qu'elle envoie au navigateur.
  await page.goto(`/site-web/offres/nouvelle?demande=${demandeId}`);
  await expect(page.getByLabel("Intitulé du poste")).toHaveValue(POSTE);
  await expect(page.getByLabel("Missions")).toHaveValue(/Animer le réseau de prescripteurs/);
  await expect(page.getByText(/Préremplie depuis la demande/)).toBeVisible();
  const html = await page.content();
  // Le salaire sous ses quatre écritures : chiffres collés, espace ordinaire, insécable, et l'espace
  // fine insécable que `toLocaleString("fr-FR")` met entre les milliers (U+202F, §118.140).
  for (const interdit of ["987654", "987 654", "987\u00a0654", "987\u202f654", JUSTIFICATION]) expect(html).not.toContain(interdit);
  await capture(page, "5-offre-preremplie");

  await page.getByRole("button", { name: "Publier sur le site" }).click();
  await page.waitForURL((url) => /^\/site-web\/offres\/(?!nouvelle$)[a-z0-9]+$/.test(url.pathname), { timeout: 30_000 });
  const offreId = page.url().split("/").pop()!;
  await expect(page.getByText("En attente", { exact: true }).first()).toBeVisible();

  const offre = await prisma.jobPosting.findUniqueOrThrow({ where: { id: offreId } });
  expect(offre).toMatchObject({ published: true, recruitmentRequestId: demandeId });
  const ligne = await prisma.sitePublication.findUniqueOrThrow({ where: { kind_externalId: { kind: "JOB", externalId: offreId } } });
  // Le poste est OUVERT (SOURCING) : l'offre part publique, et son corps ne porte rien d'interne.
  const corps = JSON.parse(ligne.body!) as Record<string, unknown>;
  expect(corps.published).toBe(true);
  expect(ligne.body).not.toContain(String(SALAIRE));
  expect(ligne.body).not.toContain(JUSTIFICATION);

  // Retour sur la demande : la carte ne propose plus de « préparer », elle mène à l'offre.
  await page.goto(`/recrutement/${demandeId}`);
  await expect(page.getByRole("link", { name: /Ouvrir l'offre/ })).toBeVisible();
});

test("un délégué ne trouve le module ni au menu ni par l'adresse", async ({ page }) => {
  await login(page, DEL_EMAIL);
  // Le refus se lit à ce que le délégué NE VOIT PAS, pas à l'adresse. `requireModule` renvoie vers
  // sa première page permise avec `?denied=SITE_WEB` ; pour un délégué c'est le tableau de bord,
  // qui redirige à son tour vers « Mon espace » sans reporter le marqueur — mesuré au premier
  // passage de ce banc, qui attendait le marqueur et a reçu `/mon-espace`.
  const horsDuModule = () => !new URL(page.url()).pathname.startsWith("/site-web");
  await page.goto("/site-web");
  expect(horsDuModule(), `le hub s'ouvre à un délégué : ${page.url()}`).toBe(true);
  await expect(page.getByRole("heading", { name: "Site web — adventumdz.com" })).toHaveCount(0);
  expect(await page.locator('a[href="/site-web"]').count(), "l'entrée « Site web » est dans son menu").toBe(0);
  const offres = await page.goto("/site-web/offres");
  expect(offres?.status()).toBe(404);
  const article = await page.goto(`/site-web/articles/${articleId}`);
  expect(article?.status() === 404 || horsDuModule(), `la fiche d'un article s'ouvre à un délégué : ${page.url()}`).toBe(true);
  await expect(page.getByText(TITRE_ARTICLE)).toHaveCount(0);
});

test("au téléphone (375 px), le module tient dans la largeur et garde ses gestes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, DIR_EMAIL);
  await page.goto("/site-web");
  await expect(page.getByRole("heading", { name: "Site web — adventumdz.com" })).toBeVisible();
  await tientEnLargeur(page);
  await capture(page, "6-mobile-hub");
  await page.goto(`/site-web/articles/${articleId}`);
  await expect(page.getByLabel("Titre")).toHaveValue(TITRE_ARTICLE);
  await tientEnLargeur(page);
  await expect(page.getByRole("button", { name: "Enregistrer les modifications" })).toBeVisible();
  await capture(page, "7-mobile-article");
});
