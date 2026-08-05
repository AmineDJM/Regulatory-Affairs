/**
 * Moteur d'opportunités stratégiques — portage **fidèle** de market_engine.py +
 * analytics.py (matching DCI pharma-safe, fabricants locaux vs importateurs depuis
 * la Nomenclature, dimensionnement marché IQVIA + PCH, scoring d'opportunités).
 * Calculé sur données réelles, mis en cache (calcul unique).
 *
 * Validé contre le moteur d'origine : 531 DCI scorées, 343 éligibles,
 * 163 substitutions d'import ; top ALBUMINE HUMAINE, CETIRIZINE 16 fab./1 imp.
 */
import { getMarketData, DZD_PER_USD, SRC_IQVIA, SRC_PCH, type IqviaRow, type PchRow } from "./data";
import { weightedGrowthPy } from "./overview";
// Les primitives de texte vivent dans `text.ts` — un module PUR, sans `fs`, donc importable
// par les composants client. On les réexporte ici : les modules serveur historiques qui les
// importent depuis `engine` n'ont rien à changer.
import { normText, tokens, queryTokens } from "./text";

export { normText, tokens, queryTokens };

/** Teste si `text` contient le token `tok` borné (mêmes frontières que le moteur Python). */
function tokenInText(text: string, tok: string): boolean {
  try {
    return new RegExp(`(?<![A-Z0-9])${tok}(?![A-Z0-9])`).test(text);
  } catch {
    return text.includes(tok);
  }
}
export const allTokensIn = (text: string, qtokens: string[]) => qtokens.every((t) => tokenInText(text, t));

// ───────────────────────── Concurrence (Nomenclature) ─────────────────────────

export interface CompetitionRow {
  key: string; dci: string; manufacturers: number; importers: number; other: number;
  mfgLabs: string[]; impLabs: string[]; nomLines: number;
}

/** Fabricants locaux vs importateurs par DCI contrôlée (Nomenclature active). */
export function buildCompetition(): Map<string, CompetitionRow> {
  const { nom } = getMarketData();
  const groups = new Map<string, { dci: string; local: Set<string>; imp: Set<string>; other: Set<string>; lines: number }>();
  for (const r of nom) {
    if (r.src && r.src.toUpperCase() !== "ACTIVE") continue;
    const dci = (r.dci ?? "").trim();
    if (!dci) continue;
    const key = normText(dci);
    if (!key) continue;
    let g = groups.get(key);
    if (!g) { g = { dci, local: new Set(), imp: new Set(), other: new Set(), lines: 0 }; groups.set(key, g); }
    g.lines++;
    const lab = (r.lab ?? "").trim();
    if (lab) {
      if (r.origin === "LOCAL") g.local.add(lab);
      else if (r.origin === "IMPORT") g.imp.add(lab);
      else if (r.origin === "OTHER") g.other.add(lab);
    }
  }
  const out = new Map<string, CompetitionRow>();
  for (const [key, g] of groups) {
    out.set(key, {
      key, dci: g.dci, manufacturers: g.local.size, importers: g.imp.size, other: g.other.size,
      mfgLabs: [...g.local].sort(), impLabs: [...g.imp].sort(), nomLines: g.lines,
    });
  }
  return out;
}

// ───────────────────────── Marché par DCI (IQVIA + PCH) ─────────────────────────

interface MarketBySource { key: string; dci: string; source: string; valueDzd: number; volume: number; growth: number | null; labs: number; topProducts: string }

function iqviaMarketByDci(comp: Map<string, CompetitionRow>): MarketBySource[] {
  const { iqvia } = getMarketData();
  const grouped = new Map<string, IqviaRow[]>();
  for (const r of iqvia) {
    const m = r.mol ?? "";
    (grouped.get(m) ?? grouped.set(m, []).get(m)!).push(r);
  }
  const molNorms = [...grouped.keys()];
  const rows: MarketBySource[] = [];
  for (const d of comp.values()) {
    const key = d.key;
    let parts: IqviaRow[] = [];
    if (grouped.has(key)) {
      parts = grouped.get(key)!;
    } else {
      const qt = queryTokens(key);
      if (qt.length) {
        for (const mn of molNorms) {
          if (mn && allTokensIn(mn, qt)) parts = parts.concat(grouped.get(mn)!);
        }
      }
    }
    if (!parts.length) continue;
    // Déduplication par produit-présentation (un produit compté une fois).
    const byKey = new Map<string, IqviaRow>();
    for (const r of parts) {
      const k = r.key ?? `${r.brand}|${r.pres}|${r.lab}`;
      const cur = byKey.get(k);
      if (!cur || (r.valDzd ?? 0) > (cur.valDzd ?? 0)) byKey.set(k, r);
    }
    const m = [...byKey.values()];
    const value = m.reduce((s, r) => s + (r.valDzd ?? 0), 0);
    const volume = m.reduce((s, r) => s + (r.vol ?? 0), 0);
    const growth = weightedGrowthPy(m.map((r) => r.valDzd), m.map((r) => r.growth));
    const labs = new Set(m.map((r) => (r.lab ?? "").trim()).filter(Boolean)).size;
    const topProducts = [...m].sort((a, b) => (b.valDzd ?? 0) - (a.valDzd ?? 0)).slice(0, 5).map((r) => r.full ?? "").join("; ");
    rows.push({ key, dci: d.dci, source: SRC_IQVIA, valueDzd: value, volume, growth, labs, topProducts });
  }
  return rows;
}

function pchMarketByDci(comp: Map<string, CompetitionRow>): MarketBySource[] {
  const { pch } = getMarketData();
  // Index inversé sur les jetons (≥3) du texte normalisé PCH.
  const inv = new Map<string, Set<number>>();
  for (let i = 0; i < pch.length; i++) {
    for (const t of new Set(tokens(pch[i].text).filter((x) => x.length >= 3))) {
      (inv.get(t) ?? inv.set(t, new Set()).get(t)!).add(i);
    }
  }
  const rows: MarketBySource[] = [];
  for (const d of comp.values()) {
    const qt = queryTokens(d.key);
    if (!qt.length) continue;
    const sets = qt.map((t) => inv.get(t));
    if (sets.some((s) => !s || s.size === 0)) continue;
    let matched = [...(sets[0] as Set<number>)];
    for (let i = 1; i < sets.length; i++) { const s = sets[i] as Set<number>; matched = matched.filter((x) => s.has(x)); }
    if (!matched.length) continue;
    const m: PchRow[] = matched.map((i) => pch[i]).filter((r) => allTokensIn(r.text ?? "", qt));
    if (!m.length) continue;
    const value = m.reduce((s, r) => s + (r.valDzd ?? 0), 0);
    const volume = m.reduce((s, r) => s + (r.vol ?? 0), 0);
    const labs = new Set(m.map((r) => (r.lab ?? "").trim()).filter(Boolean)).size;
    const topProducts = [...m].sort((a, b) => (b.valDzd ?? 0) - (a.valDzd ?? 0)).slice(0, 5).map((r) => r.full ?? "").join("; ");
    rows.push({ key: d.key, dci: d.dci, source: SRC_PCH, valueDzd: value, volume, growth: null, labs, topProducts });
  }
  return rows;
}

// ───────────────────────── Recommandations / scoring ─────────────────────────

const SMALL_USD = 3_000_000, LARGE_USD = 7_000_000, MAX_MFG = 3;

export interface RecRow {
  key: string; dci: string; opportunityScore: number; recommendation: string; bucket: string;
  valueUsd: number; valueDzd: number; volume: number; growth: number | null;
  manufacturers: number; allowed: number; importers: number;
  importSubstitution: boolean; eligible: boolean; sources: string;
  mfgLabs: string; impLabs: string; topProducts: string; nomLines: number; labsDetected: number;
}

function allowedMfg(usd: number) { return usd >= LARGE_USD ? 3 : usd >= SMALL_USD ? 2 : 1; }
function bucket(usd: number) { return usd >= LARGE_USD ? "≥ $7M" : usd >= SMALL_USD ? "$3M–$7M" : "< $3M"; }
function recoLabel(mfg: number, allowed: number, imp: number) {
  if (mfg === 0 && imp > 0) return "🎯 Substitution import : aucun fabricant local, demande prouvée";
  if (mfg === 0) return "⚪ White space : aucun fabricant local";
  if (mfg < allowed) return "🟢 Attractif : concurrence locale sous le seuil";
  if (mfg === allowed) return "🟡 À étudier : concurrence au seuil";
  return "🔴 Saturé : trop de fabricants pour la taille";
}

let recsCache: RecRow[] | null = null;

/** Construit (une fois) la table des recommandations, triée comme le moteur d'origine. */
export function getRecommendations(): RecRow[] {
  if (recsCache) return recsCache;
  const comp = buildCompetition();
  const market = [...iqviaMarketByDci(comp), ...pchMarketByDci(comp)];

  // Agrégation par DCI à travers les sources.
  const agg = new Map<string, { key: string; dci: string; valueDzd: number; volume: number; sources: Set<string>; labsDetected: number; topProducts: string[]; rows: MarketBySource[] }>();
  for (const r of market) {
    const id = `${r.key}|${r.dci}`;
    let a = agg.get(id);
    if (!a) { a = { key: r.key, dci: r.dci, valueDzd: 0, volume: 0, sources: new Set(), labsDetected: 0, topProducts: [], rows: [] }; agg.set(id, a); }
    a.valueDzd += r.valueDzd; a.volume += r.volume; a.sources.add(r.source);
    a.labsDetected = Math.max(a.labsDetected, r.labs);
    if (r.topProducts) a.topProducts.push(r.topProducts);
    a.rows.push(r);
  }

  const rows: RecRow[] = [];
  for (const a of agg.values()) {
    const valueUsd = a.valueDzd / DZD_PER_USD;
    const growth = weightedGrowthPy(a.rows.map((r) => r.valueDzd), a.rows.map((r) => r.growth));
    const c = comp.get(a.key);
    const manufacturers = c?.manufacturers ?? 0;
    const importers = c?.importers ?? 0;
    const allowed = allowedMfg(valueUsd);
    rows.push({
      key: a.key, dci: a.dci, opportunityScore: 0, recommendation: recoLabel(manufacturers, allowed, importers),
      bucket: bucket(valueUsd), valueUsd, valueDzd: a.valueDzd, volume: a.volume, growth,
      manufacturers, allowed, importers,
      importSubstitution: manufacturers === 0 && importers > 0,
      eligible: manufacturers <= allowed && manufacturers <= MAX_MFG && valueUsd >= 0,
      sources: [...a.sources].sort().join(", "),
      mfgLabs: (c?.mfgLabs ?? []).slice(0, 12).join("; "), impLabs: (c?.impLabs ?? []).slice(0, 12).join("; "),
      topProducts: a.topProducts.slice(0, 3).filter(Boolean).join("; ").slice(0, 1000),
      nomLines: c?.nomLines ?? 0, labsDetected: a.labsDetected,
    });
  }

  // Score d'opportunité 0-100 : valeur (50) + faible concurrence locale (25) + demande import (10) + croissance (15).
  const maxUsd = Math.max(...rows.map((r) => r.valueUsd), 1);
  const denom = Math.log1p(maxUsd);
  for (const r of rows) {
    const valueScore = (Math.log1p(Math.max(r.valueUsd, 0)) / denom) * 50;
    const competitionScore = ((MAX_MFG - Math.min(r.manufacturers, MAX_MFG)) / MAX_MFG) * 25;
    const importerScore = (Math.min(r.importers, 6) / 6) * 10;
    const g = Math.max(-0.5, Math.min(0.5, r.growth ?? 0));
    const growthScore = (g + 0.5) * 15;
    r.opportunityScore = Math.round((valueScore + competitionScore + importerScore + growthScore) * 10) / 10;
  }

  rows.sort((a, b) =>
    Number(b.eligible) - Number(a.eligible) ||
    b.opportunityScore - a.opportunityScore ||
    b.valueUsd - a.valueUsd,
  );
  recsCache = rows;
  return rows;
}

export interface OpportunitiesResult {
  kpis: { count: number; marketSumUsd: number; importSubstitution: number; scoreMedian: number };
  rows: RecRow[];
  totalEligible: number;
  totalImportSub: number;
  totalScored: number;
}

/** Filtre les opportunités selon la vue (éligibles / substitution import / toutes). */
export function getOpportunities(view: "eligible" | "import_substitution" | "all" = "eligible", minUsd = 0, limit = 120): OpportunitiesResult {
  const all = getRecommendations();
  let shown = all;
  if (minUsd) shown = shown.filter((r) => r.valueUsd >= minUsd);
  if (view === "import_substitution") shown = shown.filter((r) => r.importSubstitution);
  else if (view === "eligible") shown = shown.filter((r) => r.eligible);
  shown = shown.slice(0, limit);
  const scores = shown.map((r) => r.opportunityScore).sort((a, b) => a - b);
  const median = scores.length
    ? (scores.length % 2 ? scores[(scores.length - 1) / 2] : (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2)
    : 0;
  return {
    kpis: {
      count: shown.length,
      marketSumUsd: shown.reduce((s, r) => s + r.valueUsd, 0),
      importSubstitution: shown.filter((r) => r.importSubstitution).length,
      scoreMedian: median,
    },
    rows: shown,
    totalEligible: all.filter((r) => r.eligible).length,
    totalImportSub: all.filter((r) => r.importSubstitution).length,
    totalScored: all.length,
  };
}
