import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moduleScope, userCan, type Action, type SessionUser } from "@/lib/rbac";
import { lecteurDuCasPv, peutJoindreAuCasPv } from "./regles";

/**
 * PHARMACOVIGILANCE — qui voit, qui instruit (Direction, 06/10). Serveur : lit la session et la base ; la règle
 * elle-même vit dans `regles.ts` (pure), que la fiche, la liste, la porte des pièces et les actions partagent.
 */

/** Reçoit les cas : Voir le module en portée TOUT (Regulatory, la Direction). */
export function voitTousLesCasPv(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN" || (userCan(user, "PHARMACOVIGILANCE", "VIEW") && moduleScope(user, "PHARMACOVIGILANCE") === "ALL");
}

/** Instruit les cas : change le statut, ouvre une enquête, ajoute des personnes à l'échange. */
export function instruitLesCasPv(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN" || userCan(user, "PHARMACOVIGILANCE", "UPDATE") || userCan(user, "PHARMACOVIGILANCE", "VALIDATE");
}

/** Signale un cas : Créer sur le module (le KAM, par défaut tout rédacteur de rapports terrain). */
export function signaleDesCasPv(user: SessionUser): boolean {
  return userCan(user, "PHARMACOVIGILANCE", "CREATE");
}

/** La clause des cas qu'une personne lit — la même que la fiche (`lecteurDuCasPv`). */
export function clauseCasPvVisibles(user: SessionUser): Prisma.PharmacovigilanceCaseWhereInput {
  if (voitTousLesCasPv(user)) return {};
  return { OR: [{ reporterId: user.id }, { participants: { some: { userId: user.id } } }] };
}

export function lecteurPv(user: SessionUser) {
  return { userId: user.id, voitTout: voitTousLesCasPv(user), superAdmin: user.role === "SUPER_ADMIN", instruit: instruitLesCasPv(user) };
}

/**
 * LA PORTE D'UN CAS (fiche, pièces, fil) : lire = la règle de la fiche ; joindre = `peutJoindreAuCasPv` ; modifier ou
 * supprimer une pièce = qui instruit, et qui lit le cas.
 */
export async function accesAuCasPv(user: SessionUser, caseId: string, action: Action): Promise<boolean> {
  const cas = await prisma.pharmacovigilanceCase.findUnique({
    where: { id: caseId },
    select: { reporterId: true, status: true, participants: { select: { userId: true } } },
  });
  if (!cas) return false;
  const l = lecteurPv(user);
  if (!lecteurDuCasPv(l, cas)) return false;
  if (action === "VIEW" || action === "EXPORT") return true;
  if (action === "UPLOAD" || action === "CREATE") return peutJoindreAuCasPv(l, cas);
  return l.instruit;
}
