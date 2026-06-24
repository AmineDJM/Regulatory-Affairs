/* eslint-disable no-console */
/**
 * Bootstrap — creates the single initial Super Admin account (no demo data).
 * Idempotent: never overwrites an existing user. Credentials come from env:
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@adventum.dz").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const name = process.env.ADMIN_NAME ?? "Administrateur";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ Super Admin already exists: ${email} (left untouched)`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
      role: "SUPER_ADMIN",
      title: "Super Administrateur",
      avatarColor: "#1e293b",
      isActive: true,
      mustChangePassword: process.env.ADMIN_PASSWORD ? false : true,
    },
  });

  console.log("✅ Super Admin créé.");
  console.log(`   Email    : ${email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`   Mot de passe (à changer) : ${password}`);
  }
  console.log("   Connecte-toi puis crée les comptes de ton équipe depuis Administration.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
