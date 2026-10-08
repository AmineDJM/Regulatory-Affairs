import { prisma } from "@/lib/prisma";
import { userCan, type SessionUser } from "@/lib/rbac";
import { isRetiredModule } from "@/lib/modules-retired";
import { resolveRepScope } from "@/lib/sfe";
import { busDuPerimetre, chargerPilotage } from "@/lib/queries/force-de-vente";
import { canoniquesDesDossiers, chargerChaine, chargerConsommationMensuelle, chargerProduitsPch, voitLaChaine } from "@/lib/queries/stock-pch";
import { busPch, chainesContratsPch, demandeNonServie, fraicheurPch, produitsVentesPch, synthesePch, type BuPch } from "@/lib/ventes-pch/requetes";
import { SOURCE_RECEPTIONS, dateDuMois, decalerMois, periodeDe, periodePrecedente } from "@/lib/ventes-pch/calculs";
import { lireRisques } from "@/lib/adventum/brain-read";
import { filtreDuPerimetre } from "@/lib/adventum/perimetre";
import { ageEnJours } from "@/lib/stocks/pch-central";
import { CHEMIN_STOCKS_CHAINE, CHEMIN_STOCK_PCH } from "@/lib/chemins/stocks";
import {
  aTraiterAvenants, aTraiterBcEnRetard, aTraiterBrain, aTraiterFichiersPch, aTraiterHopitauxEnRupture, aTraiterLogistique,
  aTraiterRuptures, aTraiterStockPch, bcEnRetard, couvertureLaPlusCourte, cumulLivre, cumulNonServi, evolutionLivre,
  executionDesMarches, ligneCouverture, marcheEnCours, rupturesA60Jours, selectionnerATraiter,
  type ATraiter, type ChaineMarche, type CumulLivre, type Execution, type LigneCouverture, type NonServiProduit,
} from "@/lib/cockpit-operations/calculs";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * COCKPIT OPÉRATIONS — la lecture (Direction, 08/10 — maquette « Cockpit Opérations » v2 : un seul client, la PCH ;
 * pas d'encaissements, pas de programme d'import).
 *
 * Rien n'est ressaisi ni recalculé à côté : les ventes PCH (`ventes-pch/requetes.ts`), la chaîne des contrats, les
 * stocks de la chaîne et leur consommation (`queries/stock-pch.ts`), la force de vente (`queries/force-de-vente.ts`),
 * les risques d'Adventum Brain bornés au périmètre des opérations (`adventum/perimetre.ts`). Les calculs sont purs
 * (`cockpit-operations/calculs.ts`). Un signal dont la personne ne voit pas l'écran n'est pas lu : son lien serait mort.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface AccesCockpit {
  ventes: boolean;
  importer: boolean;
  chaine: boolean;
  pch: boolean;
  fdv: boolean;
  brain: boolean;
}

export interface LigneBuCockpit {
  id: string;
  nom: string;
  livre12: CumulLivre;
  evol12: number | null;
  execution: Execution;
  /** Demande non servie sur 12 mois — null si aucun fichier des DR. */
  nonServi12: number | null;
  couverture: LigneCouverture | null;
}

export interface CockpitOperations {
  moisCourant: string;
  bus: BuPch[];
  buId: string | null;
  acces: AccesCockpit;
  livre: { mois: string | null; moisN1: string | null; cumul: CumulLivre; evol: number | null; n1Present: boolean };
  execution: Execution & { annee: number };
  nonServi: { mois: string | null; quantite: number; etablissements: number };
  ruptures: { mesurables: number; produits: number; enRupture: number };
  fdv: { ouvert: boolean; horsPerimetre: boolean; pct: number | null; vues: number; cibles: number; delta: number | null };
  parBu: LigneBuCockpit[];
  aTraiter: ATraiter[];
}

const VIDE: CumulLivre = { lisible: false, boites: 0, valeur: 0, valorise: false };

export async function chargerCockpitOperations(user: SessionUser, buDemandee: string | null, maintenant: Date = new Date()): Promise<CockpitOperations> {
  const acces: AccesCockpit = {
    ventes: userCan(user, "PCH_VENTES", "VIEW"),
    importer: userCan(user, "PCH_VENTES", "UPLOAD"),
    chaine: userCan(user, "STOCKS", "VIEW") && voitLaChaine(user),
    pch: userCan(user, "PCH", "VIEW"),
    fdv: userCan(user, "SALES_PLANNING", "VIEW"),
    brain: userCan(user, "ADVENTUM_BRAIN", "VIEW"),
  };
  const moisCourant = maintenant.toISOString().slice(0, 7);
  const annee = maintenant.getUTCFullYear();

  const [fraicheur, bus, produitsVentes] = await Promise.all([fraicheurPch(), busPch(), produitsVentesPch(null)]);
  const buId = buDemandee && bus.some((b) => b.id === buDemandee) ? buDemandee : null;
  const produitsDeLaBu = buId ? new Set(produitsVentes.filter((p) => p.bus.some((b) => b.id === buId)).map((p) => p.id)) : null;
  const nomDuProduit = new Map(produitsVentes.map((p) => [p.id, p.nom]));

  // Les mois de référence : le DERNIER mois reçu de chaque source (les fichiers arrivent après coup).
  const sourcesDr = fraicheur.sources.filter((s) => s.source !== SOURCE_RECEPTIONS);
  const refRecus = fraicheur.sources.find((s) => s.source === SOURCE_RECEPTIONS)?.dernier ?? null;
  const refVentes = sourcesDr.map((s) => s.dernier).filter((x): x is string => !!x).sort().at(-1) ?? null;
  const mois = (m: string) => periodeDe("mois", m);
  const an = refRecus ? periodeDe("12m", refRecus) : null;
  const anAvant = an ? periodePrecedente(an) : null;

  // ── Lectures parallèles ─────────────────────────────────────────────────────────────────────
  const produitsStock = await chargerProduitsPch(user);
  const dossiers = [...new Set(produitsStock.map((p) => p.id))];
  const [
    livreMois, livreMoisN1, livre12, livre12Avant, n1Present, nonServiMois, nonServi12, etablissements, chaines,
    chaine, consos, canon,
  ] = await Promise.all([
    refRecus ? synthesePch(mois(refRecus), mois(decalerMois(refRecus, -12))) : Promise.resolve([]),
    refRecus ? synthesePch(mois(decalerMois(refRecus, -12)), mois(decalerMois(refRecus, -24))) : Promise.resolve([]),
    an && anAvant ? synthesePch(an, anAvant) : Promise.resolve([]),
    anAvant ? synthesePch(anAvant, periodePrecedente(anAvant)) : Promise.resolve([]),
    refRecus ? prisma.pchReceptionLigne.findFirst({ where: { mois: dateDuMois(decalerMois(refRecus, -12)) }, select: { id: true } }).then(Boolean) : Promise.resolve(false),
    refVentes ? demandeNonServie({ debut: refVentes, fin: refVentes }) : Promise.resolve([]),
    refVentes ? demandeNonServie({ debut: decalerMois(refVentes, -11), fin: refVentes }) : Promise.resolve([]),
    refVentes
      ? prisma.pchVenteLigne.groupBy({
          by: ["clientCle"],
          where: { mois: dateDuMois(refVentes), statut: "NON_SERVIE", productId: produitsDeLaBu ? { in: [...produitsDeLaBu] } : { not: null } },
        }).then((r) => r.length)
      : Promise.resolve(0),
    chainesContratsPch(null),
    chargerChaine(user, produitsStock),
    chargerConsommationMensuelle(dossiers, maintenant),
    canoniquesDesDossiers(dossiers),
  ]);

  // ── Les marchés de l'année ──────────────────────────────────────────────────────────────────
  const contratIds = [...new Set(chaines.flatMap((c) => (c.contrat ? [c.contrat.id] : [])))];
  const marcheIds = [...new Set(chaines.flatMap((c) => (c.marche ? [c.marche.id] : [])))];
  const [contrats, marches] = await Promise.all([
    contratIds.length ? prisma.legalDocument.findMany({ where: { id: { in: contratIds } }, select: { id: true, status: true, startDate: true, endDate: true } }) : Promise.resolve([]),
    marcheIds.length ? prisma.pchTender.findMany({ where: { id: { in: marcheIds } }, select: { id: true, awardDate: true } }) : Promise.resolve([]),
  ]);
  const contratDe = new Map(contrats.map((c) => [c.id, c]));
  const attributionDe = new Map(marches.map((m) => [m.id, m.awardDate]));
  const chainesMarche: ChaineMarche[] = chaines.map((c) => {
    const doc = c.contrat ? contratDe.get(c.contrat.id) : undefined;
    return {
      nom: c.nom, reference: c.marche?.reference ?? c.contrat?.reference ?? null, bus: c.bus,
      attribue: c.chaine.attribue, commande: c.chaine.commande, livre: c.chaine.livre, bcAvenants: c.bcAvenants,
      enCours: marcheEnCours({ statut: doc?.status ?? null, debut: doc?.startDate ?? null, fin: doc?.endDate ?? null, attribution: c.marche ? attributionDe.get(c.marche.id) ?? null : null }, annee),
    };
  });

  // ── La couverture de la chaîne ──────────────────────────────────────────────────────────────
  const couvertures = chaine.map((l) => ligneCouverture({
    productId: l.productId, label: l.label, buId: l.buId, buNom: l.buNom,
    adventum: l.adventum?.quantite ?? null, pch: l.pch?.quantite ?? null, hopitaux: l.hopitaux?.quantite ?? null,
    conso: consos.get(l.productId) ?? null,
  }));
  const ruptures = rupturesA60Jours(couvertures, buId);

  // ── Tuiles ──────────────────────────────────────────────────────────────────────────────────
  const cumulMois = refRecus ? cumulLivre(livreMois, buId) : VIDE;
  const cumulMoisN1 = refRecus && n1Present ? cumulLivre(livreMoisN1, buId) : null;

  let fdv: CockpitOperations["fdv"] = { ouvert: acces.fdv, horsPerimetre: false, pct: null, vues: 0, cibles: 0, delta: null };
  if (acces.fdv) {
    const scope = await resolveRepScope(user);
    const busFdv = await busDuPerimetre(scope, user.id);
    if (buId && !busFdv.some((b) => b.id === buId)) fdv = { ...fdv, horsPerimetre: true };
    else {
      const p = await chargerPilotage({ scope, userId: user.id, buId, year: maintenant.getFullYear(), month: maintenant.getMonth() + 1, maintenant });
      fdv = { ...fdv, pct: p.tuiles.couverture.pct, vues: p.tuiles.couverture.vues, cibles: p.tuiles.couverture.cibles, delta: p.tuiles.couverture.delta };
    }
  }

  // ── Par BU ──────────────────────────────────────────────────────────────────────────────────
  const parBu: LigneBuCockpit[] = bus.filter((b) => !buId || b.id === buId).map((b) => {
    const l12 = an ? cumulLivre(livre12, b.id) : VIDE;
    const produitsBu = new Set(produitsVentes.filter((p) => p.bus.some((x) => x.id === b.id)).map((p) => p.id));
    return {
      id: b.id, nom: b.nom,
      livre12: l12,
      evol12: an ? evolutionLivre(l12, cumulLivre(livre12Avant, b.id)) : null,
      execution: executionDesMarches(chainesMarche, b.id),
      nonServi12: refVentes ? cumulNonServi(nonServi12, produitsBu) : null,
      couverture: couvertureLaPlusCourte(couvertures, b.id),
    };
  });

  // ── À traiter ───────────────────────────────────────────────────────────────────────────────
  const items: ATraiter[] = [];
  if (acces.chaine) {
    items.push(...aTraiterRuptures(ruptures.enRupture, (l) => (l.buId ? `${CHEMIN_STOCKS_CHAINE}?bu=${encodeURIComponent(l.buId)}` : CHEMIN_STOCKS_CHAINE)));
    const dates = chaine.map((l) => l.pch?.date).filter((x): x is string => !!x).sort();
    items.push(...aTraiterStockPch(ageEnJours(dates.at(-1) ?? null, maintenant), produitsStock.length, CHEMIN_STOCK_PCH));
  }
  if (acces.pch) {
    const ouverts = await prisma.pchOrder.findMany({
      where: { status: { in: ["PENDING", "VALIDATED"] } },
      select: {
        id: true, reference: true, tenderId: true, status: true, expectedArrival: true, arrivedDate: true,
        deliveries: { select: { expectedAt: true, deliveredAt: true } },
        orderLines: { select: { contractLine: { select: { productId: true } }, tenderLine: { select: { productId: true } } } },
      },
      take: 500,
    });
    const dansBu = ouverts.filter((o) => !produitsDeLaBu || o.orderLines.some((l) => {
      const p = l.contractLine?.productId ?? l.tenderLine?.productId;
      return !!p && produitsDeLaBu.has(p);
    }));
    items.push(...aTraiterBcEnRetard(bcEnRetard(dansBu.map((o) => ({
      id: o.id, reference: o.reference, tenderId: o.tenderId, statut: o.status, attendu: o.expectedArrival, arrive: o.arrivedDate,
      livraisons: o.deliveries.map((d) => ({ attendu: d.expectedAt, livre: d.deliveredAt })),
    })), maintenant)));
  }
  if (acces.ventes) {
    // Hôpitaux non servis alors que la PCH centrale a du stock (dernier relevé du dossier rattaché au produit).
    const stockPch = new Map<string, number | null>();
    for (const l of chaine) {
      const p = canon.get(l.productId);
      if (p && l.pch) stockPch.set(p, Math.max(stockPch.get(p) ?? 0, l.pch.quantite));
    }
    const parProduit = new Map<string, NonServiProduit>();
    for (const r of nonServiMois) {
      if (produitsDeLaBu && !produitsDeLaBu.has(r.productId)) continue;
      const x = parProduit.get(r.productId) ?? parProduit.set(r.productId, { productId: r.productId, nom: nomDuProduit.get(r.productId) ?? "Produit", quantite: 0, etablissements: 0, drs: [] }).get(r.productId)!;
      x.quantite += r.quantite; x.etablissements += r.etablissements; x.drs.push(r.dr);
    }
    items.push(...aTraiterHopitauxEnRupture([...parProduit.values()], stockPch, "/sales/non-servi"));
    items.push(...aTraiterAvenants(chainesMarche.filter((c) => !buId || c.bus.some((b) => b.id === buId)), "/sales/contrats"));
    items.push(...aTraiterFichiersPch(fraicheur.sources, fraicheur.dernierMois, "/sales/importer"));
  }
  if (acces.brain) {
    const risques = await lireRisques(maintenant, filtreDuPerimetre(user.role === "SUPER_ADMIN"));
    const ouverts = risques.filter((r) => (r.status === "NOUVEAU" || r.status === "PRIS_EN_CHARGE") && !r.resolvedAt && !(r.snoozedUntil && new Date(r.snoozedUntil) > maintenant));
    items.push(...aTraiterBrain(ouverts, "/adventum-brain"));
  }
  // LOGISTIQUE : son module est retiré du service (`modules-retired.ts`) — le signal n'est lu que s'il y revient.
  if (!isRetiredModule("LOGISTICS") && userCan(user, "LOGISTICS", "VIEW") && !buId) {
    const commandes = await prisma.logisticsOrder.findMany({
      where: { status: { in: ["CUSTOMS", "BLOCKED"] } },
      select: { id: true, reference: true, product: true, status: true, customsDate: true, updatedAt: true },
      take: 50,
    });
    items.push(...aTraiterLogistique(commandes.map((c) => ({ id: c.id, reference: c.reference, produit: c.product, statut: c.status, depuis: c.customsDate ?? c.updatedAt })), maintenant));
  }

  return {
    moisCourant, bus, buId, acces,
    livre: { mois: refRecus, moisN1: refRecus ? decalerMois(refRecus, -12) : null, cumul: cumulMois, evol: evolutionLivre(cumulMois, cumulMoisN1), n1Present },
    execution: { ...executionDesMarches(chainesMarche, buId), annee },
    nonServi: { mois: refVentes, quantite: refVentes ? cumulNonServi(nonServiMois, produitsDeLaBu) : 0, etablissements },
    ruptures: { mesurables: ruptures.mesurables, produits: ruptures.produits, enRupture: ruptures.enRupture.length },
    fdv,
    parBu,
    aTraiter: selectionnerATraiter(items),
  };
}
