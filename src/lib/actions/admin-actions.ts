"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";

const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777"];

export async function createUser(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireUser();
  if (!can(admin.role, "ADMIN", "CREATE")) return { ok: false, error: "Réservé aux administrateurs." };

  const email = fdStr(formData, "email")?.toLowerCase();
  const name = fdStr(formData, "name");
  const password = fdStr(formData, "password");
  const role = fdStr(formData, "role") as UserRole;
  if (!email || !name || !password || !role) {
    return { ok: false, error: "Tous les champs obligatoires doivent être remplis." };
  }
  if (password.length < 8) return { ok: false, error: "Mot de passe trop court (min. 8 caractères)." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "Un utilisateur avec cet email existe déjà." };

  const created = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      title: fdStr(formData, "title"),
      region: fdStr(formData, "region"),
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    },
  });
  await recordAudit({
    actorId: admin.id, action: "CREATE", module: "Administration",
    summary: `Utilisateur créé: ${name} (${role})`,
  });
  revalidatePath("/admin");
  return { ok: true, id: created.id };
}

export async function toggleUserActive(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (!can(admin.role, "ADMIN", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id || id === admin.id) return { ok: false, error: "Action invalide." };

  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return { ok: false, error: "Introuvable." };
  await prisma.user.update({ where: { id }, data: { isActive: !u.isActive } });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    field: "isActive", oldValue: String(u.isActive), newValue: String(!u.isActive),
    summary: `${u.isActive ? "Désactivation" : "Activation"} de ${u.name}`,
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function updateUserRole(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (!can(admin.role, "ADMIN", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const role = fdStr(formData, "role") as UserRole;
  if (!id || !role) return { ok: false, error: "Paramètres manquants." };

  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return { ok: false, error: "Introuvable." };
  await prisma.user.update({ where: { id }, data: { role } });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    field: "role", oldValue: u.role, newValue: role, summary: `Rôle de ${u.name} → ${role}`,
  });
  revalidatePath("/admin");
  return { ok: true };
}
