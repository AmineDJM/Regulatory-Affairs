import { prisma } from "@/lib/prisma";
import { hasGlobalView, regulatoryLockWhere, userCan, type Action, type SessionUser } from "@/lib/rbac";
import { platformScope } from "@/lib/company";
import { cleReleve, consommationMoyenne, estCleReleve, type ProduitReconnaissable } from "@/lib/stocks/pch-central";
import { consommationHospitaliereMensuelle } from "@/lib/ventes-pch/requetes";
import { decalerMois } from "@/lib/ventes-pch/calculs";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE STOCK PCH CENTRAL ET LES STOCKS DE LA CHAÎNE — les lectures (Direction, 08/10).
 *
 * Nos produits = le catalogue des Business Units (`PromoProduct`) qui ont un dossier (`RegulatoryProduct`) : c'est
 * lui que vise un `StockSnapshot`. Le stock PCH central se saisit à la main (reçu par mail) ; les hôpitaux viennent des
 * demandes de stocks (DO → KAM), dont l'envoi écrit les mêmes états datés. Rien ici ne décide d'un droit autre que
 * « voit la chaîne » : la règle de `stocks/scopes.ts` (la chaîne d'approvisionnement, la vue globale, le Super Admin).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** La chaîne d'approvisionnement (PCH, annexes, vue par BU) : la même règle que l'écran des relevés. */
export function voitLaChaine(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN" || hasGlobalView(user) || userCan(user, "PCH", "VIEW");
}

/** Saisit le stock PCH : voit la chaîne ET écrit dans le module Stocks. */
export function saisitLeStockPch(user: SessionUser): boolean {
  return voitLaChaine(user) && (user.role === "SUPER_ADMIN" || userCan(user, "STOCKS", "CREATE") || userCan(user, "STOCKS", "UPDATE"));
}

/** La porte des pièces d'un relevé (le mail / le PDF de la PCH), identifié par sa date AAAA-MM-JJ. */
export async function accesAuReleveStockPch(user: SessionUser, cle: string, action: Action): Promise<boolean> {
  if (!estCleReleve(cle)) return false;
  if (!userCan(user, "STOCKS", "VIEW") && user.role !== "SUPER_ADMIN") return false;
  if (!voitLaChaine(user)) return false;
  if (action === "VIEW" || action === "EXPORT") return true;
  if (action === "DELETE") return user.role === "SUPER_ADMIN" || userCan(user, "STOCKS", "DELETE");
  return saisitLeStockPch(user) || userCan(user, "STOCKS", "UPLOAD");
}

export interface ProduitPch extends ProduitReconnaissable {
  label: string;
  buId: string | null;
  buNom: string;
}

/** Nos produits, par BU : un produit de BU avec son dossier. Un dossier porté par deux BU apparaît dans les deux. */
export async function chargerProduitsPch(user: SessionUser): Promise<ProduitPch[]> {
  const rows = await prisma.promoProduct.findMany({
    where: { isActive: true, regulatoryProductId: { not: null }, regulatoryProduct: regulatoryLockWhere(user) },
    select: {
      name: true, code: true, regulatoryProductId: true,
      businessUnit: { select: { id: true, name: true, sortOrder: true, isActive: true } },
      regulatoryProduct: { select: { brandName: true, dci: true, reference: true } },
    },
    orderBy: [{ businessUnit: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const vus = new Set<string>();
  const out: ProduitPch[] = [];
  for (const r of rows) {
    if (!r.regulatoryProductId) continue;
    const bu = r.businessUnit && r.businessUnit.isActive ? r.businessUnit : null;
    const cle = `${bu?.id ?? "-"}:${r.regulatoryProductId}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    const rp = r.regulatoryProduct;
    out.push({
      id: r.regulatoryProductId,
      label: r.name,
      buId: bu?.id ?? null,
      buNom: bu?.name ?? "Sans BU",
      noms: [r.name, r.code, rp?.brandName, rp?.dci, rp?.reference].filter((x): x is string => Boolean(x && x.trim())),
    });
  }
  return out;
}

export interface EtatPchDTO {
  id: string;
  productId: string;
  /** PCH = central ; ANNEX = une annexe / DR. */
  scope: string;
  annexId: string | null;
  date: string;
  quantity: number;
}

export interface RelevePchDTO {
  cle: string;
  lignes: number;
  pieces: { id: string; name: string }[];
}

/** L'historique du stock PCH (central et annexes) de nos produits, et les relevés (dates de mail) avec leurs pièces. */
export async function chargerHistoriquePch(user: SessionUser, productIds: string[]): Promise<{ etats: EtatPchDTO[]; releves: RelevePchDTO[] }> {
  if (productIds.length === 0) return { etats: [], releves: [] };
  const rows = await prisma.stockSnapshot.findMany({
    where: { AND: [await platformScope(user.id), { scope: { in: ["PCH", "ANNEX"] }, productId: { in: productIds } }] },
    orderBy: { date: "desc" },
    take: 3000,
    select: { id: true, productId: true, scope: true, annexId: true, date: true, quantity: true },
  });
  const etats = rows.map((r) => ({ id: r.id, productId: r.productId, scope: r.scope, annexId: r.annexId, date: r.date.toISOString(), quantity: r.quantity }));
  const parCle = new Map<string, number>();
  for (const e of etats) parCle.set(cleReleve(e.date), (parCle.get(cleReleve(e.date)) ?? 0) + 1);
  const cles = [...parCle.keys()].sort().reverse().slice(0, 60);
  const docs = cles.length
    ? await prisma.document.findMany({
        where: { entityType: "STOCK_PCH_RELEVE", entityId: { in: cles } },
        select: { id: true, name: true, entityId: true }, orderBy: { createdAt: "asc" },
      })
    : [];
  // Une pièce déposée pour une date SANS quantité (le mail d'abord, la saisie ensuite) reste visible.
  const docsSeuls = await prisma.document.findMany({
    where: { entityType: "STOCK_PCH_RELEVE", entityId: { notIn: cles } },
    select: { id: true, name: true, entityId: true }, orderBy: { createdAt: "desc" }, take: 30,
  });
  const toutes = [...new Set([...cles, ...docsSeuls.map((d) => d.entityId)])].sort().reverse();
  const releves = toutes.map((cle) => ({
    cle,
    lignes: parCle.get(cle) ?? 0,
    pieces: [...docs, ...docsSeuls].filter((d) => d.entityId === cle).map((d) => ({ id: d.id, name: d.name })),
  }));
  return { etats, releves };
}

// ── LES STOCKS DE LA CHAÎNE ────────────────────────────────────────────────────────────────────

export interface NiveauDate { quantite: number; date: string }

export interface LigneChaine {
  productId: string;
  label: string;
  buId: string | null;
  buNom: string;
  /** Notre stock — `null` tant qu'aucun stock initial n'est posé (aucune donnée de stock propre). */
  adventum: NiveauDate | null;
  pch: NiveauDate | null;
  /** La somme des derniers relevés de chaque hôpital ; `date` = le plus ancien de ces derniers relevés. */
  hopitaux: (NiveauDate & { nb: number; ruptures: number; plusRecent: string }) | null;
}

export async function chargerChaine(user: SessionUser, produits: ProduitPch[]): Promise<LigneChaine[]> {
  const ids = [...new Set(produits.map((p) => p.id))];
  if (ids.length === 0) return [];
  const portee = await platformScope(user.id);
  const [pch, hop, ouvertures] = await Promise.all([
    prisma.stockSnapshot.findMany({
      where: { AND: [portee, { scope: "PCH", annexId: null, productId: { in: ids } }] },
      orderBy: { date: "desc" }, distinct: ["productId"],
      select: { productId: true, quantity: true, date: true },
    }),
    prisma.stockSnapshot.findMany({
      where: { AND: [portee, { scope: "HOSPITAL", productId: { in: ids } }] },
      orderBy: { date: "desc" }, distinct: ["productId", "annexId"],
      select: { productId: true, annexId: true, quantity: true, date: true },
    }),
    prisma.stockOpeningLevel.findMany({
      where: { productId: { in: ids } }, orderBy: { date: "desc" }, distinct: ["productId"],
      select: { productId: true, quantity: true, date: true },
    }),
  ]);
  // NOTRE STOCK = stock initial + entrées − sorties (± ajustements) depuis ce stock initial. Sans stock initial, les
  // seules sorties (livraisons PCH) donneraient un chiffre négatif qui ne dit rien : la case reste « — ».
  const avecOuverture = ouvertures.filter((o): o is typeof o & { productId: string } => Boolean(o.productId));
  const mouvements = avecOuverture.length
    ? await prisma.stockMovement.findMany({
        where: { productId: { in: avecOuverture.map((o) => o.productId) } },
        select: { productId: true, direction: true, quantity: true, date: true },
      })
    : [];
  const adventum = new Map<string, NiveauDate>();
  for (const o of avecOuverture) {
    let q = o.quantity;
    let derniere = o.date;
    for (const m of mouvements) {
      if (m.productId !== o.productId || m.date < o.date) continue;
      q += m.direction === "OUT" ? -m.quantity : m.quantity;
      if (m.date > derniere) derniere = m.date;
    }
    adventum.set(o.productId, { quantite: q, date: derniere.toISOString() });
  }
  const pchPar = new Map(pch.map((s) => [s.productId, { quantite: s.quantity, date: s.date.toISOString() }]));
  const hopPar = new Map<string, NonNullable<LigneChaine["hopitaux"]>>();
  for (const s of hop) {
    const d = s.date.toISOString();
    const h = hopPar.get(s.productId);
    if (!h) hopPar.set(s.productId, { quantite: s.quantity, date: d, plusRecent: d, nb: 1, ruptures: s.quantity === 0 ? 1 : 0 });
    else {
      h.quantite += s.quantity;
      h.nb += 1;
      if (s.quantity === 0) h.ruptures += 1;
      if (d < h.date) h.date = d;
      if (d > h.plusRecent) h.plusRecent = d;
    }
  }
  return produits.map((p) => ({
    productId: p.id, label: p.label, buId: p.buId, buNom: p.buNom,
    adventum: adventum.get(p.id) ?? null,
    pch: pchPar.get(p.id) ?? null,
    hopitaux: hopPar.get(p.id) ?? null,
  }));
}

// ── LA CONSOMMATION (Ventes PCH) ───────────────────────────────────────────────────────────────

/**
 * DOSSIER → PRODUIT CANONIQUE. Un `StockSnapshot` vise un dossier (`RegulatoryProduct`) ; les ventes PCH visent le
 * produit canonique (`Product`). Le lien du dossier d'abord, à défaut celui d'un produit de BU qui porte ce dossier.
 */
export async function canoniquesDesDossiers(dossierIds: readonly string[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(dossierIds)];
  if (ids.length === 0) return new Map();
  const rows = await prisma.regulatoryProduct.findMany({
    where: { id: { in: ids } },
    select: { id: true, productId: true, promoProducts: { where: { productId: { not: null } }, select: { productId: true }, take: 1 } },
  });
  const out = new Map<string, string | null>(ids.map((id) => [id, null]));
  for (const r of rows) out.set(r.id, r.productId ?? r.promoProducts[0]?.productId ?? null);
  return out;
}

/**
 * LA CONSOMMATION MENSUELLE de chaque dossier (boîtes / mois) : la moyenne des 3 derniers mois complets distribués aux
 * hôpitaux par les DR (`consommationHospitaliereMensuelle`, 12 mois de recul au plus). `null` = aucune donnée — jamais 0.
 */
export async function chargerConsommationMensuelle(dossierIds: readonly string[], maintenant: Date = new Date()): Promise<Map<string, number | null>> {
  const canon = await canoniquesDesDossiers(dossierIds);
  const courant = maintenant.toISOString().slice(0, 7);
  const bornes = { debut: decalerMois(courant, -12), fin: decalerMois(courant, -1) };
  const produits = [...new Set([...canon.values()].filter((x): x is string => Boolean(x)))];
  const series = new Map(await Promise.all(produits.map(async (p) => [p, await consommationHospitaliereMensuelle(p, bornes)] as const)));
  return new Map([...canon.entries()].map(([dossier, p]) => [dossier, p ? consommationMoyenne(series.get(p) ?? [], courant) : null]));
}
