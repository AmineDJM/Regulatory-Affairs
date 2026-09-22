import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { getBudgetCategoryOptions } from "@/lib/queries/budget";
import type { SessionUser } from "@/lib/rbac";
import type { ItemRow } from "@/components/ad-pro/items-panel";
import { PARENT_COLONNE, type AdProParent } from "@/lib/ad-pro-items";
import { NATURES_PIECE_SECRETARIAT, PIECE_SECRETARIAT, type NaturePieceSecretariat } from "@/lib/ad-pro/pieces-secretariat";

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

export async function loadAdProItems(parent: AdProParent, parentId: string): Promise<ItemRow[]> {
  const rawItems = await prisma.adProItem.findMany({
    where: { [PARENT_COLONNE[parent]]: parentId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      budgetCategory: { select: { name: true, envelope: { select: { name: true } } } },
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
  const itemIds = rawItems.map((i) => i.id);
  const [promoRows, orderRows, demandeRows, docRows] = await Promise.all([
    promoIds.length
      ? prisma.promoMaterial.findMany({ where: { id: { in: promoIds } }, select: { id: true, reference: true, title: true, status: true } })
      : Promise.resolve([]),
    orderIds.length
      ? prisma.expenseOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true, reference: true, status: true } })
      : Promise.resolve([]),
    // LES DEMANDES DE PIÈCE, par le lien CANONIQUE — devis ET facture. En lire une par poste
    // ferait N allers-retours sur un écran qu'on ouvre pour tout voir (§118.102b).
    prisma.administrativeRequest.findMany({
      where: { linkedEntityType: "AD_PRO_ITEM", linkedEntityId: { in: itemIds }, deletedAt: null },
      select: { id: true, reference: true, type: true, status: true, linkedEntityId: true },
      orderBy: { createdAt: "asc" },
    }),
    // LES PIÈCES JOINTES d'un poste : on en rend le COMPTE, pas la liste — l'écran ne les
    // déplie qu'à la demande, et charger les métadonnées de toutes les pièces de tous les
    // postes pour afficher un chiffre coûterait une requête pour rien.
    prisma.document.groupBy({
      by: ["entityId"],
      where: { entityType: "AD_PRO_ITEM", entityId: { in: itemIds } },
      _count: { _all: true },
    }),
  ]);
  const natureDuType = new Map<string, NaturePieceSecretariat>(
    NATURES_PIECE_SECRETARIAT.map((n) => [String(PIECE_SECRETARIAT[n].type), n]),
  );
  const demandesParPoste = new Map<string, ItemRow["demandes"]>();
  for (const d of demandeRows) {
    const nature = natureDuType.get(String(d.type));
    // Une demande d'une AUTRE nature rattachée au poste (un déplacement, une signature) n'est
    // pas une pièce commerciale : on ne la range pas de force dans une case qui n'est pas la
    // sienne — la montrer comme un devis ferait croire le devis demandé (§118.26).
    if (!nature || !d.linkedEntityId) continue;
    const liste = demandesParPoste.get(d.linkedEntityId) ?? [];
    liste.push({ id: d.id, reference: d.reference, nature, status: String(d.status) });
    demandesParPoste.set(d.linkedEntityId, liste);
  }
  const docsParPoste = new Map(docRows.map((d) => [d.entityId, d._count._all]));
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
    demandes: demandesParPoste.get(i.id) ?? [],
    documentCount: docsParPoste.get(i.id) ?? 0,
    orderStage: i.orderStage,
    orderNote: i.orderNote,
    orderDecisionNote: i.orderDecisionNote,
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
