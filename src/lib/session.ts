import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "./prisma";
import { getAccess, userCan, type Action, type EffectiveAccess, type Module } from "./rbac";
import { firstAccessibleHref } from "./labels";
import { shouldTouch } from "./touch-throttle";

/** Nom du cookie de « Vue exacte » (impersonation), honoré uniquement pour un Super Admin. */
export const IMPERSONATE_COOKIE = "amd_impersonate";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** « Autre rôle » cumulé (réglé par le Super Admin), résolu depuis l'accès effectif. */
  secondaryRole?: UserRole | null;
  access: EffectiveAccess;
  sid?: string;
  mustChangePassword: boolean;
  /** Présent quand un Super Admin visualise l'OS « comme » cet utilisateur. */
  impersonatedBy?: { id: string; name: string };
}

async function build(session: Session | null): Promise<CurrentUser | null> {
  if (!session?.user) return null;

  // Validate the revocable session: reject revoked/expired tokens so the admin
  // can force-logout a user (or a single device) from the console.
  const sid = session.user.sid;
  if (sid) {
    const us = await prisma.userSession.findUnique({
      where: { id: sid },
      select: { revokedAt: true, expiresAt: true },
    });
    if (!us || us.revokedAt || us.expiresAt < new Date()) return null;
    // `lastSeenAt` = « dernier clic » : granularité à la minute suffit. On throttle donc
    // l'UPDATE (au plus 1×/min par session) au lieu d'écrire à CHAQUE requête (WAL/disque).
    if (shouldTouch(`sess:${sid}`, 60_000)) {
      prisma.userSession
        .update({ where: { id: sid }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }
  }

  // « Vue exacte » : un Super Admin peut visualiser l'OS exactement comme un autre
  // utilisateur. Le cookie n'est honoré QUE si la session réelle est Super Admin —
  // un cookie forgé par un non-admin est donc sans effet.
  if (session.user.role === "SUPER_ADMIN") {
    const targetId = cookies().get(IMPERSONATE_COOKIE)?.value;
    if (targetId && targetId !== session.user.id) {
      const target = await prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
      if (target && target.isActive) {
        const targetAccess = await getAccess(target.id, target.role);
        return {
          id: target.id,
          name: target.name,
          email: target.email,
          role: target.role,
          secondaryRole: targetAccess.secondaryRole,
          access: targetAccess,
          sid,
          mustChangePassword: false,
          impersonatedBy: { id: session.user.id, name: session.user.name ?? "Administrateur" },
        };
      }
    }
  }

  const access = await getAccess(session.user.id, session.user.role);
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    secondaryRole: access.secondaryRole,
    access,
    sid,
    mustChangePassword: session.user.mustChangePassword ?? false,
  };
}

/** Returns the signed-in user (with resolved access) or redirects to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await build(await auth());
  if (!user) redirect("/login");
  return user;
}

/**
 * Première destination de navigation que l'utilisateur peut **réellement voir**.
 * Sert d'atterrissage sûr en cas de refus : on ne renvoie JAMAIS vers une page qui
 * le refuserait à nouveau (sinon boucle infinie, ex. un refus de DASHBOARD renvoyé
 * vers /dashboard). Parcourt la navigation dans l'ordre de la barre latérale.
 */
export function safeLanding(user: CurrentUser): string {
  return firstAccessibleHref((module) => userCan(user, module, "VIEW")) ?? "/no-access";
}

/**
 * Guards a module page. Redirects unauthenticated users to /login, users who
 * must change their password to /change-password, and unauthorised users to a
 * **safe landing** (the first tab they can actually see). Enforced via the
 * user's *effective* access. Never redirects to a page the user can't view —
 * which would otherwise cause an `ERR_TOO_MANY_REDIRECTS` loop.
 */
export async function requireModule(
  module: Module,
  action: Action = "VIEW",
): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  if (!userCan(user, module, action)) {
    redirect(`${safeLanding(user)}?denied=${module}`);
  }
  return user;
}

/** Non-redirecting variant for layouts / optional checks. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return build(await auth());
}
