"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { AccessScope, EntityType } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, MODULES, type Module } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { clearAttempts } from "@/lib/login-throttle";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/** Only a Super Admin (ADMIN/UPDATE) may manage accounts & access. */
async function requireAdmin() {
  const admin = await requireUser();
  if (!userCan(admin, "ADMIN", "UPDATE")) return null;
  return admin;
}

/**
 * Save the full per-user access matrix in one shot. For each module the form
 * carries `mode_<MODULE>` = DEFAULT | CUSTOM | BLOCKED, plus action checkboxes
 * `act_<MODULE>_<ACTION>` and `scope_<MODULE>` when CUSTOM.
 */
export async function saveAccessMatrix(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Réservé au Super Admin." };
  const userId = fdStr(formData, "userId");
  if (!userId) return { ok: false, error: "Utilisateur manquant." };

  for (const module of MODULES) {
    const mode = fdStr(formData, `mode_${module}`) ?? "DEFAULT";
    if (mode === "DEFAULT") {
      await prisma.userAccess.deleteMany({ where: { userId, module } });
      continue;
    }
    const blocked = mode === "BLOCKED";
    const get = (a: string) => !blocked && formData.get(`act_${module}_${a}`) === "on";
    const scope = (fdStr(formData, `scope_${module}`) as AccessScope) ?? "ASSIGNED";
    await prisma.userAccess.upsert({
      where: { userId_module: { userId, module } },
      create: {
        userId, module,
        canView: !blocked,
        canCreate: get("CREATE"), canUpdate: get("UPDATE"), canDelete: get("DELETE"),
        canValidate: get("VALIDATE"), canExport: get("EXPORT"), canUpload: get("UPLOAD"),
        scope,
      },
      update: {
        canView: !blocked,
        canCreate: get("CREATE"), canUpdate: get("UPDATE"), canDelete: get("DELETE"),
        canValidate: get("VALIDATE"), canExport: get("EXPORT"), canUpload: get("UPLOAD"),
        scope,
      },
    });
  }

  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    entityId: userId, summary: "Mise à jour des accès (matrice)",
  });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

/**
 * Vue « par module » (façon Google Drive) : enregistre, pour UN module, les accès
 * de plusieurs comptes d'un coup. Le formulaire porte `module`, la liste `userId`,
 * et pour chaque compte `mode_<userId>` (DEFAULT|CUSTOM|BLOCKED), les cases
 * `act_<userId>_<ACTION>` et `scope_<userId>`.
 */
export async function saveModuleAccess(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Réservé au Super Admin." };
  const module = fdStr(formData, "module") as Module | null;
  if (!module || !MODULES.includes(module)) return { ok: false, error: "Module manquant." };
  const userIds = formData.getAll("userId").map(String).filter(Boolean);

  for (const userId of userIds) {
    const mode = fdStr(formData, `mode_${userId}`) ?? "DEFAULT";
    if (mode === "DEFAULT") {
      await prisma.userAccess.deleteMany({ where: { userId, module } });
      continue;
    }
    const blocked = mode === "BLOCKED";
    const get = (a: string) => !blocked && formData.get(`act_${userId}_${a}`) === "on";
    const scope = (fdStr(formData, `scope_${userId}`) as AccessScope) ?? "ASSIGNED";
    await prisma.userAccess.upsert({
      where: { userId_module: { userId, module } },
      create: {
        userId, module,
        canView: !blocked,
        canCreate: get("CREATE"), canUpdate: get("UPDATE"), canDelete: get("DELETE"),
        canValidate: get("VALIDATE"), canExport: get("EXPORT"), canUpload: get("UPLOAD"),
        scope,
      },
      update: {
        canView: !blocked,
        canCreate: get("CREATE"), canUpdate: get("UPDATE"), canDelete: get("DELETE"),
        canValidate: get("VALIDATE"), canExport: get("EXPORT"), canUpload: get("UPLOAD"),
        scope,
      },
    });
  }

  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration",
    summary: `Accès du module ${module} mis à jour (${userIds.length} comptes)`,
  });
  revalidatePath("/admin/access");
  return { ok: true };
}

/** Replace the set of granted rows for a user on one entity type. */
export async function setRowGrants(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Réservé au Super Admin." };
  const userId = fdStr(formData, "userId");
  const entityType = fdStr(formData, "entityType") as EntityType | null;
  if (!userId || !entityType) return { ok: false, error: "Paramètres manquants." };

  const ids = formData.getAll("rowId").map(String).filter(Boolean);

  await prisma.$transaction([
    prisma.rowGrant.deleteMany({ where: { userId, entityType } }),
    prisma.rowGrant.createMany({
      data: ids.map((entityId) => ({ userId, entityType, entityId })),
      skipDuplicates: true,
    }),
  ]);

  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration", entityId: userId,
    entityType, summary: `Lignes accordées (${entityType}): ${ids.length}`,
  });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function adminResetPassword(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Réservé au Super Admin." };
  const userId = fdStr(formData, "userId");
  const password = fdStr(formData, "password");
  if (!userId || !password || password.length < 8) {
    return { ok: false, error: "Mot de passe trop court (min. 8)." };
  }
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!target) return { ok: false, error: "Utilisateur introuvable." };

  const force = formData.get("mustChange") === "on";
  const passwordHash = await bcrypt.hash(password, 10);

  // Applique le nouveau mot de passe à TOUTES les lignes portant cet e-mail
  // (insensible à la casse). La connexion résout le compte par e-mail insensible
  // à la casse (`findFirst … orderBy createdAt asc`) alors que la contrainte SQL
  // `@unique` est, elle, sensible à la casse : d'anciennes données peuvent donc
  // contenir des variantes (« Amine@x.dz » et « amine@x.dz »). Ne mettre à jour
  // que la ligne cliquée laisserait parfois la connexion authentifier une AUTRE
  // ligne avec l'ANCIEN mot de passe → la réinitialisation « ne changeait rien ».
  const targets = await prisma.user.findMany({
    where: { email: { equals: target.email, mode: "insensitive" } },
    select: { id: true },
  });
  const ids = targets.map((u) => u.id);

  await prisma.user.updateMany({
    where: { id: { in: ids } },
    data: { passwordHash, mustChangePassword: force },
  });
  // Lève tout verrouillage anti-bruteforce en cours pour cet e-mail : un compte
  // verrouillé (trop d'échecs) doit pouvoir se reconnecter IMMÉDIATEMENT avec le
  // nouveau mot de passe, sans attendre l'expiration du verrou. (La clé de verrou
  // est l'e-mail en minuscules, cf. auth.ts.)
  await clearAttempts(target.email.toLowerCase());
  // Invalide les sessions existantes de toutes ces lignes pour que le nouveau mot
  // de passe s'applique partout (déconnexion immédiate des sessions actives).
  await prisma.userSession.updateMany({
    where: { userId: { in: ids }, revokedAt: null }, data: { revokedAt: new Date() },
  });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration", entityId: userId,
    field: "password", summary: "Réinitialisation du mot de passe",
  });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function updateUserProfile(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Réservé au Super Admin." };
  const userId = fdStr(formData, "userId");
  if (!userId) return { ok: false, error: "Utilisateur manquant." };

  const current = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!current) return { ok: false, error: "Utilisateur introuvable." };

  // E-mail (= identifiant de connexion) : normalisé en minuscules, format vérifié,
  // et **unicité** garantie avant l'écriture. Toute modification est tracée.
  const rawEmail = fdStr(formData, "email");
  const email = rawEmail?.toLowerCase().trim();
  let emailChanged = false;
  if (email && email !== current.email) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Adresse e-mail invalide." };
    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken && taken.id !== userId) return { ok: false, error: "Cet e-mail est déjà utilisé par un autre compte." };
    emailChanged = true;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: fdStr(formData, "name") ?? undefined,
      title: fdStr(formData, "title"),
      region: fdStr(formData, "region"),
      role: (fdStr(formData, "role") as never) ?? undefined,
      ...(emailChanged ? { email } : {}),
    },
  });
  if (emailChanged) {
    await recordAudit({
      actorId: admin.id, action: "UPDATE", module: "Administration", entityId: userId,
      field: "email", oldValue: current.email, newValue: email!,
      summary: `Changement d'e-mail de connexion → ${email}`,
    });
  }
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration", entityId: userId,
    summary: "Mise à jour du profil utilisateur",
  });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function setUserActive(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Réservé au Super Admin." };
  const userId = fdStr(formData, "userId");
  if (!userId || userId === admin.id) return { ok: false, error: "Action invalide." };
  const active = formData.get("active") === "true";
  await prisma.user.update({ where: { id: userId }, data: { isActive: active } });
  if (!active) {
    await prisma.userSession.updateMany({
      where: { userId, revokedAt: null }, data: { revokedAt: new Date() },
    });
  }
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration", entityId: userId,
    field: "isActive", newValue: String(active),
    summary: `${active ? "Activation" : "Désactivation"} du compte`,
  });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function revokeSession(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Réservé au Super Admin." };
  const sessionId = fdStr(formData, "sessionId");
  const userId = fdStr(formData, "userId");
  if (!sessionId) return { ok: false, error: "Session manquante." };
  await prisma.userSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration", entityId: userId ?? undefined,
    summary: "Révocation d'une session",
  });
  if (userId) revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

/**
 * Super Admin : (re)déclenche l'onboarding guidé d'un compte. À sa prochaine
 * navigation, l'utilisateur sera redirigé vers le parcours de configuration.
 */
export async function requestOnboarding(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Réservé au Super Admin." };
  const userId = fdStr(formData, "userId");
  if (!userId) return { ok: false, error: "Utilisateur manquant." };
  await prisma.user.update({ where: { id: userId }, data: { mustOnboard: true } });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration", entityId: userId,
    summary: "Setup guidé demandé (à la prochaine connexion)",
  });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function revokeAllSessions(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Réservé au Super Admin." };
  const userId = fdStr(formData, "userId");
  if (!userId) return { ok: false, error: "Utilisateur manquant." };
  await prisma.userSession.updateMany({
    where: { userId, revokedAt: null }, data: { revokedAt: new Date() },
  });
  await recordAudit({
    actorId: admin.id, action: "UPDATE", module: "Administration", entityId: userId,
    summary: "Révocation de toutes les sessions",
  });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}
