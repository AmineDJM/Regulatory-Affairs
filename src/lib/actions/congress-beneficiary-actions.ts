"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma, type EntityType } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * Personnes prises en charge d'un congrès (national/international) + demande de
 * leurs pièces d'identité. La liste est stockée en JSON sur le congrès ; les
 * pièces d'identité sont des Documents (catégorie ID_DOCUMENT) du congrès.
 */
type Kind = "INTERNATIONAL" | "NATIONAL";
interface Benef { id: string; name: string; role?: string }

function entityTypeOf(kind: Kind): EntityType {
  return kind === "INTERNATIONAL" ? "CONGRESS_INTERNATIONAL" : "CONGRESS_NATIONAL";
}
function pathOf(kind: Kind, id: string): string {
  return `/${kind === "INTERNATIONAL" ? "congress-international" : "congress-national"}/${id}`;
}
async function loadCongress(kind: Kind, id: string) {
  const select = { id: true, name: true, beneficiaries: true, requesterId: true } as const;
  return kind === "INTERNATIONAL"
    ? prisma.congressInternational.findUnique({ where: { id }, select })
    : prisma.congressNational.findUnique({ where: { id }, select });
}
async function saveBeneficiaries(kind: Kind, id: string, list: Benef[]) {
  const data = { beneficiaries: list as unknown as Prisma.InputJsonValue };
  if (kind === "INTERNATIONAL") await prisma.congressInternational.update({ where: { id }, data });
  else await prisma.congressNational.update({ where: { id }, data });
}
function asList(value: unknown): Benef[] {
  return Array.isArray(value) ? (value as Benef[]) : [];
}

export async function addCongressBeneficiary(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const kind = fdStr(formData, "kind") as Kind;
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Le nom de la personne est obligatoire." };
  const et = entityTypeOf(kind);
  if (!(await canAccessEntity(user, et, id, "UPDATE"))) return { ok: false, error: "Modification non autorisée." };
  const c = await loadCongress(kind, id);
  if (!c) return { ok: false, error: "Congrès introuvable." };

  const list = asList(c.beneficiaries);
  list.push({ id: randomUUID(), name, role: fdStr(formData, "role") ?? undefined });
  await saveBeneficiaries(kind, id, list);
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Congrès", entityType: et, entityId: id, summary: `Personne prise en charge ajoutée — ${name}` });
  revalidatePath(pathOf(kind, id));
  return { ok: true };
}

export async function removeCongressBeneficiary(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const kind = fdStr(formData, "kind") as Kind;
  const id = fdStr(formData, "id");
  const benefId = fdStr(formData, "benefId");
  if (!id || !benefId) return { ok: false, error: "Identifiant manquant." };
  const et = entityTypeOf(kind);
  if (!(await canAccessEntity(user, et, id, "UPDATE"))) return { ok: false, error: "Modification non autorisée." };
  const c = await loadCongress(kind, id);
  if (!c) return { ok: false, error: "Congrès introuvable." };

  const list = asList(c.beneficiaries).filter((b) => b.id !== benefId);
  await saveBeneficiaries(kind, id, list);
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Congrès", entityType: et, entityId: id, summary: "Personne prise en charge retirée" });
  revalidatePath(pathOf(kind, id));
  return { ok: true };
}

/** Demande au demandeur de joindre les pièces d'identité des personnes prises en charge. */
export async function requestBeneficiaryIds(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const kind = fdStr(formData, "kind") as Kind;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const et = entityTypeOf(kind);
  if (!(await canAccessEntity(user, et, id, "UPDATE"))) return { ok: false, error: "Non autorisé." };
  const c = await loadCongress(kind, id);
  if (!c) return { ok: false, error: "Congrès introuvable." };
  if (c.requesterId) {
    await notifyUser({ userId: c.requesterId, type: "ASSIGNMENT", title: "Pièces d'identité demandées", body: `${c.name} — merci de joindre les pièces d'identité des personnes prises en charge.`, link: pathOf(kind, id) });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Congrès", entityType: et, entityId: id, summary: "Pièces d'identité demandées" });
  revalidatePath(pathOf(kind, id));
  return { ok: true };
}
