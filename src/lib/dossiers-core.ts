/**
 * Cœur (sans "use server") de la création d'un dossier de suivi. Isolé ici pour
 * être réutilisable par l'action de formulaire (dossier-actions, "use server")
 * ET par l'assistant IA, sans tirer `@/lib/session`/auth dans leurs graphes
 * d'import (sinon les tests ne chargent plus). Ne lit jamais la session : l'auteur
 * est passé explicitement (`actorId`).
 */
import type { Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRef } from "@/lib/refs";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

export interface DossierInput {
  title: string;
  description?: string | null;
  category?: string | null;
  priority?: Priority;
  assignedToId?: string | null;
  participantIds?: string[];
  dueDate?: Date | null;
}

export async function nextDossierRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.dossier.findMany({ where: { reference: { startsWith: `DOS-${year}-` } }, select: { reference: true } });
  return buildRef("DOS", year, refs.map((r) => r.reference));
}

/**
 * Crée un dossier de suivi. Réutilisable par l'action de formulaire ET par
 * l'assistant IA (après confirmation). Notifie le responsable + les participants.
 */
export async function createDossierRecord(input: DossierInput, actorId: string): Promise<{ id: string; reference: string }> {
  const reference = await nextDossierRef();
  // On ne garde que des participants valides et actifs, hors responsable/créateur.
  const wanted = (input.participantIds ?? []).filter((id) => id && id !== input.assignedToId && id !== actorId);
  const participantIds = wanted.length
    ? (await prisma.user.findMany({ where: { id: { in: wanted }, isActive: true }, select: { id: true } })).map((u) => u.id)
    : [];

  let assignedToId = input.assignedToId ?? null;
  if (assignedToId) {
    const a = await prisma.user.findUnique({ where: { id: assignedToId }, select: { isActive: true } });
    if (!a?.isActive) assignedToId = null;
  }

  const created = await prisma.dossier.create({
    data: {
      reference,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      priority: input.priority ?? "MEDIUM",
      assignedToId,
      participantIds,
      dueDate: input.dueDate ?? null,
      createdById: actorId,
    },
    select: { id: true, reference: true, title: true },
  });

  const recipients = new Set<string>([...(assignedToId ? [assignedToId] : []), ...participantIds]);
  recipients.delete(actorId);
  for (const userId of recipients) {
    await notifyUser({ userId, type: "ASSIGNMENT", title: "Nouveau dossier de suivi", body: `${reference} — ${created.title}`, link: `/dossiers/${created.id}` });
  }
  await recordAudit({ actorId, action: "CREATE", module: "Dossiers", entityType: "DOSSIER", entityId: created.id, summary: `Dossier ${reference} — ${created.title}` });
  return { id: created.id, reference: created.reference };
}
