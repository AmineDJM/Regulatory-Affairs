import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { userCan, hasGlobalView, regulatoryLockWhere, type SessionUser } from "@/lib/rbac";
import { STATUTS_REGULATORY_TERMINES } from "@/lib/products/termines";
import { dernierMoisPch, indicateursProduitsPch, type Bornes, type IndicateursProduitPch } from "@/lib/ventes-pch/requetes";
import { decalerMois, nonServiSignificatif } from "@/lib/ventes-pch/calculs";
import { consommationMoyenne } from "@/lib/stocks/pch-central";
import { sections360, voitLeMarche } from "@/lib/vues-360-acces";
import { clauseCasPvVisibles, voitTousLesCasPv } from "@/lib/pharmacovigilance/acces";
import { chargerPorteeStock, clauseRelevesDePortee } from "@/lib/queries/stock-portee";
import { keepVisibleSnapshots, STOCK_SCOPE_LABEL, type StockScope } from "@/lib/stocks/scopes";
import { platformScope } from "@/lib/company";
import { regulatoryVisibleWhere } from "@/lib/queries/regulatory-rows";
import { marcheDuProduit, type MarcheDuProduit } from "@/lib/market/produit-marche";
import { PHARMA_FORM, DOSAGE_UNIT } from "@/lib/labels";
import { manquesIdentite } from "@/lib/products/identity";
import { titreACompleter } from "@/lib/products/produit-du-dossier";
import { toNumber } from "@/lib/utils";
import {
  etapeCycle, stockActuel, moisDeCouverture, ecoulementMensuel, cleMois,
  echeanceDecision, signalPrincipal, resoudrePrix, TYPES_PRIX, SEUIL_STOCK_BAS_MOIS,
  type EtapeCycle, type Signal, type PrixResolu, type TypePrix,
} from "@/lib/products/fiche-360";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PRODUITS 360 — LE catalogue (Direction, 07/10 : « Produit = dossier réglementaire ; je ne veux
 * pas que les produits et les dossiers réglementaires soient deux catalogues différents »).
 *
 * ── UN CATALOGUE, DES TABLES INTERNES ────────────────────────────────────────────────────
 *
 * L'écran ne montre QU'UN objet : le produit (`Product`), né de son dossier — un pour un, chaque dossier
 * non verrouillé en a un d'office (`products/canonique.ts`, `ensureProduitDuDossier`). Ses dossiers
 * (`RegulatoryProduct.productId`) en sont l'enregistrement — et portent le STOCK, dont les relevés
 * sont indexés sur le dossier : le stock d'un produit est donc la somme des stocks de ses dossiers.
 * Les profils BU (`PromoProduct`) et BD (`BdProduct`) restent des tables internes, rattachées au
 * même `productId`. Rien n'est recopié : on lit par la clé.
 *
 * ── QUI VOIT QUOI ────────────────────────────────────────────────────────────────────────
 *
 * Un produit se voit par un dossier NON VERROUILLÉ (le verrou du pipeline reste la seule
 * confidentialité, `regulatoryLockWhere`) ; chaque colonne, chaque onglet suit SON module :
 * ventes et part de marché (Ventes PCH : nos réceptions à la PCH, seul client d'Adventum), stock
 * (STOCKS, sa portée de relevés), marché IQVIA (Market Intelligence ou Explorateur),
 * pharmacovigilance (ses cas), réglementaire (REGULATORY).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const TERMINES = [...STATUTS_REGULATORY_TERMINES];
const num = (v: unknown): number => (v === null || v === undefined ? 0 : toNumber(v as never));
const ymd = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

export type OngletListe = "commercialises" | "enregistrement";

/** Le produit a un dossier terminé que la personne peut voir — la clause de l'onglet « Commercialisés ». */
export function clauseCommercialises(user: SessionUser | null): Prisma.ProductWhereInput {
  return { regulatoryProfiles: { some: { status: { in: TERMINES }, ...regulatoryLockWhere(user) } } };
}

/** Le pipeline : un dossier en cours visible, et AUCUN dossier terminé. */
export function clauseEnEnregistrement(user: SessionUser | null): Prisma.ProductWhereInput {
  return {
    AND: [
      { regulatoryProfiles: { some: { status: { notIn: TERMINES }, ...regulatoryLockWhere(user) } } },
      { NOT: { regulatoryProfiles: { some: { status: { in: TERMINES } } } } },
    ],
  };
}

/** Le produit est-il au catalogue de cette personne (un dossier non verrouillé, ou Super Admin) ? */
export function clauseProduitAuCatalogue(user: SessionUser): Prisma.ProductWhereInput {
  if (user.role === "SUPER_ADMIN") return {};
  return { regulatoryProfiles: { some: regulatoryLockWhere(user) } };
}

function clauseRecherche(q: string): Prisma.ProductWhereInput {
  if (!q) return {};
  const c = { contains: q, mode: "insensitive" as const };
  // Le dossier EST le produit (Direction, 08/10) : sa référence (REG-AAAA-NNN) et sa DCI le retrouvent aussi.
  return {
    OR: [
      { canonicalName: c }, { dci: c }, { code: c }, { aliases: { some: { label: c } } },
      { regulatoryProfiles: { some: { OR: [{ brandName: c }, { reference: c }, { dci: c }] } } },
    ],
  };
}

/** « 400 mg » — le dosage écrit comme on le dit. */
export function texteDosage(p: { dosage: string | null; dosageUnit: string | null }): string | null {
  const u = p.dosageUnit ? DOSAGE_UNIT[p.dosageUnit] ?? p.dosageUnit : "";
  return [p.dosage?.trim(), u].filter(Boolean).join(" ") || null;
}
export function texteForme(form: string | null): string | null {
  return form ? PHARMA_FORM[form] ?? form : null;
}

/** La date de la décision d'enregistrement — l'étape « décision » du suivi ANPP, quand elle est datée. */
function dateDecision(workflow: unknown): Date | null {
  const w = (workflow ?? {}) as Record<string, { date?: string } | undefined>;
  const brut = w.decision?.date;
  if (!brut) return null;
  const d = new Date(brut);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─────────────────────────── Faits partagés (liste et fiche) ───────────────────────────

/**
 * LES 12 MOIS PCH — ceux qui finissent sur le DERNIER MOIS REÇU (les fichiers de la PCH arrivent après coup : un mois
 * pas encore reçu ne se lit pas comme une vente nulle), à défaut le mois en cours.
 */
async function douzeMoisPch(maintenant: Date): Promise<Bornes> {
  const fin = (await dernierMoisPch()) ?? cleMois(maintenant);
  return { debut: decalerMois(fin, -11), fin };
}

export type SourceEcoulement = "PCH" | "VENTES" | "CONSOMMATION";

/**
 * L'ÉCOULEMENT MENSUEL de chaque produit — ce qui sort, pour diviser le stock. D'abord la distribution aux hôpitaux par
 * les DR de la PCH (moyenne des 3 derniers mois complets reçus, la règle de la chaîne `stocks/pch-central.ts`) ; à
 * défaut les ventes saisies (toutes : c'est une mesure du flux, seul le nombre de mois s'affiche), sinon la
 * consommation hospitalière comptée en BOÎTES (une consommation en unités ne se compare pas à un stock en boîtes).
 */
async function ecoulements(productIds: string[], maintenant: Date, pch?: Map<string, IndicateursProduitPch> | null): Promise<Map<string, { parMois: number; source: SourceEcoulement }>> {
  const out = new Map<string, { parMois: number; source: SourceEcoulement }>();
  for (const [id, x] of pch ?? []) {
    const c = consommationMoyenne(x.sellOutLignes, cleMois(maintenant));
    if (c !== null && c > 0) out.set(id, { parMois: c, source: "PCH" });
  }
  const reste = productIds.filter((id) => !out.has(id));
  if (!reste.length) return out;
  const debut = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 11, 1));
  const [ventes, conso] = await Promise.all([
    prisma.sale.findMany({ where: { productId: { in: reste }, date: { gte: debut } }, select: { productId: true, date: true, quantity: true } }),
    prisma.consommationLigne.findMany({
      where: { productId: { in: reste }, statut: "OK", unite: "BOITE", import: { statut: "VALIDE" }, periodeDebut: { gte: debut } },
      select: { productId: true, periodeDebut: true, quantite: true },
    }),
  ]);
  const unitesVendues = new Map<string, number>();
  for (const v of ventes) if (v.productId) unitesVendues.set(v.productId, (unitesVendues.get(v.productId) ?? 0) + v.quantity);
  for (const [id, u] of unitesVendues) if (u > 0) out.set(id, { parMois: u / 12, source: "VENTES" });
  const parProduit = new Map<string, { quantite: number; mois: string }[]>();
  for (const c of conso) {
    if (!c.productId || !c.periodeDebut || out.has(c.productId)) continue;
    (parProduit.get(c.productId) ?? parProduit.set(c.productId, []).get(c.productId)!).push({ quantite: num(c.quantite), mois: cleMois(c.periodeDebut) });
  }
  for (const [id, lignes] of parProduit) {
    const e = ecoulementMensuel(lignes);
    if (e !== null) out.set(id, { parMois: e, source: "CONSOMMATION" });
  }
  return out;
}

/** Les relevés de stock des dossiers, dans la portée de stock de la personne (la règle de l'écran Stocks). */
async function relevesDeStock(user: SessionUser, dossierIds: string[]) {
  if (!dossierIds.length) return [];
  const portee = await chargerPorteeStock(user);
  const releves = await prisma.stockSnapshot.findMany({
    where: { AND: [await platformScope(user.id), clauseRelevesDePortee(portee), { productId: { in: dossierIds } }] },
    orderBy: { date: "desc" }, take: 5000,
    select: { id: true, productId: true, scope: true, annexId: true, date: true, quantity: true, annex: { select: { name: true, institution: { select: { name: true } } } } },
  });
  const viewer = { canSeeSupplyChain: userCan(user, "PCH", "VIEW"), hasGlobalView: hasGlobalView(user) };
  return keepVisibleSnapshots(viewer, releves);
}

/** Les cas de pharmacovigilance OUVERTS que la personne lit, par produit canonique (directement ou par son produit de BU). */
async function casPvOuverts(user: SessionUser, productIds: string[]) {
  const promos = await prisma.promoProduct.findMany({ where: { productId: { in: productIds } }, select: { id: true, productId: true } });
  const promoVersProduit = new Map(promos.map((p) => [p.id, p.productId!]));
  const cas = await prisma.pharmacovigilanceCase.findMany({
    where: { AND: [clauseCasPvVisibles(user), { OR: [{ productId: { in: productIds } }, { promoProductId: { in: [...promoVersProduit.keys()] } }] }] },
    select: { id: true, reference: true, status: true, severity: true, occurredOn: true, productId: true, promoProductId: true },
    orderBy: { occurredOn: "desc" }, take: 500,
  });
  return cas.map((c) => ({ ...c, produit: c.productId ?? (c.promoProductId ? promoVersProduit.get(c.promoProductId) ?? null : null) }));
}

/** Ce que le marché dit du produit — nos noms (dossier, alias) et nos laboratoires (société, partenaire, détenteur de la DE). */
function marcheDe(p: {
  dci: string; dosage: string | null; dosageUnit: string | null; form: string | null;
  company: { name: string; shortName: string | null } | null; aliases: { label: string }[];
  regulatoryProfiles: { brandName: string | null; partnerLab: string | null; deHolder: string | null; company?: { name: string; shortName: string | null } | null }[];
}, maintenant: Date): MarcheDuProduit | null {
  try {
    return marcheDuProduit({
      dci: p.dci, dosage: texteDosage(p), forme: texteForme(p.form),
      marques: [...p.aliases.map((a) => a.label), ...p.regulatoryProfiles.map((r) => r.brandName ?? "")].filter(Boolean),
      labos: [p.company?.name, p.company?.shortName, ...p.regulatoryProfiles.flatMap((r) => [r.partnerLab, r.deHolder, r.company?.name, r.company?.shortName])].filter((x): x is string => !!x),
    }, maintenant);
  } catch {
    // Les jeux de marché absents (environnement sans données) ne cassent pas le catalogue : la colonne reste vide.
    return null;
  }
}

// ─────────────────────────── La liste ───────────────────────────

export interface LigneProduit360 {
  id: string;
  code: string;
  nom: string;
  /** « cp pelliculé · PRD-2026-012 » */
  sousTitre: string;
  bu: string | null;
  etape: EtapeCycle;
  /** Onglet « En enregistrement » : le dossier le plus avancé et sa cible. */
  dossier: { statut: string; cible: string | null; reference: string } | null;
  /** Nos réceptions PCH sur 12 mois : valeur au coût PCH (DZD) et boîtes. */
  ventes12m: number | null;
  ventes12mBoites: number | null;
  /** Nos réceptions PCH, mois par mois (boîtes). */
  tendance: number[] | null;
  partPct: number | null;
  couvertureMois: number | null;
  stockUnites: number | null;
  signal: Signal | null;
}

export interface ListeProduits360 {
  lignes: LigneProduit360[];
  compte: { commercialises: number; enregistrement: number };
  colonnes: { ventes: boolean; marche: boolean; stock: boolean };
  /** Les 12 mois PCH lus (fin = dernier mois reçu). */
  periodePch: Bornes | null;
}

const ORDRE_STATUT: Record<string, number> = {
  PRE_SUBMISSION: 0, IN_PREPARATION: 1, SUBMITTED: 2, AWAITING_BV_PAYMENT: 3, AWAITING_ANPP: 4, RESPONDING_TO_QUERIES: 5, BLOCKED: 1, DECISION_OBTAINED: 9, CLOSED: 9,
};

export async function listeProduits360(user: SessionUser, opts: { q?: string; onglet: OngletListe; maintenant?: Date }): Promise<ListeProduits360> {
  const maintenant = opts.maintenant ?? new Date();
  const q = (opts.q ?? "").trim();
  const voit = sections360(user);
  const marche = voitLeMarche(user);
  const lock = regulatoryLockWhere(user);
  const clauseOnglet = opts.onglet === "commercialises" ? clauseCommercialises(user) : clauseEnEnregistrement(user);

  const [commercialises, enregistrement, produits] = await Promise.all([
    prisma.product.count({ where: clauseCommercialises(user) }),
    prisma.product.count({ where: clauseEnEnregistrement(user) }),
    prisma.product.findMany({
      where: { AND: [clauseOnglet, clauseRecherche(q)] },
      orderBy: [{ isActive: "desc" }, { canonicalName: "asc" }],
      take: 200,
      select: {
        id: true, code: true, canonicalName: true, dci: true, dosage: true, dosageUnit: true, form: true, lifecycle: true, isActive: true,
        company: { select: { name: true, shortName: true } },
        aliases: { select: { label: true }, take: 20 },
        promoProfiles: { select: { businessUnit: { select: { name: true } } } },
        regulatoryProfiles: {
          where: lock,
          select: { id: true, reference: true, status: true, targetDate: true, brandName: true, partnerLab: true, deHolder: true, workflow: true, company: { select: { name: true, shortName: true } } },
        },
      },
    }),
  ]);

  const ids = produits.map((p) => p.id);
  const commerce = opts.onglet === "commercialises";
  const dossierVersProduit = new Map(produits.flatMap((p) => p.regulatoryProfiles.map((r) => [r.id, p.id] as const)));

  // Ventes PCH : lues pour la colonne Ventes (droit Ventes PCH) ET pour l'écoulement qui divise le stock (droit Stocks).
  const periodePch = commerce && ids.length && (voit.ventesPch || voit.stock) ? await douzeMoisPch(maintenant) : null;
  const [pch, releves, pv] = await Promise.all([
    periodePch ? indicateursProduitsPch(ids, periodePch).then((r) => r.parProduit) : Promise.resolve(null),
    commerce && voit.stock ? relevesDeStock(user, [...dossierVersProduit.keys()]) : Promise.resolve(null),
    commerce && voit.pharmacovigilance && ids.length ? casPvOuverts(user, ids) : Promise.resolve(null),
  ]);
  const flux = commerce && voit.stock && ids.length ? await ecoulements(ids, maintenant, pch) : null;
  const ventesPch = voit.ventesPch ? pch : null;

  const lignes: LigneProduit360[] = produits.map((p) => {
    const statuts = p.regulatoryProfiles.map((r) => r.status as string);
    const forme = texteForme(p.form);
    const bus = [...new Set(p.promoProfiles.map((x) => x.businessUnit?.name).filter((x): x is string => !!x))];
    const base = {
      id: p.id, code: p.code, nom: p.canonicalName,
      sousTitre: [forme?.toLowerCase(), p.code].filter(Boolean).join(" · "),
      bu: bus.join(", ") || null,
      etape: etapeCycle({ lifecycle: p.lifecycle, isActive: p.isActive, statutsDossiers: statuts }),
    };
    if (!commerce) {
      const d = [...p.regulatoryProfiles].sort((a, b) => (ORDRE_STATUT[b.status] ?? 0) - (ORDRE_STATUT[a.status] ?? 0))[0];
      return { ...base, dossier: d ? { statut: d.status, cible: ymd(d.targetDate), reference: d.reference } : null, ventes12m: null, ventes12mBoites: null, tendance: null, partPct: null, couvertureMois: null, stockUnites: null, signal: null };
    }

    const v = ventesPch?.get(p.id) ?? null;

    let couvertureMois: number | null = null; let stockUnites: number | null = null;
    if (releves) {
      const miens = releves.filter((r) => dossierVersProduit.get(r.productId) === p.id);
      if (miens.length) {
        stockUnites = stockActuel(miens).unites;
        couvertureMois = moisDeCouverture(stockUnites, flux?.get(p.id)?.parMois ?? null);
      }
    }

    const m = marche ? marcheDe(p, maintenant) : null;
    const decision = voit.reglementaire
      ? p.regulatoryProfiles.filter((r) => r.status === "DECISION_OBTAINED").map((r) => echeanceDecision(dateDecision(r.workflow), maintenant)).filter((e): e is NonNullable<typeof e> => !!e)
        .sort((a, b) => a.joursAvantDepot - b.joursAvantDepot)[0] ?? null
      : null;

    const signal = signalPrincipal({
      pvOuverts: pv ? pv.filter((c) => c.produit === p.id && c.status !== "CLOS").length : undefined,
      couvertureMois: releves ? couvertureMois : undefined,
      nonServiSignificatif: v ? nonServiSignificatif(v.recent) : undefined,
      generiquesRecents: m ? m.generiquesRecents.length : undefined,
      joursAvantDepotDe: decision ? decision.joursAvantDepot : undefined,
    });

    return {
      ...base, dossier: null,
      ventes12m: v ? v.recuValeur : null, ventes12mBoites: v ? v.recuNous : null, tendance: v ? v.sellIn : null, partPct: v?.partPct ?? null,
      couvertureMois, stockUnites, signal,
    };
  });

  return {
    lignes,
    compte: { commercialises, enregistrement },
    // Ventes, tendance et part de marché viennent de Ventes PCH : ces colonnes suivent son droit de lecture.
    colonnes: { ventes: voit.ventesPch, marche: voit.ventesPch, stock: voit.stock },
    periodePch: voit.ventesPch ? periodePch : null,
  };
}

// ─────────────────────────── La fiche ───────────────────────────

export interface ASurveiller { ton: "danger" | "warning" | "info"; titre: string; detail: string; href: string | null }

export interface Fiche360 {
  identite: {
    id: string; code: string; nom: string; dci: string; dosage: string | null; forme: string | null; conditionnement: string | null;
    societe: string | null; etape: EtapeCycle; lifecycle: string; isActive: boolean; alias: string[];
  };
  bus: { id: string; nom: string }[];
  dossiers: {
    id: string; reference: string; nomCommercial: string | null; statut: string; detenteurDe: string | null; laboPartenaire: string | null;
    classeTherapeutique: string | null; fabricant: string | null; statutFabrication: string; dateDecision: string | null;
    echeance: { expiration: string; depotAvant: string; joursAvantDepot: number } | null; cibleEnregistrement: string | null;
    variations: { id: string; vers: string; statut: string; depot: string | null; decision: string | null }[];
    demandesInfoMed: { id: string; reference: string; sujet: string; statut: string }[];
  }[];
  /** Dossiers du produit que la personne ne voit pas : comptés, jamais nommés. */
  dossiersMasques: number;
  /** Ventes PCH sur les 12 mois qui finissent au dernier mois reçu — `null` sans le droit Ventes PCH. */
  ventes: (IndicateursProduitPch & { periode: Bornes; mois: string[]; nonServiSignificatif: boolean }) | null;
  stock: {
    unites: number; date: string | null; lieux: number; couvertureMois: number | null; ecoulementMensuel: number | null;
    sourceEcoulement: SourceEcoulement | null;
    releves: { id: string; date: string; lieu: string; portee: string; quantite: number }[];
  } | null;
  pv: { id: string; reference: string; statut: string; gravite: string | null; survenu: string; href: string }[] | null;
  marche: MarcheDuProduit | null;
  voitMarche: boolean;
  prix: PrixResolu[];
  historiquePrix: { id: string; type: TypePrix; montant: number | null; depuis: string; note: string | null; auteur: string | null; creeLe: string }[];
  messages: { id: string; titre: string; actif: boolean }[] | null;
  materiel: { id: string; nom: string; actif: boolean }[] | null;
  aSurveiller: ASurveiller[];
}

/** La fiche d'UN produit — `null` quand il n'existe pas OU qu'il n'est pas au catalogue de la personne. */
export async function fiche360(user: SessionUser, productId: string, maintenant = new Date()): Promise<Fiche360 | null> {
  const voit = sections360(user);
  const marcheVisible = voitLeMarche(user);
  const p = await prisma.product.findFirst({
    where: { AND: [{ id: productId }, clauseProduitAuCatalogue(user)] },
    select: {
      id: true, code: true, canonicalName: true, dci: true, dosage: true, dosageUnit: true, form: true, packaging: true,
      lifecycle: true, isActive: true,
      company: { select: { name: true, shortName: true } },
      aliases: { select: { label: true }, orderBy: { label: "asc" } },
      promoProfiles: { select: { businessUnit: { select: { id: true, name: true } } } },
      regulatoryProfiles: { select: { id: true, status: true, isLocked: true, brandName: true, partnerLab: true, deHolder: true, company: { select: { name: true, shortName: true } } } },
    },
  });
  if (!p) return null;

  const lock = regulatoryLockWhere(user);
  const dossiersNonVerrouilles = p.regulatoryProfiles.filter((r) => !("isLocked" in lock) || !r.isLocked);
  const dossierIds = dossiersNonVerrouilles.map((r) => r.id);

  const periodePch = voit.ventesPch || voit.stock ? await douzeMoisPch(maintenant) : null;
  const [visibles, pch, releves, pv, saisies, messages, materiel] = await Promise.all([
    voit.reglementaire
      ? prisma.regulatoryProduct.findMany({
          where: { AND: [await regulatoryVisibleWhere(user), { productId: p.id }] },
          orderBy: { reference: "asc" },
          select: {
            id: true, reference: true, brandName: true, status: true, deHolder: true, partnerLab: true, therapeuticClass: true,
            manufacturer: true, manufacturingStatus: true, workflow: true, targetDate: true,
            dci: true, dosage: true, dosageUnit: true, pharmaceuticalForm: true, packaging: true,
            variations: { select: { id: true, toStatus: true, status: true, depotDate: true, decisionDate: true }, orderBy: { createdAt: "desc" } },
            regRequests: { select: { id: true, reference: true, subject: true, status: true }, orderBy: { createdAt: "desc" }, take: 10 },
          },
        })
      : Promise.resolve([]),
    periodePch ? indicateursProduitsPch([p.id], periodePch) : Promise.resolve(null),
    voit.stock ? relevesDeStock(user, dossierIds) : Promise.resolve(null),
    voit.pharmacovigilance ? casPvOuverts(user, [p.id]) : Promise.resolve(null),
    prisma.productPrice.findMany({ where: { productId: p.id }, orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }], take: 100 }),
    voit.forceDeVente || voit.marketing
      ? prisma.promoMessage.findMany({ where: { productId: p.id }, select: { id: true, title: true, isActive: true }, orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }], take: 30 })
      : Promise.resolve(null),
    voit.materiel
      ? prisma.promoStockItem.findMany({ where: { produits: { some: { productId: p.id } } }, select: { id: true, name: true, isActive: true }, orderBy: [{ isActive: "desc" }, { name: "asc" }], take: 30 })
      : Promise.resolve(null),
  ]);

  // ── Ventes PCH : nos réceptions (sell-in) et la distribution aux hôpitaux (sell-out), 12 mois contre les 12 d'avant ──
  const indicateurs = pch?.parProduit.get(p.id) ?? null;
  const flux = voit.stock ? await ecoulements([p.id], maintenant, pch?.parProduit) : null;
  const blocVentes: Fiche360["ventes"] = voit.ventesPch && indicateurs && periodePch && pch
    ? { ...indicateurs, periode: periodePch, mois: pch.mois, nonServiSignificatif: nonServiSignificatif(indicateurs.recent) }
    : null;

  // ── Stock : dernier relevé de chaque lieu, couverture ──
  let blocStock: Fiche360["stock"] = null;
  if (releves) {
    const s = stockActuel(releves);
    const e = flux?.get(p.id) ?? null;
    blocStock = {
      unites: s.unites, date: ymd(s.date), lieux: s.lieux,
      couvertureMois: releves.length ? moisDeCouverture(s.unites, e?.parMois ?? null) : null,
      ecoulementMensuel: e ? Math.round(e.parMois) : null, sourceEcoulement: e?.source ?? null,
      releves: releves.slice(0, 30).map((r) => ({
        id: r.id, date: r.date.toISOString().slice(0, 10),
        lieu: r.annex?.institution?.name ?? r.annex?.name ?? "PCH",
        portee: STOCK_SCOPE_LABEL[r.scope as StockScope] ?? r.scope, quantite: r.quantity,
      })),
    };
  }

  // ── Marché et prix ──
  const marche = marcheVisible ? marcheDe({ ...p, regulatoryProfiles: dossiersNonVerrouilles }, maintenant) : null;
  const periodeMarche = marche ? `${marche.source.periode} · ${marche.source.fichier}` : null;
  const explorateur: Record<TypePrix, { montant: number | null; source: string | null; date: Date | null }> = {
    PPA: { montant: marche?.prix.ville.notre ?? null, source: periodeMarche ? `Explorateur · IQVIA ville (${periodeMarche})` : null, date: null },
    PRIX_HOPITAL: { montant: marche?.prix.hopital.notre ?? null, source: "Explorateur · réceptions PCH", date: marche?.prix.hopital.date ? new Date(marche.prix.hopital.date) : null },
    SHP: { montant: null, source: null, date: null },
    TARIF_REFERENCE: { montant: null, source: null, date: null },
  };
  const auteurs = new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(saisies.map((s) => s.setById).filter((x): x is string => !!x))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const saisiesTypees = saisies.filter((s) => (TYPES_PRIX as readonly string[]).includes(s.kind));
  const prix = TYPES_PRIX.map((t) => resoudrePrix(t, saisiesTypees.filter((s) => s.kind === t).map((s) => ({
    montant: s.amountDzd === null ? null : num(s.amountDzd), depuis: s.validFrom, creeLe: s.createdAt,
    auteur: s.setById ? auteurs.get(s.setById) ?? null : null, note: s.note,
  })), explorateur[t], maintenant));

  // ── Dossiers ──
  const dossiers: Fiche360["dossiers"] = visibles.map((d) => {
    const dd = dateDecision(d.workflow);
    const e = d.status === "DECISION_OBTAINED" ? echeanceDecision(dd, maintenant) : null;
    return {
      id: d.id, reference: d.reference, nomCommercial: d.brandName, statut: d.status, detenteurDe: d.deHolder, laboPartenaire: d.partnerLab,
      classeTherapeutique: d.therapeuticClass, fabricant: d.manufacturer, statutFabrication: d.manufacturingStatus,
      dateDecision: ymd(dd), cibleEnregistrement: ymd(d.targetDate),
      echeance: e ? { expiration: ymd(e.expiration)!, depotAvant: ymd(e.depotAvant)!, joursAvantDepot: e.joursAvantDepot } : null,
      variations: d.variations.map((v) => ({ id: v.id, vers: v.toStatus, statut: v.status, depot: ymd(v.depotDate), decision: ymd(v.decisionDate) })),
      demandesInfoMed: d.regRequests.map((r) => ({ id: r.id, reference: r.reference, sujet: r.subject, statut: r.status })),
    };
  });

  // ── Pharmacovigilance ──
  const tousLesCas = voitTousLesCasPv(user);
  const blocPv: Fiche360["pv"] = pv ? pv.map((c) => ({
    id: c.id, reference: c.reference, statut: c.status, gravite: c.severity, survenu: c.occurredOn.toISOString().slice(0, 10),
    href: tousLesCas ? `/regulatory/pharmacovigilance/${c.id}` : `/medical/rapports/pharmacovigilance/${c.id}`,
  })) : null;

  // ── À surveiller ──
  const aSurveiller: ASurveiller[] = [];
  const ouverts = (blocPv ?? []).filter((c) => c.statut !== "CLOS");
  if (ouverts.length) {
    aSurveiller.push({
      ton: "danger", titre: ouverts.length === 1 ? "1 cas de pharmacovigilance ouvert" : `${ouverts.length} cas de pharmacovigilance ouverts`,
      detail: ouverts.slice(0, 3).map((c) => c.reference).join(" · "), href: ouverts[0].href,
    });
  }
  if (blocStock?.couvertureMois !== null && blocStock?.couvertureMois !== undefined && blocStock.couvertureMois < SEUIL_STOCK_BAS_MOIS) {
    aSurveiller.push({ ton: "warning", titre: "Stock bas", detail: `${String(blocStock.couvertureMois).replace(".", ",")} mois · ${blocStock.unites.toLocaleString("fr-FR")} boîtes`, href: "?onglet=stock" });
  }
  if (blocVentes?.nonServiSignificatif) {
    const r = blocVentes.recent;
    aSurveiller.push({
      ton: "warning", titre: "Demande non servie",
      detail: `${r.nonServi.toLocaleString("fr-FR")} boîtes · ${r.etablissements} établissement${r.etablissements > 1 ? "s" : ""} · 3 derniers mois`,
      href: `/sales/non-servi?p=12m&m=${blocVentes.periode.fin}&produit=${p.id}`,
    });
  }
  // PRODUIT = DOSSIER : une identité incomplète est une INDICATION de qualité (« Conditionnement à compléter »),
  // avec le lien vers le dossier où elle se complète — jamais un blocage.
  for (const d of visibles) {
    const titre = titreACompleter(manquesIdentite({ dci: d.dci, dosage: d.dosage, dosageUnit: d.dosageUnit, form: d.pharmaceuticalForm, packaging: d.packaging }));
    if (titre) aSurveiller.push({ ton: "info", titre, detail: `Dossier ${d.reference}`, href: `/regulatory/${d.id}` });
  }
  for (const d of dossiers) {
    if (d.echeance && d.echeance.joursAvantDepot <= 365) {
      aSurveiller.push({ ton: "warning", titre: "Renouvellement de la DE", detail: `${d.reference} · dépôt avant le ${d.echeance.depotAvant} · expiration ${d.echeance.expiration}`, href: `/regulatory/${d.id}` });
    }
  }
  if (marche?.generiquesRecents.length) {
    const g = marche.generiquesRecents[0];
    aSurveiller.push({ ton: "danger", titre: marche.generiquesRecents.length === 1 ? "Générique enregistré" : `${marche.generiquesRecents.length} génériques enregistrés`, detail: `${g.lab} · ${g.marque} · ${g.date}`, href: "?onglet=ventes" });
  }

  const bus = [...new Map(p.promoProfiles.filter((x) => x.businessUnit).map((x) => [x.businessUnit!.id, x.businessUnit!.name])).entries()].map(([id, nom]) => ({ id, nom }));

  return {
    identite: {
      id: p.id, code: p.code, nom: p.canonicalName, dci: p.dci, dosage: texteDosage(p), forme: texteForme(p.form), conditionnement: p.packaging,
      societe: p.company?.shortName ?? p.company?.name ?? null,
      etape: etapeCycle({ lifecycle: p.lifecycle, isActive: p.isActive, statutsDossiers: dossiersNonVerrouilles.map((r) => r.status as string) }),
      lifecycle: p.lifecycle, isActive: p.isActive, alias: p.aliases.map((a) => a.label),
    },
    bus,
    dossiers,
    dossiersMasques: voit.reglementaire ? Math.max(0, p.regulatoryProfiles.length - dossiers.length) : 0,
    ventes: blocVentes,
    stock: blocStock,
    pv: blocPv,
    marche,
    voitMarche: marcheVisible,
    prix,
    historiquePrix: saisiesTypees.map((s) => ({
      id: s.id, type: s.kind as TypePrix, montant: s.amountDzd === null ? null : num(s.amountDzd), depuis: s.validFrom.toISOString().slice(0, 10),
      note: s.note, auteur: s.setById ? auteurs.get(s.setById) ?? null : null, creeLe: s.createdAt.toISOString(),
    })),
    messages: messages ? messages.map((m) => ({ id: m.id, titre: m.title, actif: m.isActive })) : null,
    materiel: materiel ? materiel.map((m) => ({ id: m.id, nom: m.name, actif: m.isActive })) : null,
    aSurveiller,
  };
}
