import { prisma } from "@/lib/prisma";
import { scopeRegulatory, type SessionUser } from "@/lib/rbac";
import { currentCompanyWhereFor, productRangeScope } from "@/lib/company";
import { reminderTargets, type ReminderBoard } from "@/lib/regulatory/update-reminder";

/**
 * LE TABLEAU DE RELANCE — qui porte combien de dossiers, et depuis quand ils dorment.
 *
 * Une seule fonction pour l'ÉCRAN et pour l'ACTION, et ce n'est pas de l'économie : ce sont les
 * mêmes chiffres qui s'affichent et qui partent en notification. Deux chargements séparés
 * auraient fini par diverger d'un filtre, et la personne relancée aurait reçu « 12 dossiers »
 * alors que la direction en voyait 9 — la relance perd toute crédibilité au premier écart.
 *
 * Le PÉRIMÈTRE est celui de l'écran Regulatory, sans exception : mêmes droits de ligne, même
 * entité courante, mêmes gammes. On ne relance jamais sur des dossiers qu'on n'aurait pas le
 * droit de voir soi-même.
 */
export async function regulatoryReminderBoard(user: SessionUser, now = new Date()): Promise<ReminderBoard> {
  const rangeScope = await productRangeScope(user.id);
  const dossiers = await prisma.regulatoryProduct.findMany({
    where: {
      ...scopeRegulatory(user),
      ...await currentCompanyWhereFor(user.id),
      ...(rangeScope ? { AND: [rangeScope] } : {}),
    },
    select: {
      responsibleId: true,
      isLocked: true,
      status: true,
      updatedAt: true,
      responsible: { select: { name: true } },
    },
  });

  // La dernière relance de chacun, en UNE requête : la poser par personne mettrait autant de
  // requêtes que de pharmaciens derrière un simple affichage.
  const last = await prisma.regulatoryUpdateReminder.groupBy({
    by: ["recipientId"],
    _max: { createdAt: true },
  });
  const lastRemindedAt = new Map(
    last.filter((r) => r._max.createdAt).map((r) => [r.recipientId, r._max.createdAt as Date]),
  );

  return reminderTargets(
    dossiers.map((d) => ({
      responsibleId: d.responsibleId,
      responsibleName: d.responsible?.name ?? null,
      isLocked: d.isLocked,
      status: d.status,
      updatedAt: d.updatedAt,
    })),
    { now, lastRemindedAt },
  );
}
