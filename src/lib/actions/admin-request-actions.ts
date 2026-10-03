"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { FinanceCategory } from "@prisma/client";
import type { AdminRequestType, AdminRequestStatus, Priority, AdminApprovalStatus, DriverMissionStatus, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { actsForUser } from "@/lib/hr/stand-in-resolve";
import { journaliserDemandeAchat } from "@/lib/general-means/purchase-journal";
import { companyIdForNew } from "@/lib/company";
import { saveFile, validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { algiersInputToUtc, formatAlgiers } from "@/lib/calendar-tz";
import { archiveProcessedRequest } from "@/lib/archive";
import { ADMIN_REQUEST_TYPE, ADMIN_REQUEST_STATUS } from "@/lib/labels";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { createExpenseOrder } from "@/lib/expense-orders";
import { createDirectValidation, retirerValidationSansObjet } from "@/lib/validation";
import { buildRef, createWithRetry } from "@/lib/refs";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";
import { dejaPorteParSaFiche } from "@/lib/ad-pro/unified";
import { ecrireAuFil } from "@/lib/ad-pro/fil";
import { clauseDemandeLisible } from "@/lib/queries/admin-requests";
import { fieldLabels } from "@/lib/admin-requests";
import {
  porteDuDemandeur, refusDeModification, changementsDeLaDemande, suitLaDemandeDeBcDuPoste, refusDemandeDeBcDuPoste, type ContenuDemande,
} from "@/lib/secretariat/porte-demandeur";
import { annulerDemandeSecretariat, prevenirLeSecretariat } from "@/lib/secretariat/annulation";
import { refusDuStatutManuel, refusDeReouverture } from "@/lib/secretariat/statut-manuel";

const DENIED: ActionResult = { ok: false, error: "Non autorisé." };

/**
 * Archive une demande administrative TERMINÉE dans le Drive du traitant
 * (« Dossier traité / Bureau du secrétariat ») : récapitulatif + copie des pièces.
 * Une seule fois par demande ; ne fait jamais échouer le traitement.
 */
async function archiveAdminRequestIfDone(id: string, actorId: string): Promise<void> {
  const req = await prisma.administrativeRequest.findUnique({
    where: { id },
    include: { requester: { select: { name: true } }, assignedTo: { select: { name: true } } },
  });
  if (!req || req.archivedNodeId || req.status !== "DONE") return;

  const docs = await prisma.document.findMany({
    where: { entityType: "ADMIN_REQUEST", entityId: id },
    select: { name: true, fileKey: true, mimeType: true },
  });
  const lines = [
    `Demande administrative — ${req.reference}`,
    `Titre : ${req.title}`,
    `Type : ${ADMIN_REQUEST_TYPE[req.type] ?? req.type}${req.subtype ? ` (${req.subtype})` : ""}`,
    req.requester?.name ? `Demandeur : ${req.requester.name}` : null,
    req.assignedTo?.name ? `Traitée par : ${req.assignedTo.name}` : null,
    req.description ? `Description : ${req.description}` : null,
    `Créée le : ${formatAlgiers(req.createdAt, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    `Terminée le : ${formatAlgiers(req.completedAt ?? new Date(), { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
  ].filter(Boolean).join("\n");

  const day = new Date().toISOString().slice(0, 10);
  const nodeId = await archiveProcessedRequest({
    bureau: "Bureau du secrétariat",
    folderName: `${day} — ${req.reference} — ${req.title}`,
    summary: lines,
    attachments: docs.map((d) => ({ name: d.name, fileKey: d.fileKey, mimeType: d.mimeType })),
    ownerId: actorId,
  });
  if (nodeId) {
    await prisma.administrativeRequest.update({ where: { id }, data: { archivedNodeId: nodeId } });
    revalidatePath("/drive");
  }
}

/** Référence robuste (dérivée du maximum réel, pas de `count()+1` fragile). */
async function nextRequestRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.administrativeRequest.findMany({
    where: { reference: { startsWith: `REQ-${year}-` } },
    select: { reference: true },
  });
  return buildRef("REQ", year, refs.map((r) => r.reference));
}

/**
 * UNE DEMANDE TERMINÉE OU ANNULÉE NE SE TRAITE PLUS (§118.187 — audit 360°, R08). Depuis qu'un demandeur
 * peut annuler sa demande au-delà de trente minutes, une demande annulée reste VISIBLE au bureau (elle
 * n'est plus effacée) : « Commencer », « Demander une validation » et « Fin de la demande » l'auraient
 * ressuscitée, ou payée. Une demande TERMINÉE se rouvre par `rouvrirDemande`, avec son motif ; une
 * demande ANNULÉE ne se rouvre pas (§118.191) — ce qui en dépendait a été retiré avec elle.
 */
/** Une demande qui se TRAITE encore — la condition de toute écriture qui la fait avancer (§118.187). */
const OUVERTE = { deletedAt: null, status: { notIn: ["DONE", "CANCELLED"] as AdminRequestStatus[] } } satisfies Prisma.AdministrativeRequestWhereInput;
const DEMANDE_CHANGEE = "Cette demande vient d'être annulée ou terminée : rouvrez-la pour voir où elle en est.";

function refusDemandeClose(status: AdminRequestStatus): string | null {
  if (status === "CANCELLED") return "Cette demande a été annulée : elle ne se traite plus, et ne se rouvre pas — déposez-en une nouvelle.";
  if (status === "DONE") return "Cette demande est terminée : elle ne se traite plus. Si elle doit reprendre, rouvrez-la (« Rouvrir », avec son motif).";
  return null;
}

/** Type-specific fields are submitted as `f_<name>` and stored in `fields` JSON. */
function collectFields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("f_") && typeof v === "string" && v.trim()) out[k.slice(2)] = v.trim();
  }
  return out;
}

function isManager(user: SessionUser, assignedToId: string | null): boolean {
  return hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE") || assignedToId === user.id;
}

// ─────────────────────────────── Création ───────────────────────────────

export async function createRequest(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "ADMIN_REQUESTS", "CREATE")) return DENIED;
  const type = fdStr(formData, "type") as AdminRequestType | null;
  const title = fdStr(formData, "title");
  if (!type || !title) return { ok: false, error: "Type et titre obligatoires." };

  const created = await prisma.administrativeRequest.create({
    data: {
      reference: await nextRequestRef(),
      title, type,
      description: fdStr(formData, "description"),
      priority: (fdStr(formData, "priority") as Priority) ?? "MEDIUM",
      deadline: fdDate(formData, "deadline"),
      concernedUserId: fdStr(formData, "concernedUserId"),
      assignedToId: fdStr(formData, "assignedToId"),
      departmentId: fdStr(formData, "departmentId"),
      fields: collectFields(formData),
      requesterId: user.id,
      createdById: user.id,
      companyId: await companyIdForNew(user.id),
    },
    select: { id: true, reference: true, assignedToId: true },
  });

  if (created.assignedToId && created.assignedToId !== user.id) {
    await notifyUser({ userId: created.assignedToId, type: "ASSIGNMENT", title: "Nouvelle demande administrative", body: `${created.reference} — ${title}`, link: `/demandes/${created.id}` });
  } else if (!created.assignedToId) {
    // SANS RESPONSABLE, LE SECRÉTARIAT EST PRÉVENU (audit 360°, I10). Le formulaire propose
    // « — (l'assistante) » par défaut : la demande lui revient, et personne ne le lui disait — elle
    // devait ouvrir le bureau pour découvrir son travail.
    await notifyRoles(["DIRECTION_ASSISTANT"], { type: "ASSIGNMENT", title: "Nouvelle demande au secrétariat", body: `${created.reference} — ${title}`, link: `/demandes/${created.id}` }).catch(() => undefined);
  }
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: created.id, summary: `Demande ${created.reference} — ${title}` });
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true, id: created.id };
}

// ─────────────────────────────── Traitement ───────────────────────────────

/**
 * CHANGER LE STATUT À LA MAIN — seulement ce qui n'a pas d'autre geste (§118.191, audit 360° R12) :
 * attendre un tiers ou un document, être bloqué (et dire pourquoi), reprendre. Le menu offrait les neuf
 * statuts sans condition : « Terminée » contournait la fin gardée, « Annulée » l'annulation commune, et
 * une demande annulée se ressuscitait d'un clic. La règle vit dans `secretariat/statut-manuel.ts`, lue
 * aussi par l'écran — qui ne propose plus de menu, mais des gestes nommés.
 */
export async function updateRequestStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status") as AdminRequestStatus | null;
  if (!id || !status) return { ok: false, error: "Paramètres manquants." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { assignedToId: true, requesterId: true, reference: true, status: true, deletedAt: true } });
  if (!req || req.deletedAt) return { ok: false, error: "Demande introuvable." };
  if (!isManager(user, req.assignedToId)) return DENIED;

  const motif = fdStr(formData, "blockedReason");
  const refus = refusDuStatutManuel({ courant: req.status, cible: status, motif });
  if (refus) return { ok: false, error: refus };

  // Conditionnelle sur le statut LU : une demande terminée, annulée ou mise en validation entre-temps
  // ne change pas de statut en douce.
  const ecrit = await prisma.administrativeRequest.updateMany({
    where: { id, status: req.status, deletedAt: null },
    data: { status, blockedReason: status === "BLOCKED" ? motif : null },
  });
  if (ecrit.count === 0) return { ok: false, error: "Cette demande vient de changer : rouvrez-la pour voir où elle en est." };

  // Ce que le demandeur lit : le statut par son NOM — jamais l'énumération brute —, et le motif d'un blocage.
  const libelle = ADMIN_REQUEST_STATUS[status]?.label ?? status;
  const phrase = status === "BLOCKED" ? `Demande bloquée — ${motif}` : `Statut : ${libelle}`;
  // Le motif d'un blocage va au FIL de la demande — par l'écrivain du fil, hors du corps de l'action :
  // deux écritures en ligne feraient renoncer la dérivation des contrats à dire ce que `id` désigne.
  if (status === "BLOCKED") {
    await ecrireAuFil({ entityType: "ADMIN_REQUEST", entityId: id, authorId: user.id, body: phrase }).catch(() => undefined);
  }
  if (req.requesterId && req.requesterId !== user.id) {
    await notifyUser({
      userId: req.requesterId, type: "GENERIC",
      title: status === "BLOCKED" ? "Demande bloquée" : "Demande mise à jour",
      body: `${req.reference} — ${status === "BLOCKED" ? motif : libelle}`, link: `/demandes/${id}`,
    });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: id, field: "status", newValue: status, summary: phrase });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true };
}

/**
 * ROUVRIR UNE DEMANDE TERMINÉE — avec son motif (§118.191, audit 360° R12). La fin déclarée trop tôt
 * (« la livraison n'est jamais arrivée ») n'avait pas d'autre retour que le menu libre, qui rouvrait
 * aussi une demande ANNULÉE. Seule une demande terminée se rouvre : une annulée a perdu avec elle ses
 * validations et ses paiements, la ressusciter les laisserait derrière. La date de fin part avec la
 * fin ; l'imputation déjà faite reste (la fin suivante ne débite pas une seconde fois).
 */
export async function rouvrirDemande(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { assignedToId: true, requesterId: true, reference: true, status: true, deletedAt: true } });
  if (!req || req.deletedAt) return { ok: false, error: "Demande introuvable." };
  if (!isManager(user, req.assignedToId)) return DENIED;
  const motif = fdStr(formData, "motif");
  const refus = refusDeReouverture({ courant: req.status, motif });
  if (refus) return { ok: false, error: refus };

  const r = await prisma.administrativeRequest.updateMany({ where: { id, status: "DONE", deletedAt: null }, data: { status: "IN_PROGRESS", completedAt: null } });
  if (r.count === 0) return { ok: false, error: "Cette demande vient de changer : rouvrez-la pour voir où elle en est." };
  await ecrireAuFil({ entityType: "ADMIN_REQUEST", entityId: id, authorId: user.id, body: `Demande rouverte — ${motif}` }).catch(() => undefined);
  if (req.requesterId && req.requesterId !== user.id) {
    await notifyUser({ userId: req.requesterId, type: "GENERIC", title: "Demande rouverte", body: `${req.reference} — ${motif}`, link: `/demandes/${id}` });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, field: "status", newValue: "IN_PROGRESS", summary: `Demande ${req.reference} rouverte — ${motif}` });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true, message: "Demande rouverte — le demandeur est prévenu." };
}

/**
 * ANNULER UNE DEMANDE, PAR LE SECRÉTARIAT — avec son motif, par l'annulation commune (§118.191, R12) :
 * elle retire aussi la validation, l'approbation et le paiement qui en dépendent (§118.187). Le menu
 * libre écrivait « annulée » et laissait tout le reste vivant. Le demandeur est prévenu : c'est sa
 * demande qui s'arrête.
 */
export async function annulerDemandeAuSecretariat(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { assignedToId: true, requesterId: true, reference: true, status: true, deletedAt: true, linkedEntityType: true, type: true, title: true } });
  if (!req || req.deletedAt) return { ok: false, error: "Demande introuvable." };
  if (!isManager(user, req.assignedToId)) return DENIED;
  const close = refusDemandeClose(req.status);
  if (close) return { ok: false, error: close };
  // La demande de BC d'un poste Ad & Pro se retire DEPUIS LE POSTE : l'annuler d'ici laisserait le
  // poste attendre un bon de commande que personne n'établira (§118.187).
  if (suitLaDemandeDeBcDuPoste(req)) return { ok: false, error: refusDemandeDeBcDuPoste("annuler") };
  const motif = fdStr(formData, "motif");
  if (motif === null) return { ok: false, error: "Dites pourquoi vous annulez : c'est ce que lira le demandeur." };

  const a = await annulerDemandeSecretariat(id, { acteurId: user.id, motif, cause: "par le secrétariat" });
  if (!a.ok) return { ok: false, error: a.error };
  if (!a.annulee) return { ok: false, error: "Cette demande vient d'être terminée ou annulée : rouvrez-la pour voir où elle en est." };
  if (req.requesterId && req.requesterId !== user.id) {
    await notifyUser({ userId: req.requesterId, type: "GENERIC", title: "Demande annulée par le secrétariat", body: `${req.reference} — ${motif}`, link: `/demandes/${id}` });
  }
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  if (a.ordresAnnules.length > 0 || a.retraits > 0) revalidatePath("/validations");
  if (a.ordresAnnules.length > 0) revalidatePath("/finances/paiements-a-faire");
  return {
    ok: true,
    message: `Demande ${a.reference} annulée — le demandeur est prévenu${a.ordresAnnules.length ? ` ; paiement(s) ${a.ordresAnnules.join(", ")} annulé(s)` : ""}.${a.reserve ? ` Attention : ${a.reserve}` : ""}`,
  };
}

export async function assignRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const assignedToId = fdStr(formData, "assignedToId");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { assignedToId: true, reference: true } });
  if (!req || !isManager(user, req.assignedToId)) return DENIED;
  await prisma.administrativeRequest.update({ where: { id }, data: { assignedToId } });
  if (assignedToId && assignedToId !== user.id) {
    await notifyUser({ userId: assignedToId, type: "ASSIGNMENT", title: "Demande qui vous est assignée", body: req.reference, link: `/demandes/${id}` });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: id, summary: "Responsable modifié" });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes/assistant");
  return { ok: true };
}

// ─────────────────────────────── Validations ───────────────────────────────

export async function requestApproval(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const requestId = fdStr(formData, "requestId");
  const validatorId = fdStr(formData, "validatorId");
  if (!requestId || !validatorId) return { ok: false, error: "Validateur requis." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id: requestId }, select: { assignedToId: true, reference: true, status: true, deletedAt: true } });
  if (!req || req.deletedAt || !isManager(user, req.assignedToId)) return DENIED;
  const close = refusDemandeClose(req.status);
  if (close) return { ok: false, error: close };

  const amount = fdNum(formData, "amount");
  const approbation = await prisma.adminApproval.create({
    data: { requestId, requestedById: user.id, validatorId, status: "PENDING", comment: fdStr(formData, "comment"), amount: amount ?? undefined },
    select: { id: true },
  });
  // CONDITIONNELLE, puis COMPENSÉE (§118.187) : une annulation passée entre la lecture et l'écriture a
  // déjà retiré les approbations qu'elle voyait — celle-ci, née après, paierait une demande annulée.
  const posee = await prisma.administrativeRequest.updateMany({ where: { id: requestId, ...OUVERTE }, data: { validatorId, status: "AWAITING_VALIDATION" } });
  if (posee.count === 0) {
    await prisma.adminApproval.deleteMany({ where: { id: approbation.id, status: "PENDING" } });
    return { ok: false, error: DEMANDE_CHANGEE };
  }
  await notifyUser({ userId: validatorId, type: "VALIDATION_REQUIRED", title: "Validation demandée", body: `${req.reference}${amount ? ` — ${amount.toLocaleString("fr-FR")} DZD` : ""}`, link: `/demandes/${requestId}` });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: requestId, summary: "Validation demandée" });
  revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/demandes/approvals");
  return { ok: true };
}

export async function decideApproval(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const approvalId = fdStr(formData, "approvalId");
  const decision = fdStr(formData, "decision") as AdminApprovalStatus | null;
  if (!approvalId || !decision || decision === "PENDING") return { ok: false, error: "Décision invalide." };
  const approval = await prisma.adminApproval.findUnique({ where: { id: approvalId }, include: { request: { select: { id: true, title: true, requesterId: true, assignedToId: true, reference: true, fields: true, status: true, deletedAt: true } } } });
  if (!approval) return { ok: false, error: "Validation introuvable." };
  // UNE DEMANDE ANNULÉE OU EFFACÉE NE S'APPROUVE PLUS (§118.187) — l'approbation d'un montant émet un
  // ordre de dépense : sans cette garde, une validation restée en file payait une demande retirée.
  if (approval.request.deletedAt || approval.request.status === "CANCELLED") {
    return { ok: false, error: "Cette demande a été annulée : la validation n'a plus d'objet." };
  }
  // LE VALIDATEUR NOMMÉ, OU SON INTÉRIMAIRE (§118.185 — audit 360°, I18) — jamais sur sa propre
  // demande : remplacer son directeur ne donne pas le droit de s'approuver un achat.
  const allowed = approval.validatorId === user.id || userCan(user, "ADMIN_REQUESTS", "VALIDATE") || hasGlobalView(user.role)
    || (approval.validatorId !== null && approval.request.requesterId !== user.id && (await actsForUser(user.id, approval.validatorId)));
  if (!allowed) return DENIED;
  if (approval.status !== "PENDING") return { ok: false, error: "Déjà traité." };

  // Sous condition : une validation retirée (demande annulée) ou tranchée entre la lecture et le clic
  // ne se tranche pas une seconde fois — et ne fait pas partir un second ordre de dépense.
  const pris = await prisma.adminApproval.updateMany({ where: { id: approvalId, status: "PENDING" }, data: { status: decision, comment: fdStr(formData, "comment") ?? approval.comment, decidedAt: new Date() } });
  if (pris.count === 0) return { ok: false, error: "Déjà traité, ou retiré parce que la demande a été annulée." };

  const req = approval.request;
  let reqStatus: AdminRequestStatus = "IN_PROGRESS";
  if (decision === "APPROVED") {
    const amt = approval.amount ? Number(approval.amount) : 0;
    if (amt > 0) {
      const fields = (req.fields as Record<string, unknown> | null) ?? {};
      await createExpenseOrder({
        label: `Demande ${req.reference} — ${req.title}`,
        amount: amt, category: "AUTRE",
        beneficiary: (fields.beneficiaire as string) ?? req.title,
        sourceType: "ADMIN_REQUEST", sourceId: req.id, requestedById: user.id,
      });
      reqStatus = "AWAITING_PAYMENT";
    }
  } else if (decision === "REJECTED") {
    reqStatus = "BLOCKED";
  }
  // Jamais une demande TERMINÉE (§118.187) : une approbation tranchée après la fin ne la ressuscite pas
  // — la même règle que la validation (`decideValidation`). L'ordre de dépense, lui, part : le montant
  // a bien été autorisé.
  await prisma.administrativeRequest.updateMany({ where: { id: req.id, ...OUVERTE }, data: { status: reqStatus } });

  for (const uid of [req.assignedToId, req.requesterId]) {
    if (uid && uid !== user.id) await notifyUser({ userId: uid, type: "GENERIC", title: `Validation : ${decision === "APPROVED" ? "acceptée" : decision === "REJECTED" ? "refusée" : "modif. demandée"}`, body: req.reference, link: `/demandes/${req.id}` });
  }
  // UNE DEMANDE VALIDÉE SANS RESPONSABLE REVIENT AU SECRÉTARIAT (audit 360°, I10) : le N+1 disait
  // oui, et personne au bureau ne l'apprenait — l'achat attendait qu'on tombe dessus.
  if (decision === "APPROVED" && !req.assignedToId) {
    await notifyRoles(["DIRECTION_ASSISTANT"], { type: "ASSIGNMENT", title: "Demande validée — à traiter", body: `${req.reference} — ${req.title}`, link: `/demandes/${req.id}` }).catch(() => undefined);
  }
  await recordAudit({ actorId: user.id, action: decision === "REJECTED" ? "REFUSE" : "VALIDATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: req.id, summary: `Validation ${decision}` });
  // LE JOURNAL DES ACHATS suit la décision, pas seulement le dépôt : « qui a dit oui » est la
  // moitié de la question qu'on lui pose. Il ignore de lui-même les demandes d'une autre nature.
  await journaliserDemandeAchat({
    requestId: req.id,
    event: decision === "APPROVED" ? "APPROVED" : decision === "REJECTED" ? "REJECTED" : "CHANGES_REQUESTED",
    actorId: user.id,
    note: fdStr(formData, "comment"),
  });
  revalidatePath(`/demandes/${req.id}`);
  revalidatePath("/demandes/approvals");
  revalidatePath("/finances/paiements-a-faire");
  return { ok: true };
}

// ─────────────────────────────── Missions chauffeur ───────────────────────────────

export async function createMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const requestId = fdStr(formData, "requestId");
  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "Titre de mission requis." };
  if (requestId) {
    const req = await prisma.administrativeRequest.findUnique({ where: { id: requestId }, select: { assignedToId: true } });
    if (!req || !isManager(user, req.assignedToId)) return DENIED;
  } else if (!(hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE"))) {
    return DENIED;
  }
  const assignedToId = fdStr(formData, "assignedToId");
  // Échéance : « date et heure max » (datetime-local, heure d'Alger) ou simple date.
  const deadlineRaw = fdStr(formData, "deadline");
  const deadline = deadlineRaw ? algiersInputToUtc(deadlineRaw) ?? fdDate(formData, "deadline") : null;
  // Points de passage (point A, B, C…) avec la consigne à chaque point.
  const stopLocations = formData.getAll("stopLocation").map((v) => String(v).trim());
  const stopTasks = formData.getAll("stopTask").map((v) => String(v).trim());
  const stops = stopLocations
    .map((location, i) => ({ location, task: stopTasks[i] || null }))
    .filter((s) => s.location);

  const created = await prisma.driverMission.create({
    data: {
      requestId: requestId ?? undefined, title, assignedToId,
      startLocation: fdStr(formData, "startLocation"), destination: fdStr(formData, "destination"),
      address: fdStr(formData, "address"), contactName: fdStr(formData, "contactName"), contactPhone: fdStr(formData, "contactPhone"),
      instructions: fdStr(formData, "instructions"), deadline,
      proofType: fdStr(formData, "proofType"), createdById: user.id,
      stops: stops.length ? { create: stops.map((s, i) => ({ position: i, location: s.location, task: s.task })) } : undefined,
    },
    select: { id: true },
  });

  // Pièces jointes (bon de commande, dossier à déposer, plan…) versées à la course.
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length) {
    const maxMb = (await getAppSettings()).maxUploadMb;
    for (const file of files) {
      const invalid = validateUpload(file.name, file.size, maxMb);
      if (invalid) return { ok: false, error: invalid };
      const key = `DRIVER_MISSION/${created.id}/${randomUUID()}__${file.name}`;
      try {
        await saveFile(key, Buffer.from(await file.arrayBuffer()));
      } catch (err) {
        console.error("[mission] storage write failed, recording metadata only", err);
      }
      await prisma.document.create({
        data: {
          name: file.name, category: "OTHER", entityType: "DRIVER_MISSION", entityId: created.id,
          fileKey: key, mimeType: file.type || null, sizeBytes: file.size, confidentiality: "INTERNAL", uploadedById: user.id,
        },
      });
    }
  }

  if (assignedToId && assignedToId !== user.id) {
    await notifyUser({ userId: assignedToId, type: "MEDICAL_TOUR", title: "Nouvelle course chauffeur", body: title, link: `/demandes/driver` });
  }
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Demandes administratives", entityType: "DRIVER_MISSION", entityId: created.id, summary: `Mission « ${title} »` });
  if (requestId) revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/demandes/driver");
  revalidatePath("/demandes/courses");
  return { ok: true, id: created.id };
}

/** Coche / décoche un point de passage d'une course (chauffeur assigné ou gestionnaire). */
export async function toggleMissionStop(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const stop = await prisma.driverMissionStop.findUnique({
    where: { id },
    select: { done: true, mission: { select: { id: true, assignedToId: true } } },
  });
  if (!stop) return { ok: false, error: "Point introuvable." };
  const allowed = stop.mission.assignedToId === user.id || hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE");
  if (!allowed) return DENIED;
  const done = !stop.done;
  await prisma.driverMissionStop.update({ where: { id }, data: { done, doneAt: done ? new Date() : null } });
  revalidatePath("/demandes/driver");
  revalidatePath("/demandes/courses");
  return { ok: true };
}

export async function updateMission(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status") as DriverMissionStatus | null;
  if (!id || !status) return { ok: false, error: "Paramètres manquants." };
  const mission = await prisma.driverMission.findUnique({ where: { id }, select: { assignedToId: true, requestId: true, title: true } });
  if (!mission) return { ok: false, error: "Mission introuvable." };
  const allowed = mission.assignedToId === user.id || hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE");
  if (!allowed) return DENIED;

  const data: { status: DriverMissionStatus; proofComment?: string | null; startedAt?: Date; completedAt?: Date } = { status, proofComment: fdStr(formData, "proofComment") };
  if (status === "EN_ROUTE" || status === "ACCEPTED") data.startedAt = new Date();
  if (status === "DONE") data.completedAt = new Date();
  await prisma.driverMission.update({ where: { id }, data });

  if ((status === "DONE" || status === "PROBLEM") && mission.requestId) {
    const req = await prisma.administrativeRequest.findUnique({ where: { id: mission.requestId }, select: { assignedToId: true, reference: true } });
    if (req?.assignedToId && req.assignedToId !== user.id) {
      await notifyUser({ userId: req.assignedToId, type: "GENERIC", title: `Mission ${status === "DONE" ? "terminée" : "— problème"}`, body: mission.title, link: `/demandes/${mission.requestId}` });
    }
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Demandes administratives", entityType: "DRIVER_MISSION", entityId: id, field: "status", newValue: status, summary: `Mission → ${status}` });
  revalidatePath("/demandes/driver");
  if (mission.requestId) revalidatePath(`/demandes/${mission.requestId}`);
  return { ok: true };
}

// ─────────────────────────────── Commentaires ───────────────────────────────

export async function addRequestComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const requestId = fdStr(formData, "requestId");
  const body = fdStr(formData, "body");
  if (!requestId || !body) return { ok: false, error: "Commentaire vide." };
  // LA CLAUSE DE LA FICHE (§118.184 — audit 360°, S12) : sans elle, n'importe quel compte commentait toute
  // demande par son identifiant, et la notification partait chez le demandeur. Hors de portée, la même
  // phrase que l'absence.
  const req = await prisma.administrativeRequest.findFirst({ where: await clauseDemandeLisible(user, requestId), select: { requesterId: true, assignedToId: true } });
  if (!req) return { ok: false, error: "Demande introuvable." };

  await prisma.comment.create({ data: { entityType: "ADMIN_REQUEST", entityId: requestId, body, authorId: user.id } });
  // QUI LIT CE COMMENTAIRE (audit 360°, R09). Le demandeur parle au SECRÉTARIAT : son responsable
  // désigné, sinon chaque assistante — les demandes ouvertes par un poste naissent sans responsable,
  // et notifier le seul `assignedToId` revenait à ne prévenir personne sur le seul canal de correction
  // qui restait. Quelqu'un d'autre (l'assistante, un validateur) parle au demandeur ET au responsable.
  const avis = { type: "GENERIC" as const, title: "Nouveau commentaire", body: body.slice(0, 80), link: `/demandes/${requestId}` };
  if (user.id === req.requesterId) {
    await prevenirLeSecretariat(req.assignedToId, avis, user.id);
  } else {
    for (const uid of new Set([req.requesterId, req.assignedToId])) {
      if (uid && uid !== user.id) await notifyUser({ userId: uid, ...avis });
    }
  }
  revalidatePath(`/demandes/${requestId}`);
  return { ok: true };
}

// ─────────────────────────── Demande multi-cellules (lot) ───────────────────────────

interface BatchCell {
  type?: string;
  title?: string;
  description?: string;
  priority?: string;
  deadline?: string;
  articleId?: string;
  articleName?: string;
  quantity?: string;
  budget?: string;
}

/**
 * LES TYPES QU'ON PEUT ENCORE CRÉER. `HR_SIMPLE` n'y est plus (§118.138) : les demandes RH se
 * posent dans le module RH. La valeur reste dans l'énumération Prisma pour les demandes déjà
 * posées — c'est la porte d'ENTRÉE qu'on ferme, pas l'historique.
 */
const REQ_TYPES: AdminRequestType[] = ["TRAVEL", "MAIL", "SIGNATURE", "PURCHASE", "QUOTE", "PAYMENT", "DRIVER", "GUEST_VISA", "OTHER"];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/**
 * Crée plusieurs demandes en un seul envoi (cellules). Chaque cellule devient une
 * demande administrative à part entière, partageant un même `batchId` afin de
 * rester regroupées — mais pilotée indépendamment par l'assistante (statut,
 * validations). Idéal quand un employé a plusieurs besoins à formuler d'un coup.
 */
export async function createRequestBatch(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "ADMIN_REQUESTS", "CREATE")) return DENIED;

  let cells: BatchCell[];
  try {
    cells = JSON.parse(fdStr(formData, "cells") ?? "[]");
  } catch {
    return { ok: false, error: "Format des cellules invalide." };
  }
  const clean = (Array.isArray(cells) ? cells : []).filter((c) => c && c.title && String(c.title).trim() && c.type);
  if (clean.length === 0) return { ok: false, error: "Ajoutez au moins une cellule (type + objet)." };
  if (clean.length > 25) return { ok: false, error: "25 cellules maximum par envoi." };

  const batchId = randomUUID();
  const concernedUserId = fdStr(formData, "concernedUserId");
  const assignedToId = fdStr(formData, "assignedToId");
  const departmentId = fdStr(formData, "departmentId");
  const createdIds: string[] = [];
  // LA MÊME SOCIÉTÉ QUE LA CRÉATION UNITAIRE (`createRequest`, plus haut dans ce fichier) : le lot
  // créait ses demandes sans société, donc invisibles dans toute vue cloisonnée du bureau — même
  // pour leur auteur (§118.154). Lue une fois : toutes les cellules d'un envoi sont du même auteur.
  const companyId = await companyIdForNew(user.id);

  for (const c of clean) {
    const type = (REQ_TYPES.includes(c.type as AdminRequestType) ? c.type : "OTHER") as AdminRequestType;
    const priority = (c.priority && PRIORITIES.includes(c.priority as Priority) ? c.priority : "MEDIUM") as Priority;
    const fields: Record<string, string> = {};
    if (c.articleName) fields.article = String(c.articleName);
    if (c.articleId) fields.articleId = String(c.articleId);
    if (c.quantity) fields.quantite = String(c.quantity);
    if (c.budget) fields.budget = String(c.budget);
    const deadline = c.deadline ? new Date(c.deadline) : null;

    const created = await createWithRetry(async () =>
      prisma.administrativeRequest.create({
        data: {
          reference: await nextRequestRef(),
          title: String(c.title).trim(),
          type,
          description: c.description ? String(c.description).trim() : null,
          priority,
          deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
          concernedUserId,
          assignedToId,
          departmentId,
          fields,
          batchId,
          companyId,
          requesterId: user.id,
          createdById: user.id,
        },
        select: { id: true },
      }),
    );
    createdIds.push(created.id);
  }

  if (assignedToId && assignedToId !== user.id) {
    await notifyUser({ userId: assignedToId, type: "ASSIGNMENT", title: "Nouvelles demandes (lot)", body: `${createdIds.length} demande(s) à traiter`, link: `/demandes/${createdIds[0]}` });
  }
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: createdIds[0], summary: `Lot de ${createdIds.length} demande(s) créé` });
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true, id: createdIds[0] };
}

// ─────────────────────────── Le demandeur corrige ou annule (§118.187) ───────────────────────────

const PRIORITIES_DEMANDE: readonly Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const enTexte = (f: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v === "string" || typeof v === "number").map(([k, v]) => [k, String(v)]));

/**
 * LE DEMANDEUR CORRIGE SA DEMANDE tant qu'elle n'est ni terminée ni annulée (audit 360°, R08). Dans
 * les trente premières minutes, si personne ne l'a commencée, sans déranger personne ; au-delà,
 * l'assistante est prévenue et la discussion garde ce qui a changé. Fermé, avec son remède : pendant
 * une validation, et quand un paiement est déjà émis (`refusDeModification`).
 *
 * CE QUE LE FORMULAIRE NE PORTE PAS NE S'ÉCRIT PAS (§118.152c). L'ancien remplacement intégral des
 * champs saisis effaçait tout ce qui vit dans le même JSON sans être un champ du formulaire — les
 * LIGNES d'une demande d'achat, son total estimé —, et une correction de l'échéance effaçait la
 * description et remettait la priorité à « moyenne ». Une clé portée vide efface, une clé absente garde.
 */
export async function editOwnRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({
    where: { id },
    select: {
      requesterId: true, status: true, createdAt: true, processingStartedAt: true, deletedAt: true, assignedToId: true,
      reference: true, type: true, title: true, description: true, priority: true, deadline: true, fields: true, linkedEntityType: true,
    },
  });
  if (!req || req.deletedAt) return { ok: false, error: "Demande introuvable." };
  const porte = porteDuDemandeur(req, user.id, Date.now());
  if (!porte.ok) return { ok: false, error: porte.raison };
  if (suitLaDemandeDeBcDuPoste(req)) return { ok: false, error: refusDemandeDeBcDuPoste("corriger") };
  const [validations, approbations, ordres] = await Promise.all([
    prisma.validationRequest.count({ where: { entityType: "ADMIN_REQUEST", entityId: id, documentId: null, status: "PENDING" } }),
    prisma.adminApproval.count({ where: { requestId: id, status: "PENDING" } }),
    prisma.expenseOrder.count({ where: { sourceType: "ADMIN_REQUEST", sourceId: id, status: { not: "CANCELLED" } } }),
  ]);
  const refus = refusDeModification({ validationEnCours: validations + approbations > 0, paiementEmis: ordres > 0 });
  if (refus) return { ok: false, error: refus };

  const title = formData.has("title") ? fdStr(formData, "title") : req.title;
  if (title === null) return { ok: false, error: "Le titre est obligatoire." };
  const prioriteLue = formData.has("priority") ? fdStr(formData, "priority") : null;
  const priority = PRIORITIES_DEMANDE.find((p) => p === prioriteLue) ?? req.priority;
  const description = formData.has("description") ? fdStr(formData, "description") : req.description;
  const deadline = formData.has("deadline") ? fdDate(formData, "deadline") : req.deadline;
  const existants = req.fields && typeof req.fields === "object" && !Array.isArray(req.fields) ? (req.fields as Record<string, unknown>) : {};
  const fields: Record<string, unknown> = { ...existants };
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("f_") || typeof v !== "string") continue;
    const val = v.trim();
    if (val) fields[k.slice(2)] = val;
    else delete fields[k.slice(2)];
  }

  const avant: ContenuDemande = { title: req.title, description: req.description, priority: req.priority, deadline: jour(req.deadline), fields: enTexte(existants) };
  const apres: ContenuDemande = { title, description, priority, deadline: jour(deadline), fields: enTexte(fields) };
  const changes = changementsDeLaDemande(avant, apres, fieldLabels(req.type));
  if (changes.length === 0) return { ok: true, message: "Rien n'a changé." };

  // Sous condition : annulée ou terminée entre la lecture et l'écriture, elle ne se réécrit plus.
  const ecrite = await prisma.administrativeRequest.updateMany({
    where: { id, ...OUVERTE },
    data: { title, description, priority, deadline, fields: fields as Prisma.InputJsonValue },
  });
  if (ecrite.count === 0) return { ok: false, error: DEMANDE_CHANGEE };
  const quoi = changes.join(", ");
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id,
    summary: `Demande ${req.reference} corrigée par son demandeur${porte.discret ? " (fenêtre discrète)" : ""} — ${quoi}`,
  });
  if (!porte.discret) {
    await prisma.comment.create({ data: { entityType: "ADMIN_REQUEST", entityId: id, body: `Demande corrigée par son demandeur : ${quoi}.`, authorId: user.id } });
    await prevenirLeSecretariat(req.assignedToId, {
      type: "GENERIC", title: "Demande corrigée par son demandeur", body: `${req.reference} — ${quoi}`, link: `/demandes/${id}`,
    }, user.id);
  }
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes");
  return { ok: true, message: porte.discret ? "Demande modifiée." : `Demande modifiée — l'assistante est prévenue (${quoi}).` };
}

/**
 * LE DEMANDEUR RETIRE SA DEMANDE (audit 360°, R08). Dans la fenêtre discrète, elle s'efface sans bruit,
 * comme avant : personne n'y a rien fait. Au-delà, elle se CLÔT avec son motif — elle n'est plus effacée,
 * parce que quelqu'un a peut-être déjà travaillé dessus — et ce qui en dépend part avec elle : validations
 * en attente, approbations, paiement non réglé (`annulerDemandeSecretariat`). Un paiement réglé refuse.
 */
export async function deleteOwnRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({
    where: { id },
    select: { requesterId: true, status: true, createdAt: true, processingStartedAt: true, reference: true, deletedAt: true, linkedEntityType: true, type: true, title: true },
  });
  if (!req || req.deletedAt) return { ok: false, error: "Demande introuvable." };
  const porte = porteDuDemandeur(req, user.id, Date.now());
  if (!porte.ok) return { ok: false, error: porte.raison };
  if (suitLaDemandeDeBcDuPoste(req)) return { ok: false, error: refusDemandeDeBcDuPoste("annuler") };

  if (porte.discret) {
    const r = await prisma.administrativeRequest.updateMany({
      where: { id, deletedAt: null, status: "NEW", processingStartedAt: null },
      data: { deletedAt: new Date(), deletedById: user.id, deletionReason: "Supprimée par le demandeur (≤ 30 min)", status: "CANCELLED", cancelledAt: new Date() },
    });
    if (r.count === 0) return { ok: false, error: "L'assistante vient de commencer cette demande : rouvrez-la — elle s'annule désormais avec un motif." };
    await recordAudit({ actorId: user.id, action: "DELETE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, summary: `Demande ${req.reference} supprimée par le demandeur` });
    revalidatePath("/demandes");
    revalidatePath("/demandes/assistant");
    return { ok: true };
  }

  const motif = fdStr(formData, "motif");
  if (motif === null) return { ok: false, error: "Dites pourquoi vous annulez : l'assistante a peut-être déjà commencé, et c'est ce qu'elle lira." };
  const a = await annulerDemandeSecretariat(id, { acteurId: user.id, motif, cause: "par son demandeur" });
  if (!a.ok) return { ok: false, error: a.error };
  if (!a.annulee) return { ok: false, error: "Cette demande vient d'être terminée ou annulée : rouvrez-la pour voir où elle en est." };
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  if (a.ordresAnnules.length > 0 || a.retraits > 0) revalidatePath("/validations");
  if (a.ordresAnnules.length > 0) revalidatePath("/finances/paiements-a-faire");
  const suites = [
    a.retraits > 0 ? `${a.retraits} validation${a.retraits > 1 ? "s" : ""} retirée${a.retraits > 1 ? "s" : ""}` : null,
    a.ordresAnnules.length > 0 ? `paiement${a.ordresAnnules.length > 1 ? "s" : ""} ${a.ordresAnnules.join(", ")} annulé${a.ordresAnnules.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  return {
    ok: true,
    message: `Demande ${a.reference} annulée — l'assistante est prévenue${suites.length ? ` ; ${suites.join(", ")}` : ""}.${a.reserve ? ` Attention : ${a.reserve}` : ""}`,
  };
}

// ─────────────────────────── Suppression traçable (assistante) ───────────────────────────

/** L'assistante supprime une ou plusieurs demandes — soft delete + motif obligatoire. */
export async function deleteRequests(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE"))) return DENIED;
  const ids = (fdStr(formData, "ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return { ok: false, error: "Aucune demande sélectionnée." };
  const reason = fdStr(formData, "reason");
  if (!reason) return { ok: false, error: "Le motif de suppression est obligatoire (traçabilité)." };

  const targets = await prisma.administrativeRequest.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, reference: true } });
  if (targets.length === 0) return { ok: false, error: "Demande(s) introuvable(s)." };

  await prisma.administrativeRequest.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { deletedAt: new Date(), deletedById: user.id, deletionReason: reason },
  });
  for (const t of targets) {
    await recordAudit({ actorId: user.id, action: "DELETE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: t.id, newValue: reason, summary: `Demande ${t.reference} supprimée — motif : ${reason}` });
  }
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true };
}

/** Restaure une demande supprimée (assistante / super admin). */
export async function restoreRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!(hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE"))) return DENIED;
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { reference: true, status: true, requesterId: true, deletedById: true, processingStartedAt: true } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  // RESTAURER N'EST PAS RESSUSCITER (§118.191). La restauration remettait TOUTE demande « nouvelle » :
  // une demande terminée redevenait à traiter, une demande annulée — dont l'annulation avait retiré les
  // validations et les paiements — repartait sans eux. Seule la suppression DISCRÈTE du demandeur
  // (≤ 30 min, jamais commencée) passait la demande « annulée » en la supprimant : elle seule revient
  // « nouvelle ». Toute autre demande revient dans l'état où on l'a supprimée.
  const suppressionDiscrete = req.status === "CANCELLED" && req.deletedById === req.requesterId && req.processingStartedAt === null;
  await prisma.administrativeRequest.update({
    where: { id },
    data: { deletedAt: null, deletedById: null, deletionReason: null, ...(suppressionDiscrete ? { status: "NEW", cancelledAt: null } : {}) },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, summary: `Demande ${req.reference} restaurée` });
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true };
}

// ─────────────────────────── Flux de traitement (assistante) ───────────────────────────

/** « Commencer le traitement » : passe la demande en cours et fige la fenêtre demandeur. */
export async function startRequestProcessing(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { assignedToId: true, status: true, reference: true, deletedAt: true } });
  if (!req || req.deletedAt) return { ok: false, error: "Demande introuvable." };
  if (!isManager(user, req.assignedToId)) return DENIED;
  const close = refusDemandeClose(req.status);
  if (close) return { ok: false, error: close };

  // QUI COMMENCE EN DEVIENT RESPONSABLE, si personne ne l'était (audit 360°, R09) : sans responsable, le
  // commentaire du demandeur repartait vers tout le secrétariat alors qu'une personne précise avait la main.
  const r = await prisma.administrativeRequest.updateMany({
    where: { id, ...OUVERTE },
    data: { status: "IN_PROGRESS", processingStartedAt: new Date(), ...(req.assignedToId ? {} : { assignedToId: user.id }) },
  });
  if (r.count === 0) return { ok: false, error: DEMANDE_CHANGEE };
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, field: "status", newValue: "IN_PROGRESS", summary: req.assignedToId ? "Traitement démarré" : "Traitement démarré — responsable : la personne qui l'a commencé" });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes/assistant");
  return { ok: true };
}

/**
 * « Demande de validation des Finances » (flux achat). Crée une demande de
 * validation dans le bureau central « Demandes de validations » à destination de
 * l'équipe Finances, rattachée à la demande. Va-et-vient possible : en cas de refus
 * ou de modification demandée, l'assistante peut renvoyer une nouvelle validation.
 */
export async function requestFinanceValidation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { assignedToId: true, reference: true, title: true, status: true } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (!isManager(user, req.assignedToId)) return DENIED;
  const close = refusDemandeClose(req.status);
  if (close) return { ok: false, error: close };

  // Validateurs Finances : choisis dans le formulaire, sinon tous les responsables Finances.
  let validatorIds = [fdStr(formData, "validatorId"), fdStr(formData, "validator2Id")].filter((v): v is string => Boolean(v));
  if (validatorIds.length === 0) {
    const finance = await prisma.user.findMany({ where: { isActive: true, role: "FINANCE_BUDGET_MANAGER" }, select: { id: true } });
    validatorIds = finance.map((f) => f.id);
  }
  if (validatorIds.length === 0) return { ok: false, error: "Aucun responsable Finances disponible. Choisissez un validateur." };

  const amount = fdNum(formData, "amount");
  const note = fdStr(formData, "comment");
  const res = await createDirectValidation({
    requesterId: user.id,
    title: `Achat — ${req.reference} : ${req.title}`,
    description: [note, amount ? `Montant estimé : ${amount.toLocaleString("fr-FR")} DZD` : null].filter(Boolean).join(" — ") || null,
    module: "Finances",
    link: `/demandes/${id}`,
    validatorIds,
    entityType: "ADMIN_REQUEST",
    entityId: id,
  });
  if (!res.ok) return { ok: false, error: res.error };

  // CONDITIONNELLE, puis COMPENSÉE (§118.187) : annulée entre la lecture et l'écriture, la demande a
  // déjà retiré les validations qu'elle voyait — celle-ci, née après, resterait en file pour rien.
  const posee = await prisma.administrativeRequest.updateMany({ where: { id, ...OUVERTE }, data: { status: "AWAITING_VALIDATION" } });
  if (posee.count === 0) {
    if (res.requestId) await retirerValidationSansObjet(res.requestId);
    return { ok: false, error: DEMANDE_CHANGEE };
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, summary: `Validation Finances demandée (${res.reference})` });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/validations");
  return { ok: true };
}

/**
 * « Demander une validation » (flux hors achat). L'assistante estime qui doit
 * valider (opérations, direction, autre) — ou personne. Routé vers le bureau
 * central « Demandes de validations ».
 */
export async function requestInternalValidation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({ where: { id }, select: { assignedToId: true, reference: true, title: true, status: true } });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (!isManager(user, req.assignedToId)) return DENIED;
  const close = refusDemandeClose(req.status);
  if (close) return { ok: false, error: close };

  const validatorIds = [fdStr(formData, "validatorId"), fdStr(formData, "validator2Id")].filter((v): v is string => Boolean(v));
  if (validatorIds.length === 0) return { ok: false, error: "Choisissez au moins un validateur." };

  const res = await createDirectValidation({
    requesterId: user.id,
    title: `${req.reference} : ${req.title}`,
    description: fdStr(formData, "comment"),
    module: "Bureau du secrétariat",
    link: `/demandes/${id}`,
    validatorIds,
    entityType: "ADMIN_REQUEST",
    entityId: id,
  });
  if (!res.ok) return { ok: false, error: res.error };

  // CONDITIONNELLE, puis COMPENSÉE (§118.187) : annulée entre la lecture et l'écriture, la demande a
  // déjà retiré les validations qu'elle voyait — celle-ci, née après, resterait en file pour rien.
  const posee = await prisma.administrativeRequest.updateMany({ where: { id, ...OUVERTE }, data: { status: "AWAITING_VALIDATION" } });
  if (posee.count === 0) {
    if (res.requestId) await retirerValidationSansObjet(res.requestId);
    return { ok: false, error: DEMANDE_CHANGEE };
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, summary: `Validation interne demandée (${res.reference})` });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/validations");
  return { ok: true };
}

/**
 * « Fin de la demande ». Pour un achat, exige la facture finale (document de
 * catégorie INVOICE) avant de clôturer.
 */
export async function finishRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };
  const req = await prisma.administrativeRequest.findUnique({
    where: { id },
    select: { assignedToId: true, type: true, reference: true, title: true, linkedEntityType: true, status: true },
  });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (!isManager(user, req.assignedToId)) return DENIED;
  const close = refusDemandeClose(req.status);
  if (close) return { ok: false, error: close };

  if (req.type === "PURCHASE") {
    const invoice = await prisma.document.count({ where: { entityType: "ADMIN_REQUEST", entityId: id, category: "INVOICE" } });
    if (invoice === 0) return { ok: false, error: "Pour un achat, uploadez d'abord la facture finale (catégorie « Facture »)." };
  }

  // IMPUTATION AUX MOYENS GÉNÉRAUX — le geste qui manquait entre « la demande est faite » et
  // « le budget le sait ».
  //
  // Terminer un achat sans dire QUI le paie laissait le budget des moyens généraux intact
  // pendant que l'argent, lui, était sorti. L'assistante choisit donc le département à
  // débiter : le sien, ou celui qui a demandé — chaque département a SES moyens généraux, et
  // c'est le demandeur qui les consomme, pas le secrétariat qui exécute.
  //
  // EXCEPTION : ce qui vient d'Ad & Pro est déjà porté par le budget de l'opération (poste,
  // ordre de dépense). L'imputer une seconde fois le compterait deux fois.
  //
  // La liste était écrite À LA MAIN ici — cinq natures — pendant que la page de la même demande
  // en lisait huit : sur un achat lié à un POSTE, l'écran masquait l'imputation et cette action
  // l'exigeait, donc la demande ne pouvait plus être terminée (§118.150). Une seule fonction.
  const fromAdPro = dejaPorteParSaFiche(req.linkedEntityType);
  const departmentId = fdStr(formData, "budgetDepartmentId");
  const amount = fdNum(formData, "budgetAmount");
  const alreadyImputed = await prisma.departmentBudgetExpense.count({ where: { adminRequestId: id } });

  if (req.type === "PURCHASE" && !fromAdPro && alreadyImputed === 0 && (!departmentId || !amount)) {
    return {
      ok: false,
      error: "Choisissez le budget de moyens généraux à débiter (le vôtre ou celui du département concerné) et le montant réellement dépensé.",
    };
  }

  const imputer = departmentId != null && amount != null && alreadyImputed === 0;
  if (imputer && amount < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };
  const dept = imputer ? await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true } }) : null;
  if (imputer && !dept) return { ok: false, error: "Département introuvable." };

  // LA DEMANDE EST PRISE AVANT L'IMPUTATION, sous condition (§118.187) : annulée entre la lecture et
  // l'écriture, elle ne repasse pas « terminée », et aucun budget n'est débité pour elle.
  const prise = await prisma.administrativeRequest.updateMany({ where: { id, ...OUVERTE }, data: { status: "DONE", completedAt: new Date() } });
  if (prise.count === 0) return { ok: false, error: DEMANDE_CHANGEE };

  if (imputer && dept) {
    await prisma.departmentBudgetExpense.create({
      data: {
        departmentId: dept.id,
        year: new Date().getFullYear(),
        kind: "OPERATING",
        label: `${req.reference} — ${req.title}`,
        amount,
        notes: fdStr(formData, "budgetNote"),
        adminRequestId: id,
        createdById: user.id,
      },
    });
    await recordAudit({
      actorId: user.id, action: "CREATE", module: "Bureau du secrétariat",
      entityType: "ADMIN_REQUEST", entityId: id,
      summary: `Imputée aux moyens généraux de ${dept.name} — ${amount} DZD`,
    });
    revalidatePath("/moyens-generaux");
    revalidatePath("/budgets/departements");
  }

  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Bureau du secrétariat", entityType: "ADMIN_REQUEST", entityId: id, field: "status", newValue: "DONE", summary: "Fin de la demande" });
  // L'ARCHIVE DANS LE DRIVE (« Dossier traité ») — elle n'était faite que par le menu libre, c'est-à-dire
  // par le seul chemin qui contournait les gardes de cette fin (§118.191, audit R12). Une fois, jamais
  // bloquante : la demande est terminée même si l'archive échoue.
  await archiveAdminRequestIfDone(id, user.id).catch((e) => console.error("[admin-request] archive non faite", e));
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes");
  revalidatePath("/demandes/assistant");
  return { ok: true };
}

/**
 * SOUMETTRE UNE PIÈCE JOINTE À VALIDATION — à n'importe quel moment, à une ou plusieurs personnes.
 *
 * Chaque pièce se soumet À PART (une facture peut partir en validation pendant que le devis reste
 * en discussion), au bureau de validation CENTRAL : les validateurs choisis la retrouvent dans
 * /validations et Mon travail, comme toute validation. En PARALLÈLE — tous saisis et notifiés en
 * même temps, aucun ordre imposé. Et parce qu'on ne valide pas une pièce hors de son contexte,
 * être validateur d'une pièce OUVRE L'ACCÈS à toute la demande (géré sur la page de la demande).
 */
export async function submitAttachmentValidation(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const documentId = String(formData.get("documentId") ?? "").trim();
  const validatorIds = formData.getAll("validatorIds").map((v) => String(v).trim()).filter(Boolean);
  const note = String(formData.get("note") ?? "").trim();
  // Montant (DZD) et catégorie de finance FACULTATIFS : s'ils sont là, l'approbation de la pièce
  // émettra automatiquement l'ordre de dépense correspondant vers les Finances.
  const amount = fdNum(formData, "amount");
  const rawCategory = String(formData.get("category") ?? "").trim();
  const category = (Object.values(FinanceCategory) as string[]).includes(rawCategory) ? rawCategory : null;
  if (!requestId || !documentId) return { ok: false, error: "Pièce ou demande manquante." };
  if (validatorIds.length === 0) return { ok: false, error: "Choisissez au moins un validateur." };
  if (amount !== null && amount < 0) return { ok: false, error: "Montant invalide." };

  const req = await prisma.administrativeRequest.findFirst({
    where: { id: requestId, deletedAt: null },
    select: { id: true, reference: true, title: true, requesterId: true, assignedToId: true },
  });
  if (!req) return { ok: false, error: "Demande introuvable." };
  const isSecretary = user.role === "DIRECTION_ASSISTANT";
  const allowed = hasGlobalView(user.role) || isSecretary || userCan(user, "ADMIN_REQUESTS", "UPDATE")
    || req.requesterId === user.id || req.assignedToId === user.id;
  if (!allowed) return { ok: false, error: "Non autorisé sur cette demande." };

  const doc = await prisma.document.findFirst({
    where: { id: documentId, entityType: "ADMIN_REQUEST", entityId: requestId },
    select: { id: true, name: true },
  });
  if (!doc) return { ok: false, error: "Cette pièce n'appartient pas à la demande." };

  // Pas deux validations EN COURS sur la même pièce : la seconde sèmerait la confusion sur
  // laquelle fait foi. Une pièce refusée peut en revanche être resoumise (nouvelle version).
  const pending = await prisma.validationRequest.count({
    where: { documentId: doc.id, entityType: "ADMIN_REQUEST", entityId: requestId, status: "PENDING" },
  });
  if (pending > 0) return { ok: false, error: "Cette pièce est déjà en cours de validation." };

  const res = await createDirectValidation({
    requesterId: user.id,
    title: `Pièce jointe « ${doc.name} » — ${req.reference}`,
    description: note || `Validation de la pièce « ${doc.name} » de la demande ${req.reference} — ${req.title}.`,
    link: `/demandes/${req.id}`,
    module: "Bureau du secrétariat",
    entityType: "ADMIN_REQUEST",
    entityId: req.id,
    documentId: doc.id,
    mode: "PARALLEL",
    validatorIds,
    amount,
    category,
    // Se choisir soi-même comme validateur est PERMIS ici : la validation de pièce est un avis,
    // pas un circuit hiérarchique — sans cela, le choix s'évaporait et l'écran réclamait
    // « au moins un validateur » alors qu'on venait d'en saisir un.
    allowSelf: true,
  });
  if (!res.ok) return { ok: false, error: res.error };

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: req.id,
    summary: `Pièce « ${doc.name} » soumise à validation (${validatorIds.length} validateur·s) — ${res.reference}`,
  });
  revalidatePath(`/demandes/${req.id}`);
  revalidatePath("/validations");
  revalidatePath("/mon-travail");
  return { ok: true };
}

/**
 * RETIRER UNE VALIDATION DE PIÈCE EN COURS — soumise par erreur, mauvaise pièce, mauvais
 * validateurs : tant qu'elle est EN ATTENTE, celui qui l'a soumise (ou l'assistante / un profil
 * gestionnaire) peut la retirer. Statut ANNULÉ (trace conservée, pas de suppression) ; les
 * validateurs encore saisis sont prévenus et la pièce redevient soumissible.
 */
export async function cancelAttachmentValidation(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const validationId = String(formData.get("validationId") ?? "").trim();
  if (!validationId) return { ok: false, error: "Validation manquante." };

  const val = await prisma.validationRequest.findFirst({
    where: { id: validationId, entityType: "ADMIN_REQUEST", documentId: { not: null } },
    select: {
      id: true, reference: true, title: true, status: true, requesterId: true, entityId: true,
      steps: { select: { validatorId: true, status: true } },
    },
  });
  if (!val) return { ok: false, error: "Validation introuvable." };
  if (val.status !== "PENDING") return { ok: false, error: "Cette validation est déjà clôturée." };

  const isSecretary = user.role === "DIRECTION_ASSISTANT";
  const allowed = hasGlobalView(user.role) || isSecretary || userCan(user, "ADMIN_REQUESTS", "UPDATE") || val.requesterId === user.id;
  if (!allowed) return { ok: false, error: "Non autorisé." };

  await prisma.validationRequest.update({ where: { id: val.id }, data: { status: "CANCELLED", decidedAt: new Date() } });

  // Prévenir ceux qui l'avaient encore dans leur file — sinon ils chercheraient une demande disparue.
  for (const s of val.steps) {
    if (s.status === "PENDING" && s.validatorId !== user.id) {
      await notifyUser({
        userId: s.validatorId, type: "GENERIC", title: "Validation retirée",
        body: `${val.reference} — ${val.title}`, link: val.entityId ? `/demandes/${val.entityId}` : "/validations",
      });
    }
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Demandes administratives", entityType: "ADMIN_REQUEST", entityId: val.entityId ?? val.id,
    summary: `Validation de pièce retirée — ${val.reference}`,
  });
  if (val.entityId) revalidatePath(`/demandes/${val.entityId}`);
  revalidatePath("/validations");
  revalidatePath("/mon-travail");
  return { ok: true };
}
