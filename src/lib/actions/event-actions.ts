"use server";

import { revalidatePath } from "next/cache";
import {
  EventType, EventScope, EventFormat, EventStatus, ParticipantRole, RegistrationStatus,
} from "@prisma/client";
import type { CongressRequestStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, anyRoleFilter } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { moneyEntityOf } from "@/lib/company";
import { recordAudit } from "@/lib/audit";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { adProInit, PRODUCT_MANAGER_ROLES } from "@/lib/workflow/origin";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

const inEnum = <T extends Record<string, string>>(e: T, v: string | null, fallback: T[keyof T]): T[keyof T] =>
  v && (Object.values(e) as string[]).includes(v) ? (v as T[keyof T]) : fallback;

// ─────────────────────────── Événements ───────────────────────────

export async function createEvent(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "CREATE")) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom de l'événement est obligatoire." };
  const created = await prisma.event.create({
    data: {
      name,
      // Entité : la portée en cours, à défaut la société d'appartenance du créateur.
      // L'ENTITÉ QUI PAIERA suit la PERSONNE (sa fiche employé, à défaut son
      // département), pas la portée sélectionnée dans la barre : un délégué de Pharmagène qui
      // consulte Adventum ne doit pas imputer sa demande à Adventum. La Direction corrige en
      // validant, au seul moment où quelqu'un a le dossier entier sous les yeux.
      companyId: await moneyEntityOf(user.id),
      type: inEnum(EventType, fdStr(formData, "type"), "CONGRESS"),
      scope: inEnum(EventScope, fdStr(formData, "scope"), "NATIONAL"),
      format: inEnum(EventFormat, fdStr(formData, "format"), "PRESENTIAL"),
      status: inEnum(EventStatus, fdStr(formData, "status"), "DRAFT"),
      startDate: fdDate(formData, "startDate"),
      endDate: fdDate(formData, "endDate"),
      location: fdStr(formData, "location"),
      city: fdStr(formData, "city"),
      country: fdStr(formData, "country"),
      specialty: fdStr(formData, "specialty"),
      products: fdStr(formData, "products"),
      description: fdStr(formData, "description"),
      capacity: fdNum(formData, "capacity") ? Math.round(fdNum(formData, "capacity")!) : null,
      estimatedBudget: fdNum(formData, "estimatedBudget"),
      meetingLink: fdStr(formData, "meetingLink"),
      responsibleId: fdStr(formData, "responsibleId"),
      createdById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Events", summary: `Événement « ${name} »` });
  revalidatePath("/events");
  return { ok: true, id: created.id };
}

export async function updateEvent(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Paramètres manquants." };
  await prisma.event.update({
    where: { id },
    data: {
      name,
      type: inEnum(EventType, fdStr(formData, "type"), "CONGRESS"),
      scope: inEnum(EventScope, fdStr(formData, "scope"), "NATIONAL"),
      format: inEnum(EventFormat, fdStr(formData, "format"), "PRESENTIAL"),
      status: inEnum(EventStatus, fdStr(formData, "status"), "DRAFT"),
      startDate: fdDate(formData, "startDate"),
      endDate: fdDate(formData, "endDate"),
      location: fdStr(formData, "location"),
      city: fdStr(formData, "city"),
      country: fdStr(formData, "country"),
      specialty: fdStr(formData, "specialty"),
      products: fdStr(formData, "products"),
      description: fdStr(formData, "description"),
      capacity: fdNum(formData, "capacity") ? Math.round(fdNum(formData, "capacity")!) : null,
      estimatedBudget: fdNum(formData, "estimatedBudget"),
      meetingLink: fdStr(formData, "meetingLink"),
      responsibleId: fdStr(formData, "responsibleId"),
    },
  });
  revalidatePath(`/events/${id}`);
  return { ok: true };
}

export async function deleteEvent(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  await prisma.event.delete({ where: { id } });
  revalidatePath("/events");
  return { ok: true };
}

// ──────────────── Demande de prise en charge (circuit de financement) ────────────────

/**
 * Soumet un événement existant au **circuit de prise en charge**, identique à celui
 * des congrès : la demande (souvent d'un délégué) part vers le **National Sales**
 * (approbation préliminaire + désignation du chef de produit) → analyse du chef de
 * produit → **Direction** (décision définitive + budget accordé) → **information
 * médicale** (PRIM). Les étapes suivantes sont gérées par `congress-request-actions`
 * avec `type=EVENT` (mêmes composants UI).
 */
export async function submitEventForApproval(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "CREATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const ev = await prisma.event.findUnique({ where: { id }, select: { id: true, name: true, requestStatus: true, requesterId: true } });
  if (!ev) return { ok: false, error: "Événement introuvable." };
  if (ev.requestStatus) return { ok: false, error: "Une demande de prise en charge est déjà en cours pour cet événement." };

  // Routage intelligent : on saute les étapes d'approbation au niveau/en dessous du créateur.
  const pmId = fdStr(formData, "productManagerId");
  if (pmId) {
    const okPm = await prisma.user.count({ where: { id: pmId, isActive: true, ...anyRoleFilter(PRODUCT_MANAGER_ROLES) } });
    if (!okPm) return { ok: false, error: "Le chef de produit sélectionné est introuvable." };
  }
  // La Direction, elle, CHOISIT : trancher tout de suite, ou demander d'abord l'avis d'un chef
  // de produit. `adProInit` ignore ce drapeau pour les autres rangs — le choix ne se vole pas.
  const init = adProInit(user, pmId, { viaProductManager: fdStr(formData, "viaProductManager") === "1" });
  const now = new Date();

  await prisma.event.update({
    where: { id },
    data: {
      requestStatus: init.status as CongressRequestStatus,
      requesterId: ev.requesterId ?? user.id,
      status: "AWAITING_VALIDATION",
      ...(init.productManagerId ? { productManagerId: init.productManagerId } : {}),
      ...(init.preliminaryBySelf ? { preliminaryById: user.id, preliminaryAt: now } : {}),
    },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Events", entityType: "EVENT", entityId: id, summary: `Demande de prise en charge — ${ev.name}` });
  const link = `/events/${id}`;
  if (init.stage === "ANALYSIS" && init.productManagerId) {
    await notifyUser({ userId: init.productManagerId, type: "ASSIGNMENT", title: "Événement à analyser", body: ev.name, link });
  } else if (init.stage === "FINAL") {
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "VALIDATION_REQUIRED", title: "Événement — validation définitive", body: ev.name, link });
  } else {
    await notifyRoles(["NATIONAL_SALES", "SUPER_ADMIN"], { type: "VALIDATION_REQUIRED", title: "Événement — à attribuer (National Sales)", body: ev.name, link });
  }
  revalidatePath(`/events/${id}`);
  revalidatePath("/events");
  return { ok: true };
}

// ─────────────────────────── Inscriptions ───────────────────────────

/** Comptage des places occupées (hors annulés/refusés). */
async function takenSeats(eventId: string): Promise<number> {
  return prisma.eventRegistration.count({
    where: { eventId, status: { in: ["REGISTERED", "CONFIRMED", "PRESENT", "PENDING"] } },
  });
}

/** Inscription publique (formulaire partageable, sans compte). */
export async function publicRegister(formData: FormData): Promise<ActionResult> {
  const eventId = fdStr(formData, "eventId");
  const firstName = fdStr(formData, "firstName");
  const lastName = fdStr(formData, "lastName");
  if (!eventId || !firstName || !lastName) return { ok: false, error: "Nom et prénom obligatoires." };
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { status: true, capacity: true } });
  if (!event) return { ok: false, error: "Événement introuvable." };
  if (event.status !== "REGISTRATION_OPEN") return { ok: false, error: "Les inscriptions ne sont pas ouvertes." };

  // Liste d'attente si capacité atteinte.
  let status: RegistrationStatus = "REGISTERED";
  if (event.capacity && (await takenSeats(eventId)) >= event.capacity) status = "PENDING";

  const reg = await prisma.eventRegistration.create({
    data: {
      eventId, firstName, lastName,
      specialty: fdStr(formData, "specialty"), institution: fdStr(formData, "institution"),
      city: fdStr(formData, "city"), email: fdStr(formData, "email"), phone: fdStr(formData, "phone"),
      role: inEnum(ParticipantRole, fdStr(formData, "role"), "DOCTOR"),
      comment: fdStr(formData, "comment"), status, source: "public",
    },
    select: { id: true, qrToken: true },
  });
  revalidatePath(`/events/${eventId}`);
  return { ok: true, id: reg.qrToken };
}

/** Ajout d'un participant en interne (staff). */
export async function addRegistration(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const eventId = fdStr(formData, "eventId");
  const firstName = fdStr(formData, "firstName");
  const lastName = fdStr(formData, "lastName");
  if (!eventId || !firstName || !lastName) return { ok: false, error: "Nom et prénom obligatoires." };
  await prisma.eventRegistration.create({
    data: {
      eventId, firstName, lastName,
      specialty: fdStr(formData, "specialty"), institution: fdStr(formData, "institution"),
      city: fdStr(formData, "city"), email: fdStr(formData, "email"), phone: fdStr(formData, "phone"),
      role: inEnum(ParticipantRole, fdStr(formData, "role"), "DOCTOR"),
      comment: fdStr(formData, "comment"),
      status: inEnum(RegistrationStatus, fdStr(formData, "status"), "CONFIRMED"), source: "internal",
    },
  });
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

export async function setRegistrationStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status");
  if (!id || !status) return { ok: false, error: "Paramètres manquants." };
  const reg = await prisma.eventRegistration.update({
    where: { id },
    data: {
      status: inEnum(RegistrationStatus, status, "REGISTERED"),
      checkedInAt: status === "PRESENT" ? new Date() : undefined,
    },
    select: { eventId: true },
  });
  revalidatePath(`/events/${reg.eventId}`);
  return { ok: true };
}

/** Check-in par jeton QR : marque « présent ». */
export async function checkInByToken(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const token = fdStr(formData, "token");
  if (!token) return { ok: false, error: "Jeton manquant." };
  const reg = await prisma.eventRegistration.findUnique({ where: { qrToken: token }, select: { id: true, eventId: true } });
  if (!reg) return { ok: false, error: "Participant introuvable." };
  await prisma.eventRegistration.update({ where: { id: reg.id }, data: { status: "PRESENT", checkedInAt: new Date() } });
  revalidatePath(`/events/${reg.eventId}`);
  return { ok: true, id: reg.eventId };
}

export async function deleteRegistration(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "EVENTS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const reg = await prisma.eventRegistration.delete({ where: { id }, select: { eventId: true } });
  revalidatePath(`/events/${reg.eventId}`);
  return { ok: true };
}
