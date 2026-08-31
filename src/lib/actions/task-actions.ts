"use server";

import { revalidatePath } from "next/cache";
import type { Priority, TaskStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  canRespond, canDoWork, canComment, declineSummary,
  ACCEPTED_STATUS, DECLINED_STATUS,
} from "@/lib/tasks/request-flow";
import { createTaskRecord } from "@/lib/tasks/create-core";
import { attachFiles, validateAttachments } from "@/lib/attach-files";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

/**
 * CRÉER UNE TÂCHE — et le destinataire décide de ce que ce geste veut dire.
 *
 * Une seule porte, là où il y en avait deux. « Nouvelle tâche » assignait sans rien demander,
 * « Demander une tâche » ouvrait le circuit : personne ne devinait laquelle prendre, et l'on
 * choisissait presque toujours la première. La tâche atterrissait chez l'autre sans qu'il l'ait
 * acceptée, sans endroit où déposer son travail, et le demandeur n'apprenait jamais si elle
 * serait faite.
 *
 * Désormais : **pour soi, une to-do** — personne n'accepte ce qu'il s'impose. **Pour quelqu'un
 * d'autre, une DEMANDE** — statut `REQUESTED`, notification en **pop-up** (une demande qui attend
 * votre réponse doit interrompre, sinon elle dort dans la cloche derrière quarante autres), et le
 * dossier complet : accepter / refuser, pièces, fil d'échange, validation du travail.
 */
export async function createTask(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "CREATE")) return { ok: false, error: "Non autorisé." };

  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "L'intitulé est obligatoire." };

  const assignedToId = fdStr(formData, "assignedToId") ?? user.id;

  // Les pièces sont contrôlées AVANT toute écriture : créer la tâche puis refuser le fichier
  // laisserait une demande incomplète et un formulaire perdu.
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  const refused = await validateAttachments(files);
  if (refused) return { ok: false, error: refused };

  // Participants (peuvent agir) et lecteurs (voient seulement), fixés à la création. Le
  // responsable et le créateur ont déjà accès : on les retire de ces listes. Un participant
  // l'emporte sur un lecteur si quelqu'un figure dans les deux.
  const clean = (field: string): string[] =>
    [...new Set(formData.getAll(field).map(String).filter(Boolean))]
      .filter((id) => id !== assignedToId && id !== user.id);
  const participantIds = clean("participantIds");
  const readerIds = clean("readerIds").filter((id) => !participantIds.includes(id));

  // Le CŒUR canonique (statut/`requestedAt` selon le mode, notifications pop-up/cloche, audit)
  // est partagé avec l'assistant : `lib/tasks/create-core.ts` — une seule logique du circuit.
  const created = await createTaskRecord(user.id, {
    title,
    description: fdStr(formData, "description"),
    assignedToId,
    participantIds,
    readerIds,
    dueDate: fdDate(formData, "dueDate"),
    priority: (fdStr(formData, "priority") as Priority) ?? "MEDIUM",
    module: fdStr(formData, "module"),
    // Course / livraison : adresse (lien Maps) + durée estimée (détection de retard).
    address: fdStr(formData, "address"),
    expectedMinutes: fdNum(formData, "expectedMinutes"),
  });

  if (files.length > 0) {
    await attachFiles({ files, entityType: "TASK", entityId: created.id, uploadedById: user.id });
  }

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

/**
 * SUPPRIMER UNE TÂCHE — le geste de rangement qui manquait : une to-do créée en double, un
 * intitulé de test, une tâche devenue sans objet restaient à l'écran pour toujours (« terminée »
 * n'est pas « disparue »).
 *
 * QUI : le CRÉATEUR de la tâche (c'est sa saisie) ou le Super Admin. L'assigné d'une tâche
 * créée par un autre ne la supprime pas : sa voie est le refus (avec motif) ou le travail —
 * supprimer la demande d'autrui en silence ferait disparaître ce qu'on attend de lui.
 * Les pièces et le fil de la tâche partent avec elle : ce sont les siens, pas des archives.
 */
export async function deleteTask(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Tâche introuvable." };

  const task = await prisma.task.findUnique({ where: { id }, select: { createdById: true, title: true } });
  if (!task) return { ok: false, error: "Tâche introuvable." };
  if (task.createdById !== user.id && user.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Seul le créateur de la tâche (ou un administrateur) peut la supprimer — refusez-la plutôt si elle vous a été demandée." };
  }

  // Les fichiers du stockage sont libérés APRÈS la suppression en base (best-effort) : un blob
  // orphelin est un déchet, une ligne orpheline serait un bug.
  const docs = await prisma.document.findMany({ where: { entityType: "TASK", entityId: id }, select: { fileKey: true } });
  await prisma.$transaction([
    prisma.document.deleteMany({ where: { entityType: "TASK", entityId: id } }),
    prisma.comment.deleteMany({ where: { entityType: "TASK", entityId: id } }),
    prisma.task.delete({ where: { id } }),
  ]);
  const { deleteFileByKey } = await import("@/lib/storage");
  for (const d of docs) if (d.fileKey) await deleteFileByKey(d.fileKey).catch(() => {});

  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Espace de travail", entityType: "TASK",
    entityId: id, summary: `Tâche « ${task.title} » supprimée`,
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
 * Demande de tâche à un collègue — conservée comme PORTE D'ENTRÉE (un message qu'on transforme
 * en tâche, un appel d'API), mais ce n'est plus un circuit à part : `createTask` reconnaît seul
 * qu'un destinataire différent de soi fait une demande. Deux chemins de code pour la même règle
 * auraient divergé à la première correction.
 *
 * Elle EXIGE un destinataire, là où `createTask` retombe sur soi-même : demander une tâche à
 * personne n'a pas de sens, et se la « demander » à soi non plus.
 */
export async function requestTask(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const assignedToId = fdStr(formData, "assignedToId");
  if (!assignedToId || assignedToId === user.id) return { ok: false, error: "Choisissez le destinataire de la demande." };
  return createTask(undefined, formData);
}

/**
 * ÉCRIRE DANS LE FIL D'UNE TÂCHE.
 *
 * Un commentaire n'est pas une décision : il ne change ni le statut, ni l'échéance, ni qui fait
 * quoi. C'est pourquoi tout le cercle peut en écrire un, lecteurs compris — on les a nommés parce
 * qu'ils connaissent le sujet, et les renvoyer vers la messagerie séparerait l'information de la
 * tâche qu'elle concerne.
 *
 * Le fil ne se modifie ni ne s'efface : c'est la trace de l'échange, pas un brouillon. Une
 * précision qui remplacerait discrètement la question à laquelle l'autre a répondu rendrait le
 * fil illisible trois semaines plus tard.
 */
export async function addTaskComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const body = (formData.get("body") ? String(formData.get("body")) : "").trim().slice(0, 4000);
  if (!id) return { ok: false, error: "Tâche introuvable." };
  if (!body) return { ok: false, error: "Le message est vide." };

  const task = await prisma.task.findUnique({
    where: { id },
    select: { assignedToId: true, createdById: true, participantIds: true, readerIds: true, title: true, status: true, requestedAt: true },
  });
  if (!task) return { ok: false, error: "Tâche introuvable." };
  if (!canComment(task, user.id, hasGlobalView(user.role))) return { ok: false, error: "Non autorisé." };

  await prisma.taskComment.create({ data: { taskId: id, authorId: user.id, body } });

  // Prévenir LE CERCLE, sauf soi-même : un fil dont personne n'apprend l'existence n'est pas un
  // fil, c'est un carnet. Cloche simple — un échange n'interrompt pas, seule une demande le fait.
  const circle = [...new Set([
    task.assignedToId, task.createdById, ...task.participantIds, ...task.readerIds,
  ].filter((x): x is string => Boolean(x) && x !== user.id))];
  if (circle.length) {
    await prisma.notification.createMany({
      data: circle.map((userId) => ({
        userId, type: "GENERIC" as const,
        title: `${user.name} a commenté une tâche`,
        body: `${task.title} — ${body.slice(0, 120)}`,
        link: `/mon-espace/taches/${id}`,
      })),
    }).catch(() => undefined);
  }

  revalidatePath(`/mon-espace/taches/${id}`);
  return { ok: true };
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
