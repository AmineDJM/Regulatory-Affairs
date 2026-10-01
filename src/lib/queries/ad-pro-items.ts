import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { getBudgetCategoryOptions } from "@/lib/queries/budget";
import type { SessionUser } from "@/lib/rbac";
import type { ItemRow } from "@/components/ad-pro/items-panel";
import type { LigneStockVue, ContexteMaterielStock } from "@/components/ad-pro/materiel-stock";
import { PARENT_COLONNE, type AdProParent } from "@/lib/ad-pro-items";
import { etatValidite, libelleArticleStock } from "@/lib/promo/stock";
import { familleQuantifiee, type PromoFamille } from "@/lib/promo/catalogue";
import { peutConfirmerMateriel } from "@/lib/promo/reservations";
import type { PostePourCloture } from "@/lib/ad-pro/cloture-sponsoring";
import { gestionnairesDuMagasin } from "@/lib/queries/promo-stock";
import { NATURES_PIECE_SECRETARIAT, PIECE_SECRETARIAT, type NaturePieceSecretariat } from "@/lib/ad-pro/pieces-secretariat";
import { statutDuDossier } from "@/lib/promo-material/statut";

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
  const [promoRows, orderRows, demandeRows, docRows, lignesParPoste] = await Promise.all([
    promoIds.length
      ? prisma.promoMaterial.findMany({ where: { id: { in: promoIds } }, select: { id: true, reference: true, title: true, status: true, circuitState: true, circuitVersion: true } })
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
    // LE MATÉRIEL DU STOCK des postes qui en portent (§118.167) — en lot, comme le reste.
    lignesStockParPoste(itemIds),
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
  const promoById = new Map(promoRows.map((p) => [p.id, { reference: p.reference, title: p.title, status: statutDuDossier(p).libelle }]));
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
    lignesStock: lignesParPoste.get(i.id) ?? [],
    orderStage: i.orderStage,
    // SOUS LE SEUIL (§118.149) : le BC est passé aux Finances sans qu'aucun centre le vise — seul
    // le visa du centre pose `orderDirectionAt`. La fiche ne doit pas dire « validé par le centre ».
    orderSansCentre: i.orderStage === "DIRECTION_OK" && i.orderDirectionAt === null,
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

// ─────────────────────────── Le matériel du stock d'un poste (§118.167) ───────────────────────────

const r3 = (n: number): number => Math.round(n * 1000) / 1000;
const num = (v: unknown): number => (v == null ? 0 : Number(v));

/** Les lignes de matériel de ces postes, rangées par poste — une requête pour tous. */
export async function lignesStockParPoste(itemIds: readonly string[]): Promise<Map<string, LigneStockVue[]>> {
  const out = new Map<string, LigneStockVue[]>();
  if (itemIds.length === 0) return out;
  const lignes = await prisma.adProStockLine.findMany({
    where: { itemId: { in: [...itemIds] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, itemId: true, stockItemId: true, quantite: true, statut: true,
      utilisee: true, rendue: true, abimee: true, perdue: true, confirmeeLe: true, note: true,
      stockItem: {
        select: {
          catalogue: { select: { nom: true, famille: true, unite: true } },
          produits: { select: { product: { select: { canonicalName: true } } } },
        },
      },
    },
  });
  const opt = (v: unknown): number | null => (v == null ? null : num(v));
  for (const l of lignes) {
    const liste = out.get(l.itemId) ?? [];
    liste.push({
      id: l.id,
      stockItemId: l.stockItemId,
      libelle: libelleArticleStock(l.stockItem.catalogue.nom, l.stockItem.produits.map((p) => p.product.canonicalName)),
      famille: l.stockItem.catalogue.famille as PromoFamille,
      unite: l.stockItem.catalogue.unite,
      quantite: num(l.quantite),
      statut: l.statut,
      utilisee: opt(l.utilisee),
      rendue: opt(l.rendue),
      abimee: opt(l.abimee),
      perdue: opt(l.perdue),
      confirmeeLe: l.confirmeeLe?.toISOString() ?? null,
      note: l.note,
    });
    out.set(l.itemId, liste);
  }
  return out;
}

/**
 * LES POSTES D'UN SPONSORING, TELS QUE LA CLÔTURE LES JUGE — une seule lecture pour l'écran, l'action
 * et l'op d'Adam : la nature et le matériel réservé font partie du bilan (§118.167), et trois
 * lectures écrites à la main finiraient par oublier l'un des deux chez l'un des trois (§118.5).
 */
export async function postesPourCloture(sponsoringId: string): Promise<PostePourCloture[]> {
  const postes = await prisma.adProItem.findMany({
    where: { sponsoringId },
    select: { id: true, label: true, status: true, kind: true, amountGranted: true, budgetCategoryId: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const lignes = await lignesStockParPoste(postes.filter((p) => p.kind === "STOCK_MATERIAL").map((p) => p.id));
  return postes.map((p) => ({
    label: p.label,
    status: p.status,
    kind: p.kind,
    amountGranted: p.amountGranted != null ? toNumber(p.amountGranted) : null,
    budgetCategoryId: p.budgetCategoryId,
    lignesStock: (lignes.get(p.id) ?? []).map((l) => ({ libelle: l.libelle, statut: l.statut })),
  }));
}

/** Le demandeur et la société d'une opération — ce que le matériel du stock en a besoin. */
async function auteurEtSociete(parent: AdProParent, parentId: string): Promise<{ requesterId: string | null; companyId: string | null } | null> {
  const select = { requesterId: true, companyId: true } as const;
  switch (parent) {
    case "SPONSORING": return prisma.sponsoringRequest.findUnique({ where: { id: parentId }, select });
    case "CONGRESS_NATIONAL": return prisma.congressNational.findUnique({ where: { id: parentId }, select });
    case "CONGRESS_INTERNATIONAL": return prisma.congressInternational.findUnique({ where: { id: parentId }, select });
    case "EVENT": return prisma.event.findUnique({ where: { id: parentId }, select });
  }
}

/**
 * CE QU'UN POSTE « MATÉRIEL DU STOCK » PEUT DEMANDER, ET QUI CONFIRME APRÈS (§118.167).
 *
 * Le MAGASIN de la société de l'opération — les articles qui se comptent, avec ce qui s'y distribue
 * aujourd'hui (lots non périmés) : c'est une INDICATION, l'accord du poste relit tout sous le verrou
 * de chaque article et refuse ce que le magasin n'a plus. Sans société lisible, le magasin des
 * articles sans société : on ne pioche pas dans celui d'une autre société.
 *
 * `decideLesPostes` vient de la page, qui le calcule déjà pour le panneau : le recalculer ici en
 * ferait une seconde règle de « qui décide des postes ».
 */
export async function contexteMaterielStock(
  user: SessionUser, parent: AdProParent, parentId: string, decideLesPostes: boolean, maintenant: Date = new Date(),
): Promise<ContexteMaterielStock> {
  const [op, gestionnaires] = await Promise.all([auteurEtSociete(parent, parentId), gestionnairesDuMagasin()]);
  const companyId = op?.companyId ?? null;
  const articles = await prisma.promoStockItem.findMany({
    where: { isActive: true, companyId },
    select: {
      id: true,
      catalogue: { select: { nom: true, famille: true, unite: true } },
      produits: { select: { product: { select: { canonicalName: true } } } },
    },
  });
  const quantifies = articles.filter((a) => familleQuantifiee(a.catalogue.famille as PromoFamille));
  const ids = quantifies.map((a) => a.id);
  const sommes = ids.length
    ? await prisma.promoStockMovement.groupBy({ by: ["itemId", "lotId"], where: { itemId: { in: ids }, holderId: null }, _sum: { delta: true } })
    : [];
  const positifs = sommes.filter((x) => num(x._sum.delta) > 0);
  const lots = positifs.length
    ? await prisma.promoStockLot.findMany({ where: { id: { in: positifs.map((x) => x.lotId) } }, select: { id: true, valableJusquau: true } })
    : [];
  const validite = new Map(lots.map((l) => [l.id, l.valableJusquau]));
  const distribuable = new Map<string, number>();
  for (const x of positifs) {
    // LA MÊME LECTURE QUE LA RÉSERVATION : un lot périmé ne se réserve pas (`allouer`).
    if (etatValidite(validite.get(x.lotId) ?? null, maintenant) === "PERIME") continue;
    distribuable.set(x.itemId, r3((distribuable.get(x.itemId) ?? 0) + num(x._sum.delta)));
  }
  const magasin = quantifies
    .map((a) => ({
      itemId: a.id,
      libelle: libelleArticleStock(a.catalogue.nom, a.produits.map((p) => p.product.canonicalName)),
      famille: a.catalogue.famille as PromoFamille,
      unite: a.catalogue.unite,
      distribuable: distribuable.get(a.id) ?? 0,
    }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  return {
    magasin,
    peutConfirmer: peutConfirmerMateriel({
      superAdmin: user.role === "SUPER_ADMIN",
      estLeDemandeur: op?.requesterId === user.id,
      gereLeMagasin: gestionnaires.includes(user.id),
      decideLesPostes,
    }),
  };
}
