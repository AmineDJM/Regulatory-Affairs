"use server";

import { revalidatePath } from "next/cache";
import type { Priority, DossierStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
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
