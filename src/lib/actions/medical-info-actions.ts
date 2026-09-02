"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { MedicalInfoStatus } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, anyRoleFilter, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { createExpenseOrder } from "@/lib/expense-orders";
import { saveFile, validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { getDeclaration, canViewDeclaration } from "@/lib/queries/medical-info";
import { archiveProcessedRequest } from "@/lib/archive";
import { formatAlgiers } from "@/lib/calendar-tz";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { createPaymentRequest } from "@/lib/actions/payment-request-actions";
import { circuitOfDeclaration, isDeclarationKind, DECLARATION_KIND_LABEL } from "@/lib/medical-info/circuits";
import {
  canRequestDecision, canValidateEvent, declareStage, declareStageLabel, isDeclareIntent,
  DECLARE_INTENT_LABEL,
} from "@/lib/medical-info/declare-decision";
import {
  canDeliverSlip, canEditSlips, canRequestSlipPayment, canRequestSlipsValidation,
  slipStage, SLIPS_LOT_LABEL, SLIP_STAGE_LABEL,
} from "@/lib/medical-info/slips";
import { circuitStateOf, authoritiesOpen } from "@/lib/medical-info/circuit-state";
import { bvChain, bvChainNote } from "@/lib/medical-info/bv-approval";
import { nextDeclarationRef } from "@/lib/medical-info";

import { centreValidatorFrom } from "@/lib/validations/centre";
import { createDirectValidation } from "@/lib/validation";
import { getManagerOfUser } from "@/lib/departments";
import { toNumber } from "@/lib/utils";

const PATH = "/information-medicale";

/** Le pharmacien responsable (ou la Direction / un admin) pilote la déclaration. */
function canManage(user: SessionUser): boolean {
  return hasGlobalView(user.role) || userCan(user, "MEDICAL_INFO", "VALIDATE");
}

function revalidate(id: string) {
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
}

/** Recalcule le statut READY / DOCS_REQUESTED / AWAITING_REVIEW selon l'état des pièces. */
async function refreshStatus(declarationId: string) {
  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id: declarationId }, include: { requests: true } });
  if (!decl || decl.status === "VALIDATED") return;
  const reqs = decl.requests;
  const next: MedicalInfoStatus =
    reqs.length > 0 && reqs.every((r) => r.status === "FULFILLED") ? "READY"
    : reqs.length > 0 ? "DOCS_REQUESTED"
    : "AWAITING_REVIEW";
  if (next !== decl.status) await prisma.medicalInfoDeclaration.update({ where: { id: declarationId }, data: { status: next } });
}

// ───────────── Demande de pièce (pharmacien → Direction / comptable / délégué…) ─────────────

export async function requestDocument(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé au pharmacien responsable de l'information médicale." };
  const declarationId = fdStr(formData, "declarationId");
  const label = fdStr(formData, "label");
  const targetUserId = fdStr(formData, "targetUserId");
  if (!declarationId || !label) return { ok: false, error: "Précisez la pièce demandée." };
  if (!targetUserId) return { ok: false, error: "Sélectionnez la personne à qui demander la pièce." };

  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id: declarationId } });
  if (!decl) return { ok: false, error: "Déclaration introuvable." };
  if (decl.status === "VALIDATED") return { ok: false, error: "Déclaration déjà validée." };

  await prisma.medicalInfoDocRequest.create({ data: { declarationId, label, targetUserId, requestedById: user.id } });
  if (decl.status === "AWAITING_REVIEW") {
    await prisma.medicalInfoDeclaration.update({ where: { id: declarationId }, data: { status: "DOCS_REQUESTED" } });
  }
  await notifyUser({ userId: targetUserId, type: "ASSIGNMENT", title: "Information médicale — pièce demandée", body: `${decl.reference} — ${label}`, link: `${PATH}/${declarationId}` });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Information médicale", entityType: "MEDICAL_INFO_DECLARATION", entityId: declarationId, summary: `Pièce demandée — ${label}` });
  revalidate(declarationId);
  return { ok: true };
}

export async function cancelDocRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const r = await prisma.medicalInfoDocRequest.findUnique({ where: { id } });
  if (!r) return { ok: false, error: "Demande introuvable." };
  if (r.status === "FULFILLED") return { ok: false, error: "Pièce déjà déposée — suppression impossible." };
  await prisma.medicalInfoDocRequest.delete({ where: { id } });
  await refreshStatus(r.declarationId);
  revalidate(r.declarationId);
  return { ok: true };
}

// ───────────── Dépôt de la pièce (par la personne sollicitée) ─────────────

export async function fulfillDocRequest(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const requestId = fdStr(formData, "requestId");
  if (!requestId) return { ok: false, error: "Demande manquante." };
  const r = await prisma.medicalInfoDocRequest.findUnique({ where: { id: requestId }, include: { declaration: true } });
  if (!r) return { ok: false, error: "Demande introuvable." };
  // Seule la personne sollicitée (ou un gestionnaire) peut déposer la pièce.
  if (r.targetUserId !== user.id && !canManage(user)) return { ok: false, error: "Cette pièce ne vous a pas été demandée." };
  if (r.status === "FULFILLED") return { ok: false, error: "Pièce déjà déposée." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Aucun fichier sélectionné." };
  const validationError = validateUpload(file.name, file.size, (await getAppSettings()).maxUploadMb);
  if (validationError) return { ok: false, error: validationError };

  const key = `MEDICAL_INFO_DECLARATION/${r.declarationId}/${randomUUID()}__${file.name}`;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await saveFile(key, buffer);
  } catch (err) {
    console.error("[medical-info] storage write failed, recording metadata only", err);
  }
  const doc = await prisma.document.create({
    data: {
      name: file.name, category: "OTHER", entityType: "MEDICAL_INFO_DECLARATION", entityId: r.declarationId,
      fileKey: key, mimeType: file.type || null, sizeBytes: file.size, confidentiality: "INTERNAL", uploadedById: user.id,
    },
  });
  await prisma.medicalInfoDocRequest.update({
    where: { id: requestId },
    data: { status: "FULFILLED", documentId: doc.id, note: fdStr(formData, "note"), fulfilledAt: new Date() },
  });
  await refreshStatus(r.declarationId);
  if (r.declaration.pharmacistId) {
    await notifyUser({ userId: r.declaration.pharmacistId, type: "DOCUMENT_UPLOADED", title: "Information médicale — pièce reçue", body: `${r.declaration.reference} — ${r.label}`, link: `${PATH}/${r.declarationId}` });
  } else {
    await notifyRoles(["MEDICAL_INFO_PHARMACIST", "SUPER_ADMIN"], { type: "DOCUMENT_UPLOADED", title: "Information médicale — pièce reçue", body: `${r.declaration.reference} — ${r.label}`, link: `${PATH}/${r.declarationId}` });
  }
  await recordAudit({ actorId: user.id, action: "UPLOAD", module: "Information médicale", entityType: "MEDICAL_INFO_DECLARATION", entityId: r.declarationId, summary: `Pièce déposée — ${r.label} (« ${file.name} »)` });
  revalidate(r.declarationId);
  return { ok: true };
}

// ───────────── Enregistrement de la déclaration aux autorités ─────────────

export async function recordAuthorityDeclaration(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };

  // LA PORTE DU BON DE VERSEMENT TIENT ICI, pas seulement à l'écran. Masquer une carte est du
  // confort ; un formulaire posté à la main, ou un écran ouvert avant la remise puis soumis
  // après coup, doit rencontrer la même règle. Le refus DIT l'étape qui manque.
  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id } });
  if (!decl) return { ok: false, error: "Déclaration introuvable." };
  const etat = await circuitStateOf(decl);
  if (!authoritiesOpen(etat)) {
    return {
      ok: false,
      error: etat.circuit === "EVENT"
        ? `La décision de déclarer n'est pas encore accordée : ${declareStageLabel(declareStage(etat.declare)).toLowerCase()}.`
        : `Les quittances ne sont pas toutes entre vos mains : ${etat.summary.delivered}/${etat.summary.count} remise(s).`,
    };
  }

  await prisma.medicalInfoDeclaration.update({
    where: { id },
    data: { authorityRef: fdStr(formData, "authorityRef"), authorityNotes: fdStr(formData, "authorityNotes") },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Information médicale", entityType: "MEDICAL_INFO_DECLARATION", entityId: id, summary: "Déclaration aux autorités enregistrée" });
  revalidate(id);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CIRCUIT ÉVÉNEMENT — « faut-il déclarer ? », et rien d'autre
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * LE PHARMACIEN SOUMET SA LECTURE : ce dossier se déclare au ministère, ou il ne se déclare pas.
 *
 * Une prise en charge, un sponsoring, un événement n'appellent AUCUN versement — c'était le
 * défaut : chacun sortait par la porte « ce dossier n'appelle aucun versement », motif à l'appui.
 * Ce qu'ils appellent, c'est un jugement, et ce jugement engage la société : il ne reste pas celui
 * du pharmacien seul.
 *
 * Ce qu'on fait valider, c'est sa LECTURE — pas la question. Une demande de validation répond oui
 * ou non : poser « faut-il déclarer ? » aurait fait dire « refusé » pour signifier « non, ne
 * déclarez pas », et un dossier parfaitement conforme serait marqué comme rejeté.
 */
export async function requestDeclareDecision(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé au pharmacien responsable de l'information médicale." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Déclaration introuvable." };
  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id } });
  if (!decl) return { ok: false, error: "Déclaration introuvable." };
  if (circuitOfDeclaration(decl) !== "EVENT") {
    return { ok: false, error: "Ce dossier relève du matériel promotionnel : il passe par les bons de versement, pas par cette décision." };
  }

  const etat = await circuitStateOf(decl);
  if (!canRequestDecision(etat.declare)) {
    return { ok: false, error: `Une décision est déjà engagée pour ce dossier (${declareStageLabel(declareStage(etat.declare)).toLowerCase()}).` };
  }

  const intent = fdStr(formData, "intent");
  if (!isDeclareIntent(intent)) {
    return { ok: false, error: "Dites ce que vous comptez faire : déclarer ce dossier au ministère, ou non." };
  }
  const note = fdStr(formData, "note");
  // LA LECTURE « SANS DÉCLARATION » EXIGE UN MOTIF. C'est celle qui fait ne rien faire : sans
  // raison écrite, le validateur signe une absence, et l'audit ne lira rien.
  if (intent === "SKIP" && !note) {
    return { ok: false, error: "Dites pourquoi ce dossier ne se déclare pas : c'est ce que lira le validateur, puis l'audit." };
  }

  const validateurs = await declarationValidators(user.id, decl.sourceType, decl.sourceId);
  if (validateurs.validatorIds.length === 0) {
    return { ok: false, error: "Aucun signataire disponible (responsable, chef de produit, Directeur Général) : la demande n'aurait personne à qui aller." };
  }

  const res = await createDirectValidation({
    requesterId: user.id,
    title: `Information médicale — ${DECLARE_INTENT_LABEL[intent]} : ${decl.label}`,
    description: [
      note,
      `Déclaration ${decl.reference}${decl.beneficiary ? ` — ${decl.beneficiary}` : ""}.`,
      bvChainNote(validateurs),
    ].filter(Boolean).join("\n\n") || null,
    link: `${PATH}/${id}`,
    module: "Information médicale",
    priority: "HIGH",
    validatorIds: validateurs.validatorIds,
    // SÉQUENTIEL : l'ordre EST le contrôle — chaque marche s'appuie sur la précédente.
    mode: "SEQUENTIAL",
    entityType: "MEDICAL_INFO_DECLARATION",
    entityId: id,
  });
  if (!res.ok) return { ok: false, error: res.error ?? "La demande de décision n'a pas pu être créée." };

  await prisma.medicalInfoDeclaration.update({
    where: { id },
    data: {
      declareValidationId: res.requestId ?? null,
      declareIntent: intent,
      declareNote: note,
      declareRequestedAt: new Date(),
      declareRequestedById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Information médicale",
    entityType: "MEDICAL_INFO_DECLARATION", entityId: id,
    field: "Décision de déclarer", newValue: intent,
    summary: `${DECLARE_INTENT_LABEL[intent]} — soumis à validation (${decl.reference})`,
  });
  revalidate(id);
  return { ok: true, id: res.requestId };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CIRCUIT MATÉRIEL PROMOTIONNEL — un bon de versement par matériel
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * SÉPARER LE DOSSIER EN MATÉRIELS — un bon de versement par matériel.
 *
 * Il n'y avait qu'un bon par dossier. Un dossier en porte plusieurs : un présentoir, des affiches,
 * une vidéo — chacun sa taxe, chacun sa quittance. On additionnait donc les montants pour n'en
 * demander qu'un, et ce qui n'entrait pas dans la case se réglait hors ERP.
 */
export async function addMedicalInfoSlip(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé au pharmacien responsable de l'information médicale." };
  const id = fdStr(formData, "declarationId");
  const label = fdStr(formData, "label");
  if (!id) return { ok: false, error: "Déclaration introuvable." };
  if (!label) return { ok: false, error: "Nommez le matériel concerné par ce bon de versement." };
  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id } });
  if (!decl) return { ok: false, error: "Déclaration introuvable." };
  if (circuitOfDeclaration(decl) !== "PROMO") {
    return { ok: false, error: "Ce dossier ne relève pas du matériel promotionnel : il n'appelle aucun bon de versement." };
  }

  const etat = await circuitStateOf(decl);
  // LA LISTE EST FIGÉE UNE FOIS SIGNÉE. Y ajouter un bon après coup ferait payer un versement que
  // personne n'a vu passer.
  if (!canEditSlips(etat.lot)) {
    return { ok: false, error: `La liste des matériels est figée : ${SLIPS_LOT_LABEL[etat.lot].toLowerCase()}.` };
  }

  const raw = fdStr(formData, "amount");
  const amount = raw ? Number(raw.replace(",", ".")) : null;
  if (raw && (!Number.isFinite(amount) || (amount ?? 0) < 0)) return { ok: false, error: "Montant du bon invalide." };

  await prisma.medicalInfoSlip.create({
    data: {
      declarationId: id, label, amount, note: fdStr(formData, "note"),
      position: etat.slips.length,
    },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Information médicale",
    entityType: "MEDICAL_INFO_DECLARATION", entityId: id,
    summary: `Matériel ajouté au dossier — ${label}${amount ? ` (${amount.toLocaleString("fr-FR")} DZD)` : ""}`,
  });
  revalidate(id);
  return { ok: true };
}

/** Retirer un matériel — tant que le dépôt des bons n'est pas parti en validation. */
export async function removeMedicalInfoSlip(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé au pharmacien responsable de l'information médicale." };
  const slipId = fdStr(formData, "slipId");
  if (!slipId) return { ok: false, error: "Matériel introuvable." };
  const slip = await prisma.medicalInfoSlip.findUnique({ where: { id: slipId }, include: { declaration: true } });
  if (!slip) return { ok: false, error: "Matériel introuvable." };

  const etat = await circuitStateOf(slip.declaration);
  if (!canEditSlips(etat.lot)) {
    return { ok: false, error: "Le dépôt des bons est déjà soumis à validation : retirer un matériel laisserait une signature portant sur autre chose." };
  }
  if (slip.requestId) return { ok: false, error: "Une quittance est déjà demandée sur ce matériel." };

  await prisma.medicalInfoSlip.delete({ where: { id: slipId } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Information médicale",
    entityType: "MEDICAL_INFO_DECLARATION", entityId: slip.declarationId,
    summary: `Matériel retiré du dossier — ${slip.label}`,
  });
  revalidate(slip.declarationId);
  return { ok: true };
}

/**
 * FAIRE VALIDER LE DÉPÔT DES BONS — une fois pour le lot entier.
 *
 * Trois signatures : le N+1 du pharmacien, le chef de produit du dossier, puis le centre de
 * validations. Faire signer cinq fois la même décision, une par matériel, n'ajoute aucune
 * sécurité : cela ajoute quatre relances. Ce qui se demande matériel par matériel, c'est le
 * PAIEMENT, et il vient après.
 */
export async function requestSlipsValidation(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé au pharmacien responsable de l'information médicale." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Déclaration introuvable." };
  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id } });
  if (!decl) return { ok: false, error: "Déclaration introuvable." };
  if (circuitOfDeclaration(decl) !== "PROMO") {
    return { ok: false, error: "Ce dossier ne relève pas du matériel promotionnel : il n'appelle aucun bon de versement." };
  }
  if (decl.bvSkippedAt) return { ok: false, error: "Ce dossier a été déclaré sans versement." };

  const etat = await circuitStateOf(decl);
  const possible = canRequestSlipsValidation(etat.lot, etat.slips);
  if (!possible.ok) return { ok: false, error: possible.reason ?? "Le dépôt ne peut pas être soumis maintenant." };

  const total = etat.summary.announced;
  const note = fdStr(formData, "note");
  const validateurs = await declarationValidators(user.id, decl.sourceType, decl.sourceId);
  if (validateurs.validatorIds.length === 0) {
    return { ok: false, error: "Aucun signataire disponible (responsable, chef de produit, Directeur Général) : la demande n'aurait personne à qui aller." };
  }

  const res = await createDirectValidation({
    requesterId: user.id,
    title: `Bons de versement — ${decl.label} · ${etat.slips.length} matériel(s) · ${total.toLocaleString("fr-FR")} DZD`,
    description: [
      note,
      etat.slips.map((sl) => `• ${sl.label}${sl.amount ? ` — ${sl.amount.toLocaleString("fr-FR")} DZD` : ""}`).join("\n"),
      `Déclaration ${decl.reference}${decl.beneficiary ? ` — ${decl.beneficiary}` : ""}.`,
      bvChainNote(validateurs),
    ].filter(Boolean).join("\n\n") || null,
    link: `${PATH}/${id}`,
    module: "Information médicale",
    priority: "HIGH",
    validatorIds: validateurs.validatorIds,
    mode: "SEQUENTIAL",
    entityType: "MEDICAL_INFO_DECLARATION",
    entityId: id,
    amount: total > 0 ? total : undefined,
  });
  if (!res.ok) return { ok: false, error: res.error ?? "La demande de validation n'a pas pu être créée." };

  await prisma.medicalInfoDeclaration.update({
    where: { id },
    data: {
      bvValidationId: res.requestId ?? null,
      bvAmount: total > 0 ? total : null,
      bvNote: note,
      bvRequestedAt: new Date(),
      bvRequestedById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Information médicale",
    entityType: "MEDICAL_INFO_DECLARATION", entityId: id,
    summary: `Dépôt de ${etat.slips.length} bon(s) de versement soumis à validation — ${total.toLocaleString("fr-FR")} DZD (${decl.reference})`,
  });
  revalidate(id);
  return { ok: true, id: res.requestId };
}

/**
 * LES TROIS SIGNATAIRES D'UN DOSSIER — le N+1, le chef de produit de la source, le centre.
 *
 * La même chaîne sert aux deux circuits : ce qu'on soumet diffère (une lecture, un dépôt de bons),
 * les personnes qui répondent sont les mêmes, et pour la même raison — l'une connaît le travail,
 * l'autre le budget, la troisième engage la société.
 */
async function declarationValidators(requesterId: string, sourceType: string, sourceId: string) {
  const [manager, productManagerId, sieges] = await Promise.all([
    getManagerOfUser(requesterId).catch(() => null),
    productManagerOfSource(sourceType, sourceId),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["GENERAL_MANAGER", "SUPER_ADMIN"] } },
      select: { id: true, role: true },
    }),
  ]);
  return bvChain({
    managerUserId: manager?.userId ?? null,
    productManagerUserId: productManagerId,
    centreUserId: centreValidatorFrom(sieges),
    requesterId,
  });
}

/**
 * LE CHEF DE PRODUIT DU DOSSIER — celui du dossier SOURCE, jamais un « chef de produit » générique.
 *
 * La question qu'on lui pose est « le montant correspond-il à CET événement ? ». Y répondre
 * suppose de connaître le budget accordé et ce qu'il couvre — donc d'être celui qui a instruit
 * ce dossier-là. Désigner n'importe quel titulaire du rôle ferait signer quelqu'un qui n'a pas
 * la question, ce qui est pire qu'une marche sautée : la signature existe et ne vaut rien.
 */
async function productManagerOfSource(sourceType: string, sourceId: string): Promise<string | null> {
  const sel = { select: { productManagerId: true } } as const;
  switch (sourceType) {
    case "CONGRESS_INTERNATIONAL":
      return (await prisma.congressInternational.findUnique({ where: { id: sourceId }, ...sel }))?.productManagerId ?? null;
    case "CONGRESS_NATIONAL":
      return (await prisma.congressNational.findUnique({ where: { id: sourceId }, ...sel }))?.productManagerId ?? null;
    case "EVENT":
      return (await prisma.event.findUnique({ where: { id: sourceId }, ...sel }))?.productManagerId ?? null;
    default:
      return null;
  }
}

/**
 * LE PAIEMENT D'UNE QUITTANCE — bon par bon, et c'est tout le sujet.
 *
 * Le dépôt validé, chaque quittance se demande SÉPARÉMENT : son montant réel (qui n'est pas
 * toujours celui annoncé), sa pièce, son passage au centre de paiement, son règlement, sa remise.
 * Les grouper obligerait à attendre le dernier matériel pour déposer le premier.
 *
 * À partir d'ici, plus rien de spécifique : c'est une `PaymentRequest` ORDINAIRE, qui emprunte le
 * chemin commun. Ce qui la distingue est son rattachement, qui la ramène à cette déclaration.
 */
export async function requestSlipPayment(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé au pharmacien responsable de l'information médicale." };
  const slipId = fdStr(formData, "slipId");
  if (!slipId) return { ok: false, error: "Matériel introuvable." };
  const slip = await prisma.medicalInfoSlip.findUnique({ where: { id: slipId }, include: { declaration: true } });
  if (!slip) return { ok: false, error: "Matériel introuvable." };
  const decl = slip.declaration;

  const etat = await circuitStateOf(decl);
  if (etat.lot !== "QUITTANCE_A_DEMANDER") {
    return { ok: false, error: `Le dépôt des bons n'est pas encore validé : ${SLIPS_LOT_LABEL[etat.lot].toLowerCase()}.` };
  }
  const courant = etat.slips.find((sl) => sl.id === slipId);
  if (!courant || !canRequestSlipPayment(courant)) {
    return { ok: false, error: `Le paiement de ce bon ne peut pas être demandé maintenant : ${SLIP_STAGE_LABEL[slipStage(courant ?? { requestId: null, centralStatus: null, orderStatus: null, deliveredAt: null })].toLowerCase()}.` };
  }

  const raw = fdStr(formData, "amount");
  const amount = raw ? Number(raw.replace(",", ".")) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Indiquez le montant de la quittance." };

  // On rejoue le formulaire de la demande de paiement : c'est la MÊME action canonique que depuis
  // les Demandes de validations, donc les mêmes contrôles et le même circuit.
  const fd = new FormData();
  fd.set("title", `Quittance de versement — ${slip.label} (${decl.label})`);
  fd.set("payee", fdStr(formData, "payee") || "Autorités sanitaires");
  fd.set("amount", String(amount));
  fd.set("description", [
    fdStr(formData, "note"),
    slip.amount ? `Bon annoncé pour ${toNumber(slip.amount).toLocaleString("fr-FR")} DZD.` : null,
  ].filter(Boolean).join("\n\n"));
  if (decl.companyId) fd.set("companyId", decl.companyId);
  const echeance = fdStr(formData, "dueDate");
  if (echeance) fd.set("dueDate", echeance);
  // LE RATTACHEMENT EST POSÉ DÈS LA CRÉATION, et non par une mise à jour qui suivrait. C'est lui
  // qui identifie un BON DE VERSEMENT, et donc ce qui l'exempte de l'obligation de joindre un bon
  // de commande ou une facture (`finance/payment-dossier.ts`) : un BV n'en a ni n'en peut avoir,
  // et sa quittance n'existe qu'APRÈS le versement.
  fd.set("entityType", "MEDICAL_INFO_DECLARATION");
  fd.set("entityId", decl.id);
  fd.set("link", `${PATH}/${decl.id}`);
  for (const f of formData.getAll("files")) if (f instanceof File && f.size > 0) fd.append("files", f);

  const created = await createPaymentRequest(undefined, fd);
  if (!created.ok || !created.id) return { ok: false, error: created.error ?? "La demande de paiement a été refusée." };

  await prisma.medicalInfoSlip.update({ where: { id: slipId }, data: { requestId: created.id } });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Information médicale",
    entityType: "MEDICAL_INFO_DECLARATION", entityId: decl.id,
    summary: `Quittance demandée au paiement — ${slip.label} · ${amount.toLocaleString("fr-FR")} DZD (${decl.reference})`,
  });
  revalidate(decl.id);
  return { ok: true, id: created.id };
}

/**
 * LES FINANCES REMETTENT UNE QUITTANCE AU BUREAU DU PRIM.
 *
 * C'est CE geste — et non le règlement — qui fait avancer le dossier. « Payé » ne veut pas dire
 * « le pharmacien a le papier en main », et c'est le papier qu'on dépose au guichet. Chaque bon
 * se remet séparément : attendre le dernier pour tous les remettre bloquerait les premiers dépôts.
 */
export async function deliverMedicalInfoSlip(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  // Ceux qui règlent remettent : les Finances, et la Direction / le Super Admin qui les couvrent.
  if (!(userCan(user, "FINANCES", "UPDATE") || hasGlobalView(user.role))) {
    return { ok: false, error: "La remise du bon revient aux Finances." };
  }
  const slipId = fdStr(formData, "slipId");
  if (!slipId) return { ok: false, error: "Matériel introuvable." };
  const slip = await prisma.medicalInfoSlip.findUnique({ where: { id: slipId }, include: { declaration: true } });
  if (!slip) return { ok: false, error: "Matériel introuvable." };
  const decl = slip.declaration;

  const etat = await circuitStateOf(decl);
  const courant = etat.slips.find((sl) => sl.id === slipId);
  if (!courant || !canDeliverSlip(courant)) {
    return { ok: false, error: "Ce bon ne peut pas encore être remis : la quittance doit d'abord être réglée." };
  }

  await prisma.medicalInfoSlip.update({
    where: { id: slipId },
    data: { deliveredAt: new Date(), deliveredById: user.id, deliveryNote: fdStr(formData, "note") },
  });
  // On relit APRÈS la remise : c'est la dernière qui ouvre le dépôt aux autorités, et c'est cette
  // phrase-là que le pharmacien attend.
  const apres = await circuitStateOf(decl);
  if (decl.pharmacistId) {
    await notifyUser({
      userId: decl.pharmacistId, type: "GENERIC",
      title: apres.summary.allDelivered
        ? "Toutes les quittances remises — vous pouvez déclarer aux autorités"
        : `Quittance remise — ${slip.label}`,
      body: `${decl.reference} — ${decl.label} (${apres.summary.delivered}/${apres.summary.count})`,
      link: `${PATH}/${decl.id}`,
    });
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Information médicale",
    entityType: "MEDICAL_INFO_DECLARATION", entityId: decl.id,
    summary: `Quittance remise au bureau du PRIM — ${slip.label} (${decl.reference})`,
  });
  revalidate(decl.id);
  return { ok: true };
}

/**
 * CE DOSSIER N'APPELLE AUCUN VERSEMENT — la porte de sortie, tracée et motivée.
 *
 * Elle ne concerne plus QUE le matériel promotionnel : les dossiers d'événement ne passent plus
 * par les bons du tout, ils passent par la décision de déclarer. C'était le défaut — chacun d'eux
 * sortait par ici, et un contournement obligatoire n'est plus une porte de sortie, c'est le
 * chemin normal mal nommé. Le motif reste EXIGÉ : sans lui, elle redeviendrait ordinaire.
 */
export async function skipMedicalInfoBv(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé au pharmacien responsable de l'information médicale." };
  const id = fdStr(formData, "id");
  const reason = fdStr(formData, "reason");
  if (!id) return { ok: false, error: "Déclaration introuvable." };
  if (!reason) return { ok: false, error: "Dites pourquoi ce dossier n'appelle aucun versement : c'est ce que lira l'audit." };
  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id } });
  if (!decl) return { ok: false, error: "Déclaration introuvable." };
  if (circuitOfDeclaration(decl) !== "PROMO") {
    return { ok: false, error: "Ce dossier ne relève pas du matériel promotionnel : il n'appelle aucun bon de versement, et n'a donc rien à contourner." };
  }
  if (decl.bvSkippedAt) return { ok: false, error: "Ce dossier est déjà déclaré sans versement." };

  const etat = await circuitStateOf(decl);
  if (etat.slips.some((sl) => sl.requestId)) {
    return { ok: false, error: "Une quittance est engagée : elle doit être menée à son terme ou refusée." };
  }
  if (etat.lot !== "A_DEMANDER" && etat.lot !== "VALIDATION_REFUSEE") {
    return { ok: false, error: "Le dépôt des bons est engagé en validation : il doit être mené à son terme ou refusé." };
  }

  await prisma.medicalInfoDeclaration.update({
    where: { id },
    data: { bvSkippedAt: new Date(), bvSkippedById: user.id, bvSkipReason: reason },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Information médicale",
    entityType: "MEDICAL_INFO_DECLARATION", entityId: id,
    field: "Bon de versement", newValue: "sans versement",
    summary: `Déclaré sans bon de versement — ${decl.reference} : ${reason}`,
  });
  revalidate(id);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CE QUE LE PRIM OUVRE LUI-MÊME
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * LE PHARMACIEN N'ATTEND PAS TOUJOURS QU'UN DOSSIER LUI ARRIVE.
 *
 * Une obligation réglementaire se découvre aussi de son côté : un support à faire viser, une
 * déclaration au ministère qu'aucun événement n'a déclenchée, un versement à faire. Il n'avait
 * pour cela aucun geste — le module ne se remplissait que par la validation d'un autre — et ce
 * qui n'entre pas dans l'ERP se traite dans un carnet.
 *
 * LA NATURE CHOISIE DÉCIDE DU CIRCUIT, et il n'y a pas de seconde case : une déclaration au
 * ministère suit le circuit de la décision, un visa ou un versement celui du matériel.
 */
export async function createMedicalInfoItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Réservé au pharmacien responsable de l'information médicale." };

  const label = fdStr(formData, "label");
  const kind = fdStr(formData, "kind");
  if (!label) return { ok: false, error: "Nommez ce que vous ouvrez : c'est ce qui figurera dans la liste." };
  if (!isDeclarationKind(kind)) {
    return { ok: false, error: "Choisissez la nature : déclaration au ministère, visa publicitaire, ou bon de versement." };
  }
  const raw = fdStr(formData, "amount");
  const amount = raw ? Number(raw.replace(",", ".")) : null;
  if (raw && (!Number.isFinite(amount) || (amount ?? 0) < 0)) return { ok: false, error: "Montant invalide." };

  // LA SOURCE EST LE DOSSIER LUI-MÊME. Il n'y a pas d'événement derrière : lui en inventer un
  // ferait apparaître un lien « voir l'événement source » qui ne mène nulle part. La clé unique
  // (sourceType, sourceId) tient avec un identifiant propre à ce dossier.
  const sourceId = `prim_${randomUUID()}`;
  const pharmacist = await prisma.user.findFirst({
    where: { ...anyRoleFilter(["MEDICAL_INFO_PHARMACIST"]), isActive: true },
    select: { id: true },
  });

  const decl = await prisma.medicalInfoDeclaration.create({
    data: {
      reference: await nextDeclarationRef(),
      sourceType: "MEDICAL_INFO_DECLARATION",
      sourceId,
      label,
      declarationKind: kind,
      beneficiary: fdStr(formData, "beneficiary"),
      amount,
      requesterId: user.id,
      createdById: user.id,
      // Celui qui ouvre le dossier le tient, sauf s'il n'est pas pharmacien (Direction, admin) :
      // le laisser sans pharmacien le ferait disparaître de la file de celui qui doit l'instruire.
      pharmacistId: userCan(user, "MEDICAL_INFO", "VALIDATE") ? user.id : (pharmacist?.id ?? null),
    },
  });

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Information médicale",
    entityType: "MEDICAL_INFO_DECLARATION", entityId: decl.id,
    summary: `${DECLARATION_KIND_LABEL[kind]} ouverte — ${decl.reference} : ${label}`,
  });
  revalidatePath(PATH);
  return { ok: true, id: decl.id };
}

// ───────────── Validation pharmacien (PRIM) → transmission à la Direction ─────────────

/**
 * Le pharmacien responsable valide son instruction : la déclaration ne part PAS
 * directement au comptable mais à la Direction, qui donnera la validation finale
 * (pour le comptable). L'ordre de dépense n'est émis qu'à l'étape Direction.
 */
export async function validateDeclaration(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManage(user)) return { ok: false, error: "Validation réservée au pharmacien responsable." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id } });
  if (!decl) return { ok: false, error: "Déclaration introuvable." };
  if (decl.status === "VALIDATED") return { ok: false, error: "Déclaration déjà validée." };
  if (decl.status === "AWAITING_DIRECTION") return { ok: false, error: "Déjà transmise à la Direction pour validation finale." };

  // LE CIRCUIT TIENT ICI, pas seulement à l'écran. Masquer un bouton est du confort ; un
  // formulaire posté à la main doit rencontrer la même règle, et le refus DIT ce qui manque.
  const etat = await circuitStateOf(decl);
  if (etat.circuit === "EVENT") {
    if (!canValidateEvent(etat.declare, { authorityRef: decl.authorityRef })) {
      return {
        ok: false,
        error: declareStage(etat.declare) !== "ACCORDEE"
          ? `La décision de déclarer doit d'abord être accordée : ${declareStageLabel(declareStage(etat.declare)).toLowerCase()}.`
          : "Enregistrez d'abord la référence du dépôt auprès du ministère de l'Industrie pharmaceutique.",
      };
    }
  } else if (!authoritiesOpen(etat)) {
    return {
      ok: false,
      error: `Les quittances ne sont pas toutes remises : ${etat.summary.delivered}/${etat.summary.count}. Dites, à défaut, que ce dossier n'appelle aucun versement.`,
    };
  }

  await prisma.medicalInfoDeclaration.update({
    where: { id },
    data: { status: "AWAITING_DIRECTION", pharmacistValidatedAt: new Date(), pharmacistValidatedById: user.id },
  });
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: "Information médicale — validation finale requise (Direction)",
    body: `${decl.reference} — ${decl.label}`,
    link: `${PATH}/${id}`,
  });
  await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Information médicale", entityType: "MEDICAL_INFO_DECLARATION", entityId: id, summary: `Validation pharmacien — transmise à la Direction (${decl.reference})` });

  // Instruction du PRIM terminée → archive dans SON Drive (« Dossier traité / Information médicale »).
  if (!decl.archivedNodeId) {
    const docs = await prisma.document.findMany({
      where: { entityType: "MEDICAL_INFO_DECLARATION", entityId: id },
      select: { name: true, fileKey: true, mimeType: true },
    });
    const lines = [
      `Déclaration d'information médicale — ${decl.reference}`,
      `Libellé : ${decl.label}`,
      decl.beneficiary ? `Bénéficiaire : ${decl.beneficiary}` : null,
      decl.authorityRef ? `Référence autorités : ${decl.authorityRef}` : null,
      decl.authorityNotes ? `Notes de déclaration : ${decl.authorityNotes}` : null,
      `Créée le : ${formatAlgiers(decl.createdAt, { day: "2-digit", month: "long", year: "numeric" })}`,
      `Validée par le pharmacien le : ${formatAlgiers(new Date(), { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      `Transmise à la Direction pour validation finale.`,
    ].filter(Boolean).join("\n");
    const day = new Date().toISOString().slice(0, 10);
    const nodeId = await archiveProcessedRequest({
      bureau: "Information médicale",
      folderName: `${day} — ${decl.reference} — ${decl.label}`,
      summary: lines,
      attachments: docs.map((d) => ({ name: d.name, fileKey: d.fileKey, mimeType: d.mimeType })),
      ownerId: user.id,
    });
    if (nodeId) {
      await prisma.medicalInfoDeclaration.update({ where: { id }, data: { archivedNodeId: nodeId } });
      revalidatePath("/drive");
    }
  }
  revalidate(id);
  return { ok: true };
}

// ───────────── Validation finale (Direction) → ordre de dépense au comptable ─────────────

/**
 * La Direction donne la validation finale « pour le comptable », avec un commentaire
 * facultatif (versé dans l'espace de discussion). C'est ICI qu'est émis l'ordre de
 * dépense, qui part alors au comptable.
 */
export async function validateDeclarationByDirection(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!hasGlobalView(user.role)) return { ok: false, error: "Validation finale réservée à la Direction." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { id } });
  if (!decl) return { ok: false, error: "Déclaration introuvable." };
  if (decl.status === "VALIDATED") return { ok: false, error: "Déclaration déjà validée." };
  if (decl.status !== "AWAITING_DIRECTION") return { ok: false, error: "La déclaration doit d'abord être validée par le pharmacien responsable." };

  // Commentaire de validation (facultatif) → espace de discussion.
  const comment = fdStr(formData, "comment");
  if (comment) {
    await prisma.comment.create({ data: { entityType: "MEDICAL_INFO_DECLARATION", entityId: id, body: comment, authorId: user.id } });
  }

  // Émission de l'ordre de dépense (si un budget a été accordé) → part au comptable.
  const amount = Number(decl.amount ?? 0);
  const order = amount > 0
    ? await createExpenseOrder({
        label: decl.label,
        amount,
        category: "EVENEMENT",
        beneficiary: decl.beneficiary,
        sourceType: decl.sourceType,
        sourceId: decl.sourceId,
        requestedById: decl.requesterId,
        budgetCategoryId: decl.budgetCategoryId,
      })
    : null;

  await prisma.medicalInfoDeclaration.update({
    where: { id },
    data: { status: "VALIDATED", validatedAt: new Date(), validatedById: user.id, expenseOrderId: order?.id ?? null },
  });
  // Reporte l'ordre de dépense sur l'événement source (tout reste interconnecté).
  if (order) {
    if (decl.sourceType === "SPONSORING") await prisma.sponsoringRequest.update({ where: { id: decl.sourceId }, data: { expenseOrderId: order.id } });
    else if (decl.sourceType === "CONGRESS_INTERNATIONAL") await prisma.congressInternational.update({ where: { id: decl.sourceId }, data: { expenseOrderId: order.id } });
    else if (decl.sourceType === "CONGRESS_NATIONAL") await prisma.congressNational.update({ where: { id: decl.sourceId }, data: { expenseOrderId: order.id } });
  }
  if (decl.requesterId) await notifyUser({ userId: decl.requesterId, type: "GENERIC", title: "Information médicale — événement validé par la Direction", body: `${decl.reference} — ${decl.label}`, link: `${PATH}/${id}` });
  if (decl.pharmacistId && decl.pharmacistId !== user.id) await notifyUser({ userId: decl.pharmacistId, type: "GENERIC", title: "Information médicale — validé par la Direction", body: `${decl.reference} — ${decl.label}`, link: `${PATH}/${id}` });
  await recordAudit({ actorId: user.id, action: "VALIDATE", module: "Information médicale", entityType: "MEDICAL_INFO_DECLARATION", entityId: id, summary: `Validation Direction — ${decl.reference}${order ? ` (ordre ${order.reference})` : ""}` });
  revalidate(id);
  revalidatePath("/finances/paiements-a-faire");
  revalidatePath("/comptabilite");
  return { ok: true };
}

// ───────────── Espace de discussion (parties prenantes) ─────────────

/** Ajoute un commentaire à la déclaration (toute personne pouvant la consulter). */
export async function addMedicalInfoComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const declarationId = fdStr(formData, "declarationId");
  const body = fdStr(formData, "body");
  if (!declarationId || !body) return { ok: false, error: "Commentaire vide." };
  const decl = await getDeclaration(declarationId);
  if (!decl || !canViewDeclaration(user, decl)) return { ok: false, error: "Action non autorisée." };
  await prisma.comment.create({ data: { entityType: "MEDICAL_INFO_DECLARATION", entityId: declarationId, body, authorId: user.id } });
  revalidate(declarationId);
  return { ok: true };
}
