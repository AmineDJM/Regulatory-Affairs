/**
 * Explorateur de produits (Intelligence marché) — recherche + filtres sur les produits
 * IQVIA dédupliqués (marché de ville), pour comparer un ou plusieurs produits sur le
 * volume, la valeur (DZD/USD), le prix unitaire moyen et la croissance N-1.
 * Données réelles (IQVIA), aucune simulation.
 */
import { getMarketData, DZD_PER_USD, type IqviaRow } from "./data";
import { normText } from "./engine";

export interface MarketProduct {
  key: string;
  brand: string;
  mol: string;
  lab: string;
  cls: string;
  pres: string;
  valueDzd: number;
  valueUsd: number;
  volume: number;
  /** Prix unitaire moyen = valeur / volume (null si volume nul). */
  avgPriceDzd: number | null;
  growth: number | null;
}

export interface ProductSearchInput {
  q?: string | null;
  cls?: string | null;
  lab?: string | null;
  limit?: number;
}

export interface ProductSearchResult {
  products: MarketProduct[];
  /** Nombre TOTAL de produits correspondant au filtre (avant plafonnement). */
  total: number;
}

const clean = (s: string | null | undefined) => (s ?? "").trim();

function toProduct(r: IqviaRow): MarketProduct {
  const valueDzd = r.valDzd ?? 0;
  const volume = r.vol ?? 0;
  return {
    key: r.key ?? `${r.brand}|${r.pres}|${r.lab}`,
    brand: clean(r.brand) || "—",
    mol: clean(r.mol),
    lab: clean(r.lab) || "—",
    cls: clean(r.cls),
    pres: clean(r.pres),
    valueDzd,
    valueUsd: valueDzd / DZD_PER_USD,
    volume,
    avgPriceDzd: volume > 0 ? valueDzd / volume : null,
    growth: r.growth,
  };
}

/**
 * Recherche des produits par texte libre (marque / molécule / labo / présentation /
 * classe) et filtres exacts (classe, laboratoire). Trie par valeur décroissante et
 * plafonne le nombre de résultats renvoyés (le total réel est renvoyé à part).
 */
export function searchProducts(input: ProductSearchInput): ProductSearchResult {
  const { iqviaProducts } = getMarketData();
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 200);
  // Jetons de recherche (≥ 2 caractères) : correspondance par sous-chaîne, tolérante.
  const qTokens = input.q ? normText(input.q).split(" ").filter((t) => t.length >= 2) : [];
  const cls = clean(input.cls);
  const lab = clean(input.lab);

  const matches: IqviaRow[] = [];
  for (const r of iqviaProducts) {
    if (cls && clean(r.cls) !== cls) continue;
    if (lab && clean(r.lab) !== lab) continue;
    if (qTokens.length) {
      const hay = normText(`${r.brand ?? ""} ${r.mol ?? ""} ${r.lab ?? ""} ${r.pres ?? ""} ${r.cls ?? ""}`);
      if (!qTokens.every((t) => hay.includes(t))) continue;
    }
    matches.push(r);
  }
  matches.sort((a, b) => (b.valDzd ?? 0) - (a.valDzd ?? 0));
  return { products: matches.slice(0, limit).map(toProduct), total: matches.length };
}
