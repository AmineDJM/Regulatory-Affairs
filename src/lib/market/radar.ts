/**
 * Radar — fenêtres de marché : nouvelles AMM récentes sur marchés peu concurrentiels,
 * white spaces (aucun fabricant local), et expirations d'enregistrements à venir.
 * Portage fidèle des endpoints /api/radar/* (backend Pharmatool). Données réelles.
 */
import { getMarketData } from "./data";
import { getRecommendations, normText, type RecRow } from "./engine";

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
const addMonths = (d: Date, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const addYears = (d: Date, y: number) => { const x = new Date(d); x.setFullYear(x.getFullYear() + y); return x; };

export interface DciDate { lastReg: Date | null; nextExpiry: Date | null; registrations: number }

let datesCache: Map<string, DciDate> | null = null;
/** Calendrier d'enregistrement par DCI (dernière AMM initiale, expiration la plus proche). */
export function getDciDates(): Map<string, DciDate> {
  if (datesCache) return datesCache;
  const { nom } = getMarketData();
  const out = new Map<string, DciDate>();
  for (const r of nom) {
    if (r.src && r.src.toUpperCase() !== "ACTIVE") continue;
    const dci = (r.dci ?? "").trim();
    if (!dci) continue;
    const key = normText(dci);
    const cur = out.get(key) ?? { lastReg: null, nextExpiry: null, registrations: 0 };
    cur.registrations++;
    const init = parseDate(r.enrInit), fin = parseDate(r.enrFinal);
    if (init && (!cur.lastReg || init > cur.lastReg)) cur.lastReg = init;
    if (fin && (!cur.nextExpiry || fin > cur.nextExpiry)) cur.nextExpiry = fin;
    out.set(key, cur);
  }
  datesCache = out;
  return out;
}

export interface RadarNewRow extends RecRow { lastRegistration: string | null; concurrents: number }

/** Nouvelles AMM récentes sur des marchés à valeur et faible concurrence. */
export function getRadarNew(months = 6, minUsd = 500_000, maxCompetitors = 2) {
  const recs = getRecommendations();
  const dates = getDciDates();
  const cutoff = addMonths(new Date(), -months);
  const rows: RadarNewRow[] = [];
  for (const r of recs) {
    const d = dates.get(r.key);
    const concurrents = r.manufacturers + r.importers;
    if (!d?.lastReg || d.lastReg < cutoff) continue;
    if (r.valueUsd < minUsd || concurrents > maxCompetitors) continue;
    rows.push({ ...r, lastRegistration: d.lastReg.toISOString().slice(0, 10), concurrents });
  }
  rows.sort((a, b) => b.valueUsd - a.valueUsd);
  const med = rows.map((r) => r.valueUsd).sort((a, b) => a - b);
  return {
    rows,
    kpis: {
      count: rows.length,
      marketSumUsd: rows.reduce((s, r) => s + r.valueUsd, 0),
      whiteSpace: rows.filter((r) => r.manufacturers === 0).length,
      marketMedianUsd: med.length ? med[Math.floor((med.length - 1) / 2)] : 0,
    },
  };
}

/** White spaces : DCI sans aucun fabricant local mais avec un marché significatif. */
export function getRadarWhite(minUsd = 300_000) {
  const recs = getRecommendations().filter((r) => r.manufacturers === 0 && r.valueUsd >= minUsd);
  recs.sort((a, b) => b.valueUsd - a.valueUsd);
  const med = recs.map((r) => r.valueUsd).sort((a, b) => a - b);
  return {
    rows: recs,
    kpis: {
      count: recs.length,
      marketSumUsd: recs.reduce((s, r) => s + r.valueUsd, 0),
      withImportDemand: recs.filter((r) => r.importers > 0).length,
      marketMedianUsd: med.length ? med[Math.floor((med.length - 1) / 2)] : 0,
    },
  };
}

export interface ExpirationRow {
  dci: string; produit: string; laboratoire: string; pays: string; origine: string;
  forme: string; dosage: string; derniereDecision: string | null; echeance: string;
}

/** Enregistrements dont l'échéance estimée (dernière décision + validité) approche. */
export function getRadarExpirations(validity = 5, horizon = 24) {
  const { nom } = getMarketData();
  const now = new Date();
  const lower = addMonths(now, -6);
  const upper = addMonths(now, horizon);
  const rows: (ExpirationRow & { _e: number })[] = [];
  for (const r of nom) {
    if (r.src && r.src.toUpperCase() !== "ACTIVE") continue;
    const last = parseDate(r.enrFinal) ?? parseDate(r.enrInit);
    if (!last) continue;
    const ech = addYears(last, validity);
    if (ech < lower || ech > upper) continue;
    rows.push({
      dci: r.dci ?? "—", produit: r.brand ?? "—", laboratoire: r.lab ?? "—", pays: r.pays ?? "—",
      origine: r.origin ?? "—", forme: r.forme ?? "—", dosage: r.dosage ?? "—",
      derniereDecision: parseDate(r.enrFinal)?.toISOString().slice(0, 10) ?? null,
      echeance: ech.toISOString().slice(0, 10), _e: ech.getTime(),
    });
  }
  rows.sort((a, b) => a._e - b._e);
  const out = rows.map(({ _e, ...x }) => x);
  return {
    rows: out,
    kpis: {
      count: out.length,
      nDci: new Set(out.map((r) => r.dci)).size,
      nLabs: new Set(out.map((r) => r.laboratoire)).size,
      imported: out.filter((r) => r.origine === "IMPORT").length,
    },
  };
}
