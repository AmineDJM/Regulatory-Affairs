"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import {
  sitsOnPaymentCentre, applyDecision, applyResubmission, canResubmit,
  CENTRAL_DECISION_LABEL, CENTRAL_STATUS_LABEL,
  type CentralDecision, type CentralStatus,
} from "@/lib/payments/authorization";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

/**
 * LE CENTRE DE PAIEMENT — le PDG et le Super Admin autorisent, la comptabilité exécute.
 *
 * Quatre issues, pas deux. Un refus sec obligeait à refaire une demande depuis zéro et faisait
 * perdre la discussion ; ici le centre peut aussi demander une RÉVISION DU MONTANT ou une
 * ARGUMENTATION, le demandeur répond, et le dossier revient — autant de fois qu'il le faut. Le fil
 * reste attaché au paiement : six mois plus tard, on sait à quelles conditions il a été autorisé.
 *
 * Toutes les règles d'état viennent du module pur `payments/authorization` : cette action ne fait
 * que vérifier QUI agit, écrire, et prévenir.
 */

const PATH = "/finances/centre-de-paiement";

function isDecision(v: string): v is CentralDecision {
  return v === "APPROVE" || v === "REFUSE" || v === "REQUEST_CHANGES" || v === "REQUEST_INFO";
}

/**
 * Le centre tranche : autoriser, refuser, demander une révision du montant, ou une argumentation.
 *
 * Le MOTIF est exigé partout sauf sur une autorisation sèche : refuser sans dire pourquoi, ou
 * demander « une révision » sans dire laquelle, renvoie le demandeur deviner — et le dossier
 * revient identique.
 */
export async function decidePayment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!sitsOnPaymentCentre(user)) {
    return { ok: false, error: "Seuls le PDG et le Super Admin siègent au centre de paiement." };
  }

  const id = fdStr(formData, "id");
  const decisionRaw = fdStr(formData, "decision") ?? "";
  if (!id || !isDecision(decisionRaw)) return { ok: false, error: "Décision invalide." };
  const decision = decisionRaw;

  const body = fdStr(formData, "body") ?? "";
  if (decision !== "APPROVE" && !body.trim()) {
    return { ok: false, error: "Dites pourquoi : sans motif, le demandeur ne peut que deviner." };
  }

  const order = await prisma.expenseOrder.findUnique({
    where: { id },
    select: { id: true, reference: true, label: true, amount: true, centralStatus: true, requestedById: true, status: true },
  });
  if (!order) return { ok: false, error: "Ordre de dépense introuvable." };

  const next = applyDecision(order.centralStatus as CentralStatus, decision);
  if (!next) {
    return {
      ok: false,
      error: `Impossible : ce paiement est « ${CENTRAL_STATUS_LABEL[order.centralStatus as CentralStatus]} ». Un dossier tranché se rouvre par une nouvelle soumission du demandeur.`,
    };
  }

  // Le montant révisé n'est qu'une PROPOSITION : le centre autorise, il ne réécrit pas la demande.
  // C'est au demandeur de corriger et de resoumettre — sinon l'ordre partirait aux Finances avec
  // un montant que personne n'a validé en bas de la chaîne.
  const proposed = decision === "REQUEST_CHANGES" ? fdNum(formData, "proposedAmount") : null;

  await prisma.$transaction([
    prisma.expenseOrder.update({
      where: { id },
      data: {
        centralStatus: next,
        centralDecidedById: user.id,
        centralDecidedAt: new Date(),
        ...(proposed != null ? { centralProposedAmount: proposed } : {}),
      },
    }),
    prisma.paymentCentreMessage.create({
      data: { orderId: id, decision, body: body.trim() || CENTRAL_DECISION_LABEL[decision], authorId: user.id },
    }),
  ]);

  const money = `${Number(order.amount).toLocaleString("fr-FR")} DZD`;
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Finances", entityType: "EXPENSE_ORDER", entityId: id,
    summary: `Centre de paiement — ${CENTRAL_DECISION_LABEL[decision]} : ${order.reference} « ${order.label} » (${money})`,
  });

  // On prévient CELUI QUI ATTEND : le demandeur quand la balle lui revient, la comptabilité quand
  // le paiement est enfin exécutable.
  if (next === "APPROVED") {
    await notifyRoles(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], {
      type: "VALIDATION_REQUIRED",
      title: "Paiement autorisé — à régler",
      body: `${order.reference} — ${order.label} (${money})`,
      link: "/finances/ordres-de-depense",
    });
  }
  if (order.requestedById) {
    await notifyUser({
      userId: order.requestedById,
      type: next === "APPROVED" ? "GENERIC" : "VALIDATION_REQUIRED",
      title: `Centre de paiement — ${CENTRAL_DECISION_LABEL[decision]}`,
      body: `${order.reference} — ${order.label} (${money})${body.trim() ? ` : ${body.trim().slice(0, 200)}` : ""}`,
      link: PATH,
    });
  }

  revalidatePath(PATH);
  revalidatePath("/finances/ordres-de-depense");
  return { ok: true, message: `${CENTRAL_DECISION_LABEL[decision]} — enregistré.` };
}

/**
 * Le demandeur répond et resoumet : la balle repasse au centre.
 *
 * On ne resoumet QUE si le centre a rendu la main (révision ou argumentation demandée) — sinon on
 * pourrait relancer indéfiniment un dossier qu'il n'a pas encore regardé.
 */
export async function respondToPaymentCentre(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const body = (fdStr(formData, "body") ?? "").trim();
  if (!id) return { ok: false, error: "Ordre de dépense introuvable." };
  if (!body) return { ok: false, error: "Écrivez votre réponse." };

  const order = await prisma.expenseOrder.findUnique({
    where: { id },
    select: { id: true, reference: true, label: true, amount: true, centralStatus: true, requestedById: true },
  });
  if (!order) return { ok: false, error: "Ordre de dépense introuvable." };

  // Le demandeur, ou quelqu'un du centre agissant pour lui (il arrive qu'on saisisse la réponse
  // reçue par téléphone). Personne d'autre : c'est un argumentaire, il engage son auteur.
  const isRequester = order.requestedById === user.id;
  if (!isRequester && !sitsOnPaymentCentre(user)) {
    return { ok: false, error: "Seul le demandeur peut répondre à cette demande." };
  }
  if (!canResubmit(order.centralStatus as CentralStatus)) {
    return { ok: false, error: "Ce paiement n'attend pas de réponse de votre part." };
  }

  const next = applyResubmission(order.centralStatus as CentralStatus);
  if (!next) return { ok: false, error: "Ce paiement n'attend pas de réponse de votre part." };

  await prisma.$transaction([
    prisma.expenseOrder.update({ where: { id }, data: { centralStatus: next } }),
    prisma.paymentCentreMessage.create({ data: { orderId: id, body, authorId: user.id } }),
  ]);

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Finances", entityType: "EXPENSE_ORDER", entityId: id,
    summary: `Centre de paiement — réponse du demandeur : ${order.reference} « ${order.label} »`,
  });
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: "Réponse reçue — autorisation à reprendre",
    body: `${order.reference} — ${order.label} (${Number(order.amount).toLocaleString("fr-FR")} DZD)`,
    link: PATH,
  });

  revalidatePath(PATH);
  return { ok: true, message: "Réponse envoyée — le dossier retourne au centre de paiement." };
}
