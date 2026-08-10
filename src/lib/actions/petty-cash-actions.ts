"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { getAppSettings } from "@/lib/settings";
import { saveFile, validateUpload } from "@/lib/storage";
import { normalizeAmount, normalizeYear } from "@/lib/department-budget";
import { pettyCashBalance, canSpendFromPettyCash, currentPeriod, periodLabel, type PettyCashStatus } from "@/lib/petty-cash";
import { toNumber } from "@/lib/utils";
import { fdStr, type ActionResult } from "@/lib/actions/types";

const PATH = "/moyens-generaux";

/**
 * CAISSE D'AVANCE — actions serveur.
 *
 * Trois gestes, trois responsabilités : l'administration REMET la somme, la détentrice
 * CONFIRME l'avoir reçue, puis DÉPENSE — chaque fois avec le justificatif. Séparer la remise
 * de la confirmation n'est pas de la bureaucratie : c'est la seule façon de savoir si l'argent
 * a réellement changé de mains, et donc de distinguer « décidé » de « détenu ».
 */

/** Remettre (ou rallonger) la caisse : réservé à l'administration — c'est elle qui sort l'argent. */
function canAllot(user: Parameters<typeof userCan>[0]): boolean {
  return hasGlobalView(user) || userCan(user, "BUDGETS", "UPDATE") || userCan(user, "BUDGETS", "VALIDATE");
}

/**
 * REMETTRE UNE SOMME (dotation initiale du mois, ou rallonge).
 *
 * Une rallonge n'ouvre pas une seconde caisse pour le même mois : elle S'AJOUTE à celle en
 * cours. Deux caisses simultanées rendraient le solde indécidable — laquelle vide-t-on ?
 */
export async function allotPettyCash(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canAllot(user)) return { ok: false, error: "Remettre une caisse d'avance est réservé à l'administration." };

  const departmentId = fdStr(formData, "departmentId");
  const holderId = fdStr(formData, "holderId");
  if (!departmentId) return { ok: false, error: "Département non précisé." };
  const period = fdStr(formData, "period") || currentPeriod();
  const amount = normalizeAmount(fdStr(formData, "amount"));
  if (typeof amount !== "number") return { ok: false, error: amount.error };
  if (amount <= 0) return { ok: false, error: "Indiquez la somme remise." };

  const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } });
  if (!department) return { ok: false, error: "Département introuvable." };

  const existing = await prisma.pettyCashAllotment.findFirst({ where: { departmentId, period } });
  const note = fdStr(formData, "note");

  let holder = holderId;
  if (existing) {
    // Rallonge : on ajoute au fond du mois plutôt que d'ouvrir une seconde caisse.
    await prisma.pettyCashAllotment.update({
      where: { id: existing.id },
      data: { amount: { increment: amount }, note: note ?? existing.note, ...(holderId ? { holderId } : {}) },
    });
    holder = holderId || existing.holderId || "";
  } else {
    if (!holderId) return { ok: false, error: "Indiquez à qui la somme est remise." };
    await prisma.pettyCashAllotment.create({
      data: { departmentId, period, amount, holderId, note, createdById: user.id },
    });
  }

  await recordAudit({
    actorId: user.id, action: existing ? "UPDATE" : "CREATE", module: "Budgets",
    entityType: "BUDGET", entityId: departmentId,
    summary: `Caisse d'avance ${periodLabel(period)} — ${department.name} : ${existing ? "rallonge de " : ""}${amount} DZD`,
  });
  if (holder) {
    await notifyUser({
      userId: holder, type: "GENERIC",
      title: existing ? "Rallonge de caisse d'avance" : "Caisse d'avance remise",
      body: `${amount} DZD pour ${periodLabel(period)} — confirmez la réception dans Moyens généraux.`,
      link: PATH,
    });
  }
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * CONFIRMER LA RÉCEPTION — par la détentrice, et par elle seule.
 *
 * Tant qu'elle n'a pas confirmé, le solde disponible reste à zéro : afficher un fonds qu'on
 * n'a pas encore en main conduit à engager des dépenses qu'on ne peut pas payer.
 */
export async function confirmPettyCashReceipt(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Caisse non précisée." };
  const cash = await prisma.pettyCashAllotment.findUnique({
    where: { id },
    include: { department: { select: { name: true, id: true } } },
  });
  if (!cash) return { ok: false, error: "Caisse introuvable." };
  if (cash.holderId !== user.id && !hasGlobalView(user)) {
    return { ok: false, error: "Seule la personne à qui la somme a été remise confirme sa réception." };
  }
  if (cash.status !== "ALLOTTED") return { ok: false, error: "Cette réception est déjà confirmée." };

  await prisma.pettyCashAllotment.update({
    where: { id },
    data: { status: "RECEIVED", receivedAt: new Date() },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Budgets", entityType: "BUDGET", entityId: cash.department.id,
    summary: `Caisse d'avance ${periodLabel(cash.period)} reçue — ${toNumber(cash.amount)} DZD`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/** Solder une caisse : ce qui reste n'est plus disponible, et le mois est clos. */
export async function closePettyCash(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Caisse non précisée." };
  const cash = await prisma.pettyCashAllotment.findUnique({ where: { id }, select: { id: true, departmentId: true, period: true, holderId: true, status: true } });
  if (!cash) return { ok: false, error: "Caisse introuvable." };
  if (cash.holderId !== user.id && !canAllot(user)) return { ok: false, error: "Non autorisé." };
  if (cash.status === "CLOSED") return { ok: false, error: "Cette caisse est déjà soldée." };

  await prisma.pettyCashAllotment.update({ where: { id }, data: { status: "CLOSED" } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Budgets", entityType: "BUDGET", entityId: cash.departmentId,
    summary: `Caisse d'avance ${periodLabel(cash.period)} soldée`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * DÉPENSER SUR LA CAISSE — avec justificatif scanné, sans exception.
 *
 * La dépense est déduite du fond ET imputée au budget des moyens généraux : c'est le même
 * argent vu de deux endroits (ce qu'on avait le droit de dépenser, ce qu'on avait en main).
 * L'écrire deux fois séparément, c'était garantir deux totaux différents.
 */
export async function spendFromPettyCash(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const cashId = fdStr(formData, "cashId");
  if (!cashId) return { ok: false, error: "Caisse non précisée." };

  const cash = await prisma.pettyCashAllotment.findUnique({
    where: { id: cashId },
    include: { expenses: { select: { id: true, label: true, amount: true, date: true } } },
  });
  if (!cash) return { ok: false, error: "Caisse introuvable." };
  if (cash.holderId !== user.id && !hasGlobalView(user)) {
    return { ok: false, error: "Seule la personne qui détient la caisse y impute des dépenses." };
  }

  const label = fdStr(formData, "label");
  if (!label) return { ok: false, error: "Indiquez ce qui a été acheté." };
  const amount = normalizeAmount(fdStr(formData, "amount"));
  if (typeof amount !== "number") return { ok: false, error: amount.error };

  const state = { id: cash.id, period: cash.period, amount: toNumber(cash.amount), status: cash.status as PettyCashStatus };
  const balance = pettyCashBalance(
    state,
    cash.expenses.map((e) => ({ id: e.id, label: e.label, amount: toNumber(e.amount), date: e.date.toISOString() })),
  );
  const allowed = canSpendFromPettyCash(state, balance, amount);
  if (!allowed.ok) return { ok: false, error: allowed.reason ?? "Dépense impossible." };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { ok: false, error: "Scannez la facture ou le bon de paiement : une dépense sans pièce n'est qu'une affirmation." };
  }

  const year = normalizeYear(fdStr(formData, "year"));
  const created = await prisma.departmentBudgetExpense.create({
    data: {
      departmentId: cash.departmentId,
      year,
      kind: "OPERATING",
      label,
      amount,
      notes: fdStr(formData, "notes"),
      pettyCashId: cash.id,
      createdById: user.id,
    },
    select: { id: true },
  });

  const maxMb = (await getAppSettings()).maxUploadMb;
  for (const file of files) {
    const invalid = validateUpload(file.name, file.size, maxMb);
    if (invalid) return { ok: false, error: invalid };
    const key = `DEPARTMENT_EXPENSE/${created.id}/${randomUUID()}__${file.name}`;
    try {
      await saveFile(key, Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      console.error("[petty-cash] storage write failed, recording metadata only", err);
    }
    await prisma.document.create({
      data: {
        name: file.name, category: "INVOICE", entityType: "DEPARTMENT_EXPENSE", entityId: created.id,
        fileKey: key, mimeType: file.type || null, sizeBytes: file.size,
        confidentiality: "INTERNAL", uploadedById: user.id,
      },
    });
  }

  // Le fond baisse : on prévient AVANT d'être à sec, pas une fois bloqué.
  const after = pettyCashBalance(state, [
    ...cash.expenses.map((e) => ({ id: e.id, label: e.label, amount: toNumber(e.amount), date: e.date.toISOString() })),
    { id: created.id, label, amount, date: new Date().toISOString() },
  ]);
  if (after.lowOnCash) {
    await notifyRoles(["SUPER_ADMIN", "DIRECTION"], {
      type: "GENERIC",
      title: "Caisse d'avance presque épuisée",
      body: `${periodLabel(cash.period)} : il reste ${Math.max(0, after.remaining)} DZD.`,
      link: PATH,
    });
  }

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Budgets", entityType: "BUDGET", entityId: cash.departmentId,
    summary: `Dépense sur caisse d'avance ${periodLabel(cash.period)} — ${label} (${amount} DZD)`,
  });
  revalidatePath(PATH);
  revalidatePath("/budgets/departements");
  return { ok: true, id: created.id };
}

/**
 * DEMANDER UNE RALLONGE — par la détentrice, quand le fond s'épuise.
 *
 * Ce n'est pas une dotation budgétaire : c'est une demande d'ARGENT LIQUIDE. Elle part à
 * l'administration, qui remettra (ou non) la somme.
 */
export async function requestPettyCashTopUp(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const cashId = fdStr(formData, "cashId");
  if (!cashId) return { ok: false, error: "Caisse non précisée." };
  const cash = await prisma.pettyCashAllotment.findUnique({
    where: { id: cashId },
    include: { department: { select: { name: true } }, expenses: { select: { amount: true } } },
  });
  if (!cash) return { ok: false, error: "Caisse introuvable." };
  if (cash.holderId !== user.id && !hasGlobalView(user)) return { ok: false, error: "Non autorisé." };

  const amount = normalizeAmount(fdStr(formData, "amount"));
  if (typeof amount !== "number") return { ok: false, error: amount.error };
  if (amount <= 0) return { ok: false, error: "Indiquez le montant demandé." };
  const reason = fdStr(formData, "reason");

  const spent = cash.expenses.reduce((a, e) => a + toNumber(e.amount), 0);
  const remaining = toNumber(cash.amount) - spent;

  await notifyRoles(["SUPER_ADMIN", "DIRECTION"], {
    type: "VALIDATION_REQUIRED",
    title: "Rallonge de caisse d'avance demandée",
    body: `${cash.department.name} · ${periodLabel(cash.period)} : +${amount} DZD demandés (il reste ${Math.max(0, remaining)} DZD)${reason ? ` — ${reason}` : ""}`,
    link: PATH,
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Budgets", entityType: "BUDGET", entityId: cash.departmentId,
    summary: `Rallonge de caisse demandée — ${periodLabel(cash.period)} : +${amount} DZD`,
  });
  revalidatePath(PATH);
  return { ok: true };
}
