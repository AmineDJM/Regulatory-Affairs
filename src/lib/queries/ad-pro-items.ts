import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { getBudgetCategoryOptions } from "@/lib/queries/budget";
import type { SessionUser } from "@/lib/rbac";
import type { ItemRow } from "@/components/ad-pro/items-panel";
import type { AdProParent } from "@/lib/ad-pro-items";

/**
 * CHARGEMENT DES POSTES D'UNE OPÉRATION AD & PRO — un seul endroit pour les quatre modules.
 *
 * Chaque page (sponsoring, prises en charge nationales et internationales, événements) recopiait
 * la même vingtaine de lignes : requête, résolution des libellés du matériel promo et de l'ordre
 * de dépense, conversion des décimaux. Une différence oubliée dans l'une d'elles — un champ du
 * cycle de validation non transmis — et l'écran ment sur l'état d'un poste. Ici, la vérité est
 * écrite une fois.
 *
 * Les libellés (matériel, ordre, budget, demande de devis) sont résolus **en lot** : une requête
 * par famille, jamais une par poste.
 */

const PARENT_COLUMN: Record<AdProParent, "sponsoringId" | "congressNationalId" | "congressInternationalId" | "eventId"> = {
  SPONSORING: "sponsoringId",
  CONGRESS_NATIONAL: "congressNationalId",
  CONGRESS_INTERNATIONAL: "congressInternationalId",
  EVENT: "eventId",
};

export async function loadAdProItems(parent: AdProParent, parentId: string): Promise<ItemRow[]> {
  const rawItems = await prisma.adProItem.findMany({
    where: { [PARENT_COLUMN[parent]]: parentId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      budgetCategory: { select: { name: true, envelope: { select: { name: true } } } },
      adminRequest: { select: { reference: true } },
      decisions: {
        orderBy: { at: "desc" },
        take: 12,
        select: { decision: true, note: true, amount: true, at: true, by: { select: { name: true } } },
      },
    },
  });
  if (rawItems.length === 0) return [];

  const promoIds = rawItems.map((i) => i.promoMaterialId).filter((x): x is string => Boolean(x));
  const orderIds = rawItems.map((i) => i.expenseOrderId).filter((x): x is string => Boolean(x));
  const [promoRows, orderRows] = await Promise.all([
    promoIds.length
      ? prisma.promoMaterial.findMany({ where: { id: { in: promoIds } }, select: { id: true, reference: true, title: true, status: true } })
      : Promise.resolve([]),
    orderIds.length
      ? prisma.expenseOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true, reference: true, status: true } })
      : Promise.resolve([]),
  ]);
  const promoById = new Map(promoRows.map((p) => [p.id, { reference: p.reference, title: p.title, status: String(p.status) }]));
  const orderById = new Map(orderRows.map((o) => [o.id, { reference: o.reference, status: String(o.status) }]));

  return rawItems.map((i) => ({
    id: i.id, kind: i.kind, label: i.label, notes: i.notes, supplier: i.supplier,
    amountEstimated: i.amountEstimated != null ? toNumber(i.amountEstimated) : null,
    amountGranted: i.amountGranted != null ? toNumber(i.amountGranted) : null,
    addedAfterDecision: i.addedAfterDecision,
    promoMaterialId: i.promoMaterialId,
    promoMaterial: i.promoMaterialId ? promoById.get(i.promoMaterialId) ?? null : null,
    expenseOrderId: i.expenseOrderId,
    expenseOrder: i.expenseOrderId ? orderById.get(i.expenseOrderId) ?? null : null,
    status: i.status,
    budgetKind: i.budgetKind,
    decisionNote: i.decisionNote,
    decidedAt: i.decidedAt?.toISOString() ?? null,
    budgetCategoryId: i.budgetCategoryId,
    budgetCategoryLabel: i.budgetCategory ? `${i.budgetCategory.envelope.name} › ${i.budgetCategory.name}` : null,
    adminRequestId: i.adminRequestId,
    adminRequestRef: i.adminRequest?.reference ?? null,
    orderStage: i.orderStage,
    decisions: i.decisions.map((d) => ({
      decision: d.decision,
      note: d.note,
      amount: d.amount != null ? toNumber(d.amount) : null,
      at: d.at.toISOString(),
      by: d.by?.name ?? null,
    })),
  }));
}

/**
 * (Sous-)catégories budgétaires proposées pour imputer un poste accordé. Restreintes aux
 * enveloppes couvrant la FAMILLE Ad & Pro et accessibles au décideur — imputer un poste de
 * congrès à une enveloppe Regulatory n'aurait aucun sens, et proposer une enveloppe fermée
 * ferait échouer le choix au dernier moment.
 */
export async function adProBudgetOptions(viewer: SessionUser): Promise<{ id: string; label: string }[]> {
  const opts = await getBudgetCategoryOptions(
    ["SPONSORING", "CONGRESS_NATIONAL", "CONGRESS_INTERNATIONAL", "EVENTS", "PROMO_MATERIAL"],
    viewer,
  );
  return opts.map((o) => ({ id: o.id, label: o.label }));
}
