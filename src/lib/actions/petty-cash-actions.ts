"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { saveFile } from "@/lib/storage";
import { validateAttachments } from "@/lib/attach-files";
import { normalizeAmount, normalizeYear } from "@/lib/department-budget";
import {
  currentPeriod, periodLabel, normalizeRechargeDay, nextRechargeDate, grantedTopUpAmount,
} from "@/lib/petty-cash";
import { continuousCash, canSpendFromFund } from "@/lib/general-means/continuous-cash";
import { openRemittances } from "@/lib/queries/general-means";
import { toNumber } from "@/lib/utils";
import { nextFinanceRef } from "@/lib/finance/next-ref";
import { compteDeLEcriture } from "@/lib/finance/comptes";
import { createExpenseOrder } from "@/lib/expense-orders";
import { etatRemise, refusConfirmationRemise } from "@/lib/general-means/remise-centre";
import { fdStr, fdNum, fdCase, type ActionResult } from "@/lib/actions/types";
import { readReceipt, saveReceiptLines } from "@/lib/general-means/expense-lines";
import { allowedGeneralMeansCategoryIds, keepAllowedCategory } from "@/lib/general-means/budget-targets";

const PATH = "/moyens-generaux";

/**
 * CAISSE D'AVANCE — actions serveur.
 *
 * Trois gestes, trois responsabilités : l'administration REMET la somme, la détentrice
 * CONFIRME l'avoir reçue, puis DÉPENSE — chaque fois avec le justificatif. Séparer la remise
 * de la confirmation n'est pas de la bureaucratie : c'est la seule façon de savoir si l'argent
 * a réellement changé de mains, et donc de distinguer « décidé » de « détenu ».
 */

/**
 * Remettre (ou rallonger) la caisse, et régler son montant mensuel : les RESSOURCES HUMAINES,
 * qui pilotent le module des moyens généraux — plus l'administration et les finances, qui
 * sortent l'argent. Jamais la détentrice : on ne se recharge pas soi-même.
 */
function canAllot(user: Parameters<typeof userCan>[0]): boolean {
  return hasGlobalView(user)
    || userCan(user, "RH", "UPDATE")
    || userCan(user, "BUDGETS", "UPDATE") || userCan(user, "BUDGETS", "VALIDATE");
}

/**
 * REMETTRE UNE SOMME — et c'est tout ce que ça fait.
 *
 * Chaque remise est une LIGNE, avec sa date, sa période, son montant et sa confirmation de
 * réception. Elle s'ajoute au fond ; elle ne clôt pas la précédente et n'ouvre pas un « nouveau
 * mois ». Auparavant, remettre une somme en septembre fusionnait avec la caisse de septembre si
 * elle existait, et faisait sortir de l'écran celle d'août — dont l'argent était pourtant
 * toujours dans le tiroir. On ne peut pas répondre à « qu'a-t-on remis, et quand ? » avec une
 * somme qui s'incrémente : la question a besoin des lignes.
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

  const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true, companyId: true } });
  if (!department) return { ok: false, error: "Département introuvable." };

  // À QUI ? La personne nommée sur le formulaire ; à défaut celle qui détient déjà le fond, à
  // défaut celle que les RH ont désignée dans le réglage mensuel. Sans ce repli, une rallonge
  // exigerait de redésigner à chaque fois quelqu'un qui n'a pas changé.
  const ouvertes = await openRemittances(departmentId);
  const plan = await prisma.pettyCashPlan.findUnique({ where: { departmentId }, select: { holderId: true } });
  const holder = holderId || ouvertes.find((r) => r.holderId)?.holderId || plan?.holderId || "";
  if (!holder) return { ok: false, error: "Indiquez à qui la somme est remise." };

  // LE NOM DE LA DÉTENTRICE figure sur l'écriture : « Caisse d'avance — Logistique » sans dire à
  // qui la somme a été remise oblige à rouvrir le module pour lire une ligne de banque.
  const holderName = (await prisma.user.findUnique({ where: { id: holder }, select: { name: true } }))?.name ?? null;

  const premiere = ouvertes.length === 0;

  // ── LA REMISE PASSE PAR LE CENTRE DE PAIEMENT (§118.176) ──────────────────────────────────
  //
  // « La caisse qui est donnée mensuellement aux moyens généraux […] doit dorénavant aussi passer
  // par le centre de paiement et attendre la validation » (la Direction, 01/10/2026). La remise
  // naît donc avec son ORDRE DE DÉPENSE, en attente du centre — et l'écriture de trésorerie ne se
  // pose plus ici : elle se pose au RÈGLEMENT de l'ordre, là où l'argent quitte réellement la
  // banque. L'écrire maintenant, c'était inscrire au livre un décaissement que personne n'avait
  // encore autorisé.
  //
  // L'ordre porte l'entité du DÉPARTEMENT : c'est elle qui engage la dépense, pas celle de la
  // personne qui clique.
  const remise = await prisma.pettyCashAllotment.create({
    data: {
      departmentId, period, amount, holderId: holder, note: fdStr(formData, "note"),
      createdById: user.id,
    },
    select: { id: true },
  });
  let ordre: { id: string; reference: string };
  try {
    ordre = await createExpenseOrder({
      label: `Caisse d'avance — ${department.name} (${periodLabel(period)})`,
      amount,
      category: "AUTRE",
      beneficiary: holderName ?? "Caisse d'avance",
      requestedById: user.id,
      companyId: department.companyId,
      notes: `Remise en caisse d'avance${holderName ? ` à ${holderName}` : ""} — ${department.name}, ${periodLabel(period)}. Un achat payé sur la caisse s'impute ensuite à son budget : la remise elle-même ne se classe pas.`,
    });
  } catch (e) {
    // RIEN N'EST PARTI : une remise sans ordre ne serait ni autorisable ni confirmable.
    await prisma.pettyCashAllotment.delete({ where: { id: remise.id } }).catch(() => undefined);
    console.error("[petty-cash] ordre de la remise non créé", e);
    return { ok: false, error: "La remise n'a pas pu partir au centre de paiement — rien n'a été enregistré, réessayez." };
  }
  await prisma.pettyCashAllotment.update({ where: { id: remise.id }, data: { expenseOrderId: ordre.id } });

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Budgets",
    entityType: "BUDGET", entityId: departmentId,
    summary: `Caisse d'avance — ${department.name} : ${premiere ? "" : "nouvelle "}remise de ${amount} DZD (${periodLabel(period)}) envoyée au centre de paiement (${ordre.reference})`,
  });
  // LA DÉTENTRICE APPREND CE QUI L'ATTEND — pas « confirmez la réception » d'une somme qui n'est
  // pas partie : elle sera prévenue une seconde fois au versement, et c'est alors qu'elle confirme.
  await notifyUser({
    userId: holder, type: "GENERIC",
    title: premiere ? "Caisse d'avance annoncée" : "Nouvelle remise en caisse d'avance annoncée",
    body: `${amount} DZD demandés au centre de paiement le ${new Date().toLocaleDateString("fr-FR")} — vous serez prévenue au versement, et confirmerez alors la réception.`,
    link: PATH,
  });
  revalidatePath(PATH);
  revalidatePath("/centre-de-paiement");
  return { ok: true, message: `Remise de ${amount.toLocaleString("fr-FR")} DZD envoyée au centre de paiement (${ordre.reference}) : elle rejoindra le fond une fois autorisée et versée par les Finances.` };
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
    include: {
      department: { select: { name: true, id: true } },
      expenseOrder: { select: { status: true, centralStatus: true } },
    },
  });
  if (!cash) return { ok: false, error: "Caisse introuvable." };
  if (cash.holderId !== user.id && !hasGlobalView(user)) {
    return { ok: false, error: "Seule la personne à qui la somme a été remise confirme sa réception." };
  }
  // ON NE CONFIRME PAS AVOIR REÇU CE QUI N'EST PAS PARTI (§118.176) : tant que le centre n'a pas
  // autorisé la remise et que les Finances ne l'ont pas versée, il n'y a rien à recevoir. Une
  // remise d'avant la règle (sans ordre) se confirme comme avant.
  const refusAttente = refusConfirmationRemise(etatRemise({
    aUnOrdre: Boolean(cash.expenseOrderId), ordre: cash.expenseOrder, transactionId: cash.transactionId,
  }));
  if (cash.status !== "ALLOTTED") return { ok: false, error: "Cette réception est déjà confirmée." };
  if (refusAttente) return { ok: false, error: refusAttente };

  await prisma.pettyCashAllotment.update({
    where: { id },
    data: { status: "RECEIVED", receivedAt: new Date() },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Budgets", entityType: "BUDGET", entityId: cash.department.id,
    summary: `Remise en caisse d'avance reçue — ${toNumber(cash.amount)} DZD (${periodLabel(cash.period)})`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * SOLDER LA CAISSE — le fond ENTIER, jamais une remise isolée.
 *
 * Solder, c'est arrêter les comptes : on rend le reliquat, on classe les tickets, on repart de
 * zéro. Ne solder qu'une remise retirerait son montant du fond en y laissant les dépenses
 * imputées sur les autres — un solde qui s'effondre sans qu'une seule dépense n'ait été faite.
 * Il n'y a qu'une caisse : on la solde d'un bloc.
 */
export async function closePettyCash(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Caisse non précisée." };
  const cash = await prisma.pettyCashAllotment.findUnique({ where: { id }, select: { departmentId: true } });
  if (!cash) return { ok: false, error: "Caisse introuvable." };

  const toutes = await openRemittances(cash.departmentId);
  if (toutes.length === 0) return { ok: false, error: "Cette caisse est déjà soldée." };
  if (!toutes.some((r) => r.holderId === user.id) && !canAllot(user)) return { ok: false, error: "Non autorisé." };
  // UNE REMISE QUI ATTEND LE CENTRE NE SE SOLDE PAS AVEC LE FOND (§118.176) : elle n'y est pas
  // encore. La solder ferait verser par les Finances une remise close, que personne ne pourrait
  // plus recevoir — l'argent sortirait de la banque vers une caisse fermée.
  const ouvertes = toutes.filter((r) => !r.enAttenteDuCentre);
  if (ouvertes.length === 0) {
    return { ok: false, error: "Rien à solder : la seule remise en cours attend encore le centre de paiement (ou son versement par les Finances)." };
  }

  const fund = continuousCash(ouvertes);
  await prisma.pettyCashAllotment.updateMany({
    where: { id: { in: ouvertes.map((r) => r.id) } },
    data: { status: "CLOSED" },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Budgets", entityType: "BUDGET", entityId: cash.departmentId,
    summary: `Caisse d'avance soldée — ${ouvertes.length} remise(s), ${fund.remitted} DZD remis, ${fund.spent} DZD dépensés, reliquat ${fund.remaining} DZD`,
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
    select: { id: true, departmentId: true, period: true },
  });
  if (!cash) return { ok: false, error: "Caisse introuvable." };

  // LE FOND DÉCIDE, PAS LA REMISE. Trois remises de 20 000 paient un achat de 55 000 : c'est le
  // même tiroir. Comparer au montant d'une seule remise refusait la dépense au motif que
  // « septembre ne la couvre pas », alors que l'argent était là.
  const ouvertes = await openRemittances(cash.departmentId);
  if (!ouvertes.some((r) => r.holderId === user.id) && !hasGlobalView(user)) {
    return { ok: false, error: "Seule la personne qui détient la caisse y impute des dépenses." };
  }

  // LE TICKET FAIT LA DÉPENSE. Les articles achetés (catalogue ou saisie libre) donnent le
  // montant : un total saisi à côté du détail finirait par ne plus lui correspondre, et c'est
  // le budget qui deviendrait faux. À défaut de lignes — ancien formulaire, saisie rapide —
  // on retombe sur le couple libellé + montant.
  const rawLines = formData.get("lines");
  const read = await readReceipt(rawLines, fdStr(formData, "label"));
  if ("error" in read && rawLines) return { ok: false, error: read.error };
  const ticket = "error" in read ? null : read;

  const label = ticket ? ticket.label : fdStr(formData, "label");
  if (!label) return { ok: false, error: "Indiquez ce qui a été acheté." };
  const amount = ticket ? ticket.total : normalizeAmount(fdStr(formData, "amount"));
  if (typeof amount !== "number") return { ok: false, error: amount.error };

  const fund = continuousCash(ouvertes);
  const allowed = canSpendFromFund(fund, amount);
  if (!allowed.ok) return { ok: false, error: allowed.reason ?? "Dépense impossible." };
  // La dépense s'inscrit sur la remise EN MAIN la plus récente : le fond est un, mais chaque
  // sortie doit rester rattachée à une remise pour que l'historique se lise.
  const imputeSur = fund.currentId ?? cash.id;

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { ok: false, error: "Scannez la facture ou le bon de paiement : une dépense sans pièce n'est qu'une affirmation." };
  }
  // LA PIÈCE SE JUGE AVANT LA DÉPENSE — le même défaut que `addDepartmentExpense`, par sa seconde
  // porte. Contrôlé après la création, un fichier refusé laissait la dépense en base sans pièce
  // ni audit : sortie du fond et imputée au budget, sans rien qui la justifie, et chaque nouvel
  // essai en ajoutait une. Même règle que toutes les pièces jointes (`validateAttachments`).
  const pieceRefusee = await validateAttachments(files);
  if (pieceRefusee !== null) return { ok: false, error: pieceRefusee };

  const year = normalizeYear(fdStr(formData, "year"));
  // Un achat payé en liquide se classe dans le budget comme les autres : c'est la même dépense,
  // seul le moyen de paiement diffère. La case est revérifiée côté serveur.
  const budgetCategoryId = keepAllowedCategory(fdStr(formData, "budgetCategoryId"), await allowedGeneralMeansCategoryIds());
  const created = await prisma.departmentBudgetExpense.create({
    data: {
      departmentId: cash.departmentId,
      year,
      kind: "OPERATING",
      label,
      amount,
      budgetCategoryId,
      notes: fdStr(formData, "notes"),
      pettyCashId: imputeSur,
      createdById: user.id,
    },
    select: { id: true },
  });
  if (ticket) await saveReceiptLines(created.id, ticket.lines);

  for (const file of files) {
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
  const after = continuousCash(ouvertes.map((r) => (
    r.id === imputeSur ? { ...r, expenses: [...r.expenses, { id: created.id, amount }] } : r
  )));
  if (after.lowOnCash) {
    await notifyRoles(["SUPER_ADMIN", "DIRECTION"], {
      type: "GENERIC",
      title: "Caisse d'avance presque épuisée",
      body: `Il reste ${Math.max(0, after.remaining)} DZD en caisse.`,
      link: PATH,
    });
  }

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Budgets", entityType: "BUDGET", entityId: cash.departmentId,
    summary: `Dépense sur caisse d'avance — ${label} (${amount} DZD)`,
  });
  revalidatePath(PATH);
  revalidatePath("/budgets/departements");
  return { ok: true, id: created.id };
}

/**
 * DEMANDER UNE RALLONGE — par la détentrice, quand le fond s'épuise.
 *
 * Ce n'est pas une dotation budgétaire : c'est une demande d'ARGENT LIQUIDE, et elle doit
 * pouvoir être ACCORDÉE, REFUSÉE, ou accordée à un AUTRE MONTANT. Une simple notification ne
 * laissait rien à trancher et ne gardait aucune trace de ce qui avait été décidé.
 */
export async function requestPettyCashTopUp(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const cashId = fdStr(formData, "cashId");
  if (!cashId) return { ok: false, error: "Caisse non précisée." };
  const cash = await prisma.pettyCashAllotment.findUnique({
    where: { id: cashId },
    select: { id: true, departmentId: true, department: { select: { name: true } } },
  });
  if (!cash) return { ok: false, error: "Caisse introuvable." };
  const ouvertes = await openRemittances(cash.departmentId);
  if (!ouvertes.some((r) => r.holderId === user.id) && !hasGlobalView(user)) return { ok: false, error: "Non autorisé." };

  const amount = normalizeAmount(fdStr(formData, "amount"));
  if (typeof amount !== "number") return { ok: false, error: amount.error };
  if (amount <= 0) return { ok: false, error: "Indiquez le montant demandé." };

  const already = await prisma.pettyCashTopUpRequest.count({
    where: { allotmentId: { in: ouvertes.map((r) => r.id) }, status: "PENDING" },
  });
  if (already > 0) return { ok: false, error: "Une demande de rallonge est déjà en attente sur cette caisse." };

  const reason = fdStr(formData, "reason");
  await prisma.pettyCashTopUpRequest.create({
    data: { allotmentId: cashId, amountRequested: amount, reason, requestedById: user.id },
  });

  // CE QUI RESTE, C'EST LE FOND — pas ce qui reste sur la remise à laquelle la demande
  // s'accroche. Celui qui tranche décide sur le tiroir, pas sur une tranche.
  const remaining = continuousCash(ouvertes).remaining;
  await notifyRoles(["SUPER_ADMIN", "DIRECTION"], {
    type: "VALIDATION_REQUIRED",
    title: "Rallonge de caisse d'avance à trancher",
    body: `${cash.department.name} : +${amount} DZD demandés (il reste ${Math.max(0, remaining)} DZD en caisse)${reason ? ` — ${reason}` : ""}`,
    link: PATH,
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Budgets", entityType: "BUDGET", entityId: cash.departmentId,
    summary: `Rallonge de caisse demandée : +${amount} DZD`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * TRANCHER LA RALLONGE — les ressources humaines, au montant QU'ELLES écrivent.
 *
 * Accorder exactement ce qui a été demandé serait le cas particulier, pas la règle : les RH
 * ajustent. Le montant retenu est donc celui qu'elles saisissent, et il s'AJOUTE au fonds du
 * mois — ouvrir une seconde caisse rendrait le solde indécidable.
 */
export async function decidePettyCashTopUp(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canAllot(user)) return { ok: false, error: "Trancher une rallonge est réservé aux ressources humaines." };
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision");
  if (!id || (decision !== "APPROVED" && decision !== "REJECTED")) return { ok: false, error: "Décision invalide." };

  const req = await prisma.pettyCashTopUpRequest.findUnique({
    where: { id },
    include: { allotment: { include: { department: { select: { name: true, companyId: true } } } } },
  });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (req.status !== "PENDING") return { ok: false, error: "Cette demande a déjà été tranchée." };

  const written = fdNum(formData, "amountGranted");
  const granted = decision === "APPROVED"
    ? grantedTopUpAmount({ amountRequested: toNumber(req.amountRequested) }, written)
    : 0;
  if (granted < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };
  const note = fdStr(formData, "note");

  await prisma.pettyCashTopUpRequest.update({
    where: { id },
    data: {
      status: decision,
      amountGranted: decision === "APPROVED" ? granted : null,
      decidedById: user.id, decidedAt: new Date(), decisionNote: note,
    },
  });

  if (decision === "APPROVED" && granted > 0) {
    // La rallonge s'AJOUTE au fonds du mois : deux caisses simultanées rendraient le solde
    // indécidable — laquelle vide-t-on ?
    await prisma.pettyCashAllotment.update({
      where: { id: req.allotmentId },
      data: { amount: { increment: granted } },
    });

    // ── ET ELLE S'ÉCRIT AU LIVRE, COMME LA REMISE (§118.148) ──────────────────────────────
    //
    // L'argent quitte la banque pour la caisse exactement comme à la remise ; la remise écrivait
    // sa sortie, la rallonge non — le fond grossissait et le livre ignorait le décaissement.
    // Même écriture, même best-effort : l'argent prime, et une écriture manquante se voit au
    // contrôle du livre plutôt que de bloquer une caisse vide.
    const holderName = req.allotment.holderId
      ? (await prisma.user.findUnique({ where: { id: req.allotment.holderId }, select: { name: true } }))?.name ?? null
      : null;
    const tx = await prisma.financeTransaction
      .create({
        data: {
          reference: await nextFinanceRef(),
          date: new Date(),
          direction: "OUT",
          category: "AUTRE",
          label: `Rallonge de caisse d'avance — ${req.allotment.department.name} (${periodLabel(req.allotment.period)})`,
          amount: granted,
          method: "CASH",
          account: "Caisse",
          counterparty: holderName,
          status: "SETTLED",
          companyId: req.allotment.department.companyId,
          treasuryAccountId: await compteDeLEcriture({ compte: "Caisse", societeId: req.allotment.department.companyId }),
          createdById: user.id,
        },
        select: { id: true },
      })
      .catch((e) => {
        console.error("[petty-cash] écriture de la rallonge non passée", e);
        return null;
      });
    if (tx) {
      await prisma.pettyCashTopUpRequest.update({ where: { id }, data: { transactionId: tx.id } }).catch(() => undefined);
    }
  }

  if (req.requestedById) {
    await notifyUser({
      userId: req.requestedById, type: "GENERIC",
      title: decision === "APPROVED" ? "Rallonge accordée" : "Rallonge refusée",
      body: decision === "APPROVED"
        ? `${granted} DZD ajoutés à la caisse d'avance${note ? ` — ${note}` : ""}`
        : `Demande refusée${note ? ` — ${note}` : ""}`,
      link: PATH,
    });
  }
  await recordAudit({
    actorId: user.id, action: decision === "APPROVED" ? "VALIDATE" : "REFUSE", module: "Budgets",
    entityType: "BUDGET", entityId: req.allotment.departmentId,
    summary: `Rallonge de caisse ${decision === "APPROVED" ? `accordée (${granted} DZD)` : "refusée"} — ${req.allotment.department.name}`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * RÉGLER LE MONTANT MENSUEL — par les ressources humaines.
 *
 * Sans ce réglage, la caisse dépendait d'un geste dont personne ne se souvenait à date fixe, et
 * l'on ne pouvait prévenir de rien faute de savoir quand le rechargement était attendu. Le jour
 * est borné à 28 : le 31 n'existe pas tous les mois, et une date fantôme ne déclencherait jamais
 * le rappel.
 */
export async function setPettyCashPlan(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canAllot(user)) return { ok: false, error: "Régler la caisse mensuelle est réservé aux ressources humaines." };
  const departmentId = fdStr(formData, "departmentId");
  if (!departmentId) return { ok: false, error: "Département non précisé." };
  const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } });
  if (!department) return { ok: false, error: "Département introuvable." };

  const monthlyAmount = normalizeAmount(fdStr(formData, "monthlyAmount"));
  if (typeof monthlyAmount !== "number") return { ok: false, error: monthlyAmount.error };
  const rechargeDay = normalizeRechargeDay(fdStr(formData, "rechargeDay"));
  const holderId = fdStr(formData, "holderId");
  // ABSENT = actif (un plan qu'on crée sans toucher à la case l'est) ; le témoin caché « 0 » seul =
  // suspendu ; la case cochée (« 0 » PUIS « 1 ») = actif. Lu par `fdStr`, le témoin passait
  // devant la case et suspendait le plan à chaque enregistrement ; sans témoin, décocher ne
  // suspendait rien (§118.172).
  const isActive = fdCase(formData, "isActive") ?? true;

  const data = { monthlyAmount, rechargeDay, holderId, isActive, setById: user.id };
  await prisma.pettyCashPlan.upsert({
    where: { departmentId },
    create: { departmentId, ...data },
    update: data,
  });

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Budgets", entityType: "BUDGET", entityId: departmentId,
    summary: `Caisse mensuelle réglée — ${department.name} : ${monthlyAmount} DZD le ${rechargeDay} du mois`,
  });
  if (holderId) {
    await notifyUser({
      userId: holderId, type: "GENERIC", title: "Caisse d'avance — réglage mensuel",
      body: `${monthlyAmount} DZD vous seront remis le ${rechargeDay} de chaque mois.`, link: PATH,
    });
  }
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * RAPPEL AUX RH, 48 H AVANT LE RECHARGEMENT — appelé par le planificateur.
 *
 * Prévenir le jour même ne sert à rien : sortir la somme demande une préparation. Le rappel
 * n'est envoyé qu'UNE fois par échéance (`lastReminderPeriod`), sans quoi le battement du
 * planificateur — qui repasse toutes les minutes — enverrait la même alerte des centaines de
 * fois. La règle elle-même est une fonction pure, testée : voir `shouldRemindRecharge`.
 */
export async function runPettyCashRechargeReminders(now = new Date()): Promise<number> {
  const { shouldRemindRecharge } = await import("@/lib/petty-cash");
  const plans = await prisma.pettyCashPlan
    .findMany({ where: { isActive: true }, include: { department: { select: { name: true } } } })
    .catch(() => []);
  let sent = 0;
  for (const plan of plans) {
    const r = shouldRemindRecharge(
      { rechargeDay: plan.rechargeDay, isActive: plan.isActive, lastReminderPeriod: plan.lastReminderPeriod },
      now,
    );
    if (!r.due) continue;
    await notifyRoles(["SUPER_ADMIN", "DIRECTION"], {
      type: "GENERIC",
      title: "Caisse d'avance — rechargement dans 48 h",
      body: `${plan.department.name} : ${toNumber(plan.monthlyAmount)} DZD à remettre le ${r.at.toLocaleDateString("fr-FR")}. La remise passe par le centre de paiement : envoyez-la dès maintenant pour qu'elle soit autorisée et versée à temps.`,
      link: PATH,
    });
    await prisma.pettyCashPlan.update({ where: { id: plan.id }, data: { lastReminderPeriod: r.period } });
    sent += 1;
  }
  return sent;
}

/** La prochaine échéance de rechargement d'un département — pour l'afficher à l'écran. */
export async function nextRechargeFor(departmentId: string, now = new Date()): Promise<Date | null> {
  const plan = await prisma.pettyCashPlan.findUnique({ where: { departmentId }, select: { rechargeDay: true, isActive: true } });
  if (!plan || !plan.isActive) return null;
  return nextRechargeDate(plan.rechargeDay, now);
}
