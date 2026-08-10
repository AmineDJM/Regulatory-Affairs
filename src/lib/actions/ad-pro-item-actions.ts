"use server";

import { revalidatePath } from "next/cache";
import type { AdProItemKind, AdProItemStatus, AdProItemBudgetKind } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { createExpenseOrder } from "@/lib/expense-orders";
import { canEmitOrder, canSubmitItem, canRequestPurchaseOrder, canRemoveItem, budgetKindLocked, ITEM_KINDS, ITEM_KIND_LABELS, type AdProParent } from "@/lib/ad-pro-items";
import { buildRef } from "@/lib/refs";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

/**
 * POSTES D'UNE OPÉRATION AD & PRO — actions serveur, pour les QUATRE opérations du pôle :
 * sponsoring, prises en charge nationales et internationales, événements.
 *
 * **Chaque poste se valide INDÉPENDAMMENT.** C'est le changement de doctrine demandé par le
 * métier : consulting, traiteur, location de salle ne se décident pas ensemble, et la Direction
 * doit pouvoir accorder l'un, refuser l'autre et demander à revoir le budget du troisième —
 * autant de fois qu'il le faut (`AdProItemDecision` garde chaque tour). L'opération garde son
 * circuit d'ensemble ; les postes ont désormais le leur.
 *
 * Le poste dit AUSSI d'où vient son argent (`budgetKind`) : inclus dans l'enveloppe déjà
 * accordée, ou **rallonge** demandée en plus — sans quoi une rallonge assumée passerait pour un
 * dépassement subi.
 *
 * Chaîne complète, du besoin au paiement :
 *   devis (demande administrative) → pièces jointes → validation du poste (Direction) →
 *   choix du budget → demande d'émission du BC → visa Direction → émission par les Finances
 *   (ordre de dépense).
 *
 * Le **matériel promotionnel** reste à part : il POINTE vers un `PromoMaterial` suivant son
 * propre circuit (visa publicitaire, conformité, agence, BAT). On rattache, on ne recopie pas.
 *
 * **Un seul jeu d'actions pour les quatre modules.** Les différences réelles — où lit-on
 * l'enveloppe, quel statut vaut « accordé », quelle permission, quel chemin revalider — sont
 * rassemblées dans `PARENTS` : un seul endroit à compléter.
 */

interface ParentInfo {
  id: string;
  /** Ce qui identifie l'opération sur une pièce comptable. */
  ref: string;
  /** À qui l'argent va par défaut, quand le poste ne précise pas de bénéficiaire. */
  beneficiary: string;
  /** L'opération est-elle ACCORDÉE ? On n'engage pas une dépense avant. */
  decided: boolean;
  /** Qui a demandé l'opération — prévenu des décisions prises sur ses postes. */
  requesterId?: string | null;
}

type AdProModule = "SPONSORING" | "CONGRESS_NATIONAL" | "CONGRESS_INTERNATIONAL" | "EVENTS";

interface ParentSpec {
  module: AdProModule;
  path: string;
  /** Colonne de rattachement du poste — une par opération, jamais de colonne polymorphe. */
  column: "sponsoringId" | "congressNationalId" | "congressInternationalId" | "eventId";
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
    column: "sponsoringId",
    load: async (id) => {
      const r = await prisma.sponsoringRequest.findUnique({
        where: { id },
        select: { id: true, reference: true, institution: true, status: true, requesterId: true },
      });
      return r ? { id: r.id, ref: r.reference, beneficiary: r.institution, decided: SPONSORING_DECIDED.includes(r.status), requesterId: r.requesterId } : null;
    },
  },
  CONGRESS_NATIONAL: {
    module: "CONGRESS_NATIONAL",
    path: "/congress-national",
    column: "congressNationalId",
    load: async (id) => {
      const r = await prisma.congressNational.findUnique({
        where: { id },
        select: { id: true, name: true, hostInstitution: true, requestStatus: true, requesterId: true },
      });
      // Le congrès n'a pas de référence : son nom est ce qui l'identifie sur une pièce.
      return r ? { id: r.id, ref: r.name, beneficiary: r.hostInstitution ?? r.name, decided: CONGRESS_DECIDED.includes(r.requestStatus), requesterId: r.requesterId } : null;
    },
  },
  CONGRESS_INTERNATIONAL: {
    module: "CONGRESS_INTERNATIONAL",
    path: "/congress-international",
    column: "congressInternationalId",
    load: async (id) => {
      const r = await prisma.congressInternational.findUnique({
        where: { id },
        select: { id: true, name: true, requestStatus: true, requesterId: true },
      });
      return r ? { id: r.id, ref: r.name, beneficiary: r.name, decided: CONGRESS_DECIDED.includes(r.requestStatus), requesterId: r.requesterId } : null;
    },
  },
  EVENT: {
    module: "EVENTS",
    path: "/events",
    column: "eventId",
    load: async (id) => {
      const r = await prisma.event.findUnique({
        where: { id },
        select: { id: true, name: true, requestStatus: true, requesterId: true, status: true },
      });
      if (!r) return null;
      // Un événement peut être organisé SANS circuit de financement (requestStatus null) : il est
      // alors piloté directement, donc ses postes ne sont pas bloqués par une décision absente.
      const decided = r.requestStatus == null ? r.status !== "DRAFT" && r.status !== "CANCELLED" : CONGRESS_DECIDED.includes(r.requestStatus);
      return { id: r.id, ref: r.name, beneficiary: r.name, decided, requesterId: r.requesterId };
    },
  },
};

const isParent = (v: string): v is AdProParent =>
  v === "SPONSORING" || v === "CONGRESS_NATIONAL" || v === "CONGRESS_INTERNATIONAL" || v === "EVENT";

interface ParentColumns {
  sponsoringId: string | null;
  congressNationalId: string | null;
  congressInternationalId: string | null;
  eventId: string | null;
}

/** Le parent d'un poste, déduit de la colonne renseignée (la base garantit qu'il y en a une). */
function parentOf(item: ParentColumns): { parent: AdProParent; id: string } | null {
  if (item.sponsoringId) return { parent: "SPONSORING", id: item.sponsoringId };
  if (item.congressNationalId) return { parent: "CONGRESS_NATIONAL", id: item.congressNationalId };
  if (item.congressInternationalId) return { parent: "CONGRESS_INTERNATIONAL", id: item.congressInternationalId };
  if (item.eventId) return { parent: "EVENT", id: item.eventId };
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
      id: true, label: true, kind: true, supplier: true, amountGranted: true, amountEstimated: true,
      expenseOrderId: true, promoMaterialId: true, status: true, budgetKind: true,
      budgetCategoryId: true, orderStage: true, adminRequestId: true,
      sponsoringId: true, congressNationalId: true, congressInternationalId: true, eventId: true,
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
  // « Ce poste est-il DANS le budget accordé, ou EN PLUS ? » — question posée dès l'ajout : sans
  // elle, une rallonge assumée serait lue comme un dépassement subi.
  const budgetKind = (fdStr(formData, "budgetKind") === "ADDITIONAL" ? "ADDITIONAL" : "INCLUDED") as AdProItemBudgetKind;

  try {
    // Un poste ajouté APRÈS la décision est autorisé — c'est le choix retenu — mais il est
    // marqué. C'est ce marqueur qui expliquera un dépassement d'enveloppe à l'écran, au lieu
    // de laisser croire à une erreur de saisie.
    const late = info.decided;
    const where = { [PARENTS[parentRaw].column]: parentId } as Record<string, string>;
    const last = await prisma.adProItem.findFirst({ where, orderBy: { position: "desc" }, select: { position: true } });

    const created = await prisma.adProItem.create({
      data: {
        ...where,
        kind,
        label,
        notes: fdStr(formData, "notes"),
        supplier: fdStr(formData, "supplier"),
        amountEstimated: amountEstimated ?? null,
        budgetKind,
        addedAfterDecision: late,
        position: (last?.position ?? 0) + 1,
        createdById: user.id,
        updatedById: user.id,
      },
      select: { id: true },
    });

    await audit(user, parentRaw, parentId, "CREATE",
      `Poste ajouté — ${ITEM_KIND_LABELS[kind]} « ${label} » (${budgetKind === "ADDITIONAL" ? "budget supplémentaire" : "inclus dans le budget accordé"})${late ? " — APRÈS la décision définitive" : ""}.`);
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

  // NATURE et NATURE DE BUDGET — modifiables aussi, mais pas n'importe quand.
  // La nature (stand, prestation…) décrit la dépense : elle se corrige à tout moment.
  // La nature de BUDGET (inclus / rallonge) est ce sur quoi la Direction s'est prononcée :
  // une fois tranchée, la changer réécrirait sa décision.
  const kindRaw = fdStr(formData, "kind");
  const kind = kindRaw && (ITEM_KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as AdProItemKind) : null;
  const budgetKindRaw = fdStr(formData, "budgetKind");
  const budgetKind = budgetKindRaw === "INCLUDED" || budgetKindRaw === "ADDITIONAL" ? budgetKindRaw : null;
  const budgetDecided = budgetKindLocked(item);

  try {
    await prisma.adProItem.update({
      where: { id },
      data: {
        ...(label ? { label } : {}),
        ...(kind ? { kind } : {}),
        ...(budgetKind && !budgetDecided ? { budgetKind } : {}),
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

  // UN POSTE PAYÉ NE S'EFFACE PAS EN SILENCE — mais il doit pouvoir être retiré.
  //
  // Le refus pur et simple créait une impasse : un poste émis par erreur (mauvais fournisseur,
  // doublon) restait à l'écran pour toujours. On garde donc la protection pour les éditeurs
  // ordinaires, et on l'ouvre à la DIRECTION — celle qui a signé l'ordre est celle qui peut le
  // défaire. L'ordre de dépense est alors ANNULÉ, pas orphelin : la trace comptable subsiste,
  // marquée annulée, au lieu de pointer vers un poste disparu.
  const order = item.expenseOrderId
    ? await prisma.expenseOrder.findUnique({ where: { id: item.expenseOrderId }, select: { status: true, reference: true } })
    : null;
  const removable = canRemoveItem(
    { expenseOrderId: item.expenseOrderId, expenseOrderStatus: order?.status ?? null },
    { canAllocate: canAllocate(user, owner.parent) },
  );
  if (!removable.ok) return { ok: false, error: removable.reason ?? "Ce poste ne peut pas être retiré." };

  if (item.expenseOrderId) {
    await prisma.expenseOrder.update({ where: { id: item.expenseOrderId }, data: { status: "CANCELLED" } }).catch(() => undefined);
    await audit(user, owner.parent, owner.id, "UPDATE",
      `Ordre de dépense ${order?.reference ?? ""} annulé — le poste « ${item.label} » a été retiré.`);
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
  // ÉMISSION = geste des FINANCES (ou d'un profil à vue globale). La Direction, elle, a visé.
  const isFinance = userCan(user, "FINANCES", "UPDATE") || userCan(user, "FINANCES", "VALIDATE");
  if (!isFinance && !canAllocate(user, owner.parent)) return { ok: false, error: "Seules les Finances émettent le bon de commande." };

  const info = await PARENTS[owner.parent].load(owner.id);
  if (!info) return { ok: false, error: "Opération introuvable." };

  // Le circuit demandé : demande → visa Direction → émission. On n'émet pas sans le visa, sauf
  // pour les postes hérités d'avant ce circuit (orderStage NONE), qui gardent l'ancien geste direct.
  if (item.orderStage === "REQUESTED") return { ok: false, error: "La Direction n'a pas encore visé ce bon de commande." };
  if (item.orderStage === "REFUSED") return { ok: false, error: "L'émission de ce bon de commande a été refusée." };

  const amount = item.amountGranted != null ? toNumber(item.amountGranted) : null;
  const check = canEmitOrder({ amountGranted: amount, expenseOrderId: item.expenseOrderId, status: item.status }, info.decided);
  if (!check.ok) return { ok: false, error: check.reason ?? "Émission impossible." };

  try {
    const order = await createExpenseOrder({
      label: `${info.ref} — ${ITEM_KIND_LABELS[item.kind]} : ${item.label}`,
      amount: amount as number,
      category: "EVENEMENT",
      // Le bénéficiaire du POSTE ; à défaut, celui de l'opération.
      beneficiary: item.supplier ?? info.beneficiary,
      sourceType: owner.parent === "EVENT" ? "EVENT" : owner.parent,
      sourceId: info.id,
      requestedById: user.id,
      // Le budget CHOISI à la validation suit la dépense jusqu'aux Finances : plus de
      // ré-imputation à la main, plus de dépense qui traîne dans « à imputer ».
      budgetCategoryId: item.budgetCategoryId ?? null,
      notes: `Poste de l'opération ${info.ref}.`,
    });

    // Rattachement APRÈS création : si l'écriture échoue, on a une pièce orpheline visible côté
    // Finances plutôt qu'un poste qui se croit payé sans l'être.
    await prisma.adProItem.update({ where: { id }, data: { expenseOrderId: order.id, orderStage: "ISSUED", updatedById: user.id } });

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

// ───────────────────────── Validation du poste (Direction) ─────────────────────────

/** Trace une décision SANS écraser la précédente : le 3ᵉ tour ne doit pas effacer les deux refus. */
async function recordDecision(itemId: string, decision: AdProItemStatus, note: string | null, amount: number | null, byId: string) {
  await prisma.adProItemDecision.create({
    data: { itemId, decision, note, amount, byId },
  }).catch(() => undefined);
}

/**
 * SOUMET un poste à la Direction. Le demandeur décrit, chiffre, joint ses devis, puis envoie —
 * poste par poste. Un poste en « budget à revoir » se resoumet autant de fois qu'il le faut.
 */
export async function submitAdProItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };

  const check = canSubmitItem({
    status: item.status,
    amountEstimated: item.amountEstimated != null ? toNumber(item.amountEstimated) : null,
    amountGranted: item.amountGranted != null ? toNumber(item.amountGranted) : null,
  });
  if (!check.ok) return { ok: false, error: check.reason ?? "Soumission impossible." };

  const note = fdStr(formData, "note");
  const amount = item.amountGranted ?? item.amountEstimated;
  await prisma.adProItem.update({
    where: { id },
    data: { status: "PENDING", submittedAt: new Date(), decisionNote: null, updatedById: user.id },
  });
  await recordDecision(id, "PENDING", note, amount != null ? toNumber(amount) : null, user.id);

  const info = await PARENTS[owner.parent].load(owner.id);
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: "Poste à valider",
    body: `${info?.ref ?? "Opération"} — ${ITEM_KIND_LABELS[item.kind]} « ${item.label} »${amount != null ? ` (${toNumber(amount).toLocaleString("fr-FR")} DZD)` : ""}`,
    link: `${PARENTS[owner.parent].path}/${owner.id}`,
  }).catch(() => undefined);
  await audit(user, owner.parent, owner.id, "UPDATE", `Poste « ${item.label} » soumis à la Direction.`);
  revalidate(owner.parent, owner.id);
  return { ok: true, id };
}

/**
 * DÉCISION de la Direction sur UN poste : accorder, refuser, ou demander à revoir le budget.
 * La révision n'est pas une fin : elle rend la main au demandeur, qui corrige et resoumet — le
 * va-et-vient peut se répéter, chaque tour restant dans l'historique.
 */
export async function decideAdProItem(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision");
  if (!id || !decision) return { ok: false, error: "Décision incomplète." };
  if (!["APPROVED", "REJECTED", "REVISION"].includes(decision)) return { ok: false, error: "Décision inconnue." };

  const found = await loadItem(id);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canAllocate(user, owner.parent)) return { ok: false, error: "Seule la Direction décide d'un poste." };
  if (item.status === "APPROVED" && item.orderStage === "ISSUED") {
    return { ok: false, error: "Le bon de commande de ce poste a été émis : sa décision ne peut plus changer." };
  }

  const note = fdStr(formData, "note");
  // En accordant, la Direction peut arrêter le montant du poste (c'est le geste naturel :
  // « d'accord, mais pour 120 000 »). Sans montant saisi, l'estimation fait foi.
  const granted = fdNum(formData, "amountGranted");
  if (granted != null && granted < 0) return { ok: false, error: "Un montant ne peut pas être négatif." };
  const status = decision as AdProItemStatus;

  await prisma.adProItem.update({
    where: { id },
    data: {
      status,
      decidedAt: new Date(),
      decidedById: user.id,
      decisionNote: note,
      ...(status === "APPROVED"
        ? { amountGranted: granted ?? item.amountGranted ?? item.amountEstimated ?? null }
        : {}),
      updatedById: user.id,
    },
  });
  await recordDecision(id, status, note, granted ?? (item.amountGranted != null ? toNumber(item.amountGranted) : null), user.id);

  const info = await PARENTS[owner.parent].load(owner.id);
  const label = status === "APPROVED" ? "accordé" : status === "REJECTED" ? "refusé" : "à revoir (budget)";
  if (info?.requesterId && info.requesterId !== user.id) {
    await notifyUser({
      userId: info.requesterId,
      type: "GENERIC",
      title: `Poste ${label}`,
      body: `${info.ref} — « ${item.label} »${note ? ` : ${note}` : ""}`,
      link: `${PARENTS[owner.parent].path}/${owner.id}`,
    }).catch(() => undefined);
  }
  await audit(user, owner.parent, owner.id, "UPDATE", `Poste « ${item.label} » ${label}${note ? ` — ${note}` : ""}.`);
  revalidate(owner.parent, owner.id);
  return { ok: true, id };
}

/** Choix du BUDGET qui portera un poste accordé (catégorie d'enveloppe) — « comme d'habitude ». */
export async function setAdProItemBudget(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canAllocate(user, owner.parent)) return { ok: false, error: "Seule la Direction impute un poste à un budget." };
  if (item.status !== "APPROVED") return { ok: false, error: "Le poste doit d'abord être accordé." };

  const budgetCategoryId = fdStr(formData, "budgetCategoryId");
  if (budgetCategoryId) {
    const cat = await prisma.budgetCategoryLine.findUnique({
      where: { id: budgetCategoryId },
      select: { name: true, envelope: { select: { name: true } } },
    });
    if (!cat) return { ok: false, error: "Catégorie budgétaire introuvable." };
    await prisma.adProItem.update({ where: { id }, data: { budgetCategoryId, updatedById: user.id } });
    await audit(user, owner.parent, owner.id, "UPDATE", `Poste « ${item.label} » imputé au budget ${cat.envelope.name} › ${cat.name}.`);
  } else {
    await prisma.adProItem.update({ where: { id }, data: { budgetCategoryId: null, updatedById: user.id } });
    await audit(user, owner.parent, owner.id, "UPDATE", `Poste « ${item.label} » : imputation budgétaire retirée.`);
  }
  revalidate(owner.parent, owner.id);
  return { ok: true, id };
}

// ───────────────────────── Devis : demande administrative ─────────────────────────

/**
 * Ouvre une DEMANDE ADMINISTRATIVE (Bureau du secrétariat) pour obtenir le devis d'un poste.
 * Le secrétariat travaille avec ses outils habituels ; les devis déposés sur la demande sont
 * ensuite joints au poste, qui part alors en validation. Un seul aller au lieu de trois.
 */
export async function requestAdProItemQuote(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };
  if (item.adminRequestId) return { ok: false, error: "Une demande de devis est déjà ouverte pour ce poste." };

  const info = await PARENTS[owner.parent].load(owner.id);
  if (!info) return { ok: false, error: "Opération introuvable." };
  const note = fdStr(formData, "note");

  try {
    const reference = await nextAdminRequestRef();
    const request = await prisma.administrativeRequest.create({
      data: {
        reference,
        type: "QUOTE",
        title: `Devis — ${ITEM_KIND_LABELS[item.kind]} : ${item.label} (${info.ref})`,
        description: [
          `Demande de devis pour un poste de l'opération ${info.ref}.`,
          item.supplier ? `Prestataire pressenti : ${item.supplier}.` : null,
          item.amountEstimated != null ? `Enveloppe estimée : ${toNumber(item.amountEstimated).toLocaleString("fr-FR")} DZD.` : null,
          note,
        ].filter(Boolean).join("\n"),
        priority: "HIGH",
        requesterId: user.id,
        status: "NEW",
      },
      select: { id: true, reference: true },
    });
    await prisma.adProItem.update({ where: { id }, data: { adminRequestId: request.id, updatedById: user.id } });
    await notifyRoles(["DIRECTION_ASSISTANT", "SUPER_ADMIN"], {
      type: "ASSIGNMENT",
      title: "Demande de devis",
      body: `${request.reference} — ${item.label} (${info.ref})`,
      link: `/demandes/${request.id}`,
    }).catch(() => undefined);
    await audit(user, owner.parent, owner.id, "UPDATE", `Demande de devis ${request.reference} ouverte pour le poste « ${item.label} ».`);
    revalidate(owner.parent, owner.id);
    revalidatePath("/demandes");
    return { ok: true, id: request.id };
  } catch (err) {
    console.error("[ad-pro-item] demande de devis impossible", err);
    return { ok: false, error: "La demande de devis n'a pas pu être créée." };
  }
}

/** Référence d'une demande administrative — même forme que le module (DEM-année-n). */
async function nextAdminRequestRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await prisma.administrativeRequest.findMany({
    where: { reference: { startsWith: `DEM-${year}-` } },
    select: { reference: true },
  });
  return buildRef("DEM", year, rows.map((r) => r.reference));
}

// ───────────────────────── Bon de commande : demande → Direction → Finances ─────────────────────────

/** DEMANDE d'émission du bon de commande d'un poste accordé (première marche du circuit). */
export async function requestAdProItemOrder(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canEditItems(user, owner.parent)) return { ok: false, error: "Non autorisé." };

  const check = canRequestPurchaseOrder({
    status: item.status,
    amountGranted: item.amountGranted != null ? toNumber(item.amountGranted) : null,
    budgetCategoryId: item.budgetCategoryId,
    orderStage: item.orderStage,
  });
  if (!check.ok) return { ok: false, error: check.reason ?? "Demande impossible." };

  const note = fdStr(formData, "note");
  await prisma.adProItem.update({
    where: { id },
    data: { orderStage: "REQUESTED", orderRequestedAt: new Date(), orderRequestedById: user.id, orderNote: note, updatedById: user.id },
  });
  const info = await PARENTS[owner.parent].load(owner.id);
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: "Bon de commande à viser",
    body: `${info?.ref ?? ""} — « ${item.label} » (${toNumber(item.amountGranted!).toLocaleString("fr-FR")} DZD)`,
    link: `${PARENTS[owner.parent].path}/${owner.id}`,
  }).catch(() => undefined);
  await audit(user, owner.parent, owner.id, "UPDATE", `Émission du bon de commande demandée pour le poste « ${item.label} ».`);
  revalidate(owner.parent, owner.id);
  return { ok: true, id };
}

/**
 * VISA de la Direction sur la demande d'émission — puis les Finances émettent. Deux marches,
 * parce que ce sont deux responsabilités : la Direction engage, les Finances paient.
 */
export async function approveAdProItemOrder(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision") ?? "APPROVE";
  if (!id) return { ok: false, error: "Poste non précisé." };
  const found = await loadItem(id);
  if (!found) return { ok: false, error: "Poste introuvable." };
  const { item, owner } = found;
  if (!canAllocate(user, owner.parent)) return { ok: false, error: "Seule la Direction vise un bon de commande." };
  if (item.orderStage !== "REQUESTED") return { ok: false, error: "Aucune demande d'émission en attente sur ce poste." };

  const note = fdStr(formData, "note");
  if (decision === "REFUSE") {
    await prisma.adProItem.update({ where: { id }, data: { orderStage: "REFUSED", orderNote: note, updatedById: user.id } });
    await audit(user, owner.parent, owner.id, "UPDATE", `Émission du bon de commande REFUSÉE pour « ${item.label} »${note ? ` — ${note}` : ""}.`);
    revalidate(owner.parent, owner.id);
    return { ok: true, id };
  }

  await prisma.adProItem.update({
    where: { id },
    data: { orderStage: "DIRECTION_OK", orderDirectionAt: new Date(), orderDirectionById: user.id, orderNote: note, updatedById: user.id },
  });
  const info = await PARENTS[owner.parent].load(owner.id);
  await notifyRoles(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: "Bon de commande visé — à émettre",
    body: `${info?.ref ?? ""} — « ${item.label} » (${toNumber(item.amountGranted!).toLocaleString("fr-FR")} DZD)`,
    link: `${PARENTS[owner.parent].path}/${owner.id}`,
  }).catch(() => undefined);
  await audit(user, owner.parent, owner.id, "UPDATE", `Bon de commande visé par la Direction pour « ${item.label} » — transmis aux Finances.`);
  revalidate(owner.parent, owner.id);
  return { ok: true, id };
}
