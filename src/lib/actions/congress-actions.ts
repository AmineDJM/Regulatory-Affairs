"use server";

import { revalidatePath } from "next/cache";
import type { CongressStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, fdDate, fdBool, type ActionResult } from "@/lib/actions/types";

export async function createCongressInternational(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "CONGRESS_INTERNATIONAL", "CREATE")) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom du congrès est obligatoire." };

  const created = await prisma.congressInternational.create({
    data: {
      name,
      country: fdStr(formData, "country"),
      city: fdStr(formData, "city"),
      startDate: fdDate(formData, "startDate"),
      endDate: fdDate(formData, "endDate"),
      specialty: fdStr(formData, "specialty"),
      participants: fdStr(formData, "participants"),
      invitedDoctors: fdStr(formData, "invitedDoctors"),
      products: fdStr(formData, "products"),
      plannedBudget: fdNum(formData, "plannedBudget"),
      status: (fdStr(formData, "status") as CongressStatus) ?? "CONSIDERED",
      createdById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Congrès internationaux",
    entityType: "CONGRESS_INTERNATIONAL", entityId: created.id, summary: `Congrès « ${name} »`,
  });
  revalidatePath("/congress-international");
  return { ok: true, id: created.id };
}

export async function createCongressNational(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "CONGRESS_NATIONAL", "CREATE")) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom de l'événement est obligatoire." };

  const created = await prisma.congressNational.create({
    data: {
      name,
      city: fdStr(formData, "city"),
      hostInstitution: fdStr(formData, "hostInstitution"),
      date: fdDate(formData, "date"),
      specialty: fdStr(formData, "specialty"),
      promotedProducts: fdStr(formData, "promotedProducts"),
      budget: fdNum(formData, "budget"),
      hasBooth: fdBool(formData, "hasBooth"),
      hasSymposium: fdBool(formData, "hasSymposium"),
      presentDelegates: fdStr(formData, "presentDelegates"),
      status: (fdStr(formData, "status") as CongressStatus) ?? "CONSIDERED",
      createdById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Congrès nationaux",
    entityType: "CONGRESS_NATIONAL", entityId: created.id, summary: `Événement « ${name} »`,
  });
  revalidatePath("/congress-national");
  return { ok: true, id: created.id };
}
