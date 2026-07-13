"use server";

import { revalidatePath } from "next/cache";
import type { DirectiveStatus, Priority, UserRole } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { buildRef } from "@/lib/refs";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";

const PATH = "/directives";
const STATUSES: DirectiveStatus[] = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "DONE", "ARCHIVED"];

/** Seule la Direction (CREATE) — ou un admin global — émet/pilote les directives. */
function canManage(user: SessionUser): boolean {
  return hasGlobalView(user.role) || userCan(user, "DIRECTIVES", "CREATE");
}

type DirectiveLike = { targetUserId: string | null; targetRole: UserRole | null; fromId: string | null };
/** Destinataire (nommé ou par rôle), émetteur, ou Direction/admin : peut suivre + échanger. */
function canParticipate(user: SessionUser, d: DirectiveLike): boolean {
  return canManage(user) || d.fromId === user.id || d.targetUserId === user.id || d.targetRole === user.role;
}

function revalidate(id?: string) {
  revalidatePath(PATH);
  if (id) revalidatePath(`${PATH}/${id}`);
  revalidatePath("/mon-travail");
}

async function nextRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.directive.findMany({ where: { reference: { startsWith: `DIR-${year}-` } }, select: { reference: true } });
  return buildRef("DIR", year, refs.map((r) => r.reference));
}

// ───────────── Création (Direction) ─────────────

export async function createDirective(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Seule la Direction peut émettre une directive." };

  const title = fdStr(formData, "title");
  const body = fdStr(formData, "body");
  if (!title || !body) return { ok: false, error: "Le titre et le contenu sont obligatoires." };

  const targetUserId = fdStr(formData, "targetUserId");
  const targetRole = fdStr(formData, "targetRole") as UserRole | null;
  if (!targetUserId && !targetRole) return { ok: false, error: "Choisissez un destinataire (une personne ou un rôle)." };

  const reference = await nextRef();
  const created = await prisma.directive.create({
    data: {
      reference, title, body,
      priority: (fdStr(formData, "priority") as Priority) ?? "MEDIUM",
      dueDate: fdDate(formData, "dueDate"),
      targetUserId: targetUserId ?? null,
      targetRole: targetUserId ? null : targetRole, // une personne précise prime sur le rôle
      fromId: user.id,
    },
  });

  if (targetUserId) await notifyUser({ userId: targetUserId, type: "ASSIGNMENT", title: "Nouvelle directive", body: `${reference} — ${title}`, link: `${PATH}/${created.id}` });
  else if (targetRole) await notifyRoles([targetRole], { type: "ASSIGNMENT", title: "Nouvelle directive", body: `${reference} — ${title}`, link: `${PATH}/${created.id}` });

  await recordAudit({ actorId: user.id, action: "CREATE", module: "Directives", entityType: "DIRECTIVE", entityId: created.id, summary: `Directive ${reference} — ${title}` });
  revalidate(created.id);
  return { ok: true, id: created.id };
}

// ───────────── Changement de statut (destinataire ou Direction) ─────────────

export async function updateDirectiveStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status") as DirectiveStatus | null;
  if (!id || !status || !STATUSES.includes(status)) return { ok: false, error: "Statut invalide." };

  const d = await prisma.directive.findUnique({ where: { id } });
  if (!d) return { ok: false, error: "Directive introuvable." };
  if (!canParticipate(user, d)) return { ok: false, error: "Non autorisé." };
  // L'archivage est réservé à la Direction.
  if (status === "ARCHIVED" && !canManage(user)) return { ok: false, error: "Seule la Direction peut archiver." };

  await prisma.directive.update({
    where: { id },
    data: {
      status,
      ...(status === "ACKNOWLEDGED" && !d.acknowledgedAt ? { acknowledgedAt: new Date(), acknowledgedById: user.id } : {}),
    },
  });
  // Informe l'émetteur de l'avancement (sauf si c'est lui qui agit).
  if (d.fromId && d.fromId !== user.id) {
    await notifyUser({ userId: d.fromId, type: "GENERIC", title: "Directive — avancement", body: `${d.reference} — ${d.title}`, link: `${PATH}/${id}` });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Directives", entityType: "DIRECTIVE", entityId: id, summary: `Statut → ${status} (${d.reference})` });
  revalidate(id);
  return { ok: true };
}

export async function archiveDirective(formData: FormData): Promise<ActionResult> {
  const fd = new FormData();
  fd.set("id", fdStr(formData, "id") ?? "");
  fd.set("status", "ARCHIVED");
  return updateDirectiveStatus(fd);
}

// ───────────── Fil d'échange (retour des équipes ↔ Direction) ─────────────

export async function postDirectiveMessage(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const body = fdStr(formData, "body");
  if (!id || !body) return { ok: false, error: "Message vide." };

  const d = await prisma.directive.findUnique({ where: { id } });
  if (!d) return { ok: false, error: "Directive introuvable." };
  if (!canParticipate(user, d)) return { ok: false, error: "Non autorisé." };

  await prisma.directiveMessage.create({ data: { directiveId: id, authorId: user.id, body } });

  // Notifie l'autre partie : si l'émetteur écrit → le destinataire nommé ; sinon → l'émetteur.
  if (user.id === d.fromId) {
    if (d.targetUserId) await notifyUser({ userId: d.targetUserId, type: "GENERIC", title: "Directive — message", body: `${d.reference} — ${d.title}`, link: `${PATH}/${id}` });
    else if (d.targetRole) await notifyRoles([d.targetRole], { type: "GENERIC", title: "Directive — message", body: `${d.reference} — ${d.title}`, link: `${PATH}/${id}` });
  } else if (d.fromId) {
    await notifyUser({ userId: d.fromId, type: "GENERIC", title: "Directive — réponse", body: `${d.reference} — ${d.title}`, link: `${PATH}/${id}` });
  }
  revalidate(id);
  return { ok: true };
}
