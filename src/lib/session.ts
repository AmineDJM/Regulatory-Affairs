import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can, type Action, type Module } from "./rbac";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: import("@prisma/client").UserRole;
}

/** Returns the signed-in user or redirects to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
  };
}

/**
 * Guards a module page. Redirects unauthenticated users to /login and
 * unauthorised users to /dashboard. Always enforce this server-side at the top
 * of every protected page/route.
 */
export async function requireModule(
  module: Module,
  action: Action = "VIEW",
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, module, action)) {
    redirect("/dashboard?denied=" + module);
  }
  return user;
}

/** Non-redirecting variant for layouts / optional checks. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
  };
}
