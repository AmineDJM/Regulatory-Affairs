import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "./prisma";
import { getAccess, userCan, type Action, type EffectiveAccess, type Module } from "./rbac";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  access: EffectiveAccess;
  sid?: string;
  mustChangePassword: boolean;
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
    prisma.userSession
      .update({ where: { id: sid }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  const access = await getAccess(session.user.id, session.user.role);
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
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
 * Guards a module page. Redirects unauthenticated users to /login, users who
 * must change their password to /change-password, and unauthorised users to
 * /dashboard. Enforced via the user's *effective* access.
 */
export async function requireModule(
  module: Module,
  action: Action = "VIEW",
): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  if (!userCan(user, module, action)) {
    redirect("/dashboard?denied=" + module);
  }
  return user;
}

/** Non-redirecting variant for layouts / optional checks. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return build(await auth());
}
