import { prisma } from "@/lib/prisma";
import { userCan, isTopManagement, type SessionUser } from "@/lib/rbac";
import type { RecruitmentActor } from "./request-flow";

/**
 * QUI EST QUI devant une demande de recrutement.
 *
 * Une demande met en présence quatre personnes différentes, et la même personne peut en être
 * plusieurs à la fois (un directeur général qui recrute pour son propre département est à la
 * fois demandeur et sommet). On résout donc les quatre qualités D'UN COUP, ici, et l'écran comme
 * les actions serveur posent ensuite la même question à `abilities()`.
 *
 * Un CV est une DONNÉE PERSONNELLE : avoir le module ne suffit pas à ouvrir n'importe quelle
 * demande. Il faut y être partie — l'avoir écrite, devoir la valider, ou tenir les RH.
 */

export interface RecruitmentViewer extends RecruitmentActor {
  /** Est-il l'un des validateurs de la chaîne (quelle que soit la marche) ? */
  isApprover: boolean;
}

/**
 * Les qualités de cette personne sur CETTE demande, ou `null` si elle n'y a rien à faire.
 *
 * Rendre `null` plutôt que « tout à false » est délibéré : l'appelant doit distinguer « je n'ai
 * pas accès » (page introuvable) de « je regarde sans pouvoir agir » — deux écrans différents.
 */
export async function recruitmentViewer(
  user: SessionUser,
  requestId: string,
): Promise<RecruitmentViewer | null> {
  const req = await prisma.recruitmentRequest.findUnique({
    where: { id: requestId },
    select: { requesterId: true, approvals: { select: { approverId: true } } },
  });
  if (!req) return null;

  const isHr = userCan(user, "RH", "UPDATE");
  const isTop = isTopManagement(user);
  const isRequester = req.requesterId === user.id;
  const isApprover = req.approvals.some((a) => a.approverId === user.id);

  if (!isHr && !isTop && !isRequester && !isApprover) return null;
  return { userId: user.id, isRequester, isHr, isTop, isApprover };
}

/**
 * Le filtre de LISTE correspondant : les demandes qu'une personne a le droit de voir.
 *
 * Même règle que ci-dessus, exprimée en clause Prisma — les deux doivent dire la même chose,
 * sinon une demande apparaîtrait dans la liste sans pouvoir s'ouvrir (ou l'inverse, plus grave).
 */
export function recruitmentScope(user: SessionUser) {
  if (userCan(user, "RH", "UPDATE") || isTopManagement(user)) return {};
  return {
    OR: [
      { requesterId: user.id },
      { approvals: { some: { approverId: user.id } } },
    ],
  };
}
