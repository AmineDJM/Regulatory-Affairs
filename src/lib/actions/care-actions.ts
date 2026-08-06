"use server";

import { revalidatePath } from "next/cache";
import type { CareCellKind, CareCellStatus, CareOpinion, CareServiceKind } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { createExpenseOrder } from "@/lib/expense-orders";
import {
  beneficiaryName, careProgress, defaultCells, financeReadiness, quoteConflicts,
  OPINION_LABELS, SERVICE_KIND_LABELS,
} from "@/lib/care";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

/**
 * PRISE EN CHARGE — actions serveur (nationale et internationale).
 *
 * Ce que ce fichier tient, et qui n'existait pas :
 *   • une **décision par personne** — sur une même demande, l'une est accordée et l'autre
 *     écartée, sans qu'on ait à refuser l'ensemble ;
 *   • une **liste de besoins propre à chaque personne** — l'une a besoin d'un visa et pas
 *     l'autre ;
 *   • des **devis qui couvrent ce qu'ils couvrent réellement** : une agence chiffre le groupe,
 *     on ne lui demande pas de découper en dix lignes.
 *
 * ⚠️ Le garde-fou central : **une case déjà couverte par un devis accepté ne peut pas être
 * couverte par un second**. C'est la seule façon de ne pas payer deux fois le même hôtel — et
 * personne ne s'en apercevrait avant la facture.
 */

type Scope = "NATIONAL" | "INTERNATIONAL";

const SPEC: Record<Scope, { module: "CONGRESS_NATIONAL" | "CONGRESS_INTERNATIONAL"; path: string }> = {
  NATIONAL: { module: "CONGRESS_NATIONAL", path: "/congress-national" },
  INTERNATIONAL: { module: "CONGRESS_INTERNATIONAL", path: "/congress-international" },
};

const isScope = (v: string): v is Scope => v === "NATIONAL" || v === "INTERNATIONAL";

/** Statuts à partir desquels la Direction a tranché la demande dans son ensemble. */
const DECIDED = ["APPROVED", "COMPLETED"];

function revalidate(scope: Scope, id: string) {
  revalidatePath(SPEC[scope].path);
  revalidatePath(`${SPEC[scope].path}/${id}`);
}

/** Décrire les personnes et leurs besoins : ouvert aux acteurs de la demande. */
function canEdit(user: SessionUser, scope: Scope): boolean {
  const m = SPEC[scope].module;
  return userCan(user, m, "CREATE") || userCan(user, m, "UPDATE") || hasGlobalView(user);
}
/** Trancher (accorder une personne, accepter un devis) : Direction. */
function canDecide(user: SessionUser, scope: Scope): boolean {
  return hasGlobalView(user) || userCan(user, SPEC[scope].module, "VALIDATE");
}

async function audit(user: SessionUser, scope: Scope, id: string, action: "CREATE" | "UPDATE" | "DELETE", detail: string) {
  await recordAudit({
    actorId: user.id, module: SPEC[scope].module, entityType: SPEC[scope].module, entityId: id, action, summary: detail,
  }).catch(() => undefined);
}

/** Charge la demande, quel que soit son périmètre. */
async function loadRequest(scope: Scope, id: string) {
  if (scope === "NATIONAL") {
    const r = await prisma.congressNational.findUnique({
      where: { id }, select: { id: true, name: true, requestStatus: true, requesterId: true, finalAmount: true },
    });
    return r;
  }
  return prisma.congressInternational.findUnique({
    where: { id }, select: { id: true, name: true, requestStatus: true, requesterId: true, finalAmount: true },
  });
}

/** Le lien parent d'une personne / d'un devis, selon le périmètre. */
const parentWhere = (scope: Scope, id: string) =>
  scope === "NATIONAL" ? { congressNationalId: id } : { congressInternationalId: id };

/** Retrouve le périmètre et la demande depuis une personne. */
async function scopeOfBeneficiary(beneficiaryId: string) {
  const b = await prisma.careBeneficiary.findUnique({
    where: { id: beneficiaryId },
    select: { id: true, congressNationalId: true, congressInternationalId: true, status: true, doctorId: true, firstName: true, lastName: true },
  });
  if (!b) return null;
  const scope: Scope = b.congressNationalId ? "NATIONAL" : "INTERNATIONAL";
  const requestId = b.congressNationalId ?? b.congressInternationalId;
  return requestId ? { beneficiary: b, scope, requestId } : null;
}

/** Nom affichable d'une personne — résout l'annuaire si besoin. */
async function nameOf(b: { doctorId: string | null; firstName: string | null; lastName: string | null }): Promise<string> {
  let doctorName: string | null = null;
  if (b.doctorId) {
    doctorName = (await prisma.medicalDoctor.findUnique({ where: { id: b.doctorId }, select: { name: true } }))?.name ?? null;
  }
  return beneficiaryName({ ...b, doctorName });
}

// ───────────────────────────── Les personnes ─────────────────────────────

/**
 * Ajoute une personne à prendre en charge — depuis l'annuaire OU en profil libre.
 *
 * Le profil libre existe parce qu'on ne crée pas une fiche médecin permanente pour un
 * intervenant vu une seule fois. Il exige au minimum un nom : une ligne sans nom serait
 * introuvable dans le tableau.
 */
export async function addCareBeneficiary(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const scopeRaw = fdStr(formData, "scope") ?? "";
  if (!isScope(scopeRaw)) return { ok: false, error: "Périmètre inconnu." };
  if (!canEdit(user, scopeRaw)) return { ok: false, error: "Non autorisé." };

  const requestId = fdStr(formData, "requestId");
  if (!requestId) return { ok: false, error: "Demande non précisée." };
  const req = await loadRequest(scopeRaw, requestId);
  if (!req) return { ok: false, error: "Demande introuvable." };

  const doctorId = fdStr(formData, "doctorId");
  const lastName = fdStr(formData, "lastName");
  if (!doctorId && !lastName) return { ok: false, error: "Choisissez une personne dans l'annuaire, ou saisissez au moins son nom." };
  if (doctorId) {
    const ok = await prisma.medicalDoctor.count({ where: { id: doctorId } });
    if (!ok) return { ok: false, error: "Personne introuvable dans l'annuaire." };
  }

  try {
    const last = await prisma.careBeneficiary.findFirst({
      where: parentWhere(scopeRaw, requestId), orderBy: { position: "desc" }, select: { position: true },
    });
    const created = await prisma.careBeneficiary.create({
      data: {
        ...parentWhere(scopeRaw, requestId),
        doctorId: doctorId ?? null,
        firstName: doctorId ? null : fdStr(formData, "firstName"),
        lastName: doctorId ? null : lastName,
        jobTitle: fdStr(formData, "jobTitle"),
        institution: fdStr(formData, "institution"),
        position: (last?.position ?? 0) + 1,
        createdById: user.id,
        updatedById: user.id,
      },
      select: { id: true, doctorId: true, firstName: true, lastName: true },
    });

    await audit(user, scopeRaw, requestId, "CREATE", `Personne ajoutée à la prise en charge : ${await nameOf(created)}.`);
    revalidate(scopeRaw, requestId);
    return { ok: true, id: created.id };
  } catch (err) {
    console.error("[care] ajout de personne impossible", err);
    return { ok: false, error: "La personne n'a pas pu être ajoutée." };
  }
}

/** L'avis du demandeur SUR CETTE PERSONNE. « Pas d'avis » est une réponse valable. */
export async function setCareOpinion(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Personne non précisée." };
  const found = await scopeOfBeneficiary(id);
  if (!found) return { ok: false, error: "Personne introuvable." };
  if (!canEdit(user, found.scope)) return { ok: false, error: "Non autorisé." };

  const opinion = (fdStr(formData, "opinion") ?? "NONE") as CareOpinion;
  if (!(opinion in OPINION_LABELS)) return { ok: false, error: "Avis inconnu." };

  await prisma.careBeneficiary.update({
    where: { id },
    data: { requesterOpinion: opinion, requesterNote: fdStr(formData, "note"), updatedById: user.id },
  });
  await audit(user, found.scope, found.requestId, "UPDATE",
    `Avis « ${OPINION_LABELS[opinion]} » porté sur ${await nameOf(found.beneficiary)}.`);
  revalidate(found.scope, found.requestId);
  return { ok: true, id };
}

/**
 * La décision de la Direction, PERSONNE PAR PERSONNE.
 *
 * Accorder une personne crée d'office sa pièce d'identité à fournir : c'est le point de départ
 * du dossier, et l'oublier revient à découvrir le manque à l'aéroport. Le reste (hôtel, billet,
 * visa) s'ajoute au cas par cas — pré-remplir dix cases qu'il faudra effacer coûte plus cher.
 */
export async function decideCareBeneficiary(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision");
  if (!id || (decision !== "APPROVED" && decision !== "REJECTED")) return { ok: false, error: "Décision non précisée." };

  const found = await scopeOfBeneficiary(id);
  if (!found) return { ok: false, error: "Personne introuvable." };
  if (!canDecide(user, found.scope)) return { ok: false, error: "Seule la Direction tranche." };

  const name = await nameOf(found.beneficiary);
  try {
    await prisma.careBeneficiary.update({
      where: { id },
      data: {
        status: decision, decidedById: user.id, decidedAt: new Date(),
        decisionNote: fdStr(formData, "note"), updatedById: user.id,
      },
    });

    if (decision === "APPROVED") {
      // Idempotent : re-accorder une personne ne recrée pas sa pièce d'identité en double.
      const existing = await prisma.careCell.count({ where: { beneficiaryId: id } });
      if (existing === 0) {
        await prisma.careCell.createMany({
          data: defaultCells(found.scope === "NATIONAL" ? "NATIONAL" : "INTERNATIONAL").map((c, i) => ({
            beneficiaryId: id, kind: c.kind, serviceKind: c.serviceKind, label: c.label,
            requestedById: user.id, position: i + 1,
          })),
        });
      }
    }

    await audit(user, found.scope, found.requestId, "UPDATE",
      `${name} : ${decision === "APPROVED" ? "prise en charge ACCORDÉE" : "prise en charge ÉCARTÉE"}${fdStr(formData, "note") ? ` — ${fdStr(formData, "note")}` : ""}.`);
    revalidate(found.scope, found.requestId);
    return { ok: true, id };
  } catch (err) {
    console.error("[care] décision impossible", err);
    return { ok: false, error: "La décision n'a pas pu être enregistrée." };
  }
}

export async function removeCareBeneficiary(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Personne non précisée." };
  const found = await scopeOfBeneficiary(id);
  if (!found) return { ok: false, error: "Personne introuvable." };
  if (!canEdit(user, found.scope)) return { ok: false, error: "Non autorisé." };

  // Une personne dont une prestation est déjà engagée ne se retire pas : la dépense, elle,
  // resterait. On l'écarte (décision tracée) plutôt que de l'effacer.
  const engaged = await prisma.careCell.count({ where: { beneficiaryId: id, expenseOrderId: { not: null } } });
  if (engaged > 0) {
    return { ok: false, error: "Une dépense a déjà été engagée pour cette personne : écartez-la plutôt que de la retirer." };
  }

  const name = await nameOf(found.beneficiary);
  await prisma.careBeneficiary.delete({ where: { id } });
  await audit(user, found.scope, found.requestId, "DELETE", `${name} retirée de la prise en charge.`);
  revalidate(found.scope, found.requestId);
  return { ok: true };
}

// ───────────────────────────── Les cases ─────────────────────────────

/**
 * Ajoute une case sur la ligne d'UNE personne — une pièce à fournir ou un élément à acheter.
 *
 * Ajoutable par tous ceux qui ont accès à la demande : le chef de produit découvre souvent
 * après coup qu'il faut un visa ou une nuit d'hôtel supplémentaire.
 */
export async function addCareCell(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const beneficiaryId = fdStr(formData, "beneficiaryId");
  const label = fdStr(formData, "label");
  if (!beneficiaryId || !label) return { ok: false, error: "Le libellé est obligatoire." };

  const found = await scopeOfBeneficiary(beneficiaryId);
  if (!found) return { ok: false, error: "Personne introuvable." };
  if (!canEdit(user, found.scope)) return { ok: false, error: "Non autorisé." };

  const kind = (fdStr(formData, "kind") ?? "DOCUMENT") as CareCellKind;
  if (kind !== "DOCUMENT" && kind !== "SERVICE") return { ok: false, error: "Nature inconnue." };
  const serviceKind = kind === "SERVICE" ? ((fdStr(formData, "serviceKind") ?? "OTHER") as CareServiceKind) : null;
  if (serviceKind && !(serviceKind in SERVICE_KIND_LABELS)) return { ok: false, error: "Nature de prestation inconnue." };

  try {
    const last = await prisma.careCell.findFirst({ where: { beneficiaryId }, orderBy: { position: "desc" }, select: { position: true } });
    const created = await prisma.careCell.create({
      data: {
        beneficiaryId, kind, serviceKind, label,
        notes: fdStr(formData, "notes"),
        requestedById: user.id,
        position: (last?.position ?? 0) + 1,
      },
      select: { id: true },
    });
    await audit(user, found.scope, found.requestId, "CREATE",
      `${await nameOf(found.beneficiary)} — élément demandé : ${label}${serviceKind ? ` (${SERVICE_KIND_LABELS[serviceKind]})` : ""}.`);
    revalidate(found.scope, found.requestId);
    return { ok: true, id: created.id };
  } catch (err) {
    console.error("[care] ajout de case impossible", err);
    return { ok: false, error: "L'élément n'a pas pu être ajouté." };
  }
}

/**
 * Fait avancer une case : reçue, validée, ou sans objet.
 *
 * « Sans objet » n'est pas une suppression : on garde la trace qu'on a bien regardé le visa et
 * qu'il n'en fallait pas. Une case supprimée laisserait croire qu'on n'y a jamais pensé.
 */
export async function setCareCellStatus(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const status = fdStr(formData, "status") as CareCellStatus | null;
  if (!id || !status || !["REQUESTED", "PROVIDED", "SETTLED", "WAIVED"].includes(status)) {
    return { ok: false, error: "État non précisé." };
  }

  const cell = await prisma.careCell.findUnique({ where: { id }, select: { id: true, label: true, beneficiaryId: true, expenseOrderId: true } });
  if (!cell) return { ok: false, error: "Élément introuvable." };
  const found = await scopeOfBeneficiary(cell.beneficiaryId);
  if (!found) return { ok: false, error: "Personne introuvable." };
  if (!canEdit(user, found.scope)) return { ok: false, error: "Non autorisé." };
  // Une prestation payée ne redevient pas « sans objet » : la dépense, elle, a bien eu lieu.
  if (status === "WAIVED" && cell.expenseOrderId) {
    return { ok: false, error: "Une dépense a été engagée sur cet élément : il ne peut plus être déclaré sans objet." };
  }

  await prisma.careCell.update({ where: { id }, data: { status } });
  await audit(user, found.scope, found.requestId, "UPDATE", `${await nameOf(found.beneficiary)} — « ${cell.label} » : ${status}.`);
  revalidate(found.scope, found.requestId);
  return { ok: true, id };
}

export async function removeCareCell(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Élément non précisé." };
  const cell = await prisma.careCell.findUnique({ where: { id }, select: { id: true, label: true, beneficiaryId: true, expenseOrderId: true } });
  if (!cell) return { ok: false, error: "Élément introuvable." };
  const found = await scopeOfBeneficiary(cell.beneficiaryId);
  if (!found) return { ok: false, error: "Personne introuvable." };
  if (!canEdit(user, found.scope)) return { ok: false, error: "Non autorisé." };
  if (cell.expenseOrderId) return { ok: false, error: "Une dépense a été engagée sur cet élément : il ne peut plus être retiré." };

  await prisma.careCell.delete({ where: { id } });
  await audit(user, found.scope, found.requestId, "DELETE", `${await nameOf(found.beneficiary)} — élément « ${cell.label} » retiré.`);
  revalidate(found.scope, found.requestId);
  return { ok: true };
}

// ───────────────────────────── Les devis ─────────────────────────────

/**
 * Enregistre un devis reçu par le secrétariat, en désignant **ce qu'il couvre**.
 *
 * Un devis couvre ce qu'il couvre réellement : une agence de voyage chiffre le groupe entier,
 * on ne lui demande pas de découper en dix lignes. D'où le rattachement à N cases.
 */
export async function createCareQuote(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const scopeRaw = fdStr(formData, "scope") ?? "";
  if (!isScope(scopeRaw)) return { ok: false, error: "Périmètre inconnu." };
  if (!canEdit(user, scopeRaw)) return { ok: false, error: "Non autorisé." };

  const requestId = fdStr(formData, "requestId");
  const supplier = fdStr(formData, "supplier");
  const amount = fdNum(formData, "amountDzd");
  if (!requestId || !supplier) return { ok: false, error: "Le fournisseur est obligatoire." };
  if (amount == null || amount <= 0) return { ok: false, error: "Le montant du devis est obligatoire." };

  const cellIds = formData.getAll("cellIds").map(String).filter(Boolean);
  if (cellIds.length === 0) return { ok: false, error: "Précisez ce que ce devis couvre." };

  // Les cases doivent appartenir à CETTE demande : sans quoi un devis pourrait engager une
  // dépense sur une autre prise en charge.
  const valid = await prisma.careCell.count({
    where: { id: { in: cellIds }, beneficiary: parentWhere(scopeRaw, requestId) },
  });
  if (valid !== cellIds.length) return { ok: false, error: "Certains éléments n'appartiennent pas à cette demande." };

  try {
    const quote = await prisma.careQuote.create({
      data: {
        ...parentWhere(scopeRaw, requestId),
        supplier,
        reference: fdStr(formData, "reference"),
        amountDzd: amount,
        note: fdStr(formData, "note"),
        createdById: user.id,
        cells: { create: cellIds.map((cellId) => ({ cellId })) },
      },
      select: { id: true },
    });
    // Les cases couvertes passent à « reçu » : on a une offre, elle n'est pas encore validée.
    await prisma.careCell.updateMany({ where: { id: { in: cellIds }, status: "REQUESTED" }, data: { status: "PROVIDED" } });

    await audit(user, scopeRaw, requestId, "CREATE",
      `Devis ${supplier} — ${amount.toLocaleString("fr-FR")} DZD, couvrant ${cellIds.length} élément(s).`);
    revalidate(scopeRaw, requestId);
    return { ok: true, id: quote.id };
  } catch (err) {
    console.error("[care] enregistrement du devis impossible", err);
    return { ok: false, error: "Le devis n'a pas pu être enregistré." };
  }
}

/**
 * Accepte ou refuse un devis — **d'un bloc**. Accepter la moitié d'un devis n'a pas de sens
 * commercial : le fournisseur a chiffré un ensemble.
 *
 * ⚠️ Le garde-fou : une case déjà couverte par un devis accepté ne peut pas l'être une seconde
 * fois. C'est ce qui empêche de payer deux fois le même hôtel.
 */
export async function decideCareQuote(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision");
  if (!id || (decision !== "ACCEPTED" && decision !== "REJECTED")) return { ok: false, error: "Décision non précisée." };

  const quote = await prisma.careQuote.findUnique({
    where: { id },
    select: {
      id: true, supplier: true, amountDzd: true, status: true, expenseOrderId: true,
      congressNationalId: true, congressInternationalId: true,
      cells: { select: { cellId: true } },
    },
  });
  if (!quote) return { ok: false, error: "Devis introuvable." };
  const scope: Scope = quote.congressNationalId ? "NATIONAL" : "INTERNATIONAL";
  const requestId = quote.congressNationalId ?? quote.congressInternationalId;
  if (!requestId) return { ok: false, error: "Devis orphelin." };
  if (!canDecide(user, scope)) return { ok: false, error: "Seule la Direction tranche un devis." };
  if (quote.expenseOrderId) return { ok: false, error: "Ce devis a déjà été engagé : sa décision ne peut plus changer." };

  const cellIds = quote.cells.map((c) => c.cellId);

  if (decision === "ACCEPTED") {
    const others = await prisma.careQuote.findMany({
      where: { ...parentWhere(scope, requestId), id: { not: id } },
      select: { id: true, status: true, amountDzd: true, cells: { select: { cellId: true } } },
    });
    const conflicts = quoteConflicts(
      { id, status: "PENDING", amountDzd: toNumber(quote.amountDzd), cellIds },
      others.map((o) => ({ id: o.id, status: o.status, amountDzd: toNumber(o.amountDzd), cellIds: o.cells.map((c) => c.cellId) })),
    );
    if (conflicts.length > 0) {
      const labels = await prisma.careCell.findMany({ where: { id: { in: conflicts.map((c) => c.cellId) } }, select: { label: true } });
      return {
        ok: false,
        error: `Déjà couvert par un devis accepté : ${labels.map((l) => l.label).join(", ")}. Refusez d'abord l'autre devis.`,
      };
    }
  }

  const req = await loadRequest(scope, requestId);
  try {
    if (decision === "ACCEPTED") {
      const amount = toNumber(quote.amountDzd);
      const order = await createExpenseOrder({
        label: `${req?.name ?? "Prise en charge"} — devis ${quote.supplier}`,
        amount,
        category: "EVENEMENT",
        beneficiary: quote.supplier,
        sourceType: SPEC[scope].module,
        sourceId: requestId,
        requestedById: user.id,
        notes: `Devis couvrant ${cellIds.length} élément(s) de la prise en charge.`,
      });
      await prisma.$transaction([
        prisma.careQuote.update({
          where: { id },
          data: { status: "ACCEPTED", decidedById: user.id, decidedAt: new Date(), expenseOrderId: order.id },
        }),
        // Les cases couvertes deviennent réglées et portent leur part de la dépense.
        prisma.careCell.updateMany({
          where: { id: { in: cellIds } },
          data: { status: "SETTLED", quoteId: id, expenseOrderId: order.id },
        }),
      ]);
      await audit(user, scope, requestId, "UPDATE",
        `Devis ${quote.supplier} ACCEPTÉ (${amount.toLocaleString("fr-FR")} DZD) — ordre de dépense ${order.reference}.`);
    } else {
      await prisma.$transaction([
        prisma.careQuote.update({ where: { id }, data: { status: "REJECTED", decidedById: user.id, decidedAt: new Date(), note: fdStr(formData, "note") } }),
        // Les cases redeviennent « demandées » : il faut un autre devis.
        prisma.careCell.updateMany({ where: { id: { in: cellIds }, status: "PROVIDED" }, data: { status: "REQUESTED" } }),
      ]);
      await audit(user, scope, requestId, "UPDATE", `Devis ${quote.supplier} REFUSÉ — les éléments couverts repassent en attente.`);
    }

    revalidate(scope, requestId);
    revalidatePath("/finances/ordres-de-depense");
    return { ok: true, id };
  } catch (err) {
    console.error("[care] décision de devis impossible", err);
    return { ok: false, error: "La décision n'a pas pu être enregistrée." };
  }
}

// ───────────────────────────── Secrétariat & Finances ─────────────────────────────

/** Sollicite le secrétariat pour obtenir les devis des éléments à acheter. */
export async function requestCareQuotes(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const scopeRaw = fdStr(formData, "scope") ?? "";
  const requestId = fdStr(formData, "requestId");
  if (!isScope(scopeRaw) || !requestId) return { ok: false, error: "Demande non précisée." };
  if (!canEdit(user, scopeRaw)) return { ok: false, error: "Non autorisé." };

  const req = await loadRequest(scopeRaw, requestId);
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (!DECIDED.includes(req.requestStatus)) return { ok: false, error: "La Direction n'a pas encore validé l'événement." };

  const toQuote = await prisma.careCell.count({
    where: { beneficiary: { ...parentWhere(scopeRaw, requestId), status: "APPROVED" }, kind: "SERVICE", status: "REQUESTED" },
  });
  if (toQuote === 0) return { ok: false, error: "Aucun élément n'attend de devis." };

  await notifyRoles(["DIRECTION_ASSISTANT", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: "Devis à obtenir — prise en charge",
    body: `${req.name} : ${toQuote} élément(s) à chiffrer.`,
    link: `${SPEC[scopeRaw].path}/${requestId}`,
  }).catch(() => undefined);

  await audit(user, scopeRaw, requestId, "UPDATE", `Secrétariat sollicité pour ${toQuote} devis.`);
  revalidate(scopeRaw, requestId);
  return { ok: true, message: `Le secrétariat est prévenu — ${toQuote} élément(s) à chiffrer.` };
}

/**
 * Envoie la demande aux Finances.
 *
 * Refuse tant que quelque chose manque, en DISANT quoi : une personne accordée dont il manque
 * le passeport, ou un devis qui attend encore une décision. Envoyer aux Finances un dossier
 * incomplet, c'est produire un montant faux puis le corriger à la main.
 */
export async function sendCareToFinance(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const scopeRaw = fdStr(formData, "scope") ?? "";
  const requestId = fdStr(formData, "requestId");
  if (!isScope(scopeRaw) || !requestId) return { ok: false, error: "Demande non précisée." };
  if (!canDecide(user, scopeRaw)) return { ok: false, error: "Seule la Direction envoie aux Finances." };

  const req = await loadRequest(scopeRaw, requestId);
  if (!req) return { ok: false, error: "Demande introuvable." };

  const beneficiaries = await prisma.careBeneficiary.findMany({
    where: parentWhere(scopeRaw, requestId),
    select: {
      status: true, doctorId: true, firstName: true, lastName: true,
      cells: { select: { kind: true, status: true, label: true, amountDzd: true } },
    },
  });
  const quotes = await prisma.careQuote.findMany({
    where: parentWhere(scopeRaw, requestId),
    select: { id: true, status: true, amountDzd: true, cells: { select: { cellId: true } } },
  });

  const rows = await Promise.all(
    beneficiaries.map(async (b) => ({
      status: b.status,
      name: await nameOf(b),
      progress: careProgress(b.cells.map((c) => ({ ...c, amountDzd: c.amountDzd != null ? toNumber(c.amountDzd) : null }))),
    })),
  );
  const readiness = financeReadiness(
    rows,
    quotes.map((q) => ({ id: q.id, status: q.status, amountDzd: toNumber(q.amountDzd), cellIds: q.cells.map((c) => c.cellId) })),
  );
  if (!readiness.ready) return { ok: false, error: readiness.blockers.join(" ") };

  await notifyRoles(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: "Prise en charge à régler",
    body: `${req.name} — dossier complet, ${rows.filter((r) => r.status === "APPROVED").length} personne(s) prise(s) en charge.`,
    link: "/finances/ordres-de-depense",
  }).catch(() => undefined);
  if (req.requesterId) {
    await notifyUser({
      userId: req.requesterId, type: "GENERIC",
      title: "Prise en charge transmise aux Finances",
      body: `${req.name} — le dossier est complet.`,
      link: `${SPEC[scopeRaw].path}/${requestId}`,
    }).catch(() => undefined);
  }

  await audit(user, scopeRaw, requestId, "UPDATE", "Dossier complet transmis aux Finances.");
  revalidate(scopeRaw, requestId);
  return { ok: true, message: "Les Finances sont prévenues — le dossier est complet." };
}

/** L'annuaire, pour le sélecteur de personnes. */
export async function careDirectoryOptions(): Promise<{ id: string; name: string; specialty: string | null; institution: string | null }[]> {
  await requireUser();
  const rows = await prisma.medicalDoctor.findMany({
    orderBy: { name: "asc" }, take: 500,
    select: { id: true, name: true, specialty: true, institution: true },
  });
  return rows;
}

/**
 * Rattache un matériel promotionnel à la case d'UNE personne.
 *
 * Une prise en charge s'accompagne souvent d'un support produit — brochure, kit, présentoir —
 * destiné à cette personne-là. On ne recopie jamais le circuit du matériel ici : il a le sien
 * (visa publicitaire, conformité information médicale, agence, BAT), et la case en montre
 * seulement l'avancement. Deux vérités sur le même objet finiraient par diverger.
 */
export async function linkCareCellPromoMaterial(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Élément non précisé." };

  const cell = await prisma.careCell.findUnique({ where: { id }, select: { id: true, label: true, beneficiaryId: true } });
  if (!cell) return { ok: false, error: "Élément introuvable." };
  const found = await scopeOfBeneficiary(cell.beneficiaryId);
  if (!found) return { ok: false, error: "Personne introuvable." };
  if (!canEdit(user, found.scope)) return { ok: false, error: "Non autorisé." };

  const promoMaterialId = fdStr(formData, "promoMaterialId");
  if (promoMaterialId) {
    const pm = await prisma.promoMaterial.findUnique({ where: { id: promoMaterialId }, select: { reference: true } });
    if (!pm) return { ok: false, error: "Matériel promotionnel introuvable." };
    await prisma.careCell.update({
      where: { id },
      data: { promoMaterialId, kind: "SERVICE", serviceKind: "PROMO_MATERIAL" },
    });
    await audit(user, found.scope, found.requestId, "UPDATE",
      `${await nameOf(found.beneficiary)} — « ${cell.label} » rattaché au matériel ${pm.reference}.`);
  } else {
    await prisma.careCell.update({ where: { id }, data: { promoMaterialId: null } });
    await audit(user, found.scope, found.requestId, "UPDATE",
      `${await nameOf(found.beneficiary)} — « ${cell.label} » détaché de son matériel promotionnel.`);
  }

  revalidate(found.scope, found.requestId);
  return { ok: true, id };
}

/** Les matériels promotionnels rattachables — pour le sélecteur. */
export async function carePromoOptions(): Promise<{ id: string; reference: string; title: string }[]> {
  await requireUser();
  const rows = await prisma.promoMaterial.findMany({
    where: { status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" }, take: 60,
    select: { id: true, reference: true, title: true },
  });
  return rows;
}
