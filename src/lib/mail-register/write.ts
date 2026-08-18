import type { EntityType, MailDirection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { userCan, type SessionUser } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { companyIdForNew } from "@/lib/company";
import { canAccessEntity } from "@/lib/entity-access";
import type { ActionResult } from "@/lib/actions/types";
import { diffMailEntry, describeMailChanges, MAIL_TRACKED_FIELDS, type MailSnapshot } from "./trace";

/**
 * L'ÉCRITURE DU REGISTRE DES COURRIERS — le cœur, appelé par les DEUX portes.
 *
 * L'écran passe par une action serveur, l'API des agents par le registre d'opérations. Si chacun
 * réécrivait la mise à jour, les deux divergeraient : un contrôle ajouté d'un côté manquerait de
 * l'autre, et l'on ne s'en apercevrait qu'après. Il n'y a donc qu'UNE implémentation, et elle
 * reçoit explicitement l'utilisateur au nom de qui l'on agit — jamais la session courante.
 *
 * Les mêmes gardes s'appliquent des deux côtés : droit de module, périmètre d'entité, journal
 * champ par champ. Un agent n'a aucun raccourci ; il a juste une autre porte.
 */

export interface MailFields {
  title: string;
  reference?: string | null;
  direction?: MailDirection;
  sender?: string | null;
  recipient?: string | null;
  sentAt?: Date | null;
  receivedAt?: Date | null;
  acknowledgedAt?: Date | null;
  carrier?: string | null;
  notes?: string | null;
  sourceType?: EntityType | null;
  sourceId?: string | null;
  /**
   * Nœud du Drive RÉFÉRENCÉ par le courrier — jamais recopié. Le fichier continue de s'y
   * versionner et de s'y renommer, et le courrier en montre toujours la version courante.
   * Vérifié par l'appelant (droit de lecture, nœud vivant) : ce module écrit, il n'arbitre pas
   * les accès au Drive.
   */
  driveNodeId?: string | null;
}

/** Les colonnes suivies, lues telles quelles pour la comparaison avant/après. */
export const TRACKED_SELECT = Object.fromEntries(
  Object.keys(MAIL_TRACKED_FIELDS).map((f) => [f, true]),
) as Record<keyof typeof MAIL_TRACKED_FIELDS, true>;

/**
 * Écrit au journal une ligne PAR CHAMP touché (ancienne → nouvelle valeur), plus la synthèse.
 * Les deux sont rattachées au courrier : sa fiche affiche son propre historique sans fouiller le
 * journal global.
 */
export async function traceMailChanges(
  actorId: string, id: string, title: string, before: MailSnapshot, after: MailSnapshot,
) {
  const changes = diffMailEntry(before, after);
  if (changes.length === 0) return changes;
  const summary = describeMailChanges(title, changes);
  for (const c of changes) {
    await recordAudit({
      actorId, action: "UPDATE", module: "Courriers",
      entityType: "MAIL_ENTRY", entityId: id,
      field: c.label, oldValue: c.before, newValue: c.after,
      summary,
    });
  }
  return changes;
}

/** Enregistrer un courrier. */
export async function createMailEntryFor(user: SessionUser, f: MailFields): Promise<ActionResult> {
  if (!userCan(user, "MAIL_REGISTER", "CREATE")) return { ok: false, error: "Non autorisé." };
  const title = (f.title ?? "").trim();
  if (!title) return { ok: false, error: "L'objet du courrier est obligatoire." };

  const created = await prisma.mailEntry.create({
    data: {
      title,
      reference: f.reference ?? null,
      direction: f.direction ?? "OUTGOING",
      sender: f.sender ?? null,
      recipient: f.recipient ?? null,
      sentAt: f.sentAt ?? null,
      receivedAt: f.receivedAt ?? null,
      acknowledgedAt: f.acknowledgedAt ?? null,
      carrier: f.carrier ?? null,
      notes: f.notes ?? null,
      driveNodeId: f.driveNodeId ?? null,
      companyId: await companyIdForNew(user.id),
      sourceType: f.sourceType ?? null,
      sourceId: f.sourceId ?? null,
      createdById: user.id, updatedById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Courriers",
    entityType: "MAIL_ENTRY", entityId: created.id,
    summary: `Courrier ${(f.direction ?? "OUTGOING") === "INCOMING" ? "entrant" : "sortant"} « ${title} »`,
  });
  return { ok: true, id: created.id };
}

/** Modifier un courrier — chaque champ touché part au journal avec ses deux valeurs. */
export async function updateMailEntryFor(user: SessionUser, id: string, f: MailFields): Promise<ActionResult> {
  if (!userCan(user, "MAIL_REGISTER", "UPDATE")) return { ok: false, error: "Non autorisé." };
  if (!id) return { ok: false, error: "Courrier introuvable." };
  if (!(await canAccessEntity(user, "MAIL_ENTRY", id, "UPDATE"))) {
    return { ok: false, error: "Ce courrier n'est pas dans votre périmètre." };
  }
  const title = (f.title ?? "").trim();
  if (!title) return { ok: false, error: "L'objet du courrier est obligatoire." };

  const before = await prisma.mailEntry.findUnique({ where: { id }, select: TRACKED_SELECT });
  if (!before) return { ok: false, error: "Courrier introuvable." };

  const after = {
    title,
    reference: f.reference ?? null,
    direction: f.direction ?? "OUTGOING",
    sender: f.sender ?? null,
    recipient: f.recipient ?? null,
    sentAt: f.sentAt ?? null,
    receivedAt: f.receivedAt ?? null,
    acknowledgedAt: f.acknowledgedAt ?? null,
    carrier: f.carrier ?? null,
    notes: f.notes ?? null,
  };
  await prisma.mailEntry.update({ where: { id }, data: { ...after, updatedById: user.id } });
  const changes = await traceMailChanges(user.id, id, title, before, after);
  return {
    ok: true,
    message: changes.length === 0 ? "Aucune modification." : `${changes.length} champ(s) modifié(s) — inscrit au journal.`,
  };
}

/**
 * Poser (ou effacer) une date d'arrivée / d'accusé.
 *
 * C'est le geste le plus fréquent du registre, et celui par lequel une date se CORRIGE : il est
 * journalisé exactement comme le formulaire complet.
 */
export async function setMailDateFor(
  user: SessionUser,
  input: { id: string; field: "receivedAt" | "acknowledgedAt"; value: Date | null },
): Promise<ActionResult> {
  if (!userCan(user, "MAIL_REGISTER", "UPDATE")) return { ok: false, error: "Non autorisé." };
  if (input.field !== "receivedAt" && input.field !== "acknowledgedAt") {
    return { ok: false, error: "Champ inconnu." };
  }
  if (!(await canAccessEntity(user, "MAIL_ENTRY", input.id, "UPDATE"))) {
    return { ok: false, error: "Ce courrier n'est pas dans votre périmètre." };
  }

  const before = await prisma.mailEntry.findUnique({ where: { id: input.id }, select: TRACKED_SELECT });
  if (!before) return { ok: false, error: "Courrier introuvable." };

  await prisma.mailEntry.update({
    where: { id: input.id },
    data: { [input.field]: input.value, updatedById: user.id },
  });
  await traceMailChanges(user.id, input.id, before.title, before, { [input.field]: input.value });
  return { ok: true };
}
