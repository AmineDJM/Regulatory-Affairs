"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { getAppSettings } from "@/lib/settings";
import { saveFile, validateUpload } from "@/lib/storage";
import { companyIdForNew } from "@/lib/company";
import { buildRef, createWithRetry } from "@/lib/refs";
import { getManagerOfUser, getManagementChain } from "@/lib/departments";
import {
  canDecideChain, applyChainDecision, chainNotifyRoles, CHAIN_STAGE_LABELS, type ChainStage,
} from "@/lib/approval-chain";
import {
  initialTrainingStage, initialParticipantState, canRespondToInvitation, canEditTraining,
  type TrainingAttendance,
} from "@/lib/training";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

const PATH = "/formations";

/**
 * FORMATIONS — actions serveur.
 *
 * Deux origines qui produisent le même objet : la demande d'un salarié (qui monte
 * N+1 → RH → DG) et la formation organisée par les RH (qui part directement au DG, puisque
 * les RH SONT l'étape RH). Les postes — location de salle, traiteur, intervenant — sont des
 * `AdProItem`, validés un par un par la direction : exactement le mécanisme déjà éprouvé sur
 * les sponsorings, plutôt qu'un second circuit à maintenir en parallèle.
 */

function isHrOf(user: SessionUser): boolean {
  return userCan(user, "RH", "VALIDATE") || userCan(user, "RH", "UPDATE");
}

async function revalidateTraining(id?: string): Promise<void> {
  revalidatePath(PATH);
  revalidatePath("/mon-espace");
  if (id) revalidatePath(`${PATH}/${id}`);
}

/**
 * La prochaine référence FORM-AAAA-NNN. Recalculée à chaque tentative de création : sous
 * concurrence, deux demandes simultanées tireraient sinon le même numéro.
 */
async function nextTrainingRef(): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await prisma.training.findMany({
    where: { reference: { startsWith: `FORM-${year}-` } },
    select: { reference: true },
  });
  return buildRef("FORM", year, existing.map((r) => r.reference));
}

/** Verse les pièces (devis, programme, convention) sur la formation. */
async function attachFiles(trainingId: string, files: File[], uploaderId: string): Promise<string | null> {
  const maxMb = (await getAppSettings()).maxUploadMb;
  for (const file of files) {
    const invalid = validateUpload(file.name, file.size, maxMb);
    if (invalid) return invalid;
    const key = `TRAINING/${trainingId}/${randomUUID()}__${file.name}`;
    try {
      await saveFile(key, Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      console.error("[training] storage write failed, recording metadata only", err);
    }
    await prisma.document.create({
      data: {
        name: file.name, category: "OTHER", entityType: "DOSSIER", entityId: trainingId,
        fileKey: key, mimeType: file.type || null, sizeBytes: file.size,
        confidentiality: "INTERNAL", uploadedById: uploaderId,
      },
    });
  }
  return null;
}

/**
 * DEMANDER UNE FORMATION — ouvert à tout le monde.
 *
 * « Chaque personne a le droit de demander une formation » : la porte est donc le socle
 * WORKSPACE, pas le module RH. Le devis n'est pas exigé à la soumission — l'obtenir prend
 * parfois des semaines, et bloquer la demande sur sa pièce, c'est empêcher d'en parler.
 */
export async function requestTraining(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "CREATE")) return { ok: false, error: "Non autorisé." };

  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "Indiquez l'intitulé de la formation." };
  const amount = fdNum(formData, "amount") ?? 0;
  if (amount < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };

  const manager = await getManagerOfUser(user.id).catch(() => null);
  const managerUserId = manager?.userId ?? null;
  const stage = initialTrainingStage("EMPLOYEE", Boolean(managerUserId));

  const employee = await prisma.employee.findUnique({ where: { userId: user.id }, select: { departmentId: true } });
  const companyId = await companyIdForNew(user.id);
  const created = await createWithRetry(async () => prisma.training.create({
    data: {
      reference: await nextTrainingRef(),
      title,
      origin: "EMPLOYEE",
      status: "PENDING",
      provider: fdStr(formData, "provider"),
      description: fdStr(formData, "description"),
      startDate: fdDate(formData, "startDate"),
      endDate: fdDate(formData, "endDate"),
      location: fdStr(formData, "location"),
      amount,
      requesterId: user.id,
      departmentId: employee?.departmentId ?? null,
      companyId,
      stage,
      managerId: manager?.employeeId ?? null,
      createdById: user.id,
    },
    select: { id: true, reference: true },
  }));

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length) {
    const err = await attachFiles(created.id, files, user.id);
    if (err) return { ok: false, error: err };
  }

  if (stage === "MANAGER" && managerUserId) {
    await notifyUser({
      userId: managerUserId, type: "VALIDATION_REQUIRED", title: "Formation à valider (votre équipe)",
      body: `${user.name} — ${title}`, link: PATH,
    });
  } else {
    await notifyRoles(chainNotifyRoles("HR") as UserRole[], {
      type: "VALIDATION_REQUIRED", title: "Demande de formation", body: `${user.name} — ${title}`, link: PATH,
    });
  }
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Ressources humaines", entityType: "DOSSIER", entityId: created.id,
    summary: `Demande de formation ${created.reference} — ${title}`,
  });
  await revalidateTraining(created.id);
  return { ok: true, id: created.id };
}

/**
 * ORGANISER UNE FORMATION (RH) — même objet, autre point d'entrée. Elle part directement à la
 * direction : les RH n'ont pas à se demander l'autorisation à elles-mêmes.
 */
export async function createHrTraining(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!isHrOf(user) && !hasGlobalView(user)) {
    return { ok: false, error: "Organiser une formation est réservé aux ressources humaines." };
  }
  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "Indiquez l'intitulé de la formation." };
  const amount = fdNum(formData, "amount") ?? 0;

  const companyId = await companyIdForNew(user.id);
  const created = await createWithRetry(async () => prisma.training.create({
    data: {
      reference: await nextTrainingRef(),
      title,
      origin: "HR",
      status: "PENDING",
      provider: fdStr(formData, "provider"),
      description: fdStr(formData, "description"),
      startDate: fdDate(formData, "startDate"),
      endDate: fdDate(formData, "endDate"),
      location: fdStr(formData, "location"),
      amount,
      requesterId: user.id,
      departmentId: fdStr(formData, "departmentId"),
      companyId,
      stage: initialTrainingStage("HR", false),
      createdById: user.id,
    },
    select: { id: true, reference: true },
  }));

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length) {
    const err = await attachFiles(created.id, files, user.id);
    if (err) return { ok: false, error: err };
  }

  await notifyRoles(chainNotifyRoles("DG") as UserRole[], {
    type: "VALIDATION_REQUIRED", title: "Formation à valider (direction)",
    body: `${title} — ${amount} DZD`, link: PATH,
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Ressources humaines", entityType: "DOSSIER", entityId: created.id,
    summary: `Formation organisée ${created.reference} — ${title}`,
  });
  await revalidateTraining(created.id);
  return { ok: true, id: created.id };
}

/** Le pouvoir de trancher de cette personne sur CETTE formation. */
async function deciderFor(user: SessionUser, training: { managerId: string | null; requesterId: string | null }) {
  const isDg = hasGlobalView(user);
  const isHr = isHrOf(user);
  let isManager = false;
  if (training.managerId) {
    const mgr = await prisma.employee.findUnique({ where: { id: training.managerId }, select: { userId: true } });
    isManager = mgr?.userId === user.id;
  }
  if (!isManager && training.requesterId) {
    // Le N+1 enregistré peut avoir changé : on accepte toute personne au-dessus dans la chaîne
    // ACTUELLE, sinon la demande reste orpheline.
    const emp = await prisma.employee.findUnique({ where: { userId: training.requesterId }, select: { id: true } });
    if (emp) {
      const chain = await getManagementChain(emp.id).catch(() => []);
      isManager = chain.some((m) => m.userId === user.id);
    }
  }
  return { id: user.id, isManager, isHr, isDg };
}

/**
 * DÉCIDER — une marche du circuit. La dernière (DG) accorde définitivement et peut RÉVISER le
 * montant : la direction accorde souvent moins que demandé, et l'écrire ailleurs ferait
 * diverger le budget de la décision.
 */
export async function decideTraining(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision");
  if (!id || (decision !== "APPROVED" && decision !== "REJECTED")) return { ok: false, error: "Décision invalide." };

  const training = await prisma.training.findUnique({
    where: { id },
    include: { requester: { select: { id: true, name: true } } },
  });
  if (!training) return { ok: false, error: "Formation introuvable." };

  const decider = await deciderFor(user, training);
  const allowed = canDecideChain(
    { status: training.status === "PENDING" ? "PENDING" : "APPROVED", stage: training.stage as ChainStage, requesterUserId: training.requesterId },
    decider,
  );
  if (!allowed.ok) return { ok: false, error: allowed.reason ?? "Non autorisé." };

  const note = fdStr(formData, "note");
  const next = applyChainDecision(training.stage as ChainStage, decision);
  const now = new Date();
  const stamp: Record<string, Record<string, unknown>> = {
    MANAGER: { managerDecidedById: user.id, managerDecidedAt: now, managerNote: note },
    HR: { hrDecidedById: user.id, hrDecidedAt: now, hrNote: note },
    DG: { dgDecidedById: user.id, dgDecidedAt: now, dgNote: note },
  };
  // La direction peut accorder un montant différent de celui demandé.
  const granted = next.granted ? fdNum(formData, "amountGranted") : null;

  await prisma.training.update({
    where: { id },
    data: {
      status: next.status === "PENDING" ? "PENDING" : next.status === "APPROVED" ? "APPROVED" : "REJECTED",
      stage: next.stage,
      ...(stamp[training.stage] ?? {}),
      ...(next.granted ? { amountGranted: granted ?? Number(training.amount) } : {}),
    },
  });

  if (next.status === "PENDING") {
    const roles = chainNotifyRoles(next.stage) as UserRole[];
    if (roles.length) {
      await notifyRoles(roles, {
        type: "VALIDATION_REQUIRED", title: "Formation à valider",
        body: `${training.title} — ${CHAIN_STAGE_LABELS[next.stage]}`, link: PATH,
      });
    }
  }
  if (training.requesterId) {
    await notifyUser({
      userId: training.requesterId, type: "GENERIC",
      title: next.status === "PENDING" ? "Formation : une étape de plus"
        : next.status === "APPROVED" ? "Formation accordée" : "Formation refusée",
      body: `${training.title}${note ? ` — ${note}` : ""}`,
      link: PATH,
    });
  }
  await recordAudit({
    actorId: user.id, action: decision === "APPROVED" ? "VALIDATE" : "REFUSE",
    module: "Ressources humaines", entityType: "DOSSIER", entityId: id,
    summary: `Formation ${training.reference} — ${decision === "APPROVED" ? (next.granted ? "accordée" : `validée (${CHAIN_STAGE_LABELS[training.stage as ChainStage]})`) : "refusée"}`,
  });
  await revalidateTraining(id);
  return { ok: true };
}

/** Modifier une formation tant qu'elle n'est pas tranchée (ou toujours, pour la direction). */
export async function updateTraining(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Formation introuvable." };
  const training = await prisma.training.findUnique({ where: { id }, select: { status: true, requesterId: true } });
  if (!training) return { ok: false, error: "Formation introuvable." };
  if (!canEditTraining(
    { status: training.status, requesterId: training.requesterId },
    { id: user.id, isHr: isHrOf(user), isDg: hasGlobalView(user) },
  )) {
    return { ok: false, error: "Cette formation a été tranchée : elle ne se modifie plus." };
  }

  const amount = fdNum(formData, "amount");
  await prisma.training.update({
    where: { id },
    data: {
      ...(fdStr(formData, "title") ? { title: fdStr(formData, "title")! } : {}),
      ...(formData.has("provider") ? { provider: fdStr(formData, "provider") } : {}),
      ...(formData.has("description") ? { description: fdStr(formData, "description") } : {}),
      ...(formData.has("location") ? { location: fdStr(formData, "location") } : {}),
      ...(formData.has("startDate") ? { startDate: fdDate(formData, "startDate") } : {}),
      ...(formData.has("endDate") ? { endDate: fdDate(formData, "endDate") } : {}),
      ...(amount != null && amount >= 0 ? { amount } : {}),
    },
  });

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length) {
    const err = await attachFiles(id, files, user.id);
    if (err) return { ok: false, error: err };
  }
  await revalidateTraining(id);
  return { ok: true };
}

/**
 * INVITER DES PARTICIPANTS (RH). Obligatoire ou volontaire — et le convoqué n'a pas à
 * « accepter » : sa présence est enregistrée d'emblée, sans quoi le mot n'aurait pas de sens.
 */
export async function inviteTrainingParticipants(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!isHrOf(user) && !hasGlobalView(user)) return { ok: false, error: "Réservé aux ressources humaines." };
  const trainingId = fdStr(formData, "trainingId");
  if (!trainingId) return { ok: false, error: "Formation non précisée." };
  const training = await prisma.training.findUnique({ where: { id: trainingId }, select: { title: true } });
  if (!training) return { ok: false, error: "Formation introuvable." };

  const attendanceRaw = fdStr(formData, "attendance");
  const attendance: TrainingAttendance = attendanceRaw === "MANDATORY" ? "MANDATORY" : "VOLUNTARY";
  const userIds = Array.from(new Set(formData.getAll("userIds").filter((v): v is string => typeof v === "string" && v.length > 0)));
  if (userIds.length === 0) return { ok: false, error: "Choisissez au moins une personne." };

  const state = initialParticipantState(attendance);
  for (const userId of userIds) {
    await prisma.trainingParticipant.upsert({
      where: { trainingId_userId: { trainingId, userId } },
      create: { trainingId, userId, attendance, state, respondedAt: state === "ACCEPTED" ? new Date() : null },
      update: { attendance, state, respondedAt: state === "ACCEPTED" ? new Date() : null },
    });
    await notifyUser({
      userId, type: "ASSIGNMENT",
      title: attendance === "MANDATORY" ? "Formation — vous êtes convoqué" : "Invitation à une formation",
      body: `${training.title}${attendance === "VOLUNTARY" ? " — acceptez ou déclinez depuis Formations." : ""}`,
      link: PATH,
    });
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Ressources humaines", entityType: "DOSSIER", entityId: trainingId,
    summary: `${userIds.length} participant(s) ${attendance === "MANDATORY" ? "convoqué(s)" : "invité(s)"} — ${training.title}`,
  });
  await revalidateTraining(trainingId);
  return { ok: true };
}

/** Accepter ou décliner une invitation — par l'intéressé, et seulement s'il a le choix. */
export async function respondToTrainingInvitation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const answer = fdStr(formData, "answer");
  if (!id || (answer !== "ACCEPTED" && answer !== "DECLINED")) return { ok: false, error: "Réponse invalide." };

  const participant = await prisma.trainingParticipant.findUnique({
    where: { id },
    include: { training: { select: { id: true, title: true, requesterId: true } } },
  });
  if (!participant) return { ok: false, error: "Invitation introuvable." };
  if (participant.userId !== user.id) return { ok: false, error: "Cette invitation ne vous concerne pas." };

  const allowed = canRespondToInvitation({
    attendance: participant.attendance as TrainingAttendance,
    state: participant.state as "INVITED" | "ACCEPTED" | "DECLINED",
  });
  if (!allowed.ok) return { ok: false, error: allowed.reason ?? "Réponse impossible." };

  await prisma.trainingParticipant.update({
    where: { id },
    data: { state: answer, respondedAt: new Date(), note: fdStr(formData, "note") },
  });
  if (participant.training.requesterId) {
    await notifyUser({
      userId: participant.training.requesterId, type: "GENERIC",
      title: answer === "ACCEPTED" ? "Formation : participation acceptée" : "Formation : participation déclinée",
      body: `${user.name} — ${participant.training.title}`, link: PATH,
    });
  }
  await revalidateTraining(participant.training.id);
  return { ok: true };
}
