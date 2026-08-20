"use server";

import { revalidatePath } from "next/cache";
import type { Priority, TaskStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { canRespond, canDoWork, declineSummary, ACCEPTED_STATUS, DECLINED_STATUS } from "@/lib/tasks/request-flow";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

export async function createTask(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "CREATE")) return { ok: false, error: "Non autorisé." };

  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "L'intitulé est obligatoire." };

  const assignedToId = fdStr(formData, "assignedToId") ?? user.id;

  // Participants (peuvent agir) et lecteurs (voient seulement), fixés à la création. Le
  // responsable et le créateur ont déjà accès : on les retire de ces listes. Un participant
  // l'emporte sur un lecteur si quelqu'un figure dans les deux.
  const clean = (field: string): string[] =>
    [...new Set(formData.getAll(field).map(String).filter(Boolean))]
      .filter((id) => id !== assignedToId && id !== user.id);
  const participantIds = clean("participantIds");
  const readerIds = clean("readerIds").filter((id) => !participantIds.includes(id));

  const created = await prisma.task.create({
    data: {
      title,
      description: fdStr(formData, "description"),
      assignedToId,
      participantIds,
      readerIds,
      createdById: user.id,
      dueDate: fdDate(formData, "dueDate"),
      priority: (fdStr(formData, "priority") as Priority) ?? "MEDIUM",
      module: fdStr(formData, "module"),
      // Course / livraison : adresse (lien Maps) + durée estimée (détection de retard).
      address: fdStr(formData, "address"),
      expectedMinutes: fdNum(formData, "expectedMinutes"),
    },
  });

  // Prévenir chacun selon son rôle — l'assigné, les participants (qui peuvent agir), les
  // lecteurs (informés). Une seule notification par personne, jamais au créateur.
  const notify: { userId: string; title: string }[] = [
    ...(assignedToId !== user.id ? [{ userId: assignedToId, title: "Nouvelle tâche assignée" }] : []),
    ...participantIds.map((userId) => ({ userId, title: "Vous participez à une tâche" })),
    ...readerIds.map((userId) => ({ userId, title: "Une tâche vous est partagée (lecture)" })),
  ];
  if (notify.length) {
    await prisma.notification.createMany({
      data: notify.map((n) => ({ userId: n.userId, type: "ASSIGNMENT" as const, title: n.title, body: title, link: "/mon-espace" })),
    }).catch(() => undefined);
  }

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Espace de travail",
    entityType: "TASK", entityId: created.id, summary: `Tâche « ${title} »`,
  });
  revalidatePath("/mon-espace");
  return { ok: true, id: created.id };
}

/** Change a task's status. Allowed for its assignee, its creator, or a manager. */
export async function updateTaskStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "UPDATE")) return { ok: false, error: "Non autorisé." };

  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status") as TaskStatus;
  if (!id || !status) return { ok: false, error: "Paramètres manquants." };

  const task = await prisma.task.findUnique({ where: { id }, select: { assignedToId: true, createdById: true, participantIds: true, title: true } });
  if (!task) return { ok: false, error: "Tâche introuvable." };

  // Le responsable, le créateur, un PARTICIPANT (pas un simple lecteur) ou un manager peuvent agir.
  const allowed = task.assignedToId === user.id || task.createdById === user.id
    || task.participantIds.includes(user.id) || hasGlobalView(user.role);
  if (!allowed) return { ok: false, error: "Non autorisé." };

  await prisma.task.update({
    where: { id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Espace de travail", entityType: "TASK",
    entityId: id, field: "status", newValue: status, summary: `Tâche « ${task.title} » → ${status}`,
  });
  revalidatePath("/mon-espace");
  return { ok: true };
}

/** Démarre une tâche « course / déplacement » : horodate le départ (et passe en cours). */
export async function startTask(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Tâche introuvable." };
  const task = await prisma.task.findUnique({ where: { id }, select: { assignedToId: true, createdById: true, participantIds: true, title: true, startedAt: true } });
  if (!task) return { ok: false, error: "Tâche introuvable." };
  if (!(task.assignedToId === user.id || task.createdById === user.id || task.participantIds.includes(user.id) || hasGlobalView(user.role))) return { ok: false, error: "Non autorisé." };
  await prisma.task.update({ where: { id }, data: { startedAt: task.startedAt ?? new Date(), status: "IN_PROGRESS" } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Espace de travail", entityType: "TASK", entityId: id, summary: `Départ — « ${task.title} »` });
  revalidatePath("/mon-espace");
  return { ok: true };
}

/**
 * Demande de tâche (ex. depuis un message) : crée une tâche au statut **REQUESTED**
 * assignée à un collègue, qu'il pourra **accepter** ou **refuser**. Comme un DM.
 */
export async function requestTask(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "CREATE")) return { ok: false, error: "Non autorisé." };
  const title = fdStr(formData, "title");
  const assignedToId = fdStr(formData, "assignedToId");
  if (!title) return { ok: false, error: "L'intitulé est obligatoire." };
  if (!assignedToId || assignedToId === user.id) return { ok: false, error: "Choisissez le destinataire de la demande." };

  const created = await prisma.task.create({
    data: {
      title, description: fdStr(formData, "description"), assignedToId, createdById: user.id,
      status: "REQUESTED", priority: (fdStr(formData, "priority") as Priority) ?? "MEDIUM",
      dueDate: fdDate(formData, "dueDate"), address: fdStr(formData, "address"), expectedMinutes: fdNum(formData, "expectedMinutes"),
      // Marque le PARCOURS : une fois acceptée, cette tâche n'aura pas d'étape intermédiaire.
      requestedAt: new Date(),
    },
  });
  await prisma.notification.create({
    data: { userId: assignedToId, type: "ASSIGNMENT", title: "Demande de tâche", body: title, link: `/mon-espace/taches/${created.id}` },
  }).catch(() => undefined);
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Espace de travail", entityType: "TASK", entityId: created.id, summary: `Demande de tâche « ${title} »` });
  revalidatePath("/mon-espace");
  return { ok: true, id: created.id };
}

/**
 * Le destinataire ACCEPTE ou REFUSE une demande de tâche.
 *
 * Accepter fait passer directement **en cours** : accepter, c'est prendre en charge. Un
 * passage par « à faire » obligerait à un second clic qui n'apprend rien à personne — et
 * c'est exactement l'étape intermédiaire qu'on supprime ici.
 *
 * Refuser accepte un motif, FACULTATIF. Le rendre obligatoire ne produit pas de meilleures
 * raisons : il produit des « non » et des « pas dispo ».
 */
export async function respondTaskRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const accept = fdStr(formData, "accept") === "1";
  if (!id) return { ok: false, error: "Tâche introuvable." };
  const task = await prisma.task.findUnique({ where: { id }, select: { assignedToId: true, createdById: true, title: true, status: true, requestedAt: true } });
  if (!task) return { ok: false, error: "Tâche introuvable." };
  if (!canRespond({ ...task, status: task.status }, user.id)) {
    return { ok: false, error: task.status === "REQUESTED" ? "Seul le destinataire peut répondre." : "Cette demande a déjà été traitée." };
  }

  const reason = accept ? null : fdStr(formData, "reason");
  const status = accept ? ACCEPTED_STATUS : DECLINED_STATUS;
  await prisma.task.update({
    where: { id },
    data: { status, respondedAt: new Date(), declineReason: reason, ...(accept ? { startedAt: new Date() } : {}) },
  });
  if (task.createdById) {
    await prisma.notification.create({
      data: {
        userId: task.createdById, type: "GENERIC",
        title: accept ? "Demande de tâche acceptée" : "Demande de tâche refusée",
        body: accept ? task.title : `${task.title} — ${declineSummary(reason)}`,
        link: `/mon-espace/taches/${id}`,
      },
    }).catch(() => undefined);
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Espace de travail", entityType: "TASK", entityId: id,
    field: "status", newValue: status,
    summary: accept ? `Demande acceptée — « ${task.title} »` : `Demande refusée — « ${task.title} » · ${declineSummary(reason)}`,
  });
  revalidatePath("/mon-espace");
  revalidatePath(`/mon-espace/taches/${id}`);
  return { ok: true };
}

/**
 * VALIDER SON TRAVAIL — le dernier geste de celui qui a fait la chose demandée.
 *
 * Toujours modifiable : on valide en fin de journée, on retrouve une pièce le lendemain. Si
 * valider fermait la porte, la pièce partirait par message et le dossier resterait faux. Le
 * même bouton sert donc à valider puis à mettre à jour, et le demandeur est prévenu à chaque
 * fois — c'est ce qui rend la modification honnête plutôt que discrète.
 */
export async function submitTaskWork(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Tâche introuvable." };
  const task = await prisma.task.findUnique({
    where: { id },
    select: { assignedToId: true, createdById: true, participantIds: true, title: true, status: true, requestedAt: true },
  });
  if (!task) return { ok: false, error: "Tâche introuvable." };
  if (!canDoWork(task, user.id)) return { ok: false, error: "Seule la personne chargée de la tâche valide son travail." };

  const again = task.status === "DONE";
  await prisma.task.update({
    where: { id },
    data: { status: "DONE", completedAt: again ? undefined : new Date(), completionNote: fdStr(formData, "note") },
  });
  if (task.createdById && task.createdById !== user.id) {
    await prisma.notification.create({
      data: {
        userId: task.createdById, type: "GENERIC",
        title: again ? "Travail mis à jour" : "Travail terminé",
        body: task.title, link: `/mon-espace/taches/${id}`,
      },
    }).catch(() => undefined);
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Espace de travail", entityType: "TASK", entityId: id,
    summary: `${again ? "Travail mis à jour" : "Travail validé"} — « ${task.title} »`,
  });
  revalidatePath("/mon-espace");
  revalidatePath(`/mon-espace/taches/${id}`);
  return { ok: true };
}

/** Rouvrir son travail : la validation n'est pas une porte qui claque. */
export async function reopenTaskWork(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Tâche introuvable." };
  const task = await prisma.task.findUnique({
    where: { id },
    select: { assignedToId: true, createdById: true, participantIds: true, title: true, status: true, requestedAt: true },
  });
  if (!task) return { ok: false, error: "Tâche introuvable." };
  if (!canDoWork(task, user.id)) return { ok: false, error: "Non autorisé." };

  await prisma.task.update({ where: { id }, data: { status: "IN_PROGRESS", completedAt: null } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Espace de travail", entityType: "TASK", entityId: id,
    summary: `Travail rouvert — « ${task.title} »`,
  });
  revalidatePath("/mon-espace");
  revalidatePath(`/mon-espace/taches/${id}`);
  return { ok: true };
}
