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
} as const;

export default async function globalSetup(): Promise<void> {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
  });
  try {
    // Nettoyage d'un run précédent interrompu, puis seed frais.
    await prisma.userInvite.deleteMany({ where: { token: { startsWith: "__e2e__" } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: "__e2e__" } } });

    await prisma.user.create({
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
  } finally {
    await prisma.$disconnect();
  }
}
