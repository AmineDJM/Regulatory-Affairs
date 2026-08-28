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
    // De VRAIS fichiers, fabriqués par les mêmes fonctions que la production (`fixtures.ts`),
    // déposés dans le Drive du testeur avec un blob chiffré et une version — c'est-à-dire par
    // le chemin normal. Un `.docx` bricolé à la main ne prouverait rien : il n'a ni styles,
    // ni sectPr, donc il ne peut pas révéler les défauts qui cassent les vrais fichiers.
    //
    // Les identifiants de nœud sont écrits dans `.e2e-office.json` : la spec les relit, parce
    // qu'un identifiant `cuid()` ne peut pas être une constante.
    const { docxDeParagraphes, pdfNumerote } = await import("../src/lib/artifact/adapters/fixtures");
    const { putBlob } = await import("../src/lib/drive-storage");

    await prisma.driveNode.deleteMany({ where: { name: { startsWith: "__e2e__ " }, type: "FILE" } });
    await prisma.driveNode.deleteMany({ where: { name: E2E.officeFolder } });
    const dossier = await prisma.driveNode.create({
      data: { name: E2E.officeFolder, type: "FOLDER", ownerId: testeur.id, createdById: testeur.id },
      select: { id: true },
    });

    const deposer = async (nom: string, octets: Buffer, mime: string) => {
      const { blobId, size } = await putBlob(octets);
      const node = await prisma.driveNode.create({
        data: {
          name: nom, type: "FILE", parentId: dossier.id, ownerId: testeur.id, createdById: testeur.id,
          mimeType: mime, size, category: "Document",
          versions: { create: { blobId, version: 1, size, mimeType: mime, createdById: testeur.id } },
        },
        select: { id: true },
      });
      return node.id;
    };

    const docxNode = await deposer(
      E2E.docxName,
      await docxDeParagraphes(
        ["Contrat Consulting Mouffok", "Article 1 — Objet", "Article 2 — Durée", "Article 3 — Rémunération", "Article 4 — Confidentialité"],
        { premierEstTitre: true, tableau: [["Poste", "Montant"], ["Conseil", "120 000 DZD"]] },
      ),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const pdfNode = await deposer(E2E.pdfName, await pdfNumerote(E2E.pdfPages), "application/pdf");

    writeFileSync(
      path.join(process.cwd(), ".e2e-office.json"),
      JSON.stringify({ docxNode, pdfNode }, null, 2),
    );
    process.env.E2E_DOCX_NODE = docxNode;
    process.env.E2E_PDF_NODE = pdfNode;
  } finally {
    await prisma.$disconnect();
  }
}
