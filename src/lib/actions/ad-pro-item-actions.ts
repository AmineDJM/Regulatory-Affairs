"use server";

import { revalidatePath } from "next/cache";
import type { AdProItemKind } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { recordAudit } from "@/lib/audit";
import { createExpenseOrder } from "@/lib/expense-orders";
import { canEmitOrder, ITEM_KIND_LABELS, type AdProParent } from "@/lib/ad-pro-items";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

/**
 * POSTES D'UNE OPÉRATION AD & PRO — actions serveur (sponsoring ET congrès nationaux).
 *
 * Le principe qui structure ce fichier : **un poste n'est pas une demande**. Il ne déclenche
 * aucun circuit de validation propre. L'opération garde son circuit unique (National Sales →
 * chef de produit → Direction) et les postes en sont la ventilation. Recopier le circuit sur
 * chaque poste triplerait la bureaucratie que le moteur cherche justement à réduire.
 *
 * Deux natures de postes :
 *   • ceux qui vivent ici (stand, symposium, prestation, déplacement) — ils émettent leur ordre
 *     de dépense ;
 *   • le **matériel promotionnel**, qui POINTE vers un `PromoMaterial` suivant son propre circuit
 *     (visa publicitaire, conformité information médicale, agence, BAT). On ne recopie rien : on
 *     rattache, et l'opération affiche l'avancement en lecture.
 *
 * **Un seul jeu d'actions pour les deux modules.** Les différences réelles — où lit-on
 * l'enveloppe, quel statut vaut « accordé », quelle permission, quel chemin revalider — sont
 * rassemblées dans `PARENTS` : un seul endroit à compléter pour ajouter les congrès
 * internationaux ou les événements.
 */

interface ParentInfo {
  id: string;
  /** Ce qui identifie l'opération sur une pièce comptable. */
  ref: string;
  /** À qui l'argent va par défaut, quand le poste ne précise pas de bénéficiaire. */
  beneficiary: string;
  /** L'opération est-elle ACCORDÉE ? On n'engage pas une dépense avant. */
  decided: boolean;
}

interface ParentSpec {
  module: "SPONSORING" | "CONGRESS_NATIONAL";
  path: string;
  /** Charge ce dont les actions ont besoin, quel que soit le nom des colonnes. */
  load: (id: string) => Promise<ParentInfo | null>;
}

/** Statuts à partir desquels l'opération est ACCORDÉE : on peut alors engager la dépense. */
const SPONSORING_DECIDED = ["APPROVED", "ACCEPTED", "PAID", "CLOSED"];
const CONGRESS_DECIDED = ["APPROVED", "COMPLETED"];

const PARENTS: Record<AdProParent, ParentSpec> = {
  SPONSORING: {
    module: "SPONSORING",
    path: "/sponsoring",
    load: async (id) => {
      const r = await prisma.sponsoringRequest.findUnique({
        where: { id },
        select: { id: true, reference: true, institution: true, status: true },
      });
      return r ? { id: r.id, ref: r.reference, beneficiary: r.institution, decided: SPONSORING_DECIDED.includes(r.status) } : null;
    },
  },
  CONGRESS_NATIONAL: {
    module: "CONGRESS_NATIONAL",
    path: "/congress-national",
    load: async (id) => {
      const r = await prisma.congressNational.findUnique({
        where: { id },
        select: { id: true, name: true, hostInstitution: true, requestStatus: true },
      });
      // Le congrès n'a pas de référence : son nom est ce qui l'identifie sur une pièce.
      return r ? { id: r.id, ref: r.name, beneficiary: r.hostInstitution ?? r.name, decided: CONGRESS_DECIDED.includes(r.requestStatus) } : null;
    },
  },
};

const isParent = (v: string): v is AdProParent => v === "SPONSORING" || v === "CONGRESS_NATIONAL";

/** Le parent d'un poste, déduit de la colonne renseignée (la base garantit qu'il y en a une). */
function parentOf(item: { sponsoringId: string | null; congressNationalId: string | null }): { parent: AdProParent; id: string } | null {
  if (item.sponsoringId) return { parent: "SPONSORING", id: item.sponsoringId };
  if (item.congressNationalId) return { parent: "CONGRESS_NATIONAL", id: item.congressNationalId };
  return null;
}

function revalidate(parent: AdProParent, id: string) {
  const { path } = PARENTS[parent];
  revalidatePath(path);
  revalidatePath(`${path}/${id}`);
}

/**
 * Qui peut toucher aux postes.
 *
 * `CREATE`/`UPDATE` suffit pour DÉCRIRE les postes (le demandeur détaille son besoin), mais
 * l'affectation des montants et l'émission des ordres de dépense engagent l'argent : Direction.
 */
function canEditItems(user: SessionUser, parent: AdProParent): boolean {
  const m = PARENTS[parent].module;
  return userCan(user, m, "CREATE") || userCan(user, m, "UPDATE") || hasGlobalView(user);
}
function canAllocate(user: SessionUser, parent: AdProParent): boolean {
  return hasGlobalView(user) || userCan(user, PARENTS[parent].module, "VALIDATE");
}

async function audit(user: SessionUser, parent: AdProParent, id: string, action: "CREATE" | "UPDATE" | "DELETE", detail: string) {
  await recordAudit({
    actorId: user.id, module: PARENTS[parent].module, entityType: parent, entityId: id, action, summary: detail,
  }).catch(() => undefined);
}

/** Charge un poste avec son parent résolu — le point d'entrée de toutes les actions par `id`. */
async function loadItem(id: string) {
  const item = await prisma.adProItem.findUnique({
    where: { id },
    select: {
      id: true, label: true, kind: true, supplier: true, amountGranted: true,
      expenseOrderId: true, promoMaterialId: true, sponsoringId: true, congressNationalId: true,
    },
  });
  if (!item) return null;
  const owner = parentOf(item);
  return owner ? { item, owner } : null;
}

// ───────────────────────────── Ajouter / modifier / retirer ─────────────────────────────

export async function addAdProItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parentRaw = fdStr(formData, "parent") ?? "";
  if (!isParent(parentRaw)) return { ok: false, error: "Opération inconnue." };
  const parentId = fdStr(formData, "parentId");
  const label = fdStr(formData, "label");
  if (!parentId || !label) return { ok: false, error: "Le libellé du poste est obligatoire." };
  if (!canEditItems(user, parentRaw)) return { ok: false, error: "Non autorisé." };

  const info = await PARENTS[parentRaw].load(parentId);
  if (!info) return { ok: false, error: "Opération introuvable." };

  const kind = (fdStr(formData, "kind") ?? "OTHER") as AdProItemKind;
  if (!(kind in ITEM_KIND_LABELS)) return { ok: false, error: "Nature de poste inconnue." };

  const amountEstimated = fdNum(formData, "amountEstimated");
  if (amountEstimated != null && amountEstimated < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };

  try {
    // Un poste ajouté APRÈS la décision est autorisé — c'est le choix retenu — mais il est
    // marqué. C'est ce marqueur qui expliquera un dépassement d'enveloppe à l'écran, au lieu
    // de laisser croire à une erreur de saisie.
    const late = info.decided;
    const where = parentRaw === "SPONSORING" ? { sponsoringId: parentId } : { congressNationalId: parentId };
    const last = await prisma.adProItem.findFirst({ where, orderBy: { position: "desc" }, select: { position: true } });

    const created = await prisma.adProItem.create({
      data: {
        ...where,
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

    await audit(user, parentRaw, parentId, "CREATE",
      `Poste ajouté — ${ITEM_KIND_LABELS[kind]} « ${label} »${late ? " (APRÈS la décision définitive)" : ""}.`);
    revalidate(parentRaw, parentId);
    return { ok: true, id: created.id };
  } catch (err) {
    console.error("[ad-pro-item] création impossible", err);
    return { ok: false, error: "Le poste n'a pas pu être ajouté. Réessayez dans un instant." };
  }
}

export async function updateAdProItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };

  // Le montant affecté engage l'argent : il ne se modifie pas avec les mêmes droits que le libellé.
  const wantsAllocate = formData.get("amountGranted") !== null;
  if (wantsAllocate && !canAllocate(user, owner.parent)) {
    return { ok: false, error: "Seule la Direction affecte les montants." };
  }
  // Une pièce comptable a été émise sur ce montant : le changer en silence ferait diverger
  // l'opération et l'ordre de dépense. On refuse plutôt que de créer un écart invisible.
  if (wantsAllocate && item.expenseOrderId) {
    return { ok: false, error: "Un ordre de dépense a déjà été émis sur ce poste : son montant ne peut plus changer." };
  }

  const amountGranted = wantsAllocate ? fdNum(formData, "amountGranted") : undefined;
  if (amountGranted != null && amountGranted < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };
  const amountEstimated = fdNum(formData, "amountEstimated");
  if (amountEstimated != null && amountEstimated < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };

  const label = fdStr(formData, "label");
  try {
    await prisma.adProItem.update({
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
    await audit(user, owner.parent, owner.id, "UPDATE",
      wantsAllocate
        ? `Poste « ${label ?? item.label} » — montant affecté : ${amountGranted != null ? `${amountGranted.toLocaleString("fr-FR")} DZD` : "retiré"}.`
        : `Poste « ${label ?? item.label} » modifié.`);
    revalidate(owner.parent, owner.id);
    return { ok: true, id };
  } catch (err) {
    console.error("[ad-pro-item] mise à jour impossible", err);
    return { ok: false, error: "Le poste n'a pas pu être modifié." };
  }
}

export async function deleteAdProItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };

  // Supprimer un poste payé effacerait la justification d'une dépense déjà engagée.
  if (item.expenseOrderId) {
    return { ok: false, error: "Un ordre de dépense a été émis sur ce poste : il ne peut plus être retiré." };
  }

  try {
    await prisma.adProItem.delete({ where: { id } });
    // Le matériel promotionnel rattaché n'est PAS supprimé : il a sa vie propre et son circuit.
    await audit(user, owner.parent, owner.id, "DELETE",
      `Poste « ${item.label} » retiré${item.promoMaterialId ? " (le matériel promotionnel rattaché est conservé)" : ""}.`);
    revalidate(owner.parent, owner.id);
    return { ok: true };
  } catch (err) {
    console.error("[ad-pro-item] suppression impossible", err);
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

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canAllocate(user, owner.parent)) return { ok: false, error: "Seule la Direction engage la dépense." };

  const info = await PARENTS[owner.parent].load(owner.id);
  if (!info) return { ok: false, error: "Opération introuvable." };

  const amount = item.amountGranted != null ? toNumber(item.amountGranted) : null;
  const check = canEmitOrder({ amountGranted: amount, expenseOrderId: item.expenseOrderId }, info.decided);
  if (!check.ok) return { ok: false, error: check.reason ?? "Émission impossible." };

  try {
    const order = await createExpenseOrder({
      label: `${info.ref} — ${ITEM_KIND_LABELS[item.kind]} : ${item.label}`,
      amount: amount as number,
      category: "EVENEMENT",
      // Le bénéficiaire du POSTE ; à défaut, celui de l'opération.
      beneficiary: item.supplier ?? info.beneficiary,
      sourceType: owner.parent,
      sourceId: info.id,
      requestedById: user.id,
      notes: `Poste de l'opération ${info.ref}.`,
    });

    // Rattachement APRÈS création : si l'écriture échoue, on a une pièce orpheline visible côté
    // Finances plutôt qu'un poste qui se croit payé sans l'être.
    await prisma.adProItem.update({ where: { id }, data: { expenseOrderId: order.id, updatedById: user.id } });

    await audit(user, owner.parent, owner.id, "UPDATE",
      `Ordre de dépense ${order.reference} émis pour le poste « ${item.label} » — ${(amount as number).toLocaleString("fr-FR")} DZD au profit de ${item.supplier ?? info.beneficiary}.`);
    revalidate(owner.parent, owner.id);
    revalidatePath("/finances/ordres-de-depense");
    return { ok: true, id: order.id };
  } catch (err) {
    console.error("[ad-pro-item] émission de l'ordre impossible", err);
    return { ok: false, error: "L'ordre de dépense n'a pas pu être émis." };
  }
}

// ───────────────────────────── Matériel promotionnel ─────────────────────────────

/**
 * Rattache un matériel promotionnel EXISTANT à un poste.
 *
 * On ne recopie jamais son état ici : le matériel suit son propre circuit et l'opération en lit
 * l'avancement. Deux vérités sur le même objet finiraient toujours par diverger.
 */
export async function linkPromoMaterial(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };

  const promoMaterialId = fdStr(formData, "promoMaterialId");
  if (promoMaterialId) {
    const pm = await prisma.promoMaterial.findUnique({ where: { id: promoMaterialId }, select: { reference: true } });
    if (!pm) return { ok: false, error: "Matériel promotionnel introuvable." };
    await prisma.adProItem.update({ where: { id }, data: { promoMaterialId, kind: "PROMO_MATERIAL", updatedById: user.id } });
    await audit(user, owner.parent, owner.id, "UPDATE", `Poste « ${item.label} » rattaché au matériel ${pm.reference}.`);
  } else {
    await prisma.adProItem.update({ where: { id }, data: { promoMaterialId: null, updatedById: user.id } });
    await audit(user, owner.parent, owner.id, "UPDATE", `Poste « ${item.label} » détaché de son matériel promotionnel.`);
  }

  revalidate(owner.parent, owner.id);
  return { ok: true, id };
}

/** Les matériels promotionnels rattachables — pour le sélecteur, sans exposer tout le module. */
export async function promoMaterialOptions(): Promise<{ id: string; reference: string; title: string; status: string }[]> {
  const user = await requireUser();
  if (!canEditItems(user, "SPONSORING") && !canEditItems(user, "CONGRESS_NATIONAL")) return [];
  const rows = await prisma.promoMaterial.findMany({
    where: { status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, reference: true, title: true, status: true },
  });
  return rows.map((r) => ({ ...r, status: String(r.status) }));
}
