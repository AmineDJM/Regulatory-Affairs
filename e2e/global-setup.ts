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
