"use server";

import type {
  EntityType, PaymentDeadlineNature, PaymentPieceKind, PaymentPieceStatus,
  PaymentRequestStatus, PaymentUrgency,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { buildRef, createWithRetry } from "@/lib/refs";
import { companyIdForNew } from "@/lib/company";
import { persistUploadedDocument } from "@/lib/documents";
import { createExpenseOrder } from "@/lib/expense-orders";
import { toNumber } from "@/lib/utils";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";
import {
  nextPaymentStatus, statusFromPieces, canApprove, canResubmit, isClosed, isWithFinance,
  needsReplacement, type PaymentMove,
} from "@/lib/finance/payment-request";
import { canSubmitDossier } from "@/lib/finance/payment-dossier";
import { deadlineNatureOf } from "@/lib/finance/deadline-nature";
import { ENTITY_MODULE } from "@/lib/entity-access";

const PATH = "/validations/paiements";

/**
 * LA DEMANDE DE PAIEMENT — le dossier qui part aux Finances, et qui revient.
 *
 * Ce qui distingue ce circuit d'une validation ordinaire : **la discussion se tient pièce par
 * pièce**. Les Finances acceptent la facture, demandent à revoir le bon de commande, refusent le
 * devis périmé — et le demandeur ne reprend QUE ce qui est en cause. Le dossier reste le même
 * d'un tour à l'autre : c'est lui qui porte l'historique des refus, celui qu'on relit quand on se
 * demande pourquoi le paiement a pris trois semaines.
 *
 * L'état du dossier n'est jamais saisi à la main : il se DÉDUIT des verdicts (`statusFromPieces`).
 * Personne ne pense à changer un statut en même temps qu'il refuse une facture.
 */

/** Les Finances — celles qui instruisent. La Direction supplée, comme partout ailleurs. */
function isFinance(user: SessionUser): boolean {
  return user.role === "FINANCE_BUDGET_MANAGER"
    || userCan(user, "FINANCES", "VALIDATE")
    || userCan(user, "FINANCES", "UPDATE")
    || hasGlobalView(user.role);
}

function isRequester(user: SessionUser, req: { requesterId: string }): boolean {
  return req.requesterId === user.id || hasGlobalView(user.role);
}

async function nextRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.paymentRequest.findMany({
    where: { reference: { startsWith: `PAY-${year}-` } }, select: { reference: true },
  });
  return buildRef("PAY", year, refs.map((r) => r.reference));
}

function revalidate(id?: string) {
  revalidatePath("/validations");
  revalidatePath(PATH);
  if (id) revalidatePath(`${PATH}/${id}`);
}

/** Le fil du dossier : chaque geste laisse une trace lisible, dans l'ordre. */
async function trace(requestId: string, actorId: string | null, kind: string, message?: string | null, pieceId?: string | null) {
  await prisma.paymentRequestEvent.create({
    data: { requestId, actorId, kind, message: message || null, pieceId: pieceId || null },
  });
}

const dateOf = (raw: string | null): Date | null => {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const urgencyOf = (raw: string | null): PaymentUrgency => {
  const allowed: PaymentUrgency[] = ["WHEN_POSSIBLE", "THIS_MONTH", "THIS_WEEK", "URGENT"];
  return allowed.includes(raw as PaymentUrgency) ? (raw as PaymentUrgency) : "WHEN_POSSIBLE";
};

const kindOf = (raw: string | null): PaymentPieceKind => {
  const allowed: PaymentPieceKind[] = ["INVOICE", "PURCHASE_ORDER", "QUOTE", "DELIVERY_NOTE", "CONTRACT", "PROOF", "OTHER"];
  return allowed.includes(raw as PaymentPieceKind) ? (raw as PaymentPieceKind) : "OTHER";
};

/**
 * LE RATTACHEMENT, validé contre la liste réelle des types d'entité.
 *
 * C'est lui qui décide de l'EXEMPTION du bon de versement (`isBonDeVersement`) : il ne peut donc
 * pas être un texte libre. `ENTITY_MODULE` couvre exactement l'énumération Prisma — une valeur
 * absente retombe sur « aucun rattachement », et la demande passe par la règle commune.
 */
const entityTypeOf = (raw: string | null): EntityType | null =>
  raw && raw in ENTITY_MODULE ? (raw as EntityType) : null;

/** Une case cochée arrive « on » ; tout le reste vaut non coché. */
const checked = (formData: FormData, name: string): boolean => {
  const v = formData.get(name);
  return v === "on" || v === "1" || v === "true";
};

/**
 * PRÉVENIR QUI DOIT AGIR — le CENTRE, puis les Finances seulement une fois autorisé.
 *
 * Une demande transmise n'attend pas les Finances : elle attend le centre de paiement, qui
 * autorise avant qu'elles ne voient quoi que ce soit. Les prévenir à ce moment-là leur annonçait
 * un travail qu'elles ne pouvaient pas commencer — et noyait la vraie alerte, celle du centre.
 *
 * Le destinataire nommé n'existe plus à la création ; il survit sur les demandes anciennes, et on
 * continue de le prévenir quand il y en a un : sa demande est la sienne, il doit la suivre.
 */
async function alertFinance(req: { id: string; reference: string; title: string; recipientId: string | null }, title: string) {
  const body = `${req.reference} — ${req.title}`;
  const link = `${PATH}/${req.id}`;
  if (req.recipientId) await notifyUser({ userId: req.recipientId, type: "VALIDATION_REQUIRED", title, body, link });
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "VALIDATION_REQUIRED", title, body, link });
}

/** Recalcule l'état d'après les verdicts, et le trace s'il change. */
async function syncStatus(requestId: string, current: string, actorId: string | null): Promise<string> {
  const pieces = await prisma.paymentPiece.findMany({ where: { requestId }, select: { status: true } });
  const next = statusFromPieces(current, pieces);
  if (!next) return current;
  await prisma.paymentRequest.update({ where: { id: requestId }, data: { status: next as PaymentRequestStatus } });
  await trace(requestId, actorId, next === "CHANGES_REQUESTED" ? "CHANGES" : "SUBMIT", "État recalculé d'après les verdicts des pièces.");
  return next;
}

// ───────────────────────── Création ─────────────────────────

/**
 * Créer la demande et déposer ses premières pièces, EN UNE FOIS.
 *
 * Les pièces arrivent avec leur commentaire (`note_0`, `note_1`…) et leur nature (`kind_0`…) :
 * « voici la facture, le montant TTC inclut la livraison » appelle une réponse sur CETTE pièce,
 * pas un message général qu'il faudra rattacher de tête.
 */
export async function createPaymentRequest(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!userCan(user, "VALIDATIONS", "CREATE")) return { ok: false, error: "Non autorisé." };

    const title = fdStr(formData, "title");
    const payee = fdStr(formData, "payee");
    const amount = fdNum(formData, "amount");
    if (!title) return { ok: false, error: "Indiquez l'objet du paiement." };
    if (!payee) return { ok: false, error: "Indiquez le bénéficiaire — à qui l'argent doit aller." };
    if (amount == null || amount <= 0) return { ok: false, error: "Indiquez le montant à payer." };

    const submit = fdStr(formData, "submit") !== "0";
    const companyId = fdStr(formData, "companyId") || (await companyIdForNew(user.id));
    const entityType = entityTypeOf(fdStr(formData, "entityType"));
    const paymentMethodStated = checked(formData, "paymentMethodStated");
    const deadlineNature = deadlineNatureOf(fdStr(formData, "deadlineNature")) as PaymentDeadlineNature;

    // UNE DEMANDE TRANSMISE PORTE SA JUSTIFICATION — un BON DE COMMANDE ou une FACTURE, et la
    // déclaration que le moyen de paiement y figure. Le centre de paiement autorise une sortie
    // d'argent : sans l'un ou l'autre, il autorise une phrase ; sans le moyen de paiement, la
    // comptabilité sait quoi payer mais pas comment, et le dossier repart trois jours pour un RIB.
    //
    // L'exception est le BON DE VERSEMENT (information médicale), qui n'a ni bon ni facture et ne
    // peut pas en avoir : sa quittance n'existe qu'APRÈS le versement. Toute la règle vit dans
    // `finance/payment-dossier.ts` — module pur, testé, partagé avec le formulaire qui l'annonce
    // AVANT qu'on essaie d'envoyer.
    //
    // Un BROUILLON n'est pas concerné : il n'engage rien, il se garde incomplet, c'est sa raison
    // d'être.
    const joints = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (submit) {
      const gate = canSubmitDossier({
        entityType,
        pieces: joints.map((_, i) => ({ kind: kindOf(fdStr(formData, `kind_${i}`)) })),
        paymentMethodStated,
      });
      if (!gate.ok) return { ok: false, error: gate.reason ?? "Le dossier est incomplet." };
    }

    const req = await createWithRetry(async () =>
      prisma.paymentRequest.create({
        data: {
          reference: await nextRef(),
          title,
          description: fdStr(formData, "description"),
          amount,
          payee,
          // PLUS DE DESTINATAIRE À LA CRÉATION. Depuis que le centre de paiement est le guichet
          // unique, les Finances ne voient rien avant l'autorisation : désigner l'une d'elles
          // nommait quelqu'un qui ne pouvait pas encore agir, et faisait dormir la demande
          // jusqu'au retour de l'intéressé s'il était absent. Le champ SURVIT sur les demandes
          // anciennes — il porte leur historique, et la garde d'accès du dossier s'en sert.
          recipientId: null,
          companyId: companyId || null,
          dueDate: dateOf(fdStr(formData, "dueDate")),
          deadlineNature,
          urgency: urgencyOf(fdStr(formData, "urgency")),
          paymentMethodStated,
          // Le contact du bénéficiaire — facultatif, et c'est délibéré : une autorité sanitaire
          // n'a pas d'interlocuteur nommé, et rendre obligatoire ce qui n'est pas toujours
          // pertinent apprend à remplir les champs pour rien.
          contactName: fdStr(formData, "contactName"),
          contactPhone: fdStr(formData, "contactPhone"),
          contactEmail: fdStr(formData, "contactEmail"),
          status: submit ? "SUBMITTED" : "DRAFT",
          submittedAt: submit ? new Date() : null,
          requesterId: user.id,
          // LE RATTACHEMENT EST POSÉ ICI, à la création — pas dans une mise à jour qui suivrait.
          // C'est lui qui ouvre (ou non) l'exemption du bon de versement : le fixer après coup
          // reviendrait à contrôler la règle sur une demande qui ne dit pas encore ce qu'elle est.
          entityType,
          entityId: entityType ? fdStr(formData, "entityId") : null,
          link: fdStr(formData, "link"),
        },
      }),
    );

    // Les pièces du premier dépôt. Un échec d'enregistrement ne doit pas emporter la demande :
    // on préfère un dossier créé auquel il manque une pièce — visible, corrigeable — à un
    // formulaire perdu avec tout ce qui avait été saisi.
    const files = joints;
    for (const [i, file] of files.entries()) {
      try {
        const doc = await persistUploadedDocument(user.id, {
          entityType: "PAYMENT_REQUEST", entityId: req.id,
          category: "OTHER", confidentiality: "INTERNAL", stepKey: null, file,
        });
        if (!doc.ok || !doc.documentId) throw new Error(doc.error ?? "Enregistrement impossible.");
        await prisma.paymentPiece.create({
          data: {
            requestId: req.id, documentId: doc.documentId,
            kind: kindOf(fdStr(formData, `kind_${i}`)),
            note: fdStr(formData, `note_${i}`),
            position: i, createdById: user.id,
          },
        });
      } catch (e) {
        console.error("[payment] pièce non enregistrée", e);
      }
    }

    // TRANSMETTRE, C'EST ENTRER AU CENTRE. La demande déposée directement (sans passer par le
    // brouillon) suit le même chemin que celle transmise depuis la fiche : l'ordre de dépense naît
    // ici, en attente du centre. Un brouillon, lui, n'engage rien et n'y entre pas.
    if (submit) {
      const order = await createExpenseOrder({
        label: `${req.reference} — ${req.title}`,
        amount, category: "FOURNISSEUR", beneficiary: payee,
        sourceType: "PAYMENT_REQUEST", sourceId: req.id,
        requestedById: user.id, dueDate: dateOf(fdStr(formData, "dueDate")),
        deadlineNature,
        notes: fdStr(formData, "description"),
      });
      await prisma.paymentRequest.update({ where: { id: req.id }, data: { expenseOrderId: order.id } });
    }
    await trace(req.id, user.id, submit ? "SUBMIT" : "COMMENT", submit ? "Demande transmise au centre de paiement." : "Brouillon créé.");
    await recordAudit({
      actorId: user.id, action: "CREATE", module: "Demandes de paiement",
      entityType: "PAYMENT_REQUEST", entityId: req.id,
      summary: `Demande de paiement ${req.reference} — ${payee} · ${amount} DZD`,
    });
    revalidate(req.id);
    return { ok: true, id: req.id };
  } catch (err) {
    console.error("[payment] createPaymentRequest failed", err);
    return { ok: false, error: "La demande n'a pas pu être créée. Réessayez dans un instant." };
  }
}

// ───────────────────────── Pièces ─────────────────────────

/**
 * Ajouter une pièce — ou REMPLACER celle que les Finances ont refusée.
 *
 * Le remplacement ne supprime pas l'originale : c'est elle qui explique pourquoi il y a eu un
 * second tour. Elle passe simplement derrière sa remplaçante dans la liste.
 */
export async function addPaymentPiece(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const requestId = fdStr(formData, "requestId");
    if (!requestId) return { ok: false, error: "Demande introuvable." };
    const req = await prisma.paymentRequest.findUnique({ where: { id: requestId } });
    if (!req) return { ok: false, error: "Demande introuvable." };
    if (!isRequester(user, req) && !isFinance(user)) return { ok: false, error: "Non autorisé." };
    if (isClosed(req.status)) return { ok: false, error: "Ce dossier est clos : il ne reçoit plus de pièce." };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choisissez un fichier." };

    const replacesId = fdStr(formData, "replacesId");
    if (replacesId) {
      const old = await prisma.paymentPiece.findUnique({ where: { id: replacesId }, select: { requestId: true, status: true, replacedBy: { select: { id: true } } } });
      if (!old || old.requestId !== requestId) return { ok: false, error: "Pièce à remplacer introuvable." };
      // Une pièce acceptée n'a pas à être remplacée — et une pièce déjà reprise ne l'est pas deux
      // fois, sinon la chaîne des versions se dédouble et l'on ne sait plus laquelle fait foi.
      if (!needsReplacement(old.status)) return { ok: false, error: "Cette pièce n'a pas été mise en cause." };
      if (old.replacedBy) return { ok: false, error: "Cette pièce a déjà été remplacée." };
    }

    const doc = await persistUploadedDocument(user.id, {
      entityType: "PAYMENT_REQUEST", entityId: requestId,
      category: "OTHER", confidentiality: "INTERNAL", stepKey: null, file,
    });
    if (!doc.ok || !doc.documentId) return { ok: false, error: doc.error ?? "Le fichier n'a pas pu être enregistré." };
    const count = await prisma.paymentPiece.count({ where: { requestId } });
    const piece = await prisma.paymentPiece.create({
      data: {
        requestId, documentId: doc.documentId,
        kind: kindOf(fdStr(formData, "kind")),
        note: fdStr(formData, "note"),
        replacesId: replacesId || null,
        position: count, createdById: user.id,
      },
    });

    // La pièce remplacée sort du décompte : elle a été reprise, elle ne bloque plus rien.
    if (replacesId) {
      await prisma.paymentPiece.update({ where: { id: replacesId }, data: { status: "ACCEPTED", reviewNote: "Remplacée par une nouvelle version." } });
    }
    await trace(requestId, user.id, "PIECE_ADDED", replacesId ? "Pièce remplacée." : "Pièce ajoutée.", piece.id);
    await syncStatus(requestId, req.status, user.id);
    revalidate(requestId);
    return { ok: true, id: piece.id };
  } catch (err) {
    console.error("[payment] addPaymentPiece failed", err);
    return { ok: false, error: "La pièce n'a pas pu être ajoutée." };
  }
}

/**
 * CE QUE LE DEMANDEUR PEUT ENCORE PRÉCISER APRÈS COUP — la déclaration du moyen de paiement et
 * le contact du bénéficiaire.
 *
 * Sans cette action, un brouillon créé avant que la case n'existe, ou un dossier renvoyé pour
 * correction, serait bloqué à la transmission sans aucun moyen de se débloquer : le formulaire de
 * création est passé, et rien d'autre n'écrit ce champ. C'est exactement le cul-de-sac que la
 * règle est censée éviter.
 *
 * La case est une ATTESTATION : « j'ai la pièce sous les yeux et elle porte le RIB ». Seul le
 * demandeur la coche — les Finances ne peuvent pas attester à sa place de ce qu'elles n'ont pas
 * fourni.
 */
export async function updatePaymentRequestDetails(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    if (!id) return { ok: false, error: "Demande introuvable." };
    const req = await prisma.paymentRequest.findUnique({ where: { id } });
    if (!req) return { ok: false, error: "Demande introuvable." };
    if (!isRequester(user, req)) return { ok: false, error: "Seul le demandeur complète sa demande." };
    if (isClosed(req.status)) return { ok: false, error: "Ce dossier est clos." };

    const paymentMethodStated = checked(formData, "paymentMethodStated");
    await prisma.paymentRequest.update({
      where: { id },
      data: {
        paymentMethodStated,
        contactName: fdStr(formData, "contactName"),
        contactPhone: fdStr(formData, "contactPhone"),
        contactEmail: fdStr(formData, "contactEmail"),
      },
    });
    if (paymentMethodStated !== req.paymentMethodStated) {
      await trace(id, user.id, "COMMENT", paymentMethodStated
        ? "Le demandeur déclare que le moyen de paiement figure sur le document."
        : "Le demandeur retire sa déclaration sur le moyen de paiement.");
    }
    revalidate(id);
    return { ok: true, id };
  } catch (err) {
    console.error("[payment] updatePaymentRequestDetails failed", err);
    return { ok: false, error: "Les précisions n'ont pas pu être enregistrées." };
  }
}

/** Le demandeur précise ou corrige le commentaire d'une de ses pièces. */
export async function commentPaymentPiece(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const pieceId = fdStr(formData, "pieceId");
    if (!pieceId) return { ok: false, error: "Pièce introuvable." };
    const piece = await prisma.paymentPiece.findUnique({ where: { id: pieceId }, include: { request: true } });
    if (!piece) return { ok: false, error: "Pièce introuvable." };
    if (!isRequester(user, piece.request)) return { ok: false, error: "Seul le demandeur commente ses pièces." };
    if (isClosed(piece.request.status)) return { ok: false, error: "Ce dossier est clos." };

    const note = fdStr(formData, "note");
    await prisma.paymentPiece.update({ where: { id: pieceId }, data: { note } });
    await trace(piece.requestId, user.id, "COMMENT", note, pieceId);
    revalidate(piece.requestId);
    return { ok: true, id: piece.requestId };
  } catch (err) {
    console.error("[payment] commentPaymentPiece failed", err);
    return { ok: false, error: "Le commentaire n'a pas pu être enregistré." };
  }
}

/** Les Finances se prononcent sur UNE pièce — accepter, faire revoir, refuser. */
export async function reviewPaymentPiece(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!isFinance(user)) return { ok: false, error: "L'examen des pièces revient aux Finances." };
    const pieceId = fdStr(formData, "pieceId");
    const verdict = fdStr(formData, "verdict");
    const allowed: PaymentPieceStatus[] = ["PENDING", "ACCEPTED", "CHANGES_REQUESTED", "REJECTED"];
    if (!pieceId || !allowed.includes(verdict as PaymentPieceStatus)) return { ok: false, error: "Verdict invalide." };

    const piece = await prisma.paymentPiece.findUnique({ where: { id: pieceId }, include: { request: true } });
    if (!piece) return { ok: false, error: "Pièce introuvable." };
    if (isClosed(piece.request.status)) return { ok: false, error: "Ce dossier est clos." };

    const reviewNote = fdStr(formData, "note");
    // Mettre en cause une pièce SANS dire pourquoi renvoie le demandeur deviner : c'est le
    // deuxième aller-retour garanti.
    if ((verdict === "CHANGES_REQUESTED" || verdict === "REJECTED") && !reviewNote) {
      return { ok: false, error: "Dites ce qui ne va pas — sans motif, la pièce reviendra identique." };
    }

    await prisma.paymentPiece.update({
      where: { id: pieceId },
      data: {
        status: verdict as PaymentPieceStatus,
        reviewNote,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
    await trace(piece.requestId, user.id, "PIECE_REVIEWED", `${verdict}${reviewNote ? ` — ${reviewNote}` : ""}`, pieceId);

    // Le dossier passe automatiquement au demandeur si une pièce est mise en cause.
    const before = piece.request.status;
    const after = await syncStatus(piece.requestId, before, user.id);
    if (after !== before && after === "CHANGES_REQUESTED") {
      await notifyUser({
        userId: piece.request.requesterId, type: "GENERIC",
        title: "Demande de paiement — pièces à revoir",
        body: `${piece.request.reference} — ${piece.request.title}`,
        link: `${PATH}/${piece.requestId}`,
      });
    }
    revalidate(piece.requestId);
    return { ok: true, id: piece.requestId };
  } catch (err) {
    console.error("[payment] reviewPaymentPiece failed", err);
    return { ok: false, error: "Le verdict n'a pas pu être enregistré." };
  }
}

// ───────────────────────── Circuit du dossier ─────────────────────────

/** Un message libre dans le fil — les deux côtés peuvent en écrire. */
export async function addPaymentComment(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const requestId = fdStr(formData, "requestId");
    const message = fdStr(formData, "message");
    if (!requestId || !message) return { ok: false, error: "Écrivez un message." };
    const req = await prisma.paymentRequest.findUnique({ where: { id: requestId } });
    if (!req) return { ok: false, error: "Demande introuvable." };
    if (!isRequester(user, req) && !isFinance(user) && req.recipientId !== user.id) return { ok: false, error: "Non autorisé." };

    await trace(requestId, user.id, "COMMENT", message);
    const other = isRequester(user, req) ? req.recipientId : req.requesterId;
    if (other && other !== user.id) {
      await notifyUser({ userId: other, type: "GENERIC", title: "Demande de paiement — nouveau message", body: `${req.reference} — ${message.slice(0, 120)}`, link: `${PATH}/${requestId}` });
    }
    revalidate(requestId);
    return { ok: true, id: requestId };
  } catch (err) {
    console.error("[payment] addPaymentComment failed", err);
    return { ok: false, error: "Le message n'a pas pu être envoyé." };
  }
}

/** Le demandeur (re)transmet son dossier aux Finances. */
export async function submitPaymentRequest(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    if (!id) return { ok: false, error: "Demande introuvable." };
    // `kind` autant que `status` : la complétude du dossier se juge sur la NATURE des pièces
    // (bon de commande ou facture), leur verdict ne dit rien de ce qui manque.
    const req = await prisma.paymentRequest.findUnique({ where: { id }, include: { pieces: { select: { status: true, kind: true } } } });
    if (!req) return { ok: false, error: "Demande introuvable." };
    if (!isRequester(user, req)) return { ok: false, error: "Seul le demandeur transmet son dossier." };

    const check = canResubmit(req, req.pieces);
    if (!check.ok) return { ok: false, error: check.reason ?? "Transmission impossible." };
    const next = nextPaymentStatus(req.status, "SUBMIT");
    if (!next) return { ok: false, error: "Ce dossier n'est pas en attente d'envoi." };

    await prisma.paymentRequest.update({ where: { id }, data: { status: next as PaymentRequestStatus, submittedAt: new Date() } });

    // LE DOSSIER ENTRE AU CENTRE DE PAIEMENT DÈS LA SOUMISSION, pas au bon à payer.
    //
    // C'était l'inversion la plus coûteuse du circuit : l'ordre de dépense ne naissait qu'APRÈS
    // l'instruction des Finances, si bien qu'elles épluchaient pièce par pièce des dossiers que le
    // centre refuserait peut-être ensuite. Le centre tranche d'abord — c'est lui qui dit si
    // l'entreprise engage cet argent —, les Finances instruisent et paient ce qui est autorisé.
    //
    // L'ordre n'est créé qu'UNE FOIS : après un renvoi pour correction, le dossier est resoumis
    // mais `expenseOrderId` est déjà posé, et le centre retrouve le même dossier dans son fil.
    if (!req.expenseOrderId) {
      const order = await createExpenseOrder({
        label: `${req.reference} — ${req.title}`,
        amount: toNumber(req.amount),
        category: "FOURNISSEUR",
        beneficiary: req.payee,
        sourceType: "PAYMENT_REQUEST",
        sourceId: req.id,
        requestedById: req.requesterId,
        dueDate: req.dueDate,
        deadlineNature: req.deadlineNature,
        notes: fdStr(formData, "note") ?? null,
      });
      await prisma.paymentRequest.update({ where: { id }, data: { expenseOrderId: order.id } });
    }

    await trace(id, user.id, "SUBMIT", fdStr(formData, "note") ?? "Dossier transmis au centre de paiement.");
    revalidate(id);
    return { ok: true, id };
  } catch (err) {
    console.error("[payment] submitPaymentRequest failed", err);
    return { ok: false, error: "La transmission a échoué." };
  }
}

/**
 * La décision des Finances : instruire, mettre en attente, reprendre, renvoyer, payer, refuser.
 *
 * Un seul point d'entrée pour tous ces gestes, parce qu'ils partagent la même garde et la même
 * trace. Ce qui les distingue est dans la table de transitions, pas ici.
 */
export async function decidePaymentRequest(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!isFinance(user)) return { ok: false, error: "La décision revient aux Finances." };
    const id = fdStr(formData, "id");
    const move = fdStr(formData, "move") as PaymentMove | null;
    const moves: PaymentMove[] = ["REVIEW", "HOLD", "RESUME", "REQUEST_CHANGES", "APPROVE", "REJECT"];
    if (!id || !move || !moves.includes(move)) return { ok: false, error: "Geste inconnu." };

    const req = await prisma.paymentRequest.findUnique({ where: { id }, include: { pieces: { select: { status: true, kind: true } } } });
    if (!req) return { ok: false, error: "Demande introuvable." };

    const next = nextPaymentStatus(req.status, move);
    if (!next) return { ok: false, error: "Ce geste n'a pas de sens à ce stade du dossier." };

    const note = fdStr(formData, "note");
    // Une mise en attente sans motif ne dit rien à personne — et le demandeur relancera.
    if (move === "HOLD" && !note) return { ok: false, error: "Dites pourquoi le dossier est mis en attente." };
    if (move === "REJECT" && !note) return { ok: false, error: "Un refus se motive : c'est ce que lira le demandeur." };
    if (move === "APPROVE") {
      const check = canApprove(
        { status: req.status, amount: toNumber(req.amount), entityType: req.entityType, paymentMethodStated: req.paymentMethodStated },
        req.pieces,
      );
      if (!check.ok) return { ok: false, error: check.reason ?? "Bon à payer impossible." };
    }

    await prisma.paymentRequest.update({
      where: { id },
      data: {
        status: next as PaymentRequestStatus,
        holdReason: move === "HOLD" ? note : move === "RESUME" ? null : req.holdReason,
        decisionNote: move === "APPROVE" || move === "REJECT" || move === "REQUEST_CHANGES" ? note : req.decisionNote,
        decidedById: move === "APPROVE" || move === "REJECT" ? user.id : req.decidedById,
        decidedAt: move === "APPROVE" || move === "REJECT" ? new Date() : req.decidedAt,
      },
    });
    await trace(id, user.id, move, note);

    // L'ORDRE DE DÉPENSE EXISTE DÉJÀ : il est né à la soumission, et le centre l'a autorisé avant
    // que ce dossier n'arrive ici. Le bon à payer ne le crée donc plus — il constate que les
    // pièces sont conformes. Le verrou du décaissement reste `canDisburse`, au règlement.
    // Filet pour les dossiers ANTÉRIEURS à cette règle, soumis quand l'ordre naissait ici :
    // sans lui, ils n'auraient jamais de règlement.
    if (move === "APPROVE" && !req.expenseOrderId) {
      const order = await createExpenseOrder({
        label: `${req.reference} — ${req.title}`,
        amount: toNumber(req.amount),
        category: "FOURNISSEUR",
        beneficiary: req.payee,
        sourceType: "PAYMENT_REQUEST",
        sourceId: req.id,
        requestedById: req.requesterId,
        dueDate: req.dueDate,
        deadlineNature: req.deadlineNature,
        notes: note ?? null,
      });
      await prisma.paymentRequest.update({ where: { id }, data: { expenseOrderId: order.id } });
    }

    if (move !== "REVIEW") {
      const titles: Record<string, string> = {
        HOLD: "Demande de paiement mise en attente",
        RESUME: "Demande de paiement reprise",
        REQUEST_CHANGES: "Demande de paiement — pièces à revoir",
        APPROVE: "Bon à payer accordé",
        REJECT: "Demande de paiement refusée",
      };
      await notifyUser({
        userId: req.requesterId, type: "GENERIC",
        title: titles[move] ?? "Demande de paiement",
        body: `${req.reference} — ${req.title}`, link: `${PATH}/${id}`,
      });
    }
    await recordAudit({
      actorId: user.id, action: move === "APPROVE" ? "VALIDATE" : "UPDATE", module: "Demandes de paiement",
      entityType: "PAYMENT_REQUEST", entityId: id, summary: `${move} — ${req.reference}`,
    });
    revalidate(id);
    return { ok: true, id };
  } catch (err) {
    console.error("[payment] decidePaymentRequest failed", err);
    return { ok: false, error: "La décision n'a pas pu être enregistrée." };
  }
}

/** Le demandeur retire son dossier. */
export async function cancelPaymentRequest(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    if (!id) return { ok: false, error: "Demande introuvable." };
    const req = await prisma.paymentRequest.findUnique({ where: { id } });
    if (!req) return { ok: false, error: "Demande introuvable." };
    if (!isRequester(user, req)) return { ok: false, error: "Seul le demandeur retire sa demande." };
    if (!nextPaymentStatus(req.status, "CANCEL")) return { ok: false, error: "Ce dossier est déjà clos." };

    await prisma.paymentRequest.update({ where: { id }, data: { status: "CANCELLED" } });
    await trace(id, user.id, "CANCEL", fdStr(formData, "note"));
    if (isWithFinance(req.status)) await alertFinance(req, "Demande de paiement retirée");
    revalidate(id);
    return { ok: true, id };
  } catch (err) {
    console.error("[payment] cancelPaymentRequest failed", err);
    return { ok: false, error: "L'opération a échoué." };
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUI VIVAIT ICI, ET POURQUOI CE N'EST PLUS LÀ.
 *
 * `askPaymentValidation` (faire valider le dossier) et `askPieceValidation` (faire valider une
 * pièce) permettaient aux Finances de demander une signature sur un paiement. Elles n'ont plus
 * d'objet : depuis que le centre de paiement est le GUICHET UNIQUE, un dossier n'atteint les
 * Finances **que parce que le centre l'a autorisé**. Faire valider ce qui vient d'être validé
 * n'aboutit nulle part — et proposer un geste sans effet est pire que ne rien proposer : on
 * l'exerce, on attend une réponse, elle ne vient jamais.
 *
 * Supprimées à l'écran, dans les ops d'Adam et ICI, ensemble : une action sans appelant réel
 * n'existe pas (§118-14), et une action que l'écran ne propose plus mais que l'assistant peut
 * encore appeler est une porte dérobée (§118-7).
 *
 * Ce que les Finances gardent sur un dossier : LIRE les pièces, et RÉCLAMER celles qui manquent
 * (`ItemAskPanel`) — ce qui n'est pas une décision, mais ce qui permet d'en prendre une.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
