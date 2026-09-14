import { prisma } from "@/lib/prisma";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import {
  modeDepuisFaits, composerPortee, porteeGlobale, estRestreinte, produitDansPortee,
  type PorteeStock, type SecteurDePortee,
} from "@/lib/stocks/portee";
import { getProductOptions, type ProductOption } from "@/lib/queries/stock";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PORTÉE DE STOCK, LUE DANS LA BASE — le seul chargeur, pour l'écran, les actions et Adam.
 *
 * La DÉCISION vit dans `lib/stocks/portee.ts` (pur) ; ce fichier ne fait que lire les FAITS et
 * les lui donner : la chaîne d'approvisionnement, les BU supervisées, la fiche force de vente,
 * les affectations de secteur, les établissements des secteurs, les produits des BU. Deux
 * chargeurs finiraient par lire deux vérités (§118.5) — l'écran montrerait un hôpital que
 * l'action refuse.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

type Acteur = Pick<SessionUser, "id" | "role" | "access"> & { secondaryRole?: SessionUser["secondaryRole"] };

/** Qui voit tout le stock : la chaîne d'approvisionnement, la vue globale, le Super Admin — la règle de `scopes.ts`. */
export function voitToutLeStock(user: Acteur): boolean {
  return user.role === "SUPER_ADMIN" || hasGlobalView(user as SessionUser) || userCan(user as SessionUser, "PCH", "VIEW");
}

export async function chargerPorteeStock(user: Acteur): Promise<PorteeStock> {
  if (voitToutLeStock(user)) return porteeGlobale();

  const [supervisees, profil, affectations] = await Promise.all([
    prisma.businessUnit.findMany({ where: { supervisorId: user.id, isActive: true }, select: { id: true } }),
    prisma.salesRepProfile.findUnique({ where: { repId: user.id }, select: { businessUnitId: true } }),
    prisma.salesSectorRep.findMany({
      where: { repId: user.id, sector: { isActive: true, businessUnit: { isActive: true } } },
      select: { sectorId: true, sector: { select: { businessUnitId: true } } },
    }),
  ]);

  const mode = modeDepuisFaits({
    voitTout: false,
    buSupervisees: supervisees.map((b) => b.id),
    buDuKam: profil?.businessUnitId ?? null,
    secteurs: affectations.map((a) => a.sector),
  });
  if (mode.mode === "GLOBALE") return porteeGlobale();

  // BU : TOUS les secteurs actifs des BU supervisées. SECTEUR : ceux où la personne est affectée
  // (la décision pure écarte ensuite ceux d'une autre BU que la sienne).
  const secteurs = await prisma.salesSector.findMany({
    where: mode.mode === "BU"
      ? { businessUnitId: { in: mode.buIds }, isActive: true }
      : { id: { in: affectations.map((a) => a.sectorId) } },
    select: { id: true, name: true, businessUnitId: true, institutions: { select: { institutionId: true } } },
  });
  const produits = mode.buIds.length
    ? await prisma.promoProduct.findMany({
        where: { businessUnitId: { in: mode.buIds }, isActive: true, regulatoryProductId: { not: null } },
        select: { businessUnitId: true, regulatoryProductId: true },
      })
    : [];
  const produitsParBu: Record<string, string[]> = {};
  for (const p of produits) {
    if (!p.businessUnitId || !p.regulatoryProductId) continue;
    (produitsParBu[p.businessUnitId] ??= []).push(p.regulatoryProductId);
  }

  const entrees: SecteurDePortee[] = secteurs.map((s) => ({
    id: s.id, nom: s.name, businessUnitId: s.businessUnitId, institutionIds: s.institutions.map((i) => i.institutionId),
  }));
  return composerPortee({ mode: mode.mode, buIds: mode.buIds, secteurs: entrees, produitsParBu });
}

// ── LES HÔPITAUX que l'écran liste ─────────────────────────────────────────────────────────

export interface HopitalStockDTO {
  /** Clé d'écran stable : le lieu s'il existe, sinon l'établissement (`etab:<id>`). */
  key: string;
  /** Le lieu de stock — nul tant qu'aucun relevé n'a été fait sur cet établissement. */
  annexId: string | null;
  /** L'établissement de l'annuaire — nul pour un lieu HÉRITÉ, à rattacher. */
  institutionId: string | null;
  name: string;
  wilaya: string | null;
  /** Lieu créé à la main avant que l'annuaire ne soit la seule source : invisible aux portées restreintes. */
  herite: boolean;
}

export interface EtablissementDisponible {
  id: string;
  name: string;
  wilaya: string | null;
}

export interface HopitauxStock {
  hopitaux: HopitalStockDTO[];
  /** Les établissements de l'annuaire SANS lieu de stock — ce que le Super Admin peut ajouter ou rattacher. */
  disponibles: EtablissementDisponible[];
}

const trierParNom = <T extends { name: string }>(xs: T[]): T[] => [...xs].sort((a, b) => a.name.localeCompare(b.name, "fr"));

/**
 * Portée RESTREINTE : les établissements de la portée — TOUS, qu'un relevé les vise déjà ou non,
 * parce qu'un KAM doit pouvoir relever un hôpital de son secteur la première fois. Portée
 * GLOBALE : les lieux existants (rattachés ou hérités), et — si on le demande — les
 * établissements encore sans lieu, pour les ajouter.
 */
export async function chargerHopitauxStock(portee: PorteeStock, opts: { avecDisponibles?: boolean } = {}): Promise<HopitauxStock> {
  if (estRestreinte(portee)) {
    if (portee.institutionIds.length === 0) return { hopitaux: [], disponibles: [] };
    const etabs = await prisma.medicalInstitution.findMany({
      where: { id: { in: portee.institutionIds }, isActive: true },
      select: { id: true, name: true, wilaya: true, stockLocation: { select: { id: true } } },
    });
    return {
      hopitaux: trierParNom(etabs.map((e) => ({
        key: e.stockLocation?.id ?? `etab:${e.id}`, annexId: e.stockLocation?.id ?? null, institutionId: e.id,
        name: e.name, wilaya: e.wilaya, herite: false,
      }))),
      disponibles: [],
    };
  }

  const [lieux, disponibles] = await Promise.all([
    prisma.stockAnnex.findMany({
      where: { kind: { not: "ANNEX" } },
      select: { id: true, name: true, institutionId: true, institution: { select: { name: true, wilaya: true } } },
    }),
    opts.avecDisponibles
      ? prisma.medicalInstitution.findMany({
          where: { isActive: true, stockLocation: null },
          select: { id: true, name: true, wilaya: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as EtablissementDisponible[]),
  ]);
  return {
    hopitaux: trierParNom(lieux.map((l) => ({
      key: l.id, annexId: l.id, institutionId: l.institutionId,
      name: l.institution?.name ?? l.name, wilaya: l.institution?.wilaya ?? null, herite: !l.institutionId,
    }))),
    disponibles: trierParNom(disponibles),
  };
}

/** Les produits proposés : le catalogue Regulatory, réduit à la gamme de la BU pour une portée restreinte. */
export async function chargerProduitsStock(user: SessionUser, portee: PorteeStock): Promise<ProductOption[]> {
  const tous = await getProductOptions(user);
  return estRestreinte(portee) ? tous.filter((p) => produitDansPortee(portee, p.id)) : tous;
}

/** La clause Prisma qui ne charge QUE les relevés de la portée — pour l'écran comme pour Adam. */
export function clauseRelevesDePortee(portee: PorteeStock): Record<string, unknown> {
  if (!estRestreinte(portee)) return {};
  return {
    scope: "HOSPITAL",
    productId: { in: portee.productIds },
    annex: { institutionId: { in: portee.institutionIds } },
  };
}
