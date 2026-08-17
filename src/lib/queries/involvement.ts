import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import type { EntityType } from "@prisma/client";

/**
 * LES CONVERSATIONS D'IMPLICATION D'UNE DEMANDE AD & PRO.
 *
 * Quand on implique une tierce personne, un dossier de suivi naît : c'est un espace d'échange
 * PRIVÉ entre le demandeur et la personne sollicitée — sans budget, sans accès au module. Ce
 * dossier existait déjà, mais il vivait « à part », dans les Projets, et le demandeur oubliait
 * de l'ouvrir. On le fait donc remonter À L'ENDROIT de la demande, en bas de sa fiche.
 *
 * Ce module lit ces conversations pour un objet (une demande de congrès, un événement) et les
 * met en forme pour l'affichage inline, en réutilisant EXACTEMENT le fil de discussion des
 * dossiers (messages + pièces jointes) — pas une seconde implémentation qui divergerait.
 */

export interface InvolvementMessage {
  id: string;
  authorId: string | null;
  author: string;
  body: string;
  createdAt: string;
  mentionIds: string[];
  attachments: { id: string; name: string; mime: string; size: number }[];
}

export interface InvolvementThread {
  dossierId: string;
  /** La personne impliquée — l'autre partie de la conversation. */
  personName: string;
  personId: string | null;
  createdById: string | null;
  /** Tous ceux qui peuvent écrire : demandeur, personne impliquée, participants. */
  members: { id: string; name: string }[];
  messages: InvolvementMessage[];
}

export async function getInvolvementThreads(sourceType: EntityType, sourceId: string): Promise<InvolvementThread[]> {
  const dossiers = await prisma.dossier.findMany({
    where: { sourceType, sourceId },
    orderBy: { createdAt: "asc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true } },
          attachments: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, mime: true, size: true } },
        },
      },
    },
  });

  // Les participants additionnels (userIds bruts) → noms, en un seul lot.
  const extraIds = [...new Set(dossiers.flatMap((d) => d.participantIds))];
  const extras = extraIds.length
    ? await prisma.user.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = new Map(extras.map((u) => [u.id, u.name]));

  return dossiers.map((d) => {
    const members = [
      ...(d.createdBy ? [{ id: d.createdBy.id, name: d.createdBy.name }] : []),
      ...(d.assignedTo ? [{ id: d.assignedTo.id, name: d.assignedTo.name }] : []),
      ...d.participantIds.map((id) => ({ id, name: nameOf.get(id) ?? "—" })),
    ].filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);

    return {
      dossierId: d.id,
      personName: d.assignedTo?.name ?? "Personne impliquée",
      personId: d.assignedToId ?? null,
      createdById: d.createdById ?? null,
      members,
      messages: d.messages.map((m) => ({
        id: m.id,
        authorId: m.authorId,
        author: m.author?.name ?? "—",
        body: m.body,
        createdAt: formatDateTime(m.createdAt.toISOString()),
        mentionIds: m.mentionIds,
        attachments: m.attachments,
      })),
    };
  });
}
