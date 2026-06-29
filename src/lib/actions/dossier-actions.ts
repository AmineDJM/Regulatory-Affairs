"use server";

import { revalidatePath } from "next/cache";
import type { Priority, DossierStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, scopeDossiers, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { createDossierRecord } from "@/lib/dossiers-core";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";

const PATH = "/dossiers";
const STATUSES: DossierStatus[] = ["OPEN", "IN_PROGRESS", "ON_HOLD", "DONE", "ARCHIVED"];

function revalidate(id?: string) {
  revalidatePath(PATH);
  if (id) revalidatePath(`${PATH}/${id}`);
  revalidatePath("/mon-travail");
}

type DossierMembers = { createdById: string | null; assignedToId: string | null; participantIds: string[] };
function isMember(user: SessionUser, d: DossierMembers): boolean {
  return hasGlobalView(user.role) || d.createdById === user.id || d.assignedToId === user.id || d.participantIds.includes(user.id);
}
function isManager(user: SessionUser, d: DossierMembers): boolean {
  return hasGlobalView(user.role) || d.createdById === user.id || d.assignedToId === user.id;
}

export async function createDossier(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "DOSSIERS", "CREATE")) return { ok: false, error: "Non autorisé." };
  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "L'intitulé du dossier est obligatoire." };

  const { id } = await createDossierRecord(
    {
      title,
      description: fdStr(formData, "description"),
      category: fdStr(formData, "category"),
      priority: (fdStr(formData, "priority") as Priority) ?? "MEDIUM",
      assignedToId: fdStr(formData, "assignedToId"),
      participantIds: formData.getAll("participantIds").map(String).filter(Boolean),
      dueDate: fdDate(formData, "dueDate"),
    },
    user.id,
  );
  revalidate(id);
  return { ok: true, id };
}

export async function updateDossierStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status") as DossierStatus | null;
  if (!id || !status || !STATUSES.includes(status)) return { ok: false, error: "Paramètres invalides." };
  const d = await prisma.dossier.findUnique({ where: { id }, select: { createdById: true, assignedToId: true, participantIds: true, reference: true } });
  if (!d) return { ok: false, error: "Dossier introuvable." };
  if (!isManager(user, d)) return { ok: false, error: "Réservé au créateur, au responsable ou à la Direction." };
  await prisma.dossier.update({ where: { id }, data: { status } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Dossiers", entityType: "DOSSIER", entityId: id, summary: `Statut → ${status} (${d.reference})` });
  revalidate(id);
  return { ok: true };
}

export async function assignDossier(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Dossier manquant." };
  const d = await prisma.dossier.findUnique({ where: { id }, select: { createdById: true, assignedToId: true, participantIds: true, reference: true, title: true } });
  if (!d) return { ok: false, error: "Dossier introuvable." };
  if (!isManager(user, d)) return { ok: false, error: "Réservé au créateur, au responsable ou à la Direction." };

  const newAssignee = fdStr(formData, "assignedToId");
  const wantedParts = formData.getAll("participantIds").map(String).filter(Boolean);
  const validParts = wantedParts.length
    ? (await prisma.user.findMany({ where: { id: { in: wantedParts }, isActive: true }, select: { id: true } })).map((u) => u.id).filter((pid) => pid !== newAssignee)
    : [];

  await prisma.dossier.update({ where: { id }, data: { assignedToId: newAssignee, participantIds: validParts } });

  // Notifie les NOUVEAUX membres uniquement.
  const before = new Set([...(d.assignedToId ? [d.assignedToId] : []), ...d.participantIds]);
  const after = new Set([...(newAssignee ? [newAssignee] : []), ...validParts]);
  for (const uid of after) {
    if (!before.has(uid) && uid !== user.id) {
      await notifyUser({ userId: uid, type: "ASSIGNMENT", title: "Dossier qui vous concerne", body: `${d.reference} — ${d.title}`, link: `${PATH}/${id}` });
    }
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Dossiers", entityType: "DOSSIER", entityId: id, summary: `Responsable/participants mis à jour (${d.reference})` });
  revalidate(id);
  return { ok: true };
}

export async function postDossierMessage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const body = fdStr(formData, "body");
  if (!id || !body) return { ok: false, error: "Message vide." };
  const d = await prisma.dossier.findUnique({ where: { id }, select: { createdById: true, assignedToId: true, participantIds: true, reference: true } });
  if (!d) return { ok: false, error: "Dossier introuvable." };
  if (!isMember(user, d)) return { ok: false, error: "Non autorisé." };

  await prisma.dossierMessage.create({ data: { dossierId: id, authorId: user.id, body } });
  await prisma.dossier.update({ where: { id }, data: { updatedAt: new Date() } });

  // Prévient les autres membres du dossier.
  const recipients = new Set<string>([...(d.createdById ? [d.createdById] : []), ...(d.assignedToId ? [d.assignedToId] : []), ...d.participantIds]);
  recipients.delete(user.id);
  for (const uid of recipients) {
    await notifyUser({ userId: uid, type: "GENERIC", title: "Nouveau message sur un dossier", body: d.reference, link: `${PATH}/${id}` });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Dossiers", entityType: "DOSSIER", entityId: id, summary: `Message — ${d.reference}` });
  revalidate(id);
  return { ok: true };
}

/** Liste des dossiers auxquels l'utilisateur peut rattacher quelque chose (non archivés). */
export async function listLinkableDossiers(): Promise<{ id: string; reference: string; title: string }[]> {
  const user = await requireUser();
  if (!userCan(user, "DOSSIERS", "VIEW")) return [];
  return prisma.dossier.findMany({
    where: { AND: [scopeDossiers(user), { status: { not: "ARCHIVED" } }] },
    select: { id: true, reference: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export interface LinkEmailInput {
  dossierId?: string | null;
  newTitle?: string | null;
  from?: string | null;
  subject?: string | null;
  date?: string | null;
  body?: string | null;
}

/**
 * Rattache un e-mail (depuis le Courrier) à un dossier — existant ou créé à la
 * volée. L'e-mail est journalisé dans le fil du dossier (expéditeur, objet, date,
 * corps), pour que tout le suivi du sujet reste au même endroit.
 */
export async function linkEmailToDossier(
  input: LinkEmailInput,
): Promise<{ ok: boolean; error?: string; dossierId?: string; reference?: string }> {
  const user = await requireUser();
  if (!userCan(user, "DOSSIERS", "VIEW")) return { ok: false, error: "Non autorisé." };

  let dossierId = input.dossierId ?? null;
  let reference = "";

  if (!dossierId) {
    const title = (input.newTitle || input.subject || "").trim();
    if (!title) return { ok: false, error: "Donnez un intitulé au dossier." };
    if (!userCan(user, "DOSSIERS", "CREATE")) return { ok: false, error: "Vous ne pouvez pas créer de dossier." };
    const created = await createDossierRecord({ title, category: "E-mail" }, user.id);
    dossierId = created.id;
    reference = created.reference;
  } else {
    const d = await prisma.dossier.findUnique({ where: { id: dossierId }, select: { createdById: true, assignedToId: true, participantIds: true, reference: true } });
    if (!d) return { ok: false, error: "Dossier introuvable." };
    if (!isMember(user, d)) return { ok: false, error: "Vous n'êtes pas membre de ce dossier." };
    reference = d.reference;
  }

  const subject = (input.subject || "(sans objet)").trim();
  const from = (input.from || "—").trim();
  const when = input.date ? new Date(input.date).toLocaleString("fr-FR") : "";
  const body = (input.body || "").trim().slice(0, 6000);
  const message = `📧 E-mail lié\nDe : ${from}\nObjet : ${subject}${when ? `\nReçu le : ${when}` : ""}\n\n${body || "(corps non disponible)"}`;

  await prisma.dossierMessage.create({ data: { dossierId, authorId: user.id, body: message } });
  await prisma.dossier.update({ where: { id: dossierId }, data: { updatedAt: new Date() } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Dossiers", entityType: "DOSSIER", entityId: dossierId, summary: `E-mail lié — ${subject}` });
  revalidate(dossierId);
  return { ok: true, dossierId, reference };
}

/** Ouvre un dossier de suivi à partir d'une tâche (reprend titre, description, responsable…). */
export async function createDossierFromTask(taskId: string): Promise<{ ok: boolean; error?: string; dossierId?: string }> {
  const user = await requireUser();
  if (!userCan(user, "DOSSIERS", "CREATE")) return { ok: false, error: "Vous ne pouvez pas créer de dossier." };
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, description: true, assignedToId: true, createdById: true, priority: true, dueDate: true, module: true },
  });
  if (!t) return { ok: false, error: "Tâche introuvable." };
  if (!(hasGlobalView(user.role) || t.assignedToId === user.id || t.createdById === user.id)) {
    return { ok: false, error: "Non autorisé." };
  }
  const { id } = await createDossierRecord(
    {
      title: t.title,
      description: t.description ? `Ouvert à partir d'une tâche.\n\n${t.description}` : "Ouvert à partir d'une tâche.",
      category: t.module ?? null,
      priority: t.priority,
      assignedToId: t.assignedToId ?? null,
      dueDate: t.dueDate ?? null,
    },
    user.id,
  );
  revalidate(id);
  return { ok: true, dossierId: id };
}

export async function archiveDossier(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Dossier manquant." };
  const d = await prisma.dossier.findUnique({ where: { id }, select: { createdById: true, assignedToId: true, participantIds: true, reference: true } });
  if (!d) return { ok: false, error: "Dossier introuvable." };
  if (!isManager(user, d)) return { ok: false, error: "Réservé au créateur, au responsable ou à la Direction." };
  await prisma.dossier.update({ where: { id }, data: { status: "ARCHIVED" } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Dossiers", entityType: "DOSSIER", entityId: id, summary: `Dossier archivé (${d.reference})` });
  revalidate(id);
  return { ok: true };
}

/** Supprime un message du fil d'un dossier (auteur, responsable du dossier ou admin). */
export async function deleteDossierMessage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Message introuvable." };
  const msg = await prisma.dossierMessage.findUnique({
    where: { id },
    select: { authorId: true, dossierId: true, dossier: { select: { createdById: true, assignedToId: true, participantIds: true } } },
  });
  if (!msg) return { ok: false, error: "Message introuvable." };
  const allowed = msg.authorId === user.id || isManager(user, msg.dossier);
  if (!allowed) return { ok: false, error: "Suppression non autorisée." };
  await prisma.dossierMessage.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Dossiers", entityType: "DOSSIER", entityId: msg.dossierId, summary: "Message de dossier supprimé" });
  revalidate(msg.dossierId);
  return { ok: true };
}
