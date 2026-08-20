"use server";

import type { PaymentPieceKind, PaymentPieceStatus, PaymentRequestStatus, PaymentUrgency } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { buildRef, createWithRetry } from "@/lib/refs";
import { companyIdForNew } from "@/lib/company";
import { persistUploadedDocument } from "@/lib/documents";
import { createDirectValidation } from "@/lib/validation";
import { toNumber } from "@/lib/utils";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";
import {
  nextPaymentStatus, statusFromPieces, canApprove, canResubmit, isClosed, isWithFinance,
  needsReplacement, type PaymentMove,
} from "@/lib/finance/payment-request";

const PATH = "/finances/paiements";

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

/** Prévient les Finances : l'interlocuteur désigné, ou tout le pôle à défaut. */
async function alertFinance(req: { id: string; reference: string; title: string; recipientId: string | null }, title: string) {
  const body = `${req.reference} — ${req.title}`;
  const link = `${PATH}/${req.id}`;
  if (req.recipientId) await notifyUser({ userId: req.recipientId, type: "VALIDATION_REQUIRED", title, body, link });
  // Une demande adressée à une personne absente ne doit pas dormir jusqu'à son retour.
  else await notifyRoles(["FINANCE_BUDGET_MANAGER", "DIRECTION", "SUPER_ADMIN"], { type: "VALIDATION_REQUIRED", title, body, link });
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

    const req = await createWithRetry(async () =>
      prisma.paymentRequest.create({
        data: {
          reference: await nextRef(),
          title,
          description: fdStr(formData, "description"),
          amount,
          payee,
          recipientId: fdStr(formData, "recipientId"),
          companyId: companyId || null,
          dueDate: dateOf(fdStr(formData, "dueDate")),
          urgency: urgencyOf(fdStr(formData, "urgency")),
          status: submit ? "SUBMITTED" : "DRAFT",
          submittedAt: submit ? new Date() : null,
          requesterId: user.id,
          link: fdStr(formData, "link"),
        },
      }),
    );

    // Les pièces du premier dépôt. Un échec d'enregistrement ne doit pas emporter la demande :
    // on préfère un dossier créé auquel il manque une pièce — visible, corrigeable — à un
    // formulaire perdu avec tout ce qui avait été saisi.
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
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

    await trace(req.id, user.id, submit ? "SUBMIT" : "COMMENT", submit ? "Demande transmise aux Finances." : "Brouillon créé.");
    if (submit) await alertFinance(req, "Demande de paiement à instruire");
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
    const req = await prisma.paymentRequest.findUnique({ where: { id }, include: { pieces: { select: { status: true } } } });
    if (!req) return { ok: false, error: "Demande introuvable." };
    if (!isRequester(user, req)) return { ok: false, error: "Seul le demandeur transmet son dossier." };

    const check = canResubmit(req, req.pieces);
    if (!check.ok) return { ok: false, error: check.reason ?? "Transmission impossible." };
    const next = nextPaymentStatus(req.status, "SUBMIT");
    if (!next) return { ok: false, error: "Ce dossier n'est pas en attente d'envoi." };

    await prisma.paymentRequest.update({ where: { id }, data: { status: next as PaymentRequestStatus, submittedAt: new Date() } });
    await trace(id, user.id, "SUBMIT", fdStr(formData, "note") ?? "Dossier transmis aux Finances.");
    await alertFinance(req, "Demande de paiement à instruire");
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

    const req = await prisma.paymentRequest.findUnique({ where: { id }, include: { pieces: { select: { status: true } } } });
    if (!req) return { ok: false, error: "Demande introuvable." };

    const next = nextPaymentStatus(req.status, move);
    if (!next) return { ok: false, error: "Ce geste n'a pas de sens à ce stade du dossier." };

    const note = fdStr(formData, "note");
    // Une mise en attente sans motif ne dit rien à personne — et le demandeur relancera.
    if (move === "HOLD" && !note) return { ok: false, error: "Dites pourquoi le dossier est mis en attente." };
    if (move === "REJECT" && !note) return { ok: false, error: "Un refus se motive : c'est ce que lira le demandeur." };
    if (move === "APPROVE") {
      const check = canApprove({ status: req.status, amount: toNumber(req.amount) }, req.pieces);
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
 * LES FINANCES DEMANDENT UNE VALIDATION — sur le dossier, ou sur des pièces précises.
 *
 * Un montant qui dépasse leur seuil, un fournisseur nouveau, un doute : elles ne tranchent pas
 * seules. La demande part dans le bureau de validation ordinaire (`ValidationRequest`), avec les
 * pièces visées nommées dans son objet — un validateur qui reçoit « valider PAY-2026-014 » sans
 * savoir quelles pièces sont en cause rouvre tout le dossier pour rien.
 */
export async function askPaymentValidation(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!isFinance(user)) return { ok: false, error: "Réservé aux Finances." };
    const id = fdStr(formData, "id");
    const validatorId = fdStr(formData, "validatorId");
    if (!id) return { ok: false, error: "Demande introuvable." };
    if (!validatorId) return { ok: false, error: "Choisissez le validateur." };

    const req = await prisma.paymentRequest.findUnique({
      where: { id }, include: { pieces: { orderBy: { position: "asc" } } },
    });
    if (!req) return { ok: false, error: "Demande introuvable." };
    if (isClosed(req.status)) return { ok: false, error: "Ce dossier est clos." };

    const pieceIds = formData.getAll("pieceId").map(String).filter(Boolean);
    const targeted = req.pieces.filter((p) => pieceIds.includes(p.id));
    const docs = await prisma.document.findMany({
      where: { id: { in: targeted.map((p) => p.documentId) } }, select: { id: true, name: true },
    });
    const scope = targeted.length > 0
      ? ` — pièces : ${docs.map((d) => d.name).join(", ")}`
      : " — dossier complet";

    const second = fdStr(formData, "validator2Id");
    const res = await createDirectValidation({
      requesterId: user.id,
      title: `Paiement ${req.reference} — ${req.payee} · ${toNumber(req.amount).toLocaleString("fr-FR")} DZD${scope}`,
      description: [fdStr(formData, "note"), req.description].filter(Boolean).join("\n\n") || null,
      link: `${PATH}/${id}`,
      module: "Finances",
      priority: "HIGH",
      deadline: req.dueDate,
      validatorIds: second ? [validatorId, second] : [validatorId],
    });

    await trace(id, user.id, "VALIDATION_ASKED", `Validation demandée${scope}.`);
    revalidate(id);
    if (!res.ok) return { ok: false, error: res.error ?? "La demande de validation n'a pas pu être créée." };
    return { ok: true, id };
  } catch (err) {
    console.error("[payment] askPaymentValidation failed", err);
    return { ok: false, error: "La demande de validation n'a pas pu être créée." };
  }
}

/** Les personnes à qui l'on peut adresser une demande ou une validation. */
export async function paymentPeople(): Promise<{ id: string; name: string }[]> {
  const user = await requireUser();
  return prisma.user.findMany({
    where: { isActive: true, id: { not: user.id } },
    select: { id: true, name: true }, orderBy: { name: "asc" },
  });
}
