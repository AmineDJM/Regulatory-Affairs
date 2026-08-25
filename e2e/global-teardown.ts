import { PrismaClient } from "@prisma/client";

/** Retire TOUT le seed E2E (préfixe __e2e__) — la base ressort comme elle est entrée. */
export default async function globalTeardown(): Promise<void> {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public" } },
  });
  try {
    await prisma.userInvite.deleteMany({ where: { token: { startsWith: "__e2e__" } } });
    await prisma.auditLog.deleteMany({ where: { actor: { email: { startsWith: "__e2e__" } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: "__e2e__" } } });
  } finally {
    await prisma.$disconnect();
  }
}
