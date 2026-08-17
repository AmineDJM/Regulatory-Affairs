"use server";

import type { ConsultingBilling, ConsultingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { buildRef, createWithRetry } from "@/lib/refs";
import { companyIdForNew } from "@/lib/company";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";
import { nextConsultingStatus, isContractEditable } from "@/lib/ad-pro/consulting";

const PATH = "/consulting";

/**
 * LE CONTRAT DE CONSULTING — un engagement entre DEUX PARTIES.
 *
 * Ce n'est pas une demande qu'on approuve puis qu'on oublie : c'est une relation qui court dans
 * le temps. D'où les gestes offerts ici — soumettre à validation, activer, prolonger ou clore,
 * annuler — et les tâches attendues du prestataire, qui vivent à part parce que « ce qui reste à
 * livrer » est une question qu'on pose au contrat, et qu'un paragraphe ne sait pas y répondre.
 *
 * QUI PEUT QUOI : le porteur mène son contrat jusqu'à la demande de validation ; seul un
 * VALIDATE sur le module (Direction, ou la personne désignée) l'active ou le refuse. Personne ne
 * valide donc son propre engagement sans en avoir reçu le droit.
 */

function isDirection(user: SessionUser): boolean {
  return hasGlobalView(user.role);
}

/** Le porteur du contrat, ou quelqu'un qui a la vue globale. */
function owns(user: SessionUser, c: { requesterId: string | null; createdById: string | null }): boolean {
  return c.requesterId === user.id || c.createdById === user.id || isDirection(user);
}

async function nextRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.consultingContract.findMany({
    where: { reference: { startsWith: `CONS-${year}-` } }, select: { reference: true },
  });
  return buildRef("CONS", year, refs.map((r) => r.reference));
}

function revalidate(id?: string) {
  revalidatePath(PATH);
  revalidatePath("/ad-pro");
  if (id) revalidatePath(`${PATH}/${id}`);
}

async function audit(user: SessionUser, id: string, action: "CREATE" | "UPDATE" | "VALIDATE" | "DELETE", summary: string) {
  await recordAudit({ actorId: user.id, action, module: "Consulting", entityType: "CONSULTING_CONTRACT", entityId: id, summary });
}

function billingOf(raw: string | null): ConsultingBilling {
  const allowed: ConsultingBilling[] = ["ONE_OFF", "MONTHLY", "QUARTERLY", "YEARLY", "ON_DELIVERY"];
  return allowed.includes(raw as ConsultingBilling) ? (raw as ConsultingBilling) : "ONE_OFF";
}

const dateOf = (raw: string | null): Date | null => {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

// ───────────────────────── Création ─────────────────────────

export async function createConsultingContract(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!userCan(user, "CONSULTING", "CREATE")) return { ok: false, error: "Création réservée aux personnes habilitées." };

    const title = fdStr(formData, "title");
    const counterparty = fdStr(formData, "counterparty");
    if (!title) return { ok: false, error: "L'intitulé du contrat est obligatoire." };
    // Un contrat sans co-contractant n'est pas un contrat : c'est une note.
    if (!counterparty) return { ok: false, error: "Indiquez le consultant ou le cabinet — un contrat a deux parties." };

    const startDate = dateOf(fdStr(formData, "startDate"));
    const endDate = dateOf(fdStr(formData, "endDate"));
    if (startDate && endDate && endDate < startDate) {
      return { ok: false, error: "La date de fin ne peut pas précéder la date de début." };
    }

    // Les tâches arrivent en une saisie par ligne : c'est ainsi qu'on les dicte, et découper à
    // la main dans un formulaire aurait tout l'air d'une corvée.
    const tasks = (fdStr(formData, "tasks") ?? "")
      .split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 60);

    const companyId = fdStr(formData, "companyId") || (await companyIdForNew(user.id));

    // La référence se recalcule à CHAQUE tentative : c'est ce qui rend le réessai utile quand
    // deux contrats partent en même temps.
    const contract = await createWithRetry(async () =>
      prisma.consultingContract.create({
        data: {
          reference: await nextRef(),
          title,
          counterparty,
          counterpartyContact: fdStr(formData, "counterpartyContact"),
          companyId: companyId || null,
          scope: fdStr(formData, "scope"),
          startDate, endDate,
          amount: fdNum(formData, "amount") ?? null,
          billing: billingOf(fdStr(formData, "billing")),
          paymentTerms: fdStr(formData, "paymentTerms"),
          notes: fdStr(formData, "notes"),
          status: "DRAFT",
          requesterId: user.id,
          createdById: user.id,
          updatedById: user.id,
          tasks: { create: tasks.map((label, i) => ({ label, position: i })) },
        },
      }),
    );

    await audit(user, contract.id, "CREATE", `Contrat de consulting créé — ${contract.reference} (${counterparty})`);
    revalidate(contract.id);
    return { ok: true, id: contract.id };
  } catch (err) {
    console.error("[consulting] createConsultingContract failed", err);
    return { ok: false, error: "Le contrat n'a pas pu être créé. Réessayez dans un instant." };
  }
}

// ───────────────────────── Circuit ─────────────────────────

/** Le porteur demande la validation, et désigne à qui. */
export async function requestConsultingValidation(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    if (!id) return { ok: false, error: "Contrat introuvable." };
    const c = await prisma.consultingContract.findUnique({ where: { id } });
    if (!c) return { ok: false, error: "Contrat introuvable." };
    if (!owns(user, c)) return { ok: false, error: "Seul le porteur du contrat peut le soumettre." };

    const next = nextConsultingStatus(c.status, "SUBMIT");
    if (!next) return { ok: false, error: "Ce contrat n'est plus au stade de la soumission." };

    const validatorId = fdStr(formData, "validatorId");
    await prisma.consultingContract.update({
      where: { id }, data: { status: next as ConsultingStatus, validatorId, updatedById: user.id },
    });

    const body = `${c.reference} — ${c.title} (${c.counterparty})`;
    if (validatorId) {
      await notifyUser({ userId: validatorId, type: "VALIDATION_REQUIRED", title: "Contrat de consulting à valider", body, link: `${PATH}/${id}` });
    } else {
      await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "VALIDATION_REQUIRED", title: "Contrat de consulting à valider", body, link: `${PATH}/${id}` });
    }
    await audit(user, id, "UPDATE", `Contrat soumis à validation — ${c.reference}`);
    revalidate(id);
    return { ok: true, id };
  } catch (err) {
    console.error("[consulting] requestConsultingValidation failed", err);
    return { ok: false, error: "La soumission a échoué." };
  }
}

/** Valider (le contrat devient ACTIF) ou refuser (il est annulé, avec son motif). */
export async function decideConsultingContract(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    const approve = fdStr(formData, "approve") === "1";
    if (!id) return { ok: false, error: "Contrat introuvable." };
    const c = await prisma.consultingContract.findUnique({ where: { id } });
    if (!c) return { ok: false, error: "Contrat introuvable." };

    // La désignation ne crée pas le droit : elle DÉSIGNE quelqu'un qui l'a déjà. Sans quoi
    // n'importe qui se nommerait validateur de son propre contrat.
    const mayDecide = userCan(user, "CONSULTING", "VALIDATE") && (c.validatorId === null || c.validatorId === user.id || isDirection(user));
    if (!mayDecide) return { ok: false, error: "La décision revient au validateur désigné." };

    const next = nextConsultingStatus(c.status, approve ? "APPROVE" : "REFUSE");
    if (!next) return { ok: false, error: "Ce contrat n'attend pas de décision." };

    await prisma.consultingContract.update({
      where: { id },
      data: {
        status: next as ConsultingStatus,
        validatedById: user.id,
        validatedAt: new Date(),
        decisionNote: fdStr(formData, "note"),
        cancelledAt: approve ? null : new Date(),
        updatedById: user.id,
      },
    });

    if (c.requesterId) {
      await notifyUser({
        userId: c.requesterId, type: "GENERIC",
        title: approve ? "Contrat de consulting validé" : "Contrat de consulting refusé",
        body: `${c.reference} — ${c.title}`, link: `${PATH}/${id}`,
      });
    }
    await audit(user, id, "VALIDATE", `${approve ? "Contrat validé (actif)" : "Contrat refusé"} — ${c.reference}`);
    revalidate(id);
    return { ok: true, id };
  } catch (err) {
    console.error("[consulting] decideConsultingContract failed", err);
    return { ok: false, error: "La décision n'a pas pu être enregistrée." };
  }
}

/** Clore un contrat arrivé à son terme, ou rompre un contrat en cours. */
export async function closeConsultingContract(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    const cancel = fdStr(formData, "cancel") === "1";
    if (!id) return { ok: false, error: "Contrat introuvable." };
    const c = await prisma.consultingContract.findUnique({ where: { id } });
    if (!c) return { ok: false, error: "Contrat introuvable." };
    if (!owns(user, c) && !userCan(user, "CONSULTING", "VALIDATE")) {
      return { ok: false, error: "Seuls le porteur du contrat ou un validateur peuvent le clore." };
    }

    const next = nextConsultingStatus(c.status, cancel ? "CANCEL" : "EXPIRE");
    if (!next) return { ok: false, error: "Ce contrat est déjà clos." };

    await prisma.consultingContract.update({
      where: { id },
      data: {
        status: next as ConsultingStatus,
        cancelledAt: cancel ? new Date() : null,
        decisionNote: fdStr(formData, "note") ?? c.decisionNote,
        updatedById: user.id,
      },
    });
    await audit(user, id, "UPDATE", `${cancel ? "Contrat annulé" : "Contrat arrivé à expiration"} — ${c.reference}`);
    revalidate(id);
    return { ok: true, id };
  } catch (err) {
    console.error("[consulting] closeConsultingContract failed", err);
    return { ok: false, error: "L'opération a échoué." };
  }
}

// ───────────────────────── Tâches attendues ─────────────────────────

export async function addConsultingTask(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const contractId = fdStr(formData, "contractId");
    const label = fdStr(formData, "label");
    if (!contractId || !label) return { ok: false, error: "Décrivez la tâche attendue." };
    const c = await prisma.consultingContract.findUnique({ where: { id: contractId } });
    if (!c) return { ok: false, error: "Contrat introuvable." };
    if (!owns(user, c) && !userCan(user, "CONSULTING", "UPDATE")) return { ok: false, error: "Modification non autorisée." };

    const count = await prisma.consultingTask.count({ where: { contractId } });
    await prisma.consultingTask.create({
      data: { contractId, label, dueDate: dateOf(fdStr(formData, "dueDate")), position: count },
    });
    await audit(user, contractId, "UPDATE", `Tâche ajoutée au contrat ${c.reference}`);
    revalidate(contractId);
    return { ok: true, id: contractId };
  } catch (err) {
    console.error("[consulting] addConsultingTask failed", err);
    return { ok: false, error: "La tâche n'a pas pu être ajoutée." };
  }
}

/** Cocher / décocher une tâche livrée. */
export async function toggleConsultingTask(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const taskId = fdStr(formData, "taskId");
    if (!taskId) return { ok: false, error: "Tâche introuvable." };
    const task = await prisma.consultingTask.findUnique({ where: { id: taskId }, include: { contract: true } });
    if (!task) return { ok: false, error: "Tâche introuvable." };
    if (!owns(user, task.contract) && !userCan(user, "CONSULTING", "UPDATE")) return { ok: false, error: "Modification non autorisée." };

    await prisma.consultingTask.update({ where: { id: taskId }, data: { doneAt: task.doneAt ? null : new Date() } });
    revalidate(task.contractId);
    return { ok: true, id: task.contractId };
  } catch (err) {
    console.error("[consulting] toggleConsultingTask failed", err);
    return { ok: false, error: "L'opération a échoué." };
  }
}

export async function deleteConsultingTask(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const taskId = fdStr(formData, "taskId");
    if (!taskId) return { ok: false, error: "Tâche introuvable." };
    const task = await prisma.consultingTask.findUnique({ where: { id: taskId }, include: { contract: true } });
    if (!task) return { ok: false, error: "Tâche introuvable." };
    if (!owns(user, task.contract) && !userCan(user, "CONSULTING", "UPDATE")) return { ok: false, error: "Suppression non autorisée." };
    if (!isContractEditable(task.contract.status)) return { ok: false, error: "Un contrat clos ne se modifie plus." };

    await prisma.consultingTask.delete({ where: { id: taskId } });
    revalidate(task.contractId);
    return { ok: true, id: task.contractId };
  } catch (err) {
    console.error("[consulting] deleteConsultingTask failed", err);
    return { ok: false, error: "L'opération a échoué." };
  }
}
