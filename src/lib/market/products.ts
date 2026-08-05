/**
 * Explorateur de produits (Intelligence marché) — recherche + filtres sur DEUX marchés :
 *   • VILLE — produits IQVIA dédupliqués (marché de ville) ;
 *   • HÔPITAL — réceptions PCH (marché hospitalier), agrégées par produit.
 * Pour comparer un ou plusieurs produits sur le volume, la valeur (DZD/USD), le prix unitaire
 * moyen et la croissance N-1 (croissance uniquement disponible côté ville).
 * Données réelles (IQVIA + PCH), aucune simulation.
 */
import { getMarketData, DZD_PER_USD, type IqviaRow } from "./data";
import { normText } from "./engine";
import { moleculeMatches, canonicalForm, extractDosage, dosageMatches, labKey, type GalenicForm } from "./molecule";

export type MarketSegment = "VILLE" | "HOPITAL";

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
  /** Marché d'origine : ville (IQVIA) ou hôpital (PCH). */
  segment: MarketSegment;
}

export interface ProductSearchInput {
  /** Recherche libre (tous champs confondus) — conservée pour la compatibilité. */
  q?: string | null;
  /**
   * Recherche CIBLÉE : on cherche par le champ que l'on remplit.
   *  • `molecule` → principe actif, comparé par RADICAL (« AMOXICILLIN » ≡ « AMOXICILLINE ») ;
   *  • `brand`    → nom commercial du produit ;
   *  • `labName`  → laboratoire, réconcilié entre les trois sources (« SAIDAL » ≡ « GROUPE SAIDAL »).
   * Les champs remplis se cumulent (ET logique).
   */
  molecule?: string | null;
  brand?: string | null;
  labName?: string | null;
  /** Forme galénique canonique (comprimé, injectable…). */
  form?: GalenicForm | null;
  /** Dosage (« 500 mg », « 1g/125mg »). */
  dosage?: string | null;
  cls?: string | null;
  lab?: string | null;
  /** Segment de marché ; absent = les deux (ville + hôpital). */
  segment?: MarketSegment | null;
  limit?: number;
}

export interface ProductSearchResult {
  products: MarketProduct[];
  /** Nombre TOTAL de produits correspondant au filtre (avant plafonnement). */
  total: number;
}

const clean = (s: string | null | undefined) => (s ?? "").trim();

// ───────────────────────── Marché hospitalier (PCH), agrégé par produit ─────────────────────────

interface PchProduct { key: string; name: string; mol: string; lab: string; cls: string; forme: string; valueDzd: number; volume: number }
let pchCache: PchProduct[] | null = null;

/** Réceptions PCH agrégées par (produit + laboratoire) : valeur et volume cumulés. */
function getPchProducts(): PchProduct[] {
  if (pchCache) return pchCache;
  const { pch } = getMarketData();
  const byKey = new Map<string, PchProduct>();
  for (const r of pch) {
    const name = clean(r.full) || clean(r.text);
    if (!name) continue;
    const lab = clean(r.lab);
    const k = `${name}|${lab}`;
    const cur = byKey.get(k);
    if (cur) {
      cur.valueDzd += r.valDzd ?? 0;
      cur.volume += r.vol ?? r.qte ?? 0;
    } else {
      byKey.set(k, { key: `PCH|${k}`, name, mol: clean(r.text), lab: lab || "—", cls: clean(r.cls), forme: clean(r.forme), valueDzd: r.valDzd ?? 0, volume: r.vol ?? r.qte ?? 0 });
    }
  }
  pchCache = [...byKey.values()];
  return pchCache;
}

function toVilleProduct(r: IqviaRow): MarketProduct {
  const valueDzd = r.valDzd ?? 0;
  const volume = r.vol ?? 0;
  return {
    key: r.key ?? `${r.brand}|${r.pres}|${r.lab}`,
    brand: clean(r.brand) || "—", mol: clean(r.mol), lab: clean(r.lab) || "—", cls: clean(r.cls), pres: clean(r.pres),
    valueDzd, valueUsd: valueDzd / DZD_PER_USD, volume, avgPriceDzd: volume > 0 ? valueDzd / volume : null,
    growth: r.growth, segment: "VILLE",
  };
}

function toHopitalProduct(p: PchProduct): MarketProduct {
  return {
    key: p.key, brand: p.name, mol: p.mol, lab: p.lab, cls: p.cls, pres: "",
    valueDzd: p.valueDzd, valueUsd: p.valueDzd / DZD_PER_USD, volume: p.volume,
    avgPriceDzd: p.volume > 0 ? p.valueDzd / p.volume : null,
    growth: null, segment: "HOPITAL",
  };
}

/** Options des filtres (classes ATC4, laboratoires) — UNION des deux marchés. */
export function productFilterOptions(): { classes: string[]; labs: string[] } {
  const classes = new Set<string>();
  const labs = new Set<string>();
  for (const r of getMarketData().iqviaProducts) {
    const c = clean(r.cls); const l = clean(r.lab);
    if (c) classes.add(c);
    if (l) labs.add(l);
  }
  for (const p of getPchProducts()) {
    if (p.cls) classes.add(p.cls);
    if (p.lab && p.lab !== "—") labs.add(p.lab);
  }
  return { classes: [...classes].sort((a, b) => a.localeCompare(b)), labs: [...labs].sort((a, b) => a.localeCompare(b)) };
}

/**
 * Recherche des produits par texte libre (marque / molécule / labo / présentation / classe) et
 * filtres exacts (classe, laboratoire, segment de marché). Trie par valeur décroissante et plafonne
 * le nombre de résultats renvoyés (le total réel est renvoyé à part).
 */
export function searchProducts(input: ProductSearchInput): ProductSearchResult {
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 200);
  const qTokens = input.q ? normText(input.q).split(" ").filter((t) => t.length >= 2) : [];
  const cls = clean(input.cls);
  const lab = clean(input.lab);
  const segment = input.segment ?? null;

  // Critères CIBLÉS : on cherche par la case que l'on remplit.
  const molecule = clean(input.molecule);
  const brandTokens = input.brand ? normText(input.brand).split(" ").filter((t) => t.length >= 2) : [];
  const labNeedle = input.labName ? labKey(input.labName) : "";
  const form = input.form ?? null;
  const dosage = clean(input.dosage);

  const matches: MarketProduct[] = [];

  if (segment !== "HOPITAL") {
    for (const r of getMarketData().iqviaProducts) {
      if (cls && clean(r.cls) !== cls) continue;
      if (lab && clean(r.lab) !== lab) continue;
      if (molecule && !moleculeMatches(r.mol, molecule)) continue;
      if (brandTokens.length) {
        const b = normText(r.brand);
        if (!brandTokens.every((t) => b.includes(t))) continue;
      }
      if (labNeedle && labKey(r.lab) !== labNeedle) continue;
      if (form && canonicalForm(r.pres) !== form) continue;
      if (dosage && !dosageMatches(extractDosage(r.pres), dosage)) continue;
      if (qTokens.length) {
        const hay = normText(`${r.brand ?? ""} ${r.mol ?? ""} ${r.lab ?? ""} ${r.pres ?? ""} ${r.cls ?? ""}`);
        if (!qTokens.every((t) => hay.includes(t))) continue;
      }
      matches.push(toVilleProduct(r));
    }
  }
  if (segment !== "VILLE") {
    for (const p of getPchProducts()) {
      if (cls && p.cls !== cls) continue;
      if (lab && p.lab !== lab) continue;
      if (molecule && !moleculeMatches(p.mol || p.name, molecule)) continue;
      if (brandTokens.length) {
        const b = normText(p.name);
        if (!brandTokens.every((t) => b.includes(t))) continue;
      }
      if (labNeedle && labKey(p.lab) !== labNeedle) continue;
      if (form && canonicalForm(p.forme || p.name) !== form) continue;
      if (dosage && !dosageMatches(extractDosage(p.name), dosage)) continue;
      if (qTokens.length) {
        const hay = normText(`${p.name} ${p.mol} ${p.lab} ${p.cls}`);
        if (!qTokens.every((t) => hay.includes(t))) continue;
      }
      matches.push(toHopitalProduct(p));
    }
  }

  matches.sort((a, b) => b.valueDzd - a.valueDzd);
  return { products: matches.slice(0, limit), total: matches.length };
}
