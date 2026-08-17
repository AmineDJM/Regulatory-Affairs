"use server";

import { revalidatePath } from "next/cache";
import type { EntityType, MailDirection } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { companyIdForNew } from "@/lib/company";
import { canAccessEntity } from "@/lib/entity-access";
import { deleteFileByKey } from "@/lib/storage";
import { diffMailEntry, describeMailChanges, MAIL_TRACKED_FIELDS, type MailSnapshot } from "@/lib/mail-register/trace";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";

/**
 * LE CARNET DE COURRIERS — entrants et sortants.
 *
 * Les quatre dates racontent le trajet du pli et se remplissent à des moments différents : on
 * POSTE (avec l'heure — deux courriers du même jour ne partent pas dans le même ordre), le pli
 * ARRIVE, puis on récupère l'ACCUSÉ. Aucune n'est obligatoire : un courrier qu'on vient de
 * déposer n'a encore ni arrivée ni accusé, et exiger une date inventerait une information.
 *
 * TOUT EST TRACÉ, et pas d'un « courrier modifié » qui ne dit rien : chaque champ touché part au
 * journal avec son ancienne et sa nouvelle valeur (voir `src/lib/mail-register/trace.ts`). C'est
 * un registre qu'on oppose — « le pli est parti le 12 » — donc une correction après coup doit
 * rester lisible, avec son auteur et son heure. Les pièces jointes passent par la table
 * `Document` commune, qui journalise déjà téléversement, renommage et suppression.
 */

const parseDirection = (v: string | null): MailDirection => (v === "INCOMING" ? "INCOMING" : "OUTGOING");

/** `datetime-local` renvoie « 2026-08-17T14:30 » — on garde l'heure, contrairement à `fdDate`. */
function fdDateTime(formData: FormData, key: string): Date | null {
  const raw = fdStr(formData, key);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readFields(formData: FormData) {
  return {
    title: fdStr(formData, "title"),
    reference: fdStr(formData, "reference"),
    direction: parseDirection(fdStr(formData, "direction")),
    sender: fdStr(formData, "sender"),
    recipient: fdStr(formData, "recipient"),
    sentAt: fdDateTime(formData, "sentAt"),
    receivedAt: fdDate(formData, "receivedAt"),
    acknowledgedAt: fdDate(formData, "acknowledgedAt"),
    carrier: fdStr(formData, "carrier"),
    notes: fdStr(formData, "notes"),
  };
}

/** Les colonnes suivies, lues telles quelles pour la comparaison avant/après. */
const TRACKED_SELECT = Object.fromEntries(
  Object.keys(MAIL_TRACKED_FIELDS).map((f) => [f, true]),
) as Record<keyof typeof MAIL_TRACKED_FIELDS, true>;

/**
 * Écrit au journal une ligne PAR CHAMP touché (ancienne → nouvelle valeur), plus la ligne de
 * synthèse qui les résume. Les deux sont rattachées au courrier : la fiche peut donc afficher
 * son propre historique sans fouiller le journal global.
 */
async function traceMailChanges(actorId: string, id: string, title: string, before: MailSnapshot, after: MailSnapshot) {
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

export async function createMailEntry(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MAIL_REGISTER", "CREATE")) return { ok: false, error: "Non autorisé." };

  const { title, ...f } = readFields(formData);
  if (!title) return { ok: false, error: "L'objet du courrier est obligatoire." };

  const created = await prisma.mailEntry.create({
    data: {
      ...f, title,
      companyId: await companyIdForNew(user.id),
      sourceType: (fdStr(formData, "sourceType") as EntityType | null) ?? null,
      sourceId: fdStr(formData, "sourceId"),
      createdById: user.id, updatedById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Courriers",
    entityType: "MAIL_ENTRY", entityId: created.id,
    summary: `Courrier ${f.direction === "INCOMING" ? "entrant" : "sortant"} « ${title} »`,
  });
  revalidatePath("/courriers");
  return { ok: true, id: created.id };
}

/**
 * MODIFIER UN COURRIER — depuis sa fiche.
 *
 * L'identifiant est LIÉ côté serveur (`editMailEntry.bind(null, id)`), jamais lu dans le
 * formulaire : un champ caché se réécrit dans le navigateur, et l'on modifierait alors le
 * courrier de quelqu'un d'autre. L'accès est revérifié ligne par ligne — le cloisonnement par
 * entité vaut ici comme partout.
 */
export async function editMailEntry(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MAIL_REGISTER", "UPDATE")) return { ok: false, error: "Non autorisé." };
  if (!id) return { ok: false, error: "Courrier introuvable." };
  if (!(await canAccessEntity(user, "MAIL_ENTRY", id, "UPDATE"))) {
    return { ok: false, error: "Ce courrier n'est pas dans votre périmètre." };
  }

  const before = await prisma.mailEntry.findUnique({ where: { id }, select: TRACKED_SELECT });
  if (!before) return { ok: false, error: "Courrier introuvable." };

  const { title, ...f } = readFields(formData);
  if (!title) return { ok: false, error: "L'objet du courrier est obligatoire." };
  const after = { ...f, title };

  await prisma.mailEntry.update({ where: { id }, data: { ...after, updatedById: user.id } });
  const changes = await traceMailChanges(user.id, id, title, before, after);

  revalidatePath("/courriers");
  revalidatePath(`/courriers/${id}`);
  return {
    ok: true,
    message: changes.length === 0 ? "Aucune modification." : `${changes.length} champ(s) modifié(s) — inscrit au journal.`,
  };
}

/**
 * POSER UNE DATE, depuis la ligne du tableau.
 *
 * L'arrivée et l'accusé se constatent au fil de l'eau, souvent des jours après la saisie : les
 * poser doit tenir en un clic dans la liste, pas en un formulaire complet à rouvrir. Ce raccourci
 * est journalisé comme le formulaire complet — c'est justement par là que se corrige une date, et
 * une correction non tracée vaut une date inventée.
 */
export async function setMailDate(input: {
  id: string; field: "receivedAt" | "acknowledgedAt"; value: string | null;
}): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MAIL_REGISTER", "UPDATE")) return { ok: false, error: "Non autorisé." };
  if (input.field !== "receivedAt" && input.field !== "acknowledgedAt") {
    return { ok: false, error: "Champ inconnu." };
  }
  if (!(await canAccessEntity(user, "MAIL_ENTRY", input.id, "UPDATE"))) {
    return { ok: false, error: "Ce courrier n'est pas dans votre périmètre." };
  }
  const date = input.value ? new Date(input.value) : null;
  if (input.value && Number.isNaN(date!.getTime())) return { ok: false, error: "Date invalide." };

  const before = await prisma.mailEntry.findUnique({ where: { id: input.id }, select: TRACKED_SELECT });
  if (!before) return { ok: false, error: "Courrier introuvable." };

  await prisma.mailEntry.update({
    where: { id: input.id },
    data: { [input.field]: date, updatedById: user.id },
  });
  await traceMailChanges(user.id, input.id, before.title, before, { [input.field]: date });

  revalidatePath("/courriers");
  revalidatePath(`/courriers/${input.id}`);
  return { ok: true };
}

export async function deleteMailEntry(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MAIL_REGISTER", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Courrier introuvable." };
  if (!(await canAccessEntity(user, "MAIL_ENTRY", id, "DELETE"))) {
    return { ok: false, error: "Ce courrier n'est pas dans votre périmètre." };
  }
  const entry = await prisma.mailEntry.findUnique({ where: { id }, select: { title: true } });
  if (!entry) return { ok: false, error: "Courrier introuvable." };

  // Les pièces jointes rattachées ne seraient plus atteignables par aucun écran : on les
  // détache avec le courrier, et on DIT combien il y en avait. Le fichier lui-même n'est pas
  // perdu — tout téléversement est répliqué dans le Drive de celui qui l'a importé — mais le
  // journal doit garder trace de ce qui a disparu de la fiche.
  const attached = await prisma.document.findMany({
    where: { entityType: "MAIL_ENTRY", entityId: id }, select: { id: true, fileKey: true },
  });
  await prisma.document.deleteMany({ where: { entityType: "MAIL_ENTRY", entityId: id } });
  // Les octets se libèrent avec la fiche, sans quoi le stockage garderait à vie des pièces que
  // plus aucun écran ne montre.
  for (const d of attached) if (d.fileKey) await deleteFileByKey(d.fileKey);
  await prisma.mailEntry.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Courriers",
    entityType: "MAIL_ENTRY", entityId: id,
    summary: `Courrier « ${entry.title} » supprimé${attached.length > 0 ? ` — ${attached.length} pièce(s) jointe(s)` : ""}`,
  });
  revalidatePath("/courriers");
  return { ok: true };
}
