"use server";

import type { MaterialType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { createExpenseOrder } from "@/lib/expense-orders";
import { buildRef, createWithRetry } from "@/lib/refs";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

const PATH = "/promo-material";

// ───────────────────────── Acteurs du circuit ─────────────────────────
// Marketing = l'initiateur (demandeur) ; Assistante de direction = détenteur de
// VALIDATE sur le module (attribué par l'admin) ; Finances / Information médicale
// = par rôle ; Direction = vue globale (peut débloquer n'importe quelle étape).

function isAssistant(user: SessionUser): boolean {
  // L'assistante de direction pilote ses étapes depuis les Demandes administratives
  // (elle n'a pas accès au module promo) ; la Direction/Super Admin peut suppléer.
  return user.role === "DIRECTION_ASSISTANT" || hasGlobalView(user.role);
}
function isFinance(user: SessionUser): boolean {
  return user.role === "FINANCE_BUDGET_MANAGER" || hasGlobalView(user.role);
}
function isMedicalInfo(user: SessionUser): boolean {
  return user.role === "MEDICAL_INFO_PHARMACIST" || hasGlobalView(user.role);
}
function isDirection(user: SessionUser): boolean {
  return hasGlobalView(user.role);
}
function isMarketing(user: SessionUser, pm: { requesterId: string | null }): boolean {
  return pm.requesterId === user.id || hasGlobalView(user.role);
}

async function nextPromoRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.promoMaterial.findMany({ where: { reference: { startsWith: `MP-${year}-` } }, select: { reference: true } });
  return buildRef("MP", year, refs.map((r) => r.reference));
}

async function nextRequestRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.administrativeRequest.findMany({ where: { reference: { startsWith: `REQ-${year}-` } }, select: { reference: true } });
  return buildRef("REQ", year, refs.map((r) => r.reference));
}

function revalidate(id: string) {
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
}

/** Notifie « l'assistante » : la personne assignée, sinon la Direction. */
async function notifyAssistant(pm: { id: string; reference: string; title: string; assistantId: string | null }, title: string) {
  const body = `${pm.reference} — ${pm.title}`;
  const link = `${PATH}/${pm.id}`;
  if (pm.assistantId) await notifyUser({ userId: pm.assistantId, type: "ASSIGNMENT", title, body, link });
  else await notifyRoles(["DIRECTION_ASSISTANT", "DIRECTION", "SUPER_ADMIN"], { type: "ASSIGNMENT", title, body, link });
}
async function notifyRequester(pm: { id: string; reference: string; title: string; requesterId: string | null }, title: string) {
  if (!pm.requesterId) return;
  await notifyUser({ userId: pm.requesterId, type: "GENERIC", title, body: `${pm.reference} — ${pm.title}`, link: `${PATH}/${pm.id}` });
}
async function notifyGroup(roles: ("FINANCE_BUDGET_MANAGER" | "MEDICAL_INFO_PHARMACIST" | "DIRECTION" | "SUPER_ADMIN")[], pm: { id: string; reference: string; title: string }, title: string) {
  await notifyRoles(roles, { type: "VALIDATION_REQUIRED", title, body: `${pm.reference} — ${pm.title}`, link: `${PATH}/${pm.id}` });
}

async function audit(user: SessionUser, id: string, action: "CREATE" | "UPDATE" | "VALIDATE" | "DELETE", summary: string) {
  await recordAudit({ actorId: user.id, action, module: "Matériel promotionnel", entityType: "PROMO_MATERIAL", entityId: id, summary });
}

async function load(id: string) {
  return prisma.promoMaterial.findUnique({ where: { id } });
}

// ───────────────────────── 1. Marketing : création (prospection) ─────────────────────────

/** Marketing demande la prospection d'agences ; l'assistante la reçoit. */
export async function createPromoMaterial(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!userCan(user, "PROMO_MATERIAL", "CREATE")) return { ok: false, error: "Création réservée au Marketing." };
    const title = fdStr(formData, "title");
    if (!title) return { ok: false, error: "Le titre / la campagne est obligatoire." };

    const assistantId = fdStr(formData, "assistantId");
    const description = fdStr(formData, "description");
    const amount = fdNum(formData, "amount");
    const materialType = fdStr(formData, "materialType");
    const companyId = fdStr(formData, "companyId");

    // Demande administrative liée : l'assistante de direction pilote ses étapes
    // (devis, BC, transmission, facture) depuis « Demandes administratives ».
    // Références dérivées du max existant + réessai en cas de collision concurrente.
    // Les deux créations sont atomiques (transaction) : en cas de collision sur la
    // 2ᵉ, la 1ʳᵉ est annulée — pas de demande administrative orpheline au réessai.
    const pm = await createWithRetry(() =>
      prisma.$transaction(async (tx) => {
        const req = await tx.administrativeRequest.create({
          data: {
            reference: await nextRequestRef(),
            title: `Matériel promotionnel — ${title}`,
            type: "QUOTE",
            status: "NEW",
            description: description ?? "Demande de prospection d'agences (matériel promotionnel).",
            requesterId: user.id,
            assignedToId: assistantId,
          },
        });
        return tx.promoMaterial.create({
          data: {
            reference: await nextPromoRef(),
            title,
            description,
            materialType: materialType ? (materialType as MaterialType) : null,
            companyId: companyId || null,
            amount: amount ?? null,
            assistantId,
            status: "PROSPECTION_REQUESTED",
            requesterId: user.id,
            adminRequestId: req.id,
            createdById: user.id,
            updatedById: user.id,
          },
        });
      }),
    );

    await notifyAssistant(pm, "Matériel promotionnel — prospection d'agences demandée");
    await audit(user, pm.id, "CREATE", `Matériel promotionnel créé — ${pm.reference}`);
    revalidate(pm.id);
    revalidatePath("/demandes");
    return { ok: true, id: pm.id };
  } catch (err) {
    console.error("[promo] createPromoMaterial failed", err);
    return { ok: false, error: "La demande n'a pas pu être créée. Réessayez dans un instant." };
  }
}

// ───────────────────────── 2. Assistante : devis déposés ─────────────────────────

export async function submitQuotes(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!isAssistant(user)) return { ok: false, error: "Réservé à l'assistante de direction." };
  if (pm.status !== "PROSPECTION_REQUESTED") return { ok: false, error: "Étape déjà passée." };

  await prisma.promoMaterial.update({ where: { id }, data: { status: "QUOTES_UPLOADED", updatedById: user.id } });
  await notifyRequester(pm, "Matériel promotionnel — devis disponibles, à arbitrer");
  await audit(user, id, "UPDATE", "Devis déposés (assistante)");
  revalidate(id);
  return { ok: true };
}

// ───────────────────────── 3. Marketing : choix de l'agence + demande de BC ─────────────────────────

export async function chooseAgency(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!isMarketing(user, pm)) return { ok: false, error: "Réservé au Marketing (demandeur)." };
  if (pm.status !== "QUOTES_UPLOADED") return { ok: false, error: "Les devis doivent d'abord être déposés." };
  const agency = fdStr(formData, "chosenAgency");
  if (!agency) return { ok: false, error: "Indiquez l'agence retenue." };

  await prisma.promoMaterial.update({
    where: { id },
    data: { status: "AGENCY_CHOSEN", chosenAgency: agency, chosenAmount: fdNum(formData, "chosenAmount") ?? null, updatedById: user.id },
  });
  const note = fdStr(formData, "comment");
  if (note) await prisma.comment.create({ data: { entityType: "PROMO_MATERIAL", entityId: id, body: `Agence retenue : ${agency}. ${note}`, authorId: user.id } });
  await notifyAssistant(pm, "Matériel promotionnel — création du bon de commande demandée");
  await audit(user, id, "UPDATE", `Agence retenue : ${agency} — création du BC demandée`);
  revalidate(id);
  return { ok: true };
}

// ───────────────────────── 4. Assistante : BC → validation finances ─────────────────────────

export async function submitBcForFinance(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!isAssistant(user)) return { ok: false, error: "Réservé à l'assistante de direction." };
  if (pm.status !== "AGENCY_CHOSEN") return { ok: false, error: "Étape déjà passée." };

  await prisma.promoMaterial.update({
    where: { id },
    data: { status: "BC_FINANCE_REVIEW", bcReference: fdStr(formData, "bcReference"), financeReminderAt: null, updatedById: user.id },
  });
  await notifyGroup(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], pm, "Matériel promotionnel — bon de commande à valider");
  await audit(user, id, "UPDATE", "Bon de commande transmis aux finances");
  revalidate(id);
  return { ok: true };
}

/** Relance des finances (système d'alerte). */
export async function remindFinance(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!(isAssistant(user) || isMarketing(user, pm))) return { ok: false, error: "Non autorisé." };
  if (pm.status !== "BC_FINANCE_REVIEW") return { ok: false, error: "Aucune validation finances en attente." };

  await prisma.promoMaterial.update({ where: { id }, data: { financeReminderAt: new Date(), financeReminderCount: { increment: 1 } } });
  await notifyGroup(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], pm, "⏰ Relance — bon de commande à valider (matériel promotionnel)");
  await audit(user, id, "UPDATE", "Relance des finances");
  revalidate(id);
  return { ok: true };
}

// ───────────────────────── 5. Finances : validation du BC ─────────────────────────

export async function validateBc(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!isFinance(user)) return { ok: false, error: "Réservé aux finances." };
  if (pm.status !== "BC_FINANCE_REVIEW") return { ok: false, error: "Aucun bon de commande à valider." };

  await prisma.promoMaterial.update({ where: { id }, data: { status: "BC_VALIDATED", bcValidatedAt: new Date(), updatedById: user.id } });
  await notifyAssistant(pm, "Matériel promotionnel — bon de commande validé par les finances");
  await audit(user, id, "VALIDATE", "Bon de commande validé/signé (finances)");
  revalidate(id);
  return { ok: true };
}

// ───────────────────────── 6. Assistante : BC validé → envoyé à l'agence ─────────────────────────

export async function confirmBcSent(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!isAssistant(user)) return { ok: false, error: "Réservé à l'assistante de direction." };
  if (pm.status !== "BC_VALIDATED") return { ok: false, error: "Le bon de commande doit d'abord être validé par les finances." };

  await prisma.promoMaterial.update({ where: { id }, data: { status: "BC_SENT", updatedById: user.id } });
  await notifyGroup(["MEDICAL_INFO_PHARMACIST", "SUPER_ADMIN"], pm, "Matériel promotionnel — initier le bordereau de paiement");
  await notifyRequester(pm, "Matériel promotionnel — bon de commande transmis à l'agence");
  await audit(user, id, "UPDATE", "Bon de commande validé et transmis à l'agence");
  revalidate(id);
  return { ok: true };
}

// ───────────────────────── 7. Information médicale : bordereau de paiement ─────────────────────────

export async function initiatePayment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!isMedicalInfo(user)) return { ok: false, error: "Réservé à l'information médicale." };
  if (pm.status !== "BC_SENT") return { ok: false, error: "Le bon de commande doit d'abord être transmis à l'agence." };

  const amount = Number(pm.chosenAmount ?? pm.amount ?? 0);
  const order = amount > 0
    ? await createExpenseOrder({
        label: `Matériel promotionnel — ${pm.title}${pm.chosenAgency ? ` (${pm.chosenAgency})` : ""}`,
        amount, category: "FOURNISSEUR", beneficiary: pm.chosenAgency, sourceType: "PROMO_MATERIAL", sourceId: pm.id, requestedById: user.id,
      })
    : null;

  await prisma.promoMaterial.update({
    where: { id },
    data: { status: "PAYMENT_INITIATED", paymentInitiatedAt: new Date(), paymentOrderId: order?.id ?? null, updatedById: user.id },
  });
  await notifyGroup(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], pm, "Matériel promotionnel — bordereau de paiement à régler");
  await audit(user, id, "UPDATE", `Bordereau de paiement initié${order ? ` (ordre ${order.reference})` : ""}`);
  revalidate(id);
  return { ok: true };
}

// ───────────────────────── 8. Finances : paiement effectué ─────────────────────────

export async function confirmPayment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!isFinance(user)) return { ok: false, error: "Réservé aux finances." };
  if (pm.status !== "PAYMENT_INITIATED") return { ok: false, error: "Aucun bordereau de paiement en attente." };

  await prisma.promoMaterial.update({ where: { id }, data: { status: "PAYMENT_DONE", paymentDoneAt: new Date(), updatedById: user.id } });
  const note = fdStr(formData, "comment");
  if (note) await prisma.comment.create({ data: { entityType: "PROMO_MATERIAL", entityId: id, body: `Paiement effectué. ${note}`, authorId: user.id } });
  await notifyGroup(["MEDICAL_INFO_PHARMACIST", "SUPER_ADMIN"], pm, "Matériel promotionnel — paiement effectué (déposer la quittance)");
  await audit(user, id, "VALIDATE", "Paiement effectué (finances)");
  revalidate(id);
  return { ok: true };
}

// ───────────────────────── 9. Marketing : matériel réalisé par l'agence ─────────────────────────

export async function submitMaterial(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!isMarketing(user, pm)) return { ok: false, error: "Réservé au Marketing." };
  if (pm.status !== "PAYMENT_DONE") return { ok: false, error: "Le paiement doit d'abord être effectué." };

  await prisma.promoMaterial.update({ where: { id }, data: { status: "MATERIAL_PRODUCED", updatedById: user.id } });
  await notifyGroup(["DIRECTION", "SUPER_ADMIN"], pm, "Matériel promotionnel — matériel réalisé à valider");
  await audit(user, id, "UPDATE", "Matériel réalisé par l'agence, déposé par le Marketing");
  revalidate(id);
  return { ok: true };
}

// ───────────────────────── 10. Direction → 11. Information médicale (conformité) ─────────────────────────

export async function directionReview(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!isDirection(user)) return { ok: false, error: "Réservé à la Direction." };
  if (pm.status !== "MATERIAL_PRODUCED") return { ok: false, error: "Aucun matériel à examiner." };

  await prisma.promoMaterial.update({ where: { id }, data: { status: "CONFORMITY_REVIEW", updatedById: user.id } });
  const note = fdStr(formData, "comment");
  if (note) await prisma.comment.create({ data: { entityType: "PROMO_MATERIAL", entityId: id, body: `Direction : ${note}`, authorId: user.id } });
  await notifyGroup(["MEDICAL_INFO_PHARMACIST", "SUPER_ADMIN"], pm, "Matériel promotionnel — vérification de conformité / dépôt");
  await audit(user, id, "VALIDATE", "Matériel examiné par la Direction");
  revalidate(id);
  return { ok: true };
}

/** Information médicale : conformité OK + dépôt → référence & visa publicitaire. */
export async function confirmConformity(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!isMedicalInfo(user)) return { ok: false, error: "Réservé à l'information médicale." };
  if (pm.status !== "CONFORMITY_REVIEW") return { ok: false, error: "Aucune vérification en attente." };

  await prisma.promoMaterial.update({
    where: { id },
    data: { status: "VISA_OBTAINED", visaReference: fdStr(formData, "visaReference"), authorityRef: fdStr(formData, "authorityRef"), updatedById: user.id },
  });
  await notifyRequester(pm, "Matériel promotionnel — visa publicitaire obtenu, BAT/impression à lancer");
  await audit(user, id, "VALIDATE", "Conformité validée — visa publicitaire obtenu");
  revalidate(id);
  return { ok: true };
}

// ───────────────────────── 12. Marketing : BAT / impression → matériel final ─────────────────────────

export async function startBat(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!isMarketing(user, pm)) return { ok: false, error: "Réservé au Marketing." };
  if (pm.status !== "VISA_OBTAINED") return { ok: false, error: "Le visa publicitaire doit d'abord être obtenu." };

  await prisma.promoMaterial.update({ where: { id }, data: { status: "BAT_PRINTING", updatedById: user.id } });
  await audit(user, id, "UPDATE", "BAT / impression lancés");
  revalidate(id);
  return { ok: true };
}

export async function submitFinalMaterial(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!isMarketing(user, pm)) return { ok: false, error: "Réservé au Marketing." };
  if (pm.status !== "BAT_PRINTING") return { ok: false, error: "Lancez d'abord le BAT / l'impression." };

  await prisma.promoMaterial.update({ where: { id }, data: { status: "FINAL_MATERIAL", updatedById: user.id } });
  await notifyAssistant(pm, "Matériel promotionnel — matériel final livré (facture agence attendue)");
  await audit(user, id, "UPDATE", "Matériel final déposé par le Marketing");
  revalidate(id);
  return { ok: true };
}

// ───────────────────────── 13. Facture agence → 14. règlement finances ─────────────────────────

export async function recordInvoice(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!(isAssistant(user) || isMarketing(user, pm))) return { ok: false, error: "Non autorisé." };
  if (pm.status !== "FINAL_MATERIAL") return { ok: false, error: "Le matériel final doit d'abord être déposé." };

  await prisma.promoMaterial.update({ where: { id }, data: { status: "INVOICED", updatedById: user.id } });
  await notifyGroup(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], pm, "Matériel promotionnel — facture finale à régler");
  await audit(user, id, "UPDATE", "Facture finale + bon de livraison enregistrés (agence)");
  revalidate(id);
  return { ok: true };
}

export async function settle(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!isFinance(user)) return { ok: false, error: "Réservé aux finances." };
  if (pm.status !== "INVOICED") return { ok: false, error: "Aucune facture à régler." };

  const amount = fdNum(formData, "amount") ?? Number(pm.chosenAmount ?? pm.amount ?? 0);
  const order = amount > 0
    ? await createExpenseOrder({
        label: `Règlement matériel promotionnel — ${pm.title}${pm.chosenAgency ? ` (${pm.chosenAgency})` : ""}`,
        amount, category: "FOURNISSEUR", beneficiary: pm.chosenAgency, sourceType: "PROMO_MATERIAL", sourceId: pm.id, requestedById: user.id,
      })
    : null;

  await prisma.promoMaterial.update({ where: { id }, data: { status: "SETTLED", settlementOrderId: order?.id ?? null, updatedById: user.id } });
  if (pm.adminRequestId) await prisma.administrativeRequest.update({ where: { id: pm.adminRequestId }, data: { status: "DONE" } }).catch(() => {});
  await notifyRequester(pm, "Matériel promotionnel — dossier réglé et clôturé");
  await audit(user, id, "VALIDATE", `Règlement final${order ? ` (ordre ${order.reference})` : ""}`);
  revalidate(id);
  return { ok: true };
}

// ───────────────────────── Divers : commentaire, annulation ─────────────────────────

export async function addPromoComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "promoId");
  const body = fdStr(formData, "body");
  if (!id || !body) return { ok: false, error: "Commentaire vide." };
  if (!userCan(user, "PROMO_MATERIAL", "VIEW")) return { ok: false, error: "Action non autorisée." };
  await prisma.comment.create({ data: { entityType: "PROMO_MATERIAL", entityId: id, body, authorId: user.id } });
  revalidate(id);
  return { ok: true };
}

export async function cancelPromoMaterial(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const pm = await load(id);
  if (!pm) return { ok: false, error: "Dossier introuvable." };
  if (!(isMarketing(user, pm) || isAssistant(user) || isDirection(user))) return { ok: false, error: "Non autorisé." };
  if (pm.status === "SETTLED" || pm.status === "CANCELLED") return { ok: false, error: "Dossier déjà clôturé." };

  await prisma.promoMaterial.update({ where: { id }, data: { status: "CANCELLED", updatedById: user.id } });
  if (pm.adminRequestId) await prisma.administrativeRequest.update({ where: { id: pm.adminRequestId }, data: { status: "CANCELLED" } }).catch(() => {});
  await audit(user, id, "UPDATE", "Dossier annulé");
  revalidate(id);
  return { ok: true };
}
