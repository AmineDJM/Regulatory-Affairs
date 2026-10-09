import { affiniteAffichee, type EtatProduit, type Lettre, type MethodeAffinite } from "@/lib/segmentation/regles";
import { derniere, type Observation } from "@/lib/segmentation/moteur";

/**
 * MARKETING COCKPIT · TERRAIN — les calculs PURS de « Ce qui dépend vraiment du terrain » (maquette validée, 10/2026).
 *
 * En marché d'appels d'offres, la PCH répartit entre les gagnants : la part de réceptions ne mesure pas l'effort
 * marketing. On lit donc ce que le terrain fait bouger : les décideurs vus, l'affinité déclarée (Q2/Q1) cycle après
 * cycle, les lettres qui changent, et — par les NUMÉROS DE LOT — les hôpitaux qui reçoivent réellement nos boîtes.
 * Ces fonctions reçoivent des faits déjà lus et rendent des chiffres (testées seules) ; une donnée absente rend null.
 */

// ───────────────────────────── Décideurs engagés ─────────────────────────────

export const VISITES_ENGAGEMENT = 2;

/** « Décideurs engagés » : les H vus au moins deux fois (visites terminées) pendant le cycle, sur tous les H. */
export function decideursEngages(praticiens: readonly { lettre: Lettre; faitesCycle: number }[], seuil = VISITES_ENGAGEMENT): { engages: number; total: number } {
  const h = praticiens.filter((p) => p.lettre === "H");
  return { engages: h.filter((p) => p.faitesCycle >= seuil).length, total: h.length };
}

// ───────────────────────────── Conversions de lettres ─────────────────────────────

/**
 * LES CONVERSIONS DEPUIS LE CYCLE FIGÉ : B → A (l'affinité gagnée) et A → B (perdue), segment du produit. Un praticien
 * absent du cycle d'avant n'est pas une conversion (il est nouveau), et une donnée manquante n'est ni A ni B.
 */
export function conversions(avant: ReadonlyMap<string, EtatProduit | null>, apres: ReadonlyMap<string, EtatProduit | null>): { bVersA: number; aVersB: number; compares: number } {
  let bVersA = 0, aVersB = 0, compares = 0;
  for (const [id, seg] of apres) {
    if (!avant.has(id)) continue;
    compares++;
    const a = avant.get(id);
    if (a === "B" && seg === "A") bVersA++;
    if (a === "A" && seg === "B") aVersB++;
  }
  return { bVersA, aVersB, compares };
}

// ───────────────────────────── Affinité moyenne (Q2/Q1) ─────────────────────────────

export interface ObservationDatee extends Observation { doctorId: string }

/**
 * L'AFFINITÉ MOYENNE à une date : pour chaque praticien du panel, les réponses en vigueur à cette date (les plus
 * récentes, `derniere` du moteur), l'affinité selon la méthode de la règle (Q2 ÷ 10, ou Q2 ÷ Q1) ; la moyenne de ceux
 * dont elle se calcule. Personne de mesurable : null.
 */
export function affiniteMoyenneAu(
  observations: readonly ObservationDatee[],
  doctorIds: readonly string[],
  productId: string,
  methode: MethodeAffinite,
  le: Date,
): { moyenne: number | null; mesures: number } {
  const parDoc = new Map<string, Observation[]>();
  for (const o of observations) {
    if (o.observeLe.getTime() > le.getTime()) continue;
    const l = parDoc.get(o.doctorId);
    if (l) l.push(o); else parDoc.set(o.doctorId, [o]);
  }
  const valeurs: number[] = [];
  for (const id of new Set(doctorIds)) {
    const obs = parDoc.get(id);
    if (!obs) continue;
    const q1 = derniere(obs, "potentiel", productId)?.valeur ?? null;
    const q2 = derniere(obs, "prescriptionsSur10", productId)?.valeur ?? null;
    const a = affiniteAffichee(q1, q2, methode);
    if (a !== null && Number.isFinite(a)) valeurs.push(a);
  }
  return { moyenne: valeurs.length ? valeurs.reduce((s, x) => s + x, 0) / valeurs.length : null, mesures: valeurs.length };
}

/** La tendance sur des dates (du plus ancien au plus récent) et l'écart en POINTS entre le premier et le dernier point mesuré. */
export function tendanceAffinite(
  observations: readonly ObservationDatee[],
  doctorIds: readonly string[],
  productId: string,
  methode: MethodeAffinite,
  points: readonly { libelle: string; le: Date }[],
): { serie: { libelle: string; moyenne: number | null; mesures: number }[]; ecartPts: number | null } {
  const serie = points.map((p) => ({ libelle: p.libelle, ...affiniteMoyenneAu(observations, doctorIds, productId, methode, p.le) }));
  const mesures = serie.filter((s) => s.moyenne !== null);
  const ecartPts = mesures.length >= 2 ? (mesures[mesures.length - 1].moyenne! - mesures[0].moyenne!) * 100 : null;
  return { serie, ecartPts };
}

// ───────────────────────────── Nos lots chez les hôpitaux ─────────────────────────────

/** Un n° de lot comparable : lettres et chiffres seuls, en majuscules, sans le mot « LOT » ; trop court = illisible. */
export function normaliserLot(s: string | null | undefined): string | null {
  const t = (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(LOT|BATCH|N)(?=[A-Z0-9]*\d)/, "");
  return t.length >= 3 ? t : null;
}

export interface LigneDistribution {
  /** L'établissement : son identifiant d'annuaire, sinon la clé du client écrite par la DR. */
  cle: string;
  institutionId: string | null;
  nom: string;
  lot: string | null;
  quantite: number;
}

export interface HopitalLots {
  cle: string;
  institutionId: string | null;
  nom: string;
  quantite: number;
  /** Quantité servie avec NOS lots. */
  quantiteNous: number;
  lotsConnus: number;
}

export interface RepartitionLots {
  /** Avons-nous au moins un n° de lot sur nos BL ? Sans lui, rien ne se compare. */
  nosLotsConnus: boolean;
  /** Les établissements qui consomment la DCI (quantité servie > 0). */
  consommateurs: number;
  avecNosLots: HopitalLots[];
  /** Servis avec des lots connus, AUCUN des nôtres. */
  concurrentSeul: HopitalLots[];
  /** Servis sans aucun n° de lot dans les fichiers : on ne sait pas. */
  sansLot: HopitalLots[];
}

/**
 * OÙ VONT NOS LOTS : les n° de lot de NOS livraisons PCH retrouvés dans la distribution des DR aux hôpitaux (même
 * poste / DCI). Un hôpital est « servi avec nos lots » dès qu'une ligne porte l'un des nôtres ; « servi uniquement par
 * le concurrent » s'il a des lots connus et aucun des nôtres ; sans aucun lot dans les fichiers, il reste « inconnu ».
 */
export function repartitionParLots(nosLots: Iterable<string | null | undefined>, lignes: readonly LigneDistribution[]): RepartitionLots {
  const nous = new Set<string>();
  for (const l of nosLots) { const n = normaliserLot(l); if (n) nous.add(n); }
  const par = new Map<string, HopitalLots>();
  for (const l of lignes) {
    if (!(l.quantite > 0)) continue;
    const h = par.get(l.cle) ?? { cle: l.cle, institutionId: l.institutionId, nom: l.nom, quantite: 0, quantiteNous: 0, lotsConnus: 0 };
    h.quantite += l.quantite;
    const lot = normaliserLot(l.lot);
    if (lot) {
      h.lotsConnus++;
      if (nous.has(lot)) h.quantiteNous += l.quantite;
    }
    if (!h.institutionId && l.institutionId) h.institutionId = l.institutionId;
    par.set(l.cle, h);
  }
  const tous = [...par.values()].sort((a, b) => b.quantite - a.quantite || a.nom.localeCompare(b.nom, "fr"));
  return {
    nosLotsConnus: nous.size > 0,
    consommateurs: tous.length,
    avecNosLots: tous.filter((h) => h.quantiteNous > 0),
    concurrentSeul: tous.filter((h) => h.lotsConnus > 0 && h.quantiteNous === 0),
    sansLot: tous.filter((h) => h.lotsConnus === 0),
  };
}

/** Les segments (A–D) des DÉCIDEURS d'un établissement — « nos décideurs y sont A ». */
export function segmentsDesDecideurs(
  panel: readonly { doctorId: string; institutionId: string | null; statut: string | null }[],
  segmentDe: ReadonlyMap<string, EtatProduit | null>,
): Map<string, EtatProduit[]> {
  const out = new Map<string, EtatProduit[]>();
  for (const p of panel) {
    if (p.statut !== "DECIDEUR" || !p.institutionId) continue;
    const s = segmentDe.get(p.doctorId);
    if (!s) continue;
    out.set(p.institutionId, [...(out.get(p.institutionId) ?? []), s]);
  }
  return out;
}
