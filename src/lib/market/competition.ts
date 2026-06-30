/**
 * Paysage concurrentiel — analyse du marché de deux façons :
 *   • à l'intérieur d'une classe thérapeutique (ATC4) : acteurs, parts, croissance,
 *     concentration HHI ;
 *   • pour un laboratoire donné : portefeuille par classe et par produit.
 * Portage fidèle de market_engine.class_competition / lab_portfolio (Pharmatool),
 * calculé sur les produits IQVIA dédupliqués. Données réelles, aucune simulation.
 */
import { getMarketData, DZD_PER_USD, type IqviaRow } from "./data";
import { weightedGrowthPy, computeHhi, hhiLabel } from "./overview";

const clean = (s: string | null | undefined) => (s ?? "").trim();
const isTotal = (s: string) => ["grand total", "total", "nan", ""].includes(s.toLowerCase());

/** Classes thérapeutiques (ATC4) distinctes, triées par valeur de marché décroissante. */
export function classList(): string[] {
  const { iqviaProducts } = getMarketData();
  const val = new Map<string, number>();
  for (const r of iqviaProducts) {
    const c = clean(r.cls);
    if (!c || isTotal(c)) continue;
    val.set(c, (val.get(c) ?? 0) + (r.valDzd ?? 0));
  }
  return [...val.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

/** Laboratoires distincts, triés par valeur de marché décroissante. */
export function labList(): string[] {
  const { iqviaProducts } = getMarketData();
  const val = new Map<string, number>();
  for (const r of iqviaProducts) {
    const l = clean(r.lab);
    if (!l || isTotal(l)) continue;
    val.set(l, (val.get(l) ?? 0) + (r.valDzd ?? 0));
  }
  return [...val.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
}

export interface CompLabRow { lab: string; valueDzd: number; valueUsd: number; volume: number; products: number; share: number; growth: number | null }
export interface CompProductRow { brand: string; lab: string; valueDzd: number; valueUsd: number; volume: number; share: number; growth: number | null }
export interface ClassCompetitionSummary {
  cls: string; valueDzd: number; valueUsd: number; volume: number; growth: number | null;
  nLabs: number; nProducts: number; hhi: number | null; hhiLabel: string; leader: string; leaderShare: number | null;
}
export interface ClassCompetition { labs: CompLabRow[]; products: CompProductRow[]; summary: ClassCompetitionSummary }

function groupSum(rows: IqviaRow[]) {
  const value = rows.reduce((s, r) => s + (r.valDzd ?? 0), 0);
  const volume = rows.reduce((s, r) => s + (r.vol ?? 0), 0);
  const growth = weightedGrowthPy(rows.map((r) => r.valDzd), rows.map((r) => r.growth));
  return { value, volume, growth };
}

/** Paysage concurrentiel d'une classe thérapeutique : labos + produits + synthèse. */
export function getClassCompetition(className: string): ClassCompetition | null {
  const { iqviaProducts } = getMarketData();
  if (!className) return null;
  const sub = iqviaProducts.filter((r) => clean(r.cls) === className.trim());
  if (!sub.length) return null;
  const total = sub.reduce((s, r) => s + (r.valDzd ?? 0), 0);

  // Par laboratoire.
  const byLab = new Map<string, IqviaRow[]>();
  for (const r of sub) {
    const l = clean(r.lab) || "—";
    (byLab.get(l) ?? byLab.set(l, []).get(l)!).push(r);
  }
  const labs: CompLabRow[] = [...byLab.entries()].map(([lab, rows]) => {
    const { value, volume, growth } = groupSum(rows);
    const products = new Set(rows.map((r) => clean(r.brand)).filter(Boolean)).size;
    return { lab, valueDzd: value, valueUsd: value / DZD_PER_USD, volume, products, share: total > 0 ? value / total : 0, growth };
  }).sort((a, b) => b.valueDzd - a.valueDzd);

  // Par produit (BRAND × LABORATOIRE).
  const byProd = new Map<string, IqviaRow[]>();
  for (const r of sub) {
    const k = `${clean(r.brand)}|${clean(r.lab)}`;
    (byProd.get(k) ?? byProd.set(k, []).get(k)!).push(r);
  }
  const products: CompProductRow[] = [...byProd.values()].map((rows) => {
    const { value, volume, growth } = groupSum(rows);
    return { brand: clean(rows[0].brand) || "—", lab: clean(rows[0].lab) || "—", valueDzd: value, valueUsd: value / DZD_PER_USD, volume, share: total > 0 ? value / total : 0, growth };
  }).sort((a, b) => b.valueDzd - a.valueDzd);

  const hhi = computeHhi(labs.map((l) => l.share));
  const summary: ClassCompetitionSummary = {
    cls: className, valueDzd: total, valueUsd: total / DZD_PER_USD,
    volume: sub.reduce((s, r) => s + (r.vol ?? 0), 0),
    growth: weightedGrowthPy(sub.map((r) => r.valDzd), sub.map((r) => r.growth)),
    nLabs: labs.length, nProducts: new Set(sub.map((r) => clean(r.brand)).filter(Boolean)).size,
    hhi, hhiLabel: hhiLabel(hhi),
    leader: labs[0]?.lab ?? "—", leaderShare: labs[0]?.share ?? null,
  };
  return { labs, products, summary };
}

export interface LabClassRow { cls: string; valueDzd: number; valueUsd: number; volume: number; products: number; growth: number | null }
export interface LabProductRow { brand: string; presentation: string; cls: string; valueDzd: number; volume: number; growth: number | null }
export interface LabPortfolioSummary { lab: string; valueDzd: number; valueUsd: number; growth: number | null; nClasses: number; nProducts: number }
export interface LabPortfolio { byClass: LabClassRow[]; products: LabProductRow[]; summary: LabPortfolioSummary }

/** Portefeuille d'un laboratoire : répartition par classe et par produit. */
export function getLabPortfolio(labName: string): LabPortfolio | null {
  const { iqviaProducts } = getMarketData();
  if (!labName) return null;
  const sub = iqviaProducts.filter((r) => clean(r.lab) === labName.trim());
  if (!sub.length) return null;

  const byClass = new Map<string, IqviaRow[]>();
  for (const r of sub) {
    const c = clean(r.cls) || "—";
    (byClass.get(c) ?? byClass.set(c, []).get(c)!).push(r);
  }
  const classes: LabClassRow[] = [...byClass.entries()].map(([cls, rows]) => {
    const { value, volume, growth } = groupSum(rows);
    return { cls, valueDzd: value, valueUsd: value / DZD_PER_USD, volume, products: new Set(rows.map((r) => clean(r.brand)).filter(Boolean)).size, growth };
  }).sort((a, b) => b.valueDzd - a.valueDzd);

  const products: LabProductRow[] = sub.map((r) => ({
    brand: clean(r.brand) || "—", presentation: clean(r.pres) || "—", cls: clean(r.cls) || "—",
    valueDzd: r.valDzd ?? 0, volume: r.vol ?? 0, growth: r.growth ?? null,
  })).sort((a, b) => b.valueDzd - a.valueDzd);

  const total = sub.reduce((s, r) => s + (r.valDzd ?? 0), 0);
  const summary: LabPortfolioSummary = {
    lab: labName, valueDzd: total, valueUsd: total / DZD_PER_USD,
    growth: weightedGrowthPy(sub.map((r) => r.valDzd), sub.map((r) => r.growth)),
    nClasses: classes.length, nProducts: new Set(sub.map((r) => clean(r.brand)).filter(Boolean)).size,
  };
  return { byClass: classes, products, summary };
}
