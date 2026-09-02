"use server";

import type { PaymentRequestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { ENTITY_MODULE } from "@/lib/entity-access";
import { pickAutoCategory } from "@/lib/budget/auto-category";
import { prisma } from "@/lib/prisma";
import { buildRef } from "@/lib/refs";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { canDisburse, blockedReason, type CentralStatus } from "@/lib/payments/authorization";
import { checkDeferral } from "@/lib/finance/settlement";
import { budgetGate } from "@/lib/finance/settle-budget";
import { dossierHrefByOrder } from "@/lib/expense-orders";
import { companionStatusForOrder } from "@/lib/finance/dossier-auto";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * LE DOSSIER COMPAGNON PASSE À « SOLDÉ » quand son ordre est réglé, et le fil le dit.
 *
 * Best-effort : un dossier qui ne se met pas à jour ne doit jamais annuler un virement déjà
 * inscrit. C'est la même hiérarchie que partout dans ce circuit — l'argent prime, l'affichage
 * se rattrape.
 */
async function syncCompanionOnSettle(orderId: string, orderRef: string, actorId: string): Promise<void> {
  try {
    const dossiers = await prisma.paymentRequest.findMany({
      where: { expenseOrderId: orderId, origin: "EXPENSE_ORDER" },
      select: { id: true },
    });
    if (dossiers.length === 0) return;
    const ids = dossiers.map((d) => d.id);
    await prisma.paymentRequest.updateMany({
      where: { id: { in: ids } },
      data: { status: companionStatusForOrder("PAID") as PaymentRequestStatus },
    });
    await prisma.paymentRequestEvent.createMany({
      data: ids.map((requestId) => ({
        requestId, actorId, kind: "APPROVE",
        message: `Ordre ${orderRef} réglé par les Finances.`,
      })),
    });
  } catch (e) {
    console.error("[expense] dossier compagnon non synchronisé", e);
  }
}

async function nextFinanceRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.financeTransaction.findMany({ where: { reference: { startsWith: `FIN-${year}-` } }, select: { reference: true } });
  return buildRef("FIN", year, refs.map((r) => r.reference));
}

/** Comptable settles an ordre de dépense → generates the treasury OUT entry and marks the source paid. */
export async function settleExpenseOrder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Réservé à la comptabilité (Finances)." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Ordre introuvable." };
  const order = await prisma.expenseOrder.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Ordre introuvable." };
  if (order.status === "PAID") return { ok: true };
  if (order.status !== "PENDING") return { ok: false, error: "Cet ordre a été annulé." };

  // LE VERROU DU CENTRE DE PAIEMENT — la dernière porte avant que l'argent sorte.
  //
  // C'est ici, et pas dans un écran, que la règle tient : quelle que soit la façon dont on arrive
  // à cet ordre, un décaissement au-dessus du seuil ne s'exécute pas sans l'autorisation du PDG
  // ou du Super Admin. Le message dit POURQUOI — « non autorisé » seul ferait ouvrir un ticket.
  if (!canDisburse(order.centralStatus as CentralStatus)) {
    return { ok: false, error: blockedReason(order.centralStatus as CentralStatus) ?? "Ce paiement n'est pas autorisé." };
  }

  // Facture obligatoire pour les dépenses événementielles : joindre la facture
  // (à l'ordre ou au dossier source) avant de régler, sinon la demander.
  if (order.requiresInvoice) {
    const invoice = await prisma.document.count({
      where: {
        category: "INVOICE",
        OR: [
          { entityType: "EXPENSE_ORDER", entityId: order.id },
          ...(order.sourceType && order.sourceId ? [{ entityType: order.sourceType, entityId: order.sourceId }] : []),
        ],
      },
    });
    if (invoice === 0) return { ok: false, error: "Facture obligatoire : joignez la facture à l'ordre (ou au dossier source) avant de régler, ou demandez-la au demandeur." };
  }

  // ── ON CLASSE AVANT DE PAYER ───────────────────────────────────────────────────────────────
  //
  // Trois chances, dans l'ordre : la catégorie CHOISIE ICI par les Finances au moment de régler
  // (la plus récente et la plus informée — quelqu'un a la facture sous les yeux), celle posée par
  // la Direction à la validation, puis l'attribution automatique déduite du module d'origine.
  // Si aucune ne répond, le règlement s'ARRÊTE et demande le classement : une écriture sans
  // budget rejoint les « à imputer », que personne ne reprend jamais, et l'enveloppe affiche
  // l'année suivante une consommation fausse. La règle vit dans `finance/settle-budget.ts`.
  let chosenCategoryId: string | null = fdStr(formData, "budgetCategoryId");
  if (chosenCategoryId) {
    const ok = await prisma.budgetCategoryLine.count({ where: { id: chosenCategoryId } });
    if (ok === 0) chosenCategoryId = null;
  }
  let budgetCategoryId: string | null = order.budgetCategoryId ?? null;
  if (budgetCategoryId) {
    // Sécurité : on ignore une (sous-)catégorie qui n'existe plus.
    const exists = await prisma.budgetCategoryLine.count({ where: { id: budgetCategoryId } });
    if (exists === 0) budgetCategoryId = null;
  }
  if (!budgetCategoryId && order.sourceType) {
    const sourceModule = ENTITY_MODULE[order.sourceType];
    if (sourceModule) {
      // Deux chances, dans l'ordre : une catégorie qui déclare le module, puis — c'est la
      // nouveauté qui branche les bordereaux de versement — la première catégorie d'une
      // ENVELOPPE qui couvre ce module. Créer l'enveloppe « Regulatory » et cocher le module
      // suffit désormais : les BV payés s'y imputent sans réglage supplémentaire.
      const [envelopes, categories] = await Promise.all([
        prisma.budgetEnvelope.findMany({
          where: { isActive: true },
          select: { id: true, isActive: true, modules: true, module: true, periodStart: true },
        }),
        prisma.budgetCategoryLine.findMany({
          where: { parentId: null, envelope: { isActive: true } },
          select: { id: true, envelopeId: true, module: true, parentId: true, createdAt: true },
        }),
      ]);
      budgetCategoryId = pickAutoCategory(sourceModule, envelopes, categories);
    }
  }

  // L'EXCEPTION QUI ÉVITE L'IMPASSE : s'il n'existe AUCUNE catégorie où classer, on paie et la
  // dépense reste à imputer. Exiger un choix dans une liste vide ferme une porte à clé sur une
  // pièce vide, et une installation sans enveloppes doit pouvoir régler ses factures.
  const gate = budgetGate({
    chosen: chosenCategoryId,
    onOrder: budgetCategoryId,
    availableCount: await prisma.budgetCategoryLine.count({ where: { envelope: { isActive: true } } }),
  });
  if (!gate.ok) return { ok: false, error: gate.reason ?? "Classez cette dépense dans son budget avant de la régler." };
  budgetCategoryId = gate.categoryId;

  const tx = await prisma.financeTransaction.create({
    data: {
      reference: await nextFinanceRef(), date: new Date(), direction: "OUT",
      category: order.category, label: order.label, amount: order.amount,
      method: "BANK_TRANSFER", account: "Banque", counterparty: order.beneficiary,
      status: "SETTLED", budgetCategoryId, createdById: user.id,
    },
  });
  await prisma.expenseOrder.update({
    where: { id }, data: { status: "PAID", transactionId: tx.id, paidById: user.id, paidDate: new Date() },
  });

  // LE DOSSIER COMPAGNON SUIT L'ORDRE — il n'a pas de vie propre : il décrit un paiement. Le
  // laisser « chez les Finances » sous un virement fait ce matin ferait relancer un dossier soldé.
  //
  // Les dossiers NATIFS ne sont pas touchés : leur « bon à payer » a été donné par quelqu'un, et
  // récrire `decidedById` avec le nom du comptable qui règle effacerait celui qui a décidé.
  await syncCompanionOnSettle(id, order.reference, user.id);

  // Mark the originating record as settled.
  if (order.sourceType === "SPONSORING" && order.sourceId) {
    await prisma.sponsoringRequest.update({ where: { id: order.sourceId }, data: { status: "PAID" } }).catch(() => undefined);
  } else if (order.sourceType === "SALARY_ADVANCE" && order.sourceId) {
    await prisma.salaryAdvance.update({
      where: { id: order.sourceId }, data: { status: "PAID", paidDate: new Date(), transactionId: tx.id },
    }).catch(() => undefined);
  } else if (order.sourceType === "ADMIN_REQUEST" && order.sourceId) {
    await prisma.administrativeRequest.update({
      where: { id: order.sourceId }, data: { status: "IN_PROGRESS" },
    }).catch(() => undefined);
  }

  if (order.requestedById) {
    await notifyUser({
      userId: order.requestedById, type: "GENERIC", title: "Ordre de dépense réglé",
      body: `${order.reference} — ${order.label}`, link: "/finances/paiements-a-faire",
    });
  }

  // UN BON DE VERSEMENT RÉGLÉ N'EST PAS UN BON REMIS. Le pharmacien responsable ne peut déclarer
  // aux autorités qu'avec le papier en main : on ramène donc les Finances sur la déclaration,
  // avec le geste qui reste à poser. Sans ce rappel, le dossier attendrait sans que personne ne
  // sache que la balle est de leur côté — le règlement, lui, a bien eu lieu.
  if (order.sourceType === "PAYMENT_REQUEST" && order.sourceId) {
    const req = await prisma.paymentRequest
      .findUnique({ where: { id: order.sourceId }, select: { entityType: true, entityId: true, reference: true } })
      .catch(() => null);
    if (req?.entityType === "MEDICAL_INFO_DECLARATION" && req.entityId) {
      await notifyRoles(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], {
        type: "ASSIGNMENT",
        title: "Bon de versement réglé — à remettre au bureau du PRIM",
        body: `${req.reference} — c'est la remise, et non le règlement, qui ouvre la déclaration aux autorités.`,
        link: `/information-medicale/${req.entityId}`,
      });
      revalidatePath(`/information-medicale/${req.entityId}`);
    }
  }
  await recordAudit({
    actorId: user.id, action: "VALIDATE", module: "Finances", entityType: "EXPENSE_ORDER",
    entityId: id, summary: `Ordre ${order.reference} réglé — ${order.label}`,
  });
  revalidatePath("/finances");
  revalidatePath("/finances/paiements-a-faire");
  revalidatePath("/sponsoring");
  revalidatePath("/rh");
  revalidatePath("/mon-espace");
  return { ok: true };
}

/**
 * PURGER L'HISTORIQUE DES RÈGLEMENTS — réglés et annulés, et eux seuls.
 *
 * L'écran « Paiements à faire » accumulait sous la file du jour un historique qui ne servait plus
 * qu'à faire défiler. Le Super Admin peut le vider.
 *
 * CE QUI N'EST PAS TOUCHÉ, et c'est ce qui rend le geste sûr : les ÉCRITURES DE TRÉSORERIE
 * (`FinanceTransaction`) restent — c'est là que vit la trace de l'argent sorti, dans le livre
 * comptable —, ainsi que le journal d'audit. On efface la FILE, pas la comptabilité. Le fil
 * d'autorisation du centre de paiement part avec son ordre : il ne dit rien sans lui.
 *
 * Un ordre EN COURS (à régler, révision demandée) n'est jamais touché : purger ne doit pas
 * pouvoir faire disparaître un paiement qui attend.
 */
export async function purgeSettledExpenseOrders(): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };

  const cibles = await prisma.expenseOrder.findMany({
    where: { status: { in: ["PAID", "CANCELLED"] } },
    select: { id: true },
  });
  if (cibles.length === 0) return { ok: false, error: "L'historique est déjà vide." };

  // LE DOSSIER COMPAGNON PART AVEC SON ORDRE. Il ne décrit que lui : sans l'ordre, il montre un
  // paiement qui n'existe plus, avec des pièces rattachées à rien. Les dossiers NATIFS restent —
  // ce sont des demandes que quelqu'un a déposées, elles ont une vie propre et leur propre écran.
  await prisma.paymentRequest.deleteMany({
    where: { origin: "EXPENSE_ORDER", expenseOrderId: { in: cibles.map((o) => o.id) } },
  });
  await prisma.expenseOrder.deleteMany({ where: { id: { in: cibles.map((o) => o.id) } } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Finances",
    summary: `Historique des règlements purgé — ${cibles.length} ordre(s) réglé(s) ou annulé(s). Les écritures de trésorerie sont conservées.`,
  });
  revalidatePath("/finances/paiements-a-faire");
  revalidatePath("/finances");
  return { ok: true, message: `${cibles.length} ordre(s) retiré(s) de l'historique. Les écritures de trésorerie sont conservées.` };
}

/** Le comptable demande la facture au demandeur (dépense événementielle sans facture). */
export async function requestInvoice(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE") && !hasGlobalView(user.role)) return { ok: false, error: "Réservé à la comptabilité (Finances)." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Ordre introuvable." };
  const order = await prisma.expenseOrder.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Ordre introuvable." };

  // ON ENVOIE LE DEMANDEUR LÀ OÙ IL PEUT DÉPOSER — son dossier — et non dans la file du
  // décaissement, qui est l'écran des Finances et que la plupart des demandeurs ne peuvent même
  // pas ouvrir. C'est le dossier qui porte les pièces ; l'y conduire est la moitié du geste.
  const dossier = (await dossierHrefByOrder([order.id])).get(order.id) ?? "/finances/paiements-a-faire";
  if (order.requestedById) {
    await notifyUser({
      userId: order.requestedById, type: "ASSIGNMENT", title: "Facture demandée",
      body: `${order.reference} — ${order.label} : merci de joindre la facture pour règlement.`,
      link: dossier,
    });
  } else {
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "ASSIGNMENT", title: "Facture demandée", body: `${order.reference} — ${order.label}`, link: dossier });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Finances", entityType: "EXPENSE_ORDER", entityId: id, summary: `Facture demandée — ${order.reference}` });
  revalidatePath("/finances/paiements-a-faire");
  return { ok: true };
}

/**
 * REPORTER UN PAIEMENT À UNE DATE — le seul geste, avec le règlement, qui reste aux Finances.
 *
 * ── CE QUI A ÉTÉ RETIRÉ D'ICI, ET POURQUOI ───────────────────────────────────────────────────
 *
 * Trois actions vivaient à cet endroit : `cancelExpenseOrder`, `requestBudgetRevision` et
 * `resolveBudgetRevision`. Toutes les trois défaisaient une décision déjà prise ailleurs : l'ordre
 * arrive au décaissement **autorisé par le centre de paiement**, qui a vu le montant, la file
 * entière et l'engagement pris. Le rouvrir à la caisse, c'est donner le dernier mot à celui qui
 * n'a que la trésorerie sous les yeux — et faire porter à l'écran comptable un arbitrage qui
 * appartient au centre. Elles ont été supprimées, pas seulement masquées : un bouton retiré
 * laisse une porte ouverte à l'assistant et à l'API, et §118-7 interdit qu'une mission soit une
 * porte dérobée vers ce que l'écran refuse.
 *
 * Il ne reste donc que trois états — non payé (défaut), reporté à une date, payé — et le report
 * est une DATE, jamais un statut : il expire seul (`src/lib/finance/settlement.ts`).
 *
 * Le motif n'est exigé que sur une échéance déclarée FIXE et non négociable. Ce n'est pas un
 * veto : les Finances peuvent devoir décaler, et personne ne peut le leur interdire depuis un
 * formulaire. C'est la trace que le demandeur relira quand il devra expliquer le retard.
 */
export async function deferExpenseOrder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Réservé à la comptabilité (Finances)." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Ordre introuvable." };
  const order = await prisma.expenseOrder.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Ordre introuvable." };
  if (order.status !== "PENDING") return { ok: false, error: "Seul un ordre à régler peut être reporté." };

  const reason = fdStr(formData, "reason");
  const check = checkDeferral({
    order: { status: order.status, deferredUntil: order.deferredUntil },
    until: fdStr(formData, "until"),
    reason,
    deadlineNature: order.deadlineNature,
  });
  if (!check.ok || !check.until) return { ok: false, error: check.reason ?? "Report impossible." };

  await prisma.expenseOrder.update({
    where: { id },
    data: { deferredUntil: check.until, deferredReason: reason, deferredById: user.id, deferredAt: new Date() },
  });

  // LE DEMANDEUR APPREND LE REPORT — c'est lui qui a une échéance en face, et un fournisseur qui
  // rappelle. Le lui cacher jusqu'au jour dit ne retarde pas le problème, il le rend surprenant.
  if (order.requestedById) {
    await notifyUser({
      userId: order.requestedById, type: "GENERIC", title: "Paiement reporté",
      body: `${order.reference} — ${order.label} : reporté au ${check.until.toLocaleDateString("fr-FR")}${reason ? ` — ${reason}` : ""}`,
      link: "/finances/paiements-a-faire",
    });
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Finances", entityType: "EXPENSE_ORDER",
    entityId: id, field: "deferredUntil", newValue: check.until.toISOString(),
    summary: `Ordre ${order.reference} — paiement reporté au ${check.until.toLocaleDateString("fr-FR")}${reason ? ` (${reason})` : ""}`,
  });
  revalidatePath("/finances/paiements-a-faire");
  revalidatePath("/finances");
  revalidatePath("/mon-espace");
  return { ok: true };
}

/**
 * LEVER LE REPORT — l'ordre redevient simplement « non payé », l'état par défaut.
 *
 * Ce n'est pas un quatrième geste : c'est le retour au premier des trois états. Sans lui, une
 * date saisie trop loin ne pourrait plus être corrigée qu'en attendant qu'elle arrive.
 */
export async function resumeExpenseOrder(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "FINANCES", "UPDATE")) return { ok: false, error: "Réservé à la comptabilité (Finances)." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Ordre introuvable." };
  const order = await prisma.expenseOrder.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Ordre introuvable." };
  if (!order.deferredUntil) return { ok: false, error: "Ce paiement n'est pas reporté." };

  await prisma.expenseOrder.update({
    where: { id },
    data: { deferredUntil: null, deferredReason: null, deferredById: null, deferredAt: null },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Finances", entityType: "EXPENSE_ORDER",
    entityId: id, field: "deferredUntil", newValue: "", summary: `Ordre ${order.reference} — report levé, paiement de nouveau dû`,
  });
  revalidatePath("/finances/paiements-a-faire");
  revalidatePath("/finances");
  return { ok: true };
}
