import { prisma } from "@/lib/prisma";
import { effaceDeSource } from "@/lib/segmentation/moteur";
import type { EtatProduit, MethodeAffinite } from "@/lib/segmentation/regles";
import { chargerBesoins, type BesoinCockpit } from "@/lib/besoins-services/service";
import { chargerRapportsTerrain } from "@/lib/voix-terrain/rapports";
import { voixDuTerrain } from "@/lib/voix-terrain-luna";
import type { VoixTerrain } from "@/lib/voix-terrain/pur";
import type { BaseCockpit, BuCockpit, ProduitCockpit } from "./donnees";
import { repartitionParLots, segmentsDesDecideurs, tendanceAffinite, type LigneDistribution, type RepartitionLots, type ObservationDatee } from "./terrain";

/**
 * MARKETING COCKPIT · TERRAIN — les LECTURES (serveur) de la vue d'ensemble « Ce qui dépend vraiment du terrain » :
 * les besoins annuels exprimés par les services, l'affinité déclarée sur trois cycles, nos lots chez les hôpitaux, la
 * voix du terrain. Les calculs sont dans `terrain.ts` (purs, testés).
 */

export interface TerrainCockpit {
  annee: number;
  besoins: BesoinCockpit[];
  affinite: { serie: { libelle: string; moyenne: number | null; mesures: number }[]; ecartPts: number | null; methode: MethodeAffinite } | null;
  lots: RepartitionLots & { segmentsDecideurs: Map<string, EtatProduit[]>; molecule: string | null } | null;
  voix: VoixTerrain;
}

const JOUR = 86_400_000;

/** Les produits canoniques du périmètre : le produit choisi, sinon ceux de la BU. */
export const produitsDuPerimetre = (bu: BuCockpit, produit: ProduitCockpit | null): string[] =>
  produit ? (produit.productId ? [produit.productId] : []) : [...new Set(bu.produits.map((p) => p.productId).filter((x): x is string => !!x))];

export async function chargerTerrain(base: BaseCockpit, bu: BuCockpit, produit: ProduitCockpit | null, userId: string, maintenant: Date): Promise<TerrainCockpit> {
  const annee = maintenant.getFullYear() + 1;
  const ids = produitsDuPerimetre(bu, produit);
  const [besoins, affinite, lots, voix] = await Promise.all([
    chargerBesoins(ids, [annee, annee - 1]),
    chargerAffinite(base, maintenant),
    chargerLots(ids, base, maintenant),
    chargerVoix(bu, userId, maintenant),
  ]);
  return { annee, besoins, affinite, lots, voix };
}

/** L'affinité moyenne à la fin de chacun des trois derniers cycles (le cycle en cours : aujourd'hui). */
async function chargerAffinite(base: BaseCockpit, maintenant: Date): Promise<TerrainCockpit["affinite"]> {
  const s = base.strategie;
  if (!s || !base.productId || base.panel.length === 0) return null;
  const methode: MethodeAffinite = s.regle?.regles?.produits.find((p) => p.productId === base.productId)?.methodeAffinite ?? "SUR_10";
  const cycles = await prisma.segmentationCycle.findMany({
    where: { strategieId: s.id, debut: { lte: maintenant } }, orderBy: { debut: "desc" }, take: 3, select: { libelle: true, fin: true },
  });
  const points = cycles.length
    ? cycles.reverse().map((c) => ({ libelle: c.libelle, le: c.fin.getTime() < maintenant.getTime() ? new Date(c.fin.getTime() + JOUR - 1) : maintenant }))
    : [{ libelle: "aujourd'hui", le: maintenant }];
  const ids = base.panel.map((p) => p.doctorId);
  const obs = await prisma.hcpObservation.findMany({
    where: { doctorId: { in: ids }, OR: [{ strategieId: s.id }, { strategieId: null }], observeLe: { lte: maintenant } },
    select: { doctorId: true, productId: true, potentiel: true, prescriptionsSur10: true, observeLe: true, source: true },
  });
  const observations: ObservationDatee[] = obs.map((o) => ({
    doctorId: o.doctorId, productId: o.productId, observeLe: o.observeLe, efface: effaceDeSource(o.source),
    potentiel: o.potentiel === null ? null : Number(o.potentiel), prescriptionsSur10: o.prescriptionsSur10 === null ? null : Number(o.prescriptionsSur10),
  }));
  return { ...tendanceAffinite(observations, ids, base.productId, methode, points), methode };
}

/**
 * NOS LOTS : les n° de lot de nos BL PCH (lignes de livraison des BC de nos produits), et la distribution des DR aux
 * hôpitaux sur 12 mois pour les mêmes postes / la même DCI.
 */
async function chargerLots(productIds: readonly string[], base: BaseCockpit, maintenant: Date): Promise<TerrainCockpit["lots"]> {
  if (productIds.length === 0) return null;
  const ids = [...productIds];
  const [bl, postes, molecules] = await Promise.all([
    prisma.pchDeliveryLine.findMany({
      where: { batchNumber: { not: null }, orderLine: { OR: [{ contractLine: { productId: { in: ids } } }, { tenderLine: { productId: { in: ids } } }] } },
      select: { batchNumber: true }, take: 5000,
    }),
    prisma.pchPoste.findMany({ where: { productId: { in: ids } }, select: { poste: true, molecule: true } }),
    prisma.pchVenteLigne.findMany({ where: { productId: { in: ids }, molecule: { not: null } }, distinct: ["molecule"], select: { molecule: true }, take: 20 }),
  ]);
  const mols = [...new Set([...postes.map((p) => p.molecule), ...molecules.map((m) => m.molecule)].filter((x): x is string => !!x))];
  const depuis = new Date(Date.UTC(maintenant.getUTCFullYear() - 1, maintenant.getUTCMonth(), 1));
  const lignes = await prisma.pchVenteLigne.findMany({
    where: {
      mois: { gte: depuis }, qteLivree: { gt: 0 },
      OR: [{ productId: { in: ids } }, ...(postes.length ? [{ poste: { in: postes.map((p) => p.poste) } }] : []), ...(mols.length ? [{ molecule: { in: mols } }] : [])],
    },
    select: { institutionId: true, clientCle: true, client: true, lot: true, qteLivree: true, institution: { select: { name: true } } },
    take: 30_000,
  });
  if (lignes.length === 0 && bl.length === 0) return null;
  const distribution: LigneDistribution[] = lignes.map((l) => ({
    cle: l.institutionId ?? `client:${l.clientCle}`, institutionId: l.institutionId, nom: l.institution?.name ?? l.client, lot: l.lot, quantite: l.qteLivree,
  }));
  return {
    ...repartitionParLots(bl.map((b) => b.batchNumber), distribution),
    segmentsDecideurs: segmentsDesDecideurs(base.panel, base.segmentDe),
    molecule: mols[0] ?? null,
  };
}

/** La voix du terrain de la BU : 30 jours de rapports — visites portant un produit de la BU, ou faites par ses KAM. */
async function chargerVoix(bu: BuCockpit, userId: string, maintenant: Date): Promise<VoixTerrain> {
  const delegues = await prisma.salesRepProfile.findMany({ where: { businessUnitId: bu.id, isActive: true }, select: { repId: true } });
  const rapports = await chargerRapportsTerrain({
    depuis: new Date(maintenant.getTime() - 30 * JOUR),
    perimetre: { productIds: produitsDuPerimetre(bu, null), delegateIds: delegues.map((d) => d.repId) },
  });
  return voixDuTerrain({ perimetre: `mkt:bu:${bu.id}`, jours: 30, rapports, userId, maintenant });
}
