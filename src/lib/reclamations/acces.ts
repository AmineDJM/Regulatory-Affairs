import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moduleScope, userCan, type Action, type SessionUser } from "@/lib/rbac";
import { lecteurDeLaReclamation, peutContribuer, type LecteurReclamation } from "./regles";

/**
 * RETOURS & RÉCLAMATIONS — qui voit, qui instruit. Serveur : lit la session et la base ; la règle vit dans `regles.ts`
 * (pure), que l'écran, la porte des pièces et les actions partagent.
 */

const MODULE = "RETOURS_RECLAMATIONS" as const;

export function voitToutesLesReclamations(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN" || (userCan(user, MODULE, "VIEW") && moduleScope(user, MODULE) === "ALL");
}

export function instruitLesReclamations(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN" || userCan(user, MODULE, "UPDATE");
}

export function declareDesReclamations(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN" || userCan(user, MODULE, "CREATE");
}

export function lecteurReclamation(user: SessionUser): LecteurReclamation {
  return { userId: user.id, voitTout: voitToutesLesReclamations(user), instruit: instruitLesReclamations(user) };
}

/** La clause des réclamations qu'une personne lit — la même règle que la fiche. */
export function clauseReclamationsVisibles(user: SessionUser): Prisma.ReclamationWhereInput {
  if (voitToutesLesReclamations(user)) return {};
  return { OR: [{ declaredById: user.id }, { ownerId: user.id }] };
}

/** La porte d'une réclamation (pièces, fil) : lire = la règle de la fiche ; joindre = contribuer ; le reste = instruire. */
export async function accesALaReclamation(user: SessionUser, id: string, action: Action): Promise<boolean> {
  if (!userCan(user, MODULE, "VIEW") && user.role !== "SUPER_ADMIN") return false;
  const r = await prisma.reclamation.findUnique({ where: { id }, select: { declaredById: true, ownerId: true, status: true } });
  if (!r) return false;
  const l = lecteurReclamation(user);
  if (!lecteurDeLaReclamation(l, r)) return false;
  if (action === "VIEW" || action === "EXPORT") return true;
  if (action === "UPLOAD" || action === "CREATE") return peutContribuer(l, r);
  return l.instruit;
}
