"use server";

import { revalidatePath } from "next/cache";
import type { SponsoringItemKind } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { recordAudit } from "@/lib/audit";
import { createExpenseOrder } from "@/lib/expense-orders";
import { canEmitOrder, ITEM_KIND_LABELS } from "@/lib/sponsoring-items";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

/**
 * POSTES D'UN SPONSORING — actions serveur.
 *
 * Le principe qui structure ce fichier : **un poste n'est pas une demande**. Il ne déclenche
 * aucun circuit de validation propre. Le sponsoring garde son circuit unique (National Sales →
 * chef de produit → Direction) et les postes en sont la ventilation. Recopier le circuit sur
 * chaque poste triplerait la bureaucratie que le moteur cherche justement à réduire.
 *
 * Deux natures de postes :
 *   • ceux qui vivent ici (stand, prestation, déplacement) — ils émettent leur ordre de dépense ;
 *   • le **matériel promotionnel**, qui POINTE vers un `PromoMaterial` suivant son propre circuit
 *     (visa publicitaire, conformité information médicale, agence, BAT). On ne recopie rien : on
 *     rattache, et le sponsoring affiche l'avancement en lecture.
 */

const PATH = "/sponsoring";

/** Statuts à partir desquels le sponsoring est ACCORDÉ : on peut alors engager la dépense. */
const DECIDED_STATUSES = ["APPROVED", "ACCEPTED", "PAID", "CLOSED"] as const;

function revalidate(sponsoringId: string) {
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${sponsoringId}`);
}

/**
 * Qui peut toucher aux postes.
 *
 * `CONTRIBUTE` suffit pour DÉCRIRE les postes (le délégué détaille sa demande), mais l'affectation
 * des montants et l'émission des ordres de dépense engagent l'argent : réservées à la Direction.
 */
function canEditItems(user: SessionUser): boolean {
  return userCan(user, "SPONSORING", "CREATE") || userCan(user, "SPONSORING", "UPDATE") || hasGlobalView(user);
}
function canAllocate(user: SessionUser): boolean {
  return hasGlobalView(user) || userCan(user, "SPONSORING", "VALIDATE");
}

async function loadSponsoring(id: string) {
  return prisma.sponsoringRequest.findUnique({
    where: { id },
    select: { id: true, reference: true, institution: true, status: true, amountGranted: true },
  });
}

const isDecided = (status: string): boolean => (DECIDED_STATUSES as readonly string[]).includes(status);

async function audit(user: SessionUser, sponsoringId: string, action: "CREATE" | "UPDATE" | "DELETE", detail: string) {
  await recordAudit({
    actorId: user.id, module: "SPONSORING", entityType: "SPONSORING", entityId: sponsoringId, action, summary: detail,
  }).catch(() => undefined);
}

// ───────────────────────────── Ajouter / modifier / retirer ─────────────────────────────

export async function addSponsoringItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canEditItems(user)) return { ok: false, error: "Non autorisé." };

  const sponsoringId = fdStr(formData, "sponsoringId");
  const label = fdStr(formData, "label");
  if (!sponsoringId || !label) return { ok: false, error: "Le libellé du poste est obligatoire." };

  const sponsoring = await loadSponsoring(sponsoringId);
  if (!sponsoring) return { ok: false, error: "Sponsoring introuvable." };

  const kind = (fdStr(formData, "kind") ?? "OTHER") as SponsoringItemKind;
  if (!(kind in ITEM_KIND_LABELS)) return { ok: false, error: "Nature de poste inconnue." };

  const amountEstimated = fdNum(formData, "amountEstimated");
  if (amountEstimated != null && amountEstimated < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };

  try {
    // Un poste ajouté APRÈS la décision est autorisé — c'est le choix retenu — mais il est
    // marqué. C'est ce marqueur qui expliquera un dépassement d'enveloppe à l'écran, au lieu
    // de laisser croire à une erreur de saisie.
    const late = isDecided(sponsoring.status);
    const last = await prisma.sponsoringItem.findFirst({
      where: { sponsoringId }, orderBy: { position: "desc" }, select: { position: true },
    });

    const item = await prisma.sponsoringItem.create({
      data: {
        sponsoringId,
        kind,
        label,
        notes: fdStr(formData, "notes"),
        supplier: fdStr(formData, "supplier"),
        amountEstimated: amountEstimated ?? null,
        addedAfterDecision: late,
        position: (last?.position ?? 0) + 1,
        createdById: user.id,
        updatedById: user.id,
      },
      select: { id: true },
    });

    await audit(user, sponsoringId, "CREATE",
      `Poste ajouté — ${ITEM_KIND_LABELS[kind]} « ${label} »${late ? " (APRÈS la décision définitive)" : ""}.`);
    revalidate(sponsoringId);
    return { ok: true, id: item.id };
  } catch (err) {
    console.error("[sponsoring-item] création impossible", err);
    return { ok: false, error: "Le poste n'a pas pu être ajouté. Réessayez dans un instant." };
  }
}

export async function updateSponsoringItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canEditItems(user)) return { ok: false, error: "Non autorisé." };

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };

  const item = await prisma.sponsoringItem.findUnique({
    where: { id },
    select: { id: true, sponsoringId: true, label: true, expenseOrderId: true },
  });
  if (!item) return { ok: false, error: "Poste introuvable." };

  // Le montant affecté engage l'argent : il ne se modifie pas avec les mêmes droits que le libellé.
  const rawGranted = formData.get("amountGranted");
  const wantsAllocate = rawGranted !== null;
  if (wantsAllocate && !canAllocate(user)) {
    return { ok: false, error: "Seule la Direction affecte les montants." };
  }
  // Une pièce comptable a été émise sur ce montant : le changer en silence ferait diverger le
  // sponsoring et l'ordre de dépense. On refuse plutôt que de créer un écart invisible.
  if (wantsAllocate && item.expenseOrderId) {
    return { ok: false, error: "Un ordre de dépense a déjà été émis sur ce poste : son montant ne peut plus changer." };
  }

  const amountGranted = wantsAllocate ? fdNum(formData, "amountGranted") : undefined;
  if (amountGranted != null && amountGranted < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };
  const amountEstimated = fdNum(formData, "amountEstimated");
  if (amountEstimated != null && amountEstimated < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };

  const label = fdStr(formData, "label");
  try {
    await prisma.sponsoringItem.update({
      where: { id },
      data: {
        ...(label ? { label } : {}),
        ...(formData.has("notes") ? { notes: fdStr(formData, "notes") } : {}),
        ...(formData.has("supplier") ? { supplier: fdStr(formData, "supplier") } : {}),
        ...(formData.has("amountEstimated") ? { amountEstimated: amountEstimated ?? null } : {}),
        ...(wantsAllocate ? { amountGranted: amountGranted ?? null } : {}),
        updatedById: user.id,
      },
    });
    await audit(user, item.sponsoringId, "UPDATE",
      wantsAllocate
        ? `Poste « ${label ?? item.label} » — montant affecté : ${amountGranted != null ? `${amountGranted.toLocaleString("fr-FR")} DZD` : "retiré"}.`
        : `Poste « ${label ?? item.label} » modifié.`);
    revalidate(item.sponsoringId);
    return { ok: true, id };
  } catch (err) {
    console.error("[sponsoring-item] mise à jour impossible", err);
    return { ok: false, error: "Le poste n'a pas pu être modifié." };
  }
}

export async function deleteSponsoringItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canEditItems(user)) return { ok: false, error: "Non autorisé." };

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };

  const item = await prisma.sponsoringItem.findUnique({
    where: { id },
    select: { id: true, sponsoringId: true, label: true, expenseOrderId: true, promoMaterialId: true },
  });
  if (!item) return { ok: false, error: "Poste introuvable." };
  // Supprimer un poste payé effacerait la justification d'une dépense déjà engagée.
  if (item.expenseOrderId) {
    return { ok: false, error: "Un ordre de dépense a été émis sur ce poste : il ne peut plus être retiré." };
  }

  try {
    await prisma.sponsoringItem.delete({ where: { id } });
    // Le matériel promotionnel rattaché n'est PAS supprimé : il a sa vie propre et son circuit.
    await audit(user, item.sponsoringId, "DELETE",
      `Poste « ${item.label} » retiré${item.promoMaterialId ? " (le matériel promotionnel rattaché est conservé)" : ""}.`);
    revalidate(item.sponsoringId);
    return { ok: true };
  } catch (err) {
    console.error("[sponsoring-item] suppression impossible", err);
    return { ok: false, error: "Le poste n'a pas pu être retiré." };
  }
}

// ───────────────────────────── Paiement ─────────────────────────────

/**
 * Émet l'ordre de dépense d'UN poste.
 *
 * Un ordre par poste, parce que les bénéficiaires diffèrent réellement : le stand se paie à
 * l'organisateur, le matériel à l'agence, l'appui à l'association. Un ordre global obligerait
 * les Finances à répartir à la main — et c'est là que les erreurs se glissent.
 */
export async function emitItemExpenseOrder(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canAllocate(user)) return { ok: false, error: "Seule la Direction engage la dépense." };

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };

  const item = await prisma.sponsoringItem.findUnique({
    where: { id },
    select: { id: true, sponsoringId: true, kind: true, label: true, supplier: true, amountGranted: true, expenseOrderId: true },
  });
  if (!item) return { ok: false, error: "Poste introuvable." };

  const sponsoring = await loadSponsoring(item.sponsoringId);
  if (!sponsoring) return { ok: false, error: "Sponsoring introuvable." };

  const amount = item.amountGranted != null ? toNumber(item.amountGranted) : null;
  const check = canEmitOrder({ amountGranted: amount, expenseOrderId: item.expenseOrderId }, isDecided(sponsoring.status));
  if (!check.ok) return { ok: false, error: check.reason ?? "Émission impossible." };

  try {
    const order = await createExpenseOrder({
      label: `${sponsoring.reference} — ${ITEM_KIND_LABELS[item.kind]} : ${item.label}`,
      amount: amount as number,
      category: "EVENEMENT",
      // Le bénéficiaire du POSTE ; à défaut, l'institution sponsorisée.
      beneficiary: item.supplier ?? sponsoring.institution,
      sourceType: "SPONSORING",
      sourceId: sponsoring.id,
      requestedById: user.id,
      notes: `Poste du sponsoring ${sponsoring.reference} (${sponsoring.institution}).`,
    });

    // Rattachement APRÈS création : si l'écriture échoue, on a une pièce orpheline visible côté
    // Finances plutôt qu'un poste qui se croit payé sans l'être.
    await prisma.sponsoringItem.update({ where: { id }, data: { expenseOrderId: order.id, updatedById: user.id } });

    await audit(user, item.sponsoringId, "UPDATE",
      `Ordre de dépense ${order.reference} émis pour le poste « ${item.label} » — ${(amount as number).toLocaleString("fr-FR")} DZD au profit de ${item.supplier ?? sponsoring.institution}.`);
    revalidate(item.sponsoringId);
    revalidatePath("/finances/ordres-de-depense");
    return { ok: true, id: order.id };
  } catch (err) {
    console.error("[sponsoring-item] émission de l'ordre impossible", err);
    return { ok: false, error: "L'ordre de dépense n'a pas pu être émis." };
  }
}

// ───────────────────────────── Matériel promotionnel ─────────────────────────────

/**
 * Rattache un matériel promotionnel EXISTANT à un poste.
 *
 * On ne recopie jamais son état ici : le matériel suit son propre circuit et le sponsoring en
 * lit l'avancement. Deux vérités sur le même objet finiraient toujours par diverger.
 */
export async function linkPromoMaterial(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canEditItems(user)) return { ok: false, error: "Non autorisé." };

  const id = fdStr(formData, "id");
  const promoMaterialId = fdStr(formData, "promoMaterialId");
  if (!id) return { ok: false, error: "Poste non précisé." };

  const item = await prisma.sponsoringItem.findUnique({ where: { id }, select: { id: true, sponsoringId: true, label: true } });
  if (!item) return { ok: false, error: "Poste introuvable." };

  if (promoMaterialId) {
    const pm = await prisma.promoMaterial.findUnique({ where: { id: promoMaterialId }, select: { reference: true } });
    if (!pm) return { ok: false, error: "Matériel promotionnel introuvable." };
    await prisma.sponsoringItem.update({ where: { id }, data: { promoMaterialId, kind: "PROMO_MATERIAL", updatedById: user.id } });
    await audit(user, item.sponsoringId, "UPDATE", `Poste « ${item.label} » rattaché au matériel ${pm.reference}.`);
  } else {
    await prisma.sponsoringItem.update({ where: { id }, data: { promoMaterialId: null, updatedById: user.id } });
    await audit(user, item.sponsoringId, "UPDATE", `Poste « ${item.label} » détaché de son matériel promotionnel.`);
  }

  revalidate(item.sponsoringId);
  return { ok: true, id };
}

/** Les matériels promotionnels rattachables — pour le sélecteur, sans exposer tout le module. */
export async function promoMaterialOptions(): Promise<{ id: string; reference: string; title: string; status: string }[]> {
  const user = await requireUser();
  if (!canEditItems(user)) return [];
  const rows = await prisma.promoMaterial.findMany({
    where: { status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, reference: true, title: true, status: true },
  });
  return rows.map((r) => ({ ...r, status: String(r.status) }));
}
