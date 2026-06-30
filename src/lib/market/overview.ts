/**
 * Analytics « Vue d'ensemble » du marché — portage fidèle du moteur Python
 * (market_engine.iqvia_total_market / iqvia_class_breakdown / compute_hhi /
 * weighted_growth_py). Calculé sur les données réelles, réconcilié aux totaux
 * officiels IQVIA (déduplication par produit-présentation).
 */
import { getMarketData, DZD_PER_USD, type IqviaRow } from "./data";

/**
 * Croissance YoY agrégée et robuste : reconstruit la valeur N-1 de chaque ligne
 * (valeur / (1+croissance)) puis renvoie Σvaleur / Σ(N-1) − 1. Les lignes
 * aberrantes (gros % sur petite valeur) ne déforment pas le résultat.
 */
export function weightedGrowthPy(values: (number | null)[], growths: (number | null)[]): number | null {
  let cur = 0, prior = 0, any = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i], g = growths[i];
    if (v == null || g == null || !(g > -1) || !(v > 0)) continue;
    cur += v;
    prior += v / (1 + g);
    any = true;
  }
  if (!any || prior <= 0) return null;
  return cur / prior - 1;
}

/** Indice Herfindahl-Hirschman (0–10000) sur des parts de marché fractionnaires. */
export function computeHhi(shares: (number | null)[]): number | null {
  let total = 0;
  for (const s of shares) if (s != null) total += s;
  if (total <= 0) return null;
  let sum = 0;
  for (const s of shares) { const f = (s ?? 0) / total; sum += f * f; }
  return sum * 10000;
}

export function hhiLabel(hhi: number | null): string {
  if (hhi == null || Number.isNaN(hhi)) return "—";
  if (hhi < 1500) return "Concurrentiel";
  if (hhi < 2500) return "Modérément concentré";
  return "Très concentré";
}

export interface ClassRow {
  cls: string; valueDzd: number; valueUsd: number; share: number;
  growth: number | null; players: number; products: number; volume: number;
}
export interface OverviewLab { rank: number; lab: string; valueDzd: number; valueUsd: number; share: number; growth: number | null }
export interface MomRow { cls: string; growth: number; share: number }

export interface MarketOverview {
  kpis: { valueDzd: number; valueUsd: number; growthPy: number | null; volume: number; nLabs: number; hhi: number | null; hhiLabel: string };
  classes: ClassRow[];
  labs: OverviewLab[];
  growers: MomRow[];
  decliners: MomRow[];
  meta: { iqviaFile: string; period: string; nProducts: number };
}

/** Construit la vue d'ensemble du marché (KPIs, classes thérapeutiques, labos, momentum). */
export function getMarketOverview(): MarketOverview {
  const { iqviaProducts, labs, meta } = getMarketData();

  // Total marché : préférer la feuille officielle des laboratoires (réconciliée).
  const totalDzd = labs.reduce((s, l) => s + (l.valDzd ?? 0), 0);
  const totalVol = labs.reduce((s, l) => s + (l.vol ?? 0), 0);
  const totalGrowth = weightedGrowthPy(labs.map((l) => l.valDzd), labs.map((l) => l.growth));
  const nLabs = labs.filter((l) => (l.valDzd ?? 0) > 0).length;
  const hhi = computeHhi(labs.map((l) => l.share));

  // Répartition par classe thérapeutique (sur les produits dédupliqués).
  const groups = new Map<string, IqviaRow[]>();
  for (const r of iqviaProducts) {
    const c = r.cls ?? "—";
    (groups.get(c) ?? groups.set(c, []).get(c)!).push(r);
  }
  const grandTotal = iqviaProducts.reduce((s, r) => s + (r.valDzd ?? 0), 0) || 1;
  const classes: ClassRow[] = [...groups.entries()].map(([cls, rows]) => {
    const valueDzd = rows.reduce((s, r) => s + (r.valDzd ?? 0), 0);
    const volume = rows.reduce((s, r) => s + (r.vol ?? 0), 0);
    const players = new Set(rows.map((r) => r.lab).filter(Boolean)).size;
    const products = new Set(rows.map((r) => r.brand).filter(Boolean)).size;
    const growth = weightedGrowthPy(rows.map((r) => r.valDzd), rows.map((r) => r.growth));
    return { cls, valueDzd, valueUsd: valueDzd / DZD_PER_USD, share: valueDzd / grandTotal, growth, players, products, volume };
  }).sort((a, b) => b.valueDzd - a.valueDzd);

  // Momentum : classes matérielles (part ≥ 0,3 %) avec croissance connue.
  const material = classes.filter((c) => c.share >= 0.003 && c.growth != null);
  const mom = (c: ClassRow): MomRow => ({ cls: c.cls, growth: c.growth as number, share: c.share });
  const growers = [...material].sort((a, b) => (b.growth as number) - (a.growth as number)).slice(0, 12).map(mom);
  const decliners = [...material].sort((a, b) => (a.growth as number) - (b.growth as number)).slice(0, 12).map(mom);

  const labRows: OverviewLab[] = labs
    .slice()
    .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
    .slice(0, 40)
    .map((l) => ({ rank: l.rank ?? 0, lab: l.lab, valueDzd: l.valDzd ?? 0, valueUsd: l.valUsd ?? (l.valDzd ?? 0) / DZD_PER_USD, share: l.share ?? 0, growth: l.growth }));

  return {
    kpis: { valueDzd: totalDzd, valueUsd: totalDzd / DZD_PER_USD, growthPy: totalGrowth, volume: totalVol, nLabs, hhi, hhiLabel: hhiLabel(hhi) },
    classes: classes.slice(0, 40),
    labs: labRows,
    growers,
    decliners,
    meta: { iqviaFile: meta.iqviaFile, period: meta.period, nProducts: meta.nProducts },
  };
}
