"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { MODULE_LABELS } from "@/lib/labels";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { rolesWithModule } from "@/lib/rbac";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { normalizeDelegated, delegationsFor, delegationNotice, STAND_IN_LABEL } from "@/lib/hr/stand-in";

/**
 * L'INTÉRIMAIRE D'UN CONGÉ — désigné par l'absent, validé par les RH.
 *
 * Deux gestes, deux personnes, et c'est ce partage qui rend la délégation acceptable : l'absent
 * SAIT qui peut le remplacer sur son métier, les RH VÉRIFIENT que ce n'est pas un remplaçant de
 * complaisance. Ni l'un ni l'autre ne suffit seul.
 *
 * Les règles (fenêtre d'activité, modules délégables, bornes des droits) vivent dans le module
 * pur `lib/hr/stand-in.ts` ; ici on lit le formulaire, on vérifie qui parle, on écrit.
 */

/** L'absent désigne (ou change) son intérimaire, et choisit ce qu'il délègue. */
export async function proposeStandIn(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const standInId = fdStr(formData, "standInId");
  if (!id) return { ok: false, error: "Demande de congé introuvable." };

  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    select: {
      id: true, status: true, endDate: true,
      employee: { select: { fullName: true, userId: true } },
    },
  });
  if (!leave) return { ok: false, error: "Demande de congé introuvable." };

  // C'est SA demande. Les RH peuvent aussi désigner pour quelqu'un — cela arrive quand l'absence
  // est déjà commencée et que la personne n'y a pas pensé.
  const isOwner = leave.employee.userId === user.id;
  const isHr = userCan(user, "RH", "UPDATE");
  if (!isOwner && !isHr) return { ok: false, error: "Seul l'intéressé (ou les RH) désigne son intérimaire." };
  if (leave.status === "REJECTED" || leave.status === "CANCELLED") {
    return { ok: false, error: "Ce congé n'est plus en cours." };
  }

  // RETIRER l'intérimaire est un geste légitime : on change d'avis, ou le remplaçant part aussi.
  if (!standInId) {
    await prisma.leaveRequest.update({
      where: { id },
      data: { standInId: null, standInStatus: null, standInModules: [], standInDecidedAt: null, standInDecidedById: null, standInNote: null },
    });
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "RH", entityType: "LEAVE_REQUEST", entityId: id,
      summary: `Congé de ${leave.employee.fullName} — intérimaire retiré`,
    });
    revalidatePath("/rh/conges");
    revalidatePath("/mon-espace");
    return { ok: true, message: "Intérimaire retiré." };
  }

  // ON NE SE REMPLACE PAS SOI-MÊME : la situation naît d'un clic malheureux, et ferait passer
  // une auto-validation pour un intérim.
  if (standInId === leave.employee.userId) {
    return { ok: false, error: "On ne peut pas se désigner soi-même comme intérimaire." };
  }
  const candidate = await prisma.user.findUnique({ where: { id: standInId }, select: { name: true, isActive: true } });
  if (!candidate || !candidate.isActive) return { ok: false, error: "Cette personne n'a plus de compte actif." };

  const modules = normalizeDelegated(formData.getAll("modules").map(String));
  if (modules.length === 0) {
    return { ok: false, error: "Choisissez au moins un module à déléguer — sinon l'intérimaire n'aurait rien à faire." };
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      standInId,
      // Toute nouvelle désignation REPART en attente des RH : changer de remplaçant après
      // validation ne doit pas hériter de l'accord donné pour quelqu'un d'autre.
      standInStatus: "PENDING",
      standInModules: modules,
      standInDecidedAt: null, standInDecidedById: null, standInNote: null,
    },
  });
  await notifyRoles(rolesWithModule("RH", "UPDATE"), {
    type: "GENERIC",
    title: "Intérimaire à valider",
    body: `${leave.employee.fullName} propose ${candidate.name} pendant son congé (${modules.map((m) => MODULE_LABELS[m]).join(", ")}).`,
    link: "/rh/conges",
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "RH", entityType: "LEAVE_REQUEST", entityId: id,
    field: "Intérimaire", newValue: candidate.name,
    summary: `Congé de ${leave.employee.fullName} — ${candidate.name} proposé comme intérimaire (${modules.map((m) => MODULE_LABELS[m]).join(", ")})`,
  });
  revalidatePath("/rh/conges");
  revalidatePath("/mon-espace");
  return { ok: true, message: "Intérimaire proposé — en attente de validation des RH." };
}

/** Les RH tranchent : l'intérimaire est validé, ou refusé avec un motif. */
export async function decideStandIn(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "RH", "UPDATE")) {
    return { ok: false, error: "La validation d'un intérimaire appartient aux ressources humaines." };
  }
  const id = fdStr(formData, "id");
  const approve = fdStr(formData, "decision") !== "REJECTED";
  const note = fdStr(formData, "note");
  if (!id) return { ok: false, error: "Demande de congé introuvable." };

  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    select: {
      id: true, endDate: true, standInId: true, standInStatus: true, standInModules: true,
      employee: { select: { fullName: true, user: { select: { id: true, role: true } } } },
    },
  });
  if (!leave) return { ok: false, error: "Demande de congé introuvable." };
  if (!leave.standInId) return { ok: false, error: "Aucun intérimaire n'est proposé sur ce congé." };
  if (!approve && !note) return { ok: false, error: "Un refus se motive : l'intéressé doit savoir quoi proposer d'autre." };

  // On VÉRIFIE que la délégation transmettra réellement quelque chose. Valider un intérim vide
  // laisserait tout le monde croire que la place est tenue.
  const absenteeRole = leave.employee.user?.role;
  if (approve && absenteeRole) {
    const delegations = delegationsFor(absenteeRole, leave.standInModules);
    if (delegations.length === 0) {
      return {
        ok: false,
        error: "Aucun des modules choisis n'est réellement détenu par la personne absente : "
          + "la délégation ne transmettrait rien. Faites-lui corriger sa sélection.",
      };
    }
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      standInStatus: approve ? "APPROVED" : "REJECTED",
      standInDecidedById: user.id, standInDecidedAt: new Date(), standInNote: note,
    },
  });

  await notifyUser({
    userId: leave.standInId, type: "GENERIC",
    title: approve ? "Vous êtes intérimaire" : "Intérim refusé",
    body: approve
      ? delegationNotice(leave.employee.fullName, leave.endDate)
      : `Les RH n'ont pas retenu votre désignation comme intérimaire de ${leave.employee.fullName}${note ? ` — ${note}` : ""}.`,
    link: "/validations",
  });
  if (leave.employee.user?.id) {
    await notifyUser({
      userId: leave.employee.user.id, type: "GENERIC",
      title: STAND_IN_LABEL[approve ? "APPROVED" : "REJECTED"],
      body: note || (approve ? "Votre intérimaire pourra agir pendant votre congé." : ""),
      link: "/mon-espace",
    });
  }
  await recordAudit({
    actorId: user.id, action: approve ? "VALIDATE" : "REFUSE", module: "RH",
    entityType: "LEAVE_REQUEST", entityId: id,
    field: "Intérimaire", newValue: approve ? "APPROVED" : "REJECTED",
    summary: `Congé de ${leave.employee.fullName} — intérimaire ${approve ? "validé" : "refusé"}${note ? ` · ${note}` : ""}`,
  });
  revalidatePath("/rh/conges");
  revalidatePath("/mon-espace");
  // La délégation change les DROITS de l'intérimaire : sa navigation doit être recalculée.
  revalidatePath("/", "layout");
  return { ok: true, message: approve ? "Intérimaire validé." : "Intérimaire refusé." };
}
