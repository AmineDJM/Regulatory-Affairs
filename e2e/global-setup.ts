import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * SEED E2E — tout est préfixé `__e2e__` et retiré au teardown. Un utilisateur qui peut se
 * connecter, une invitation VALABLE (token déterministe) et une invitation EXPIRÉE : de quoi
 * jouer les parcours réels sans toucher à rien d'existant.
 */

export const E2E = {
  email: "__e2e__user@test.dz",
  password: "E2e!MotDePasse#2026",
  /** Le compte qui TIENT la papeterie (assistante de direction) — le registre de marque se règle par lui. */
  papeterieEmail: "__e2e__papeterie@test.dz",
  /** Un compte qui LIT sans régler (simple lecteur, sans société) — le registre de marque doit lui rester fermé. */
  lecteurEmail: "__e2e__lecteur@test.dz",
  inviteValid: "__e2e__invite-valide-token",
  inviteExpired: "__e2e__invite-expiree-token",
  inviteeValid: "__e2e__invitee@test.dz",
  inviteeExpired: "__e2e__invitee-exp@test.dz",
  /** Le dossier Legal et ses bons de commande — le décor du bogue « documents disparus ». */
  legalFolder: "__e2e__ Bons de commande",
  legalDocPrefix: "__e2e__BC",
  legalDocCount: 6,
  /** Le décor du LIVE OFFICE : un vrai `.docx` et un vrai `.pdf` dans le Drive du testeur. */
  officeFolder: "__e2e__ Live Office",
  docxName: "__e2e__ Contrat Consulting Mouffok.docx",
  pdfName: "__e2e__ Dossier ANPP.pdf",
  pdfPages: 10,
  /** Le décor de la BOÎTE DE DÉCISION : une validation à son tour, une notification, un engagement. */
  /** Le décor de « d'où tu tiens ça ? » (F8) : un tour déjà consigné, avec deux faits sourcés. */
  provenanceLabel: "PRD-E2E-TEMOIN — Produit témoin",
  provenanceTotal: "Total décaissé témoin E2E",
  provenanceQuestion: "__e2e__ Où en est le produit témoin ?",
  inboxValidationRef: "__e2e__VAL-1",
  inboxValidationTitle: "__e2e__ Avance sur frais — mission Oran",
  inboxNotificationTitle: "__e2e__ Rapport d'inventaire déposé",
  inboxCommitmentWho: "__e2e__ Khaled Mansouri",
  /**
   * LE SECRET DE SESSION DU RUN E2E — et la raison pour laquelle il est ici.
   *
   * `drive-storage.ts` DÉRIVE la clé de chiffrement des blobs de ce secret quand
   * `DRIVE_ENCRYPTION_KEY` n'est pas posée. Si le seed et le serveur n'ont pas le même, le seed
   * chiffre avec une clé et le serveur déchiffre avec une autre : « Unsupported state or unable
   * to authenticate data ». C'est exactement ce qui est arrivé, et la seule protection sûre est
   * qu'il n'existe qu'UNE source — celle-ci, lue par `playwright.config.ts` ET par le seed.
   */
  authSecret: process.env.NEXTAUTH_SECRET ?? "e2e-secret-local-only",
} as const;

export default async function globalSetup(): Promise<void> {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
  });
  try {
    // Nettoyage d'un run précédent interrompu, puis seed frais.
    await prisma.userInvite.deleteMany({ where: { token: { startsWith: "__e2e__" } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: "__e2e__" } } });

    const testeur = await prisma.user.create({
      data: {
        name: "__e2e__ Testeur", email: E2E.email,
        passwordHash: await bcrypt.hash(E2E.password, 10),
        role: "DIRECTION",
      },
    });

    const papeterie = await prisma.user.create({
      data: { name: "__e2e__ Papeterie", email: E2E.papeterieEmail, passwordHash: await bcrypt.hash(E2E.password, 10), role: "DIRECTION_ASSISTANT" },
    });
    // Le compte papeterie VOIT la première société active : le registre de marque suit le périmètre
    // de la personne, et un compte sans société n'aurait rien à régler. L'accès part avec le compte.
    const premiere = await prisma.company.findFirst({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true } });
    if (premiere) await prisma.userCompanyAccess.create({ data: { userId: papeterie.id, companyId: premiere.id, canEdit: true } });
    await prisma.user.create({
      data: { name: "__e2e__ Lecteur", email: E2E.lecteurEmail, passwordHash: await bcrypt.hash(E2E.password, 10), role: "VIEWER" },
    });

    const invitee = await prisma.user.create({
      data: { name: "__e2e__ Invitée", email: E2E.inviteeValid, passwordHash: await bcrypt.hash("jamais-communique", 10), role: "VIEWER" },
    });
    await prisma.userInvite.create({
      data: { token: E2E.inviteValid, userId: invitee.id, expiresAt: new Date(Date.now() + 3_600_000) },
    });

    const expired = await prisma.user.create({
      data: { name: "__e2e__ Expirée", email: E2E.inviteeExpired, passwordHash: await bcrypt.hash("jamais-communique", 10), role: "VIEWER" },
    });
    await prisma.userInvite.create({
      data: { token: E2E.inviteExpired, userId: expired.id, expiresAt: new Date(Date.now() - 3_600_000) },
    });

    // LE DÉCOR DU BOGUE LEGAL : un dossier « Bons de commande » et six BC SANS échéance —
    // donc aucun d'eux n'est « à surveiller ». C'est précisément cette combinaison qui faisait
    // afficher « 0 / 6 documents » après une arrivée par un rappel d'échéance.
    await prisma.legalDocument.deleteMany({ where: { title: { startsWith: E2E.legalDocPrefix } } });
    await prisma.legalFolder.deleteMany({ where: { name: E2E.legalFolder } });
    const folder = await prisma.legalFolder.create({ data: { name: E2E.legalFolder }, select: { id: true } });
    for (let n = 1; n <= E2E.legalDocCount; n += 1) {
      await prisma.legalDocument.create({
        data: {
          title: `${E2E.legalDocPrefix} ${n}`,
          reference: `${E2E.legalDocPrefix}-${n}`,
          kind: "PURCHASE_ORDER",
          counterparty: "__e2e__ Kwality",
          startDate: new Date("2026-01-05"),
          endDate: null,
          folderId: folder.id,
        },
      });
    }
    // ── LE DÉCOR DE LA BOÎTE DE DÉCISION (§21) ─────────────────────────────────────
    //
    // Une validation À SON TOUR (mode parallèle, échéance dépassée : la carte doit sortir en
    // tête, CRITIQUE), une notification non lue marquée importante, un engagement en retard.
    // Trois genres de cartes, trois lignes réelles — et le clic « Approuver » de la spec doit
    // changer l'état de l'étape en base, pas seulement l'écran.
    await prisma.executiveCommitment.deleteMany({ where: { who: { startsWith: "__e2e__" } } });
    await prisma.notification.deleteMany({ where: { title: { startsWith: "__e2e__" } } });
    await prisma.validationRequest.deleteMany({ where: { reference: { startsWith: "__e2e__" } } });
    await prisma.validationRequest.create({
      data: {
        reference: E2E.inboxValidationRef, module: "Finances", objectType: "EXPENSE",
        title: E2E.inboxValidationTitle, description: "Déplacement de deux jours à Oran : hôtel, carburant, péages.",
        amount: 120_000, priority: "HIGH", requesterId: invitee.id, mode: "PARALLEL", status: "PENDING",
        deadline: new Date(Date.now() - 86_400_000),
        steps: { create: [{ order: 1, validatorId: testeur.id, status: "PENDING" }] },
      },
    });
    await prisma.notification.create({
      // PAS en pop-up plein écran : ce mode recouvre les écrans de l'ERP jusqu'à accusé de
      // réception, et les autres specs cliquent sur ces écrans. La carte n'en a pas besoin.
      data: { userId: testeur.id, title: E2E.inboxNotificationTitle, body: "Le rapport d'inventaire de Rouiba est dans le Drive.", link: "/drive", popup: false },
    });
    await prisma.executiveCommitment.create({
      data: { ownerId: testeur.id, who: E2E.inboxCommitmentWho, toWhom: "le PDG", what: "régler la facture Hikma sous 10 jours", dueAt: new Date(Date.now() - 3 * 86_400_000), status: "OPEN", source: "comité du 28/08" },
    });

    // ── LE DÉCOR DE LA PROVENANCE (F8) ─────────────────────────────────────────────
    //
    // Un tour DÉJÀ consigné pour le testeur : une fiche ERP (Regulatory, temps réel) et un total
    // calculé avec sa lignée. La spec pose « D'où tu tiens ça ? » dans le bureau d'Adam : la
    // réponse doit venir du code — sans appel de modèle — et citer ces deux faits.
    await prisma.assistantProvenance.deleteMany({ where: { userId: testeur.id } });
    const lu = new Date().toISOString();
    await prisma.assistantProvenance.create({
      data: {
        userId: testeur.id, question: E2E.provenanceQuestion, nombre: 2,
        faits: [
          {
            id: "search_products:/regulatory/__e2e__", libelle: E2E.provenanceLabel, valeur: "statut : SUBMITTED · priorite : HAUTE",
            nature: "ERP", famille: "REGULATORY", outil: "search_products", href: "/regulatory", locator: null,
            horodatage: "2026-08-12T00:00:00.000Z", observeLe: lu, confiance: 1, base: "metadata", fraicheur: "TEMPS_REEL",
            autorite: "L'AVANCEMENT réglementaire d'un dossier, l'identité canonique d'un produit.", preuveNegative: true,
            acteur: testeur.id, calcul: null,
          },
          {
            id: "finance_totals:calcul:__e2e__", libelle: E2E.provenanceTotal, valeur: "142 800 DZD",
            nature: "CALCUL", famille: "FINANCE", outil: "finance_totals", href: "/finances", locator: null,
            horodatage: "2026-07-03T00:00:00.000Z", observeLe: lu, confiance: 1, base: "calcul", fraicheur: "TEMPS_REEL",
            autorite: "Ce qui a été PAYÉ, quand, à qui — et ce qui reste dû.", preuveNegative: true, acteur: testeur.id,
            calcul: { entrees: ["PAY-E2E-1", "PAY-E2E-2", "PAY-E2E-3"], transformation: "somme côté base de 3 écriture(s) RÉGLÉE(s)", formule: "Σ montant (direction, statut SETTLED, période, filtres)", calculeLe: lu },
          },
        ],
      },
    });

    // ── LE DÉCOR DU LIVE OFFICE ────────────────────────────────────────────────────
    //
    // Délégué à `scripts/e2e/office-seed.ts`, lancé sous `tsx` : le chargeur TypeScript de
    // Playwright n'honore pas les alias `@/`, et le seed doit utiliser EXACTEMENT le code de
    // production (`putBlob`, `fixtures.ts`) plutôt qu'une copie réécrite en chemins relatifs.
    //
    // Les identifiants de nœud atterrissent dans `.e2e-office.json` : la spec les relit, parce
    // qu'un `cuid()` ne peut pas être une constante et que `process.env` posé ici ne traverse
    // pas jusqu'aux workers Playwright.
    const seed = execFileSync("npx", ["tsx", "scripts/e2e/office-seed.ts", testeur.id], {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public",
        NEXTAUTH_SECRET: E2E.authSecret,
      },
    });
    writeFileSync(path.join(process.cwd(), ".e2e-office.json"), seed.trim());
  } finally {
    await prisma.$disconnect();
  }
}
