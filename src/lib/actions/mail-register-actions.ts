"use server";

import { revalidatePath } from "next/cache";
import type { EntityType, MailDirection } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { companyIdForNew } from "@/lib/company";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";

/**
 * LE CARNET DE COURRIERS — entrants et sortants.
 *
 * Les quatre dates racontent le trajet du pli et se remplissent à des moments différents : on
 * POSTE (avec l'heure — deux courriers du même jour ne partent pas dans le même ordre), le pli
 * ARRIVE, puis on récupère l'ACCUSÉ. Aucune n'est obligatoire : un courrier qu'on vient de
 * déposer n'a encore ni arrivée ni accusé, et exiger une date inventerait une information.
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
    summary: `Courrier ${f.direction === "INCOMING" ? "entrant" : "sortant"} « ${title} »`,
  });
  revalidatePath("/courriers");
  return { ok: true, id: created.id };
}

export async function updateMailEntry(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MAIL_REGISTER", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Courrier introuvable." };

  const { title, ...f } = readFields(formData);
  if (!title) return { ok: false, error: "L'objet du courrier est obligatoire." };

  await prisma.mailEntry.update({ where: { id }, data: { ...f, title, updatedById: user.id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Courriers",
    summary: `Courrier « ${title} » mis à jour`,
  });
  revalidatePath("/courriers");
  revalidatePath(`/courriers/${id}`);
  return { ok: true };
}

/**
 * POSER UNE DATE, depuis la ligne du tableau.
 *
 * L'arrivée et l'accusé se constatent au fil de l'eau, souvent des jours après la saisie : les
 * poser doit tenir en un clic dans la liste, pas en un formulaire complet à rouvrir.
 */
export async function setMailDate(input: {
  id: string; field: "receivedAt" | "acknowledgedAt"; value: string | null;
}): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MAIL_REGISTER", "UPDATE")) return { ok: false, error: "Non autorisé." };
  if (input.field !== "receivedAt" && input.field !== "acknowledgedAt") {
    return { ok: false, error: "Champ inconnu." };
  }
  const date = input.value ? new Date(input.value) : null;
  if (input.value && Number.isNaN(date!.getTime())) return { ok: false, error: "Date invalide." };

  await prisma.mailEntry.update({
    where: { id: input.id },
    data: { [input.field]: date, updatedById: user.id },
  });
  revalidatePath("/courriers");
  return { ok: true };
}

export async function deleteMailEntry(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MAIL_REGISTER", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Courrier introuvable." };
  const entry = await prisma.mailEntry.findUnique({ where: { id }, select: { title: true } });
  if (!entry) return { ok: false, error: "Courrier introuvable." };

  await prisma.mailEntry.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Courriers",
    summary: `Courrier « ${entry.title} » supprimé`,
  });
  revalidatePath("/courriers");
  return { ok: true };
}
