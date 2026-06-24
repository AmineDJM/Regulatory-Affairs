"use server";

import { revalidatePath } from "next/cache";
import type { Priority, SponsoringStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

// Above this amount (DZD) a sponsoring requires Direction validation.
const DIRECTION_THRESHOLD = 100000;

export async function createSponsoring(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "SPONSORING", "CREATE")) return { ok: false, error: "Non autorisé." };

  const institution = fdStr(formData, "institution");
  if (!institution) return { ok: false, error: "L'institution est obligatoire." };

  const year = new Date().getFullYear();
  const count = await prisma.sponsoringRequest.count({
    where: { reference: { startsWith: `SPO-${year}-` } },
  });
  const reference = `SPO-${year}-${String(count + 1).padStart(3, "0")}`;
  const amountRequested = fdNum(formData, "amountRequested");
  const needsDirection = (amountRequested ?? 0) > DIRECTION_THRESHOLD;

  const created = await prisma.sponsoringRequest.create({
    data: {
      reference,
      institution,
      doctor: fdStr(formData, "doctor"),
      specialty: fdStr(formData, "specialty"),
      city: fdStr(formData, "city"),
      type: fdStr(formData, "type") ?? "Sponsoring",
      description: fdStr(formData, "description"),
      amountRequested,
      product: fdStr(formData, "product"),
      strategicImportance: (fdStr(formData, "strategicImportance") as Priority) ?? "MEDIUM",
      status: needsDirection ? "AWAITING_DIRECTION" : "RECEIVED",
      requesterId: user.id,
      createdById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    module: "Sponsoring",
    entityType: "SPONSORING",
    entityId: created.id,
    summary: `Demande ${reference} — ${institution}`,
  });

  if (needsDirection) {
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
      type: "SPONSORING_VALIDATION",
      title: "Sponsoring à valider",
      body: `${reference} — ${institution} (montant élevé)`,
      link: `/sponsoring/${created.id}`,
    });
  }

  revalidatePath("/sponsoring");
  return { ok: true, id: created.id };
}

export async function decideSponsoring(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "SPONSORING", "VALIDATE")) return { ok: false, error: "Validation non autorisée." };

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const before = await prisma.sponsoringRequest.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Demande introuvable." };

  const decision = fdStr(formData, "decision") as SponsoringStatus; // ACCEPTED | REFUSED | PAID
  const amountGranted = fdNum(formData, "amountGranted");

  await prisma.sponsoringRequest.update({
    where: { id },
    data: {
      status: decision,
      amountGranted: decision === "ACCEPTED" || decision === "PAID" ? amountGranted : 0,
      finalDecision: fdStr(formData, "finalDecision"),
      validatedBy: user.name,
      validationDate: new Date(),
      updatedById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: decision === "REFUSED" ? "REFUSE" : "VALIDATE",
    module: "Sponsoring",
    entityType: "SPONSORING",
    entityId: id,
    field: "status",
    oldValue: before.status,
    newValue: decision,
    summary: `Décision sur ${before.reference}: ${decision}`,
  });

  if (before.requesterId) {
    await notifyUser({
      userId: before.requesterId,
      type: "SPONSORING_VALIDATION",
      title: `Sponsoring ${decision === "REFUSED" ? "refusé" : "accepté"}`,
      body: `${before.reference} — ${before.institution}`,
      link: `/sponsoring/${id}`,
    });
  }

  revalidatePath("/sponsoring");
  revalidatePath(`/sponsoring/${id}`);
  return { ok: true };
}
