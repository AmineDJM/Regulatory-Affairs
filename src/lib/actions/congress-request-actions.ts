"use server";

import { revalidatePath } from "next/cache";
import type { CongressRequestStatus, NationalEventType, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { createExpenseOrder } from "@/lib/expense-orders";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

type CongressType = "INTL" | "NATIONAL";
const EVENT_TYPES: NationalEventType[] = ["CONGRESS", "SEMINAR", "ROUND_TABLE", "WEBINAR", "WORKSHOP", "SYMPOSIUM", "STAFF", "OTHER"];

const moduleFor = (t: CongressType): "CONGRESS_INTERNATIONAL" | "CONGRESS_NATIONAL" => (t === "INTL" ? "CONGRESS_INTERNATIONAL" : "CONGRESS_NATIONAL");
const pathFor = (t: CongressType) => (t === "INTL" ? "/congress-international" : "/congress-national");
const entityFor = (t: CongressType): "CONGRESS_INTERNATIONAL" | "CONGRESS_NATIONAL" => (t === "INTL" ? "CONGRESS_INTERNATIONAL" : "CONGRESS_NATIONAL");
const typeOf = (formData: FormData): CongressType => (fdStr(formData, "type") === "NATIONAL" ? "NATIONAL" : "INTL");
const fdList = (formData: FormData, key: string): string[] => formData.getAll(key).map((v) => String(v)).filter(Boolean);

function loadCongress(t: CongressType, id: string) {
  return t === "INTL"
    ? prisma.congressInternational.findUnique({ where: { id } })
    : prisma.congressNational.findUnique({ where: { id } });
}
function updateCongress(t: CongressType, id: string, data: Record<string, unknown>) {
  return t === "INTL"
    ? prisma.congressInternational.update({ where: { id }, data: data as Prisma.CongressInternationalUpdateInput })
    : prisma.congressNational.update({ where: { id }, data: data as Prisma.CongressNationalUpdateInput });
}

// ───────────────────────────── Création de la demande ─────────────────────────────

export async function createCongressRequest(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const t = typeOf(formData);
  if (!userCan(user, moduleFor(t), "CREATE")) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom de l'événement est obligatoire." };

  const eventType: NationalEventType = EVENT_TYPES.includes(fdStr(formData, "eventType") as NationalEventType)
    ? (fdStr(formData, "eventType") as NationalEventType)
    : "CONGRESS";
  const common = {
    name,
    eventType,
    specialty: fdStr(formData, "specialty"),
    estimatedBudget: fdNum(formData, "estimatedBudget"),
    invitedDoctorIds: fdList(formData, "invitedDoctorIds"),
    participantIds: fdList(formData, "participantIds"),
    requesterId: user.id,
    requestStatus: "AWAITING_PRELIMINARY" as CongressRequestStatus,
    createdById: user.id,
  };

  const created =
    t === "INTL"
      ? await prisma.congressInternational.create({
          data: {
            ...common,
            country: fdStr(formData, "country"),
            city: fdStr(formData, "city"),
            startDate: fdDate(formData, "startDate"),
            endDate: fdDate(formData, "endDate"),
          },
        })
      : await prisma.congressNational.create({
          data: {
            ...common,
            city: fdStr(formData, "city"),
            hostInstitution: fdStr(formData, "hostInstitution"),
            date: fdDate(formData, "date"),
          },
        });

  await recordAudit({ actorId: user.id, action: "CREATE", module: "Congrès", entityType: entityFor(t), entityId: created.id, summary: `Demande de congrès « ${name} »` });
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: "Demande de congrès à valider (préliminaire)",
    body: name,
    link: `${pathFor(t)}/${created.id}`,
  });
  revalidatePath(pathFor(t));
  return { ok: true, id: created.id };
}

// ───────────────────────────── Validation préliminaire (Direction) ─────────────────────────────

export async function preliminaryDecision(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const t = typeOf(formData);
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision"); // APPROVE | REJECT
  if (!id || !decision) return { ok: false, error: "Paramètres manquants." };
  if (!userCan(user, moduleFor(t), "VALIDATE") && !hasGlobalView(user.role)) return { ok: false, error: "Non autorisé." };

  const c = await loadCongress(t, id);
  if (!c) return { ok: false, error: "Demande introuvable." };
  if (c.requestStatus !== "AWAITING_PRELIMINARY") return { ok: false, error: "Cette demande n'est pas en attente de validation préliminaire." };

  if (decision === "REJECT") {
    const reason = fdStr(formData, "note");
    if (!reason) return { ok: false, error: "Le motif de refus est obligatoire." };
    await updateCongress(t, id, { requestStatus: "REJECTED", rejectionReason: reason, preliminaryById: user.id, preliminaryAt: new Date(), updatedById: user.id });
    if (c.requesterId) await notifyUser({ userId: c.requesterId, type: "GENERIC", title: "Demande de congrès refusée", body: c.name, link: `${pathFor(t)}/${id}` });
    await recordAudit({ actorId: user.id, action: "REFUSE", module: "Congrès", entityType: entityFor(t), entityId: id, summary: `Refus préliminaire — ${c.name}` });
  } else {
    const productManagerId = fdStr(formData, "productManagerId");
    if (!productManagerId) return { ok: false, error: "Sélectionnez le chef de produit qui fera l'analyse." };
    await updateCongress(t, id, {
      requestStatus: "PRELIMINARY_APPROVED", productManagerId,
      preliminaryById: user.id, preliminaryAt: new Date(), preliminaryNote: fdStr(formData, "note"), updatedById: user.id,
    });
    await notifyUser({ userId: productManagerId, type: "ASSIGNMENT", title: "Congrès à analyser", body: c.name, link: `${pathFor(t)}/${id}` });
    if (c.requesterId) await notifyUser({ userId: c.requesterId, type: "GENERIC", title: "Demande validée (préliminaire)", body: c.name, link: `${pathFor(t)}/${id}` });
    await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Congrès", entityType: entityFor(t), entityId: id, summary: `Validation préliminaire — ${c.name}` });
  }
  revalidatePath(`${pathFor(t)}/${id}`);
  revalidatePath(pathFor(t));
  return { ok: true };
}

// ───────────────────────────── Analyse chef de produit ─────────────────────────────

export async function submitProductAnalysis(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const t = typeOf(formData);
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const c = await loadCongress(t, id);
  if (!c) return { ok: false, error: "Demande introuvable." };
  if (c.productManagerId !== user.id && !hasGlobalView(user.role)) return { ok: false, error: "Réservé au chef de produit assigné." };
  if (c.requestStatus !== "PRELIMINARY_APPROVED") return { ok: false, error: "Cette demande n'est pas en phase d'analyse." };
  const budget = fdNum(formData, "productManagerBudget");
  if (budget === null) return { ok: false, error: "Le budget proposé est obligatoire." };

  await updateCongress(t, id, {
    requestStatus: "AWAITING_FINAL",
    productManagerBudget: budget,
    productManagerNotes: fdStr(formData, "productManagerNotes"),
    updatedById: user.id,
  });
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: "Congrès — validation définitive",
    body: `${c.name} — analyse chef de produit terminée`,
    link: `${pathFor(t)}/${id}`,
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Congrès", entityType: entityFor(t), entityId: id, summary: `Analyse chef de produit — ${c.name}` });
  revalidatePath(`${pathFor(t)}/${id}`);
  return { ok: true };
}

// ───────────────────────────── Validation définitive (Direction) → ordre de dépense ─────────────────────────────

export async function finalDecision(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const t = typeOf(formData);
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision");
  if (!id || !decision) return { ok: false, error: "Paramètres manquants." };
  if (!userCan(user, moduleFor(t), "VALIDATE") && !hasGlobalView(user.role)) return { ok: false, error: "Non autorisé." };

  const c = await loadCongress(t, id);
  if (!c) return { ok: false, error: "Demande introuvable." };
  if (c.requestStatus !== "AWAITING_FINAL") return { ok: false, error: "Cette demande n'est pas en attente de validation définitive." };

  if (decision === "REJECT") {
    const reason = fdStr(formData, "note");
    if (!reason) return { ok: false, error: "Le motif de refus est obligatoire." };
    await updateCongress(t, id, { requestStatus: "REJECTED", rejectionReason: reason, finalById: user.id, finalAt: new Date(), updatedById: user.id });
    if (c.requesterId) await notifyUser({ userId: c.requesterId, type: "GENERIC", title: "Demande de congrès refusée (définitif)", body: c.name, link: `${pathFor(t)}/${id}` });
    await recordAudit({ actorId: user.id, action: "REFUSE", module: "Congrès", entityType: entityFor(t), entityId: id, summary: `Refus définitif — ${c.name}` });
    revalidatePath(`${pathFor(t)}/${id}`);
    return { ok: true };
  }

  // Validation définitive → émission d'un ordre de dépense vers l'espace comptable.
  const amount = Number(c.productManagerBudget ?? c.estimatedBudget ?? 0);
  const order = amount > 0
    ? await createExpenseOrder({
        label: `Congrès — ${c.name}`,
        amount,
        category: "EVENEMENT",
        beneficiary: c.name,
        sourceType: entityFor(t),
        sourceId: id,
        requestedById: c.requesterId ?? user.id,
      })
    : null;

  await updateCongress(t, id, {
    requestStatus: "APPROVED",
    finalById: user.id, finalAt: new Date(), finalNote: fdStr(formData, "note"),
    expenseOrderId: order?.id ?? null,
    status: "VALIDATED",
    updatedById: user.id,
  });
  if (c.requesterId) await notifyUser({ userId: c.requesterId, type: "GENERIC", title: "Congrès validé — pris en charge", body: c.name, link: `${pathFor(t)}/${id}` });
  await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Congrès", entityType: entityFor(t), entityId: id, summary: `Validation définitive — ${c.name}${order ? ` (ordre ${order.reference})` : ""}` });
  revalidatePath(`${pathFor(t)}/${id}`);
  revalidatePath("/finances/ordres-de-depense");
  revalidatePath("/comptabilite");
  return { ok: true };
}

export async function cancelCongressRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const t = typeOf(formData);
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const c = await loadCongress(t, id);
  if (!c) return { ok: false, error: "Introuvable." };
  const isOwner = c.requesterId === user.id;
  if (!isOwner && !userCan(user, moduleFor(t), "VALIDATE") && !hasGlobalView(user.role)) return { ok: false, error: "Non autorisé." };
  if (["APPROVED", "COMPLETED"].includes(c.requestStatus)) return { ok: false, error: "Demande déjà validée." };
  await updateCongress(t, id, { requestStatus: "CANCELLED", updatedById: user.id });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Congrès", entityType: entityFor(t), entityId: id, summary: `Demande annulée — ${c.name}` });
  revalidatePath(`${pathFor(t)}/${id}`);
  revalidatePath(pathFor(t));
  return { ok: true };
}
