import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { E2E } from "./global-setup";

/**
 * ═════════════════════════════════════════════════════════════════
 * UNE FACTURE ÉMISE SE CORRIGE PAR UN AVOIR DEPUIS SA FICHE — dans le navigateur (audit 360°, lot C4d2b2, §118.195).
 *
 * Le banc de flux (`avoir-flow.test.ts`) prouve les RÈGLES par les vraies actions — le plafond, le verrou, le net
 * que le règlement encaisse ; celui-ci prouve qu'elles ont un ÉCRAN qui les déclenche (§118.50), dans la peau
 * d'une personne des Finances :
 *   - elle compose une facture depuis Legal, comme au quotidien ;
 *   - sur la fiche de la facture, « Émettre un avoir » n'émet l'avoir qu'une fois le motif écrit — c'est ce que
 *     l'avoir imprime —, et la fiche dit ensuite le NET de la facture et l'avoir qui la corrige ;
 *   - l'avoir est une pièce définitive : il ne se révise pas ;
 *   - la facture émise ne part pas au centre de paiement : c'est son client qui la règle, et la fiche le dit À LA
 *     PLACE du bouton, avant le clic (§118.83).
 *
 * Décor propre à la spec (préfixe `__e2e18__`), posé en base et retiré au début et à la fin.
 * ═════════════════════════════════════════════════════════════════
 */

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
});

const P = "__e2e18__";
const EMAIL_FIN = `${P}fin@test.dz`;
const CLIENT = `${P} Pharmacie du Port`;
const MOTIF = "Retour de 20 boîtes endommagées à la livraison.";
// La facture : 100 × 450 = 45 000 HT, TVA 19 % par défaut → 53 550 TTC. L'avoir garde sa ligne et n'en crédite que
// la part rendue : 20 × 450 = 9 000 HT → 10 710 TTC. Net de la facture : 53 550 − 10 710 = 42 840.
const TTC_AVOIR = 10_710;

let companyId = "";
let finId = "";
let factureId = "";
let avoirId = "";

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
  const societes = (await prisma.company.findMany({ where: { name: { startsWith: P } }, select: { id: true } })).map((c) => c.id);
  const comptes = (await prisma.user.findMany({ where: { email: { startsWith: P } }, select: { id: true } })).map((u) => u.id);
  // Les avoirs sont couverts par le filtre de société : la fabrique les émet au nom de la société de leur facture.
  const pieces = (await prisma.legalDocument.findMany({ where: { companyId: { in: societes } }, select: { id: true } })).map((d) => d.id);
  const vIds = (await prisma.validationRequest.findMany({ where: { entityType: "LEGAL_DOCUMENT", entityId: { in: pieces } }, select: { id: true } })).map((v) => v.id);
  await prisma.validationStep.deleteMany({ where: { requestId: { in: vIds } } });
  await prisma.validationRequest.deleteMany({ where: { id: { in: vIds } } });
  await prisma.adProGateVisa.deleteMany({ where: { entityType: "LEGAL_DOCUMENT", entityId: { in: pieces } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ entityId: { in: pieces } }, { actorId: { in: comptes } }] } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: comptes } } });
  // L'avoir pointe vers sa facture (`chainFromId`) : il part AVANT elle.
  await prisma.legalDocument.deleteMany({ where: { id: { in: pieces }, kind: "CREDIT_NOTE" } });
  await prisma.legalDocument.deleteMany({ where: { id: { in: pieces } } });
  // Un règlement renseigné écrirait une écriture de trésorerie au nom de la société : la spec n'en pose aucune, et
  // le décor ne laisse rien derrière lui s'il en restait une d'un passage interrompu.
  await prisma.financeTransaction.deleteMany({ where: { companyId: { in: societes } } }).catch(() => {});
  await prisma.documentSequence.deleteMany({ where: { companyId: { in: societes } } }).catch(() => {});
  await prisma.fileVersion.deleteMany({ where: { node: { ownerId: { in: comptes } } } });
  await prisma.driveNode.deleteMany({ where: { ownerId: { in: comptes }, type: "FILE" } });
  await prisma.driveNode.deleteMany({ where: { ownerId: { in: comptes } } });
  await prisma.userCompanyAccess.deleteMany({ where: { companyId: { in: societes } } });
  await prisma.companyLegalIdentity.deleteMany({ where: { companyId: { in: societes } } });
  await prisma.company.deleteMany({ where: { id: { in: societes } } });
  await prisma.user.deleteMany({ where: { id: { in: comptes } } });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await nettoyer();
  const hash = await bcrypt.hash(E2E.password, 10);
  finId = (await prisma.user.create({ data: { email: EMAIL_FIN, name: `${P} Finances`, passwordHash: hash, role: "FINANCE_BUDGET_MANAGER" }, select: { id: true } })).id;
  companyId = (await prisma.company.create({ data: { name: `${P} Pharma`, shortName: "E2E18", color: "#1B7F79" }, select: { id: true } })).id;
  // Une facture est une pièce FISCALE : sans l'identité complète de l'émetteur, la fabrique ne l'émet pas.
  await prisma.companyLegalIdentity.create({
    data: {
      companyId, legalName: `${P} Pharma SARL`, legalForm: "SARL", shareCapital: "10 000 000 DZD", rcNumber: "16/00-1234567B21", nif: "001916012345678",
      nis: "001916012345690", taxArticle: "16012345678", headOffice: "12 rue des Frères Bouadou, Alger", phone: "+213 21 00 00 00", email: "contact@test.dz",
      bankName: "BNA", bankAgency: "Hydra", rib: "001 00123 0123456789 45", managerName: "Gérant de test", managerTitle: "Gérant",
    },
  });
  // Les Finances ENGAGENT cette société : c'est ce qui leur ouvre la composition de ses factures et l'émission de
  // ses avoirs.
  await prisma.userCompanyAccess.create({ data: { userId: finId, companyId, canEdit: true } });
});

test.afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

test("COMPOSER — les Finances émettent une facture depuis Legal", async ({ page }) => {
  // Le premier parcours après un build propre paie le démarrage à froid du serveur (§118.124b).
  test.setTimeout(150_000);
  await login(page, EMAIL_FIN);
  await aller(page, "/legal");
  await page.getByRole("button", { name: "Composer une facture" }).click();
  await page.locator("#cp-societe").selectOption(companyId);
  await page.locator("#cp-tiers-nom").fill(CLIENT);
  await page.getByLabel("Désignation 1").fill("Boîtes de démonstration — conditionnement hospitalier");
  await page.getByLabel("Quantité").first().fill("100");
  await page.getByLabel("Prix unitaire HT").first().fill("450");
  const emettre = page.getByRole("button", { name: "Émettre la facture" });
  await expect(emettre).toBeEnabled({ timeout: 30_000 });
  await emettre.click();
  await expect(page.getByText("Pièce émise.")).toBeVisible({ timeout: 60_000 });
  const doc = await prisma.legalDocument.findFirstOrThrow({ where: { companyId, kind: "INVOICE" }, select: { id: true } });
  factureId = doc.id;
});

test("ÉMETTRE UN AVOIR — le geste n'est offert qu'avec un motif, et la fiche dit le net", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, EMAIL_FIN);
  await aller(page, `/legal/${factureId}`);
  await page.getByRole("button", { name: "Émettre un avoir" }).click();
  await expect(page.getByText(/Émettre un avoir sur la facture/)).toBeVisible({ timeout: 15_000 });
  // Ce qui reste à créditer est dit en tête, avant toute saisie.
  await expect(page.getByText(/Reste à créditer :/)).toBeVisible();
  const envoyer = page.getByRole("button", { name: "Émettre l'avoir" });
  // Sans motif, le geste n'est pas offert : c'est ce que l'avoir imprime, sous la facture d'origine.
  await expect(envoyer).toBeDisabled();
  // On garde la ligne de la facture et l'on n'en crédite que la part rendue.
  await page.getByLabel("Quantité de la ligne 1").fill("20");
  await page.getByLabel("Motif de l'avoir").fill(MOTIF);
  await envoyer.click();
  // Les montants viennent de la fabrique (« 10 710,00 DZD »), jamais du navigateur : la phrase dit le crédit ET le net.
  await expect(page.getByText(/Avoir AV.* émis : 10\s710,00 DZD TTC crédités sur la facture .+ — net de la facture : 42\s840,00 DZD\./))
    .toBeVisible({ timeout: 60_000 });
  // Le texte, pas le nom : la croix du panneau s'annonce aussi « Fermer ».
  await page.getByText("Fermer", { exact: true }).click();
  await expect(page.getByText(/Net de la facture : 42\s840\sDZD/)).toBeVisible({ timeout: 30_000 });
  const av = await prisma.legalDocument.findFirstOrThrow({
    where: { chainFromId: factureId, kind: "CREDIT_NOTE" },
    select: { id: true, amount: true, reference: true },
  });
  expect(Number(av.amount)).toBe(TTC_AVOIR);
  expect(av.reference ?? "").toMatch(/^AV/);
  // La fiche de la facture nomme l'avoir qui la corrige, et y mène.
  await expect(page.getByRole("link", { name: String(av.reference), exact: true })).toBeVisible();
  avoirId = av.id;
});

test("L'AVOIR ne se révise pas, et la facture émise ne part pas au centre de paiement", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, EMAIL_FIN);
  // L'avoir est une pièce DÉFINITIVE : il s'annule (motif à l'appui) et se refait depuis la facture, il ne se réécrit pas.
  await aller(page, `/legal/${avoirId}`);
  await expect(page.getByText("Un avoir émis ne se révise pas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Réviser la pièce" })).toHaveCount(0);
  // La facture a été émise PAR la société : c'est son client qui la règle. La chaîne d'achat le dit à la place du
  // bouton — le centre de paiement n'autorise que des dépenses.
  await aller(page, `/legal/${factureId}`);
  await expect(page.getByText("c'est son client qui la règle")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /envoyer au règlement/i })).toHaveCount(0);
});
