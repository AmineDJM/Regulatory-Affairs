/**
 * Intelligence prix par DCI — prix moyen / fourchette par boîte (IQVIA ville) et
 * par unité (PCH hospitalier), avec le détail par produit. Portage fidèle de
 * market_engine.price_for_dci (Pharmatool). Le rapprochement DCI réutilise les
 * primitives validées du moteur (normText / tokens / allTokensIn). Données réelles.
 */
import { getMarketData, DZD_PER_USD, type IqviaRow, type PchRow } from "./data";
import { buildCompetition, queryTokens, allTokensIn } from "./engine";

export interface PriceStats { avgDzd: number | null; avgUsd: number | null; min: number | null; median: number | null; max: number | null; n: number }
export interface VilleRow { brand: string; presentation: string; lab: string; volume: number; valueDzd: number; priceBoxDzd: number | null; growth: number | null }
export interface HospitalRow { product: string; lab: string; qte: number; unitPriceDzd: number | null; valueDzd: number; devise: string | null; date: string | null }
export interface PriceForDci {
  dci: string;
  ville: PriceStats | null; villeRows: VilleRow[];
  hospital: PriceStats | null; hospitalRows: HospitalRow[];
}

function stats(prices: (number | null)[], avg: number | null): PriceStats {
  const v = prices.map((p) => (p == null || !Number.isFinite(p) ? null : p)).filter((p): p is number => p != null).sort((a, b) => a - b);
  const median = v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null;
  return {
    avgDzd: avg, avgUsd: avg == null ? null : avg / DZD_PER_USD,
    min: v.length ? v[0] : null, median, max: v.length ? v[v.length - 1] : null, n: v.length,
  };
}

/** Liste contrôlée des DCI (Nomenclature active), triée par valeur de marché IQVIA décroissante. */
export function pricingDciList(): { key: string; dci: string }[] {
  const comp = buildCompetition();
  const { iqvia } = getMarketData();
  // Valeur IQVIA approximative par molécule normalisée (pour ordonner les DCI utiles en tête).
  const molVal = new Map<string, number>();
  for (const r of iqvia) molVal.set(r.mol ?? "", (molVal.get(r.mol ?? "") ?? 0) + (r.valDzd ?? 0));
  return [...comp.values()]
    .map((c) => ({ key: c.key, dci: c.dci, val: molVal.get(c.key) ?? 0 }))
    .sort((a, b) => b.val - a.val || a.dci.localeCompare(b.dci))
    .map(({ key, dci }) => ({ key, dci }));
}

/** Rapproche les lignes IQVIA d'une DCI (par molécule, jetons bornés) puis déduplique par produit. */
function matchIqvia(key: string): IqviaRow[] {
  const { iqvia } = getMarketData();
  const byMol = new Map<string, IqviaRow[]>();
  for (const r of iqvia) (byMol.get(r.mol ?? "") ?? byMol.set(r.mol ?? "", []).get(r.mol ?? "")!).push(r);
  let parts: IqviaRow[] = [];
  if (byMol.has(key)) parts = byMol.get(key)!;
  else {
    const qt = queryTokens(key);
    if (qt.length) for (const [mn, rows] of byMol) if (mn && allTokensIn(mn, qt)) parts = parts.concat(rows);
  }
  const byKey = new Map<string, IqviaRow>();
  for (const r of parts) {
    const k = r.key ?? `${r.brand}|${r.pres}|${r.lab}`;
    const cur = byKey.get(k);
    if (!cur || (r.valDzd ?? 0) > (cur.valDzd ?? 0)) byKey.set(k, r);
  }
  return [...byKey.values()];
}

/** Rapproche les réceptions PCH d'une DCI (index inversé de jetons + filtre strict). */
function matchPch(key: string): PchRow[] {
  const { pch } = getMarketData();
  const qt = queryTokens(key);
  if (!qt.length) return [];
  return pch.filter((r) => allTokensIn(r.text ?? "", qt));
}

/** Intelligence prix d'une DCI : statistiques ville (par boîte) + hôpital (par unité). */
export function getPriceForDci(key: string): PriceForDci | null {
  const comp = buildCompetition();
  const row = comp.get(key);
  if (!row) return null;

  // ── IQVIA ville : prix par boîte = valeur / volume.
  const iq = matchIqvia(key);
  let ville: PriceStats | null = null;
  const villeRows: VilleRow[] = [];
  if (iq.length) {
    let tv = 0, tvol = 0;
    const prices: (number | null)[] = [];
    for (const r of iq) {
      const val = r.valDzd ?? 0, vol = r.vol ?? 0;
      const price = vol > 0 ? val / vol : null;
      tv += val; tvol += vol; prices.push(price);
      villeRows.push({ brand: r.brand ?? "—", presentation: r.pres ?? "—", lab: r.lab ?? "—", volume: vol, valueDzd: val, priceBoxDzd: price, growth: r.growth ?? null });
    }
    villeRows.sort((a, b) => b.valueDzd - a.valueDzd);
    ville = stats(prices, tvol > 0 ? tv / tvol : null);
  }

  // ── PCH hospitalier : prix par unité = coût unitaire d'achat.
  const ph = matchPch(key);
  let hospital: PriceStats | null = null;
  const hospitalRows: HospitalRow[] = [];
  if (ph.length) {
    let tv = 0, tvol = 0;
    const prices: (number | null)[] = [];
    for (const r of ph) {
      const up = r.unitPrice ?? null, qte = r.qte ?? 0;
      tv += (up ?? 0) * qte; tvol += qte; prices.push(up);
      hospitalRows.push({ product: r.full ?? "—", lab: r.lab ?? "—", qte, unitPriceDzd: up, valueDzd: r.valDzd ?? (up ?? 0) * qte, devise: r.devise, date: r.date });
    }
    hospitalRows.sort((a, b) => b.valueDzd - a.valueDzd);
    hospital = stats(prices, tvol > 0 ? tv / tvol : null);
  }

  return { dci: row.dci, ville, villeRows, hospital, hospitalRows };
}
