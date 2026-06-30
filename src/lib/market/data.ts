/**
 * Intelligence marché (Business Development) — chargement des données normalisées
 * **réelles** issues de Pharmatool : IQVIA (marché de ville), PCH (réceptions
 * hospitalières) et Nomenclature (enregistrements). Les fichiers sont des NDJSON
 * compressés (gzip) exportés une fois depuis le moteur Python d'origine — le
 * runtime reste 100 % TypeScript. Chargement paresseux + mise en cache mémoire.
 *
 * Aucune donnée simulée : ce sont les jeux de données officiels (IQVIA 2026,
 * Nomenclature avril 2026, réceptions PCH 2025), réconciliés aux totaux officiels.
 */
import { readFileSync } from "fs";
import { gunzipSync } from "zlib";
import path from "path";

export interface IqviaRow {
  cls: string; mol: string | null; lab: string | null; brand: string | null;
  pres: string | null; full: string | null; key: string | null;
  valDzd: number | null; vol: number | null; growth: number | null;
}
export interface PchRow {
  cls: string | null; lab: string | null; full: string | null; text: string | null;
  forme: string | null; qte: number | null; unitPrice: number | null; devise: string | null;
  date: string | null; cond: string | null; valDzd: number | null; vol: number | null;
}
export interface NomRow {
  dci: string | null; dciNorm: string | null; brand: string | null; lab: string | null;
  origin: string | null; src: string | null; pays: string | null; forme: string | null;
  dosage: string | null; brandNorm: string | null; formeNorm: string | null; dosageNorm: string | null;
  status: string | null; enrInit: string | null; enrFinal: string | null; full: string | null;
}
export interface LabRow {
  lab: string; valDzd: number | null; valUsd: number | null; vol: number | null;
  share: number | null; growth: number | null; rank: number | null;
}
export interface MarketMeta {
  dzdPerUsd: number; iqviaFile: string; period: string;
  nIqvia: number; nProducts: number; nPch: number; nNom: number; nLabs: number;
}

const DIR = path.join(process.cwd(), "src", "data", "market");

function loadNdjson<T>(file: string): T[] {
  const raw = gunzipSync(readFileSync(path.join(DIR, file))).toString("utf8");
  const out: T[] = [];
  for (const line of raw.split("\n")) {
    if (line.trim()) out.push(JSON.parse(line) as T);
  }
  return out;
}

interface Cache {
  iqvia: IqviaRow[]; pch: PchRow[]; nom: NomRow[]; labs: LabRow[]; meta: MarketMeta;
  iqviaProducts: IqviaRow[]; // dédupliqués par PROD_KEY (un produit-présentation = une ligne)
}
let cache: Cache | null = null;

/** Charge (une fois) et met en cache les jeux de données marché. */
export function getMarketData(): Cache {
  if (cache) return cache;
  const iqvia = loadNdjson<IqviaRow>("iqvia.ndjson.gz");
  const pch = loadNdjson<PchRow>("pch.ndjson.gz");
  const nom = loadNdjson<NomRow>("nom.ndjson.gz");
  const labs = loadNdjson<LabRow>("labs.ndjson.gz");
  const meta = JSON.parse(readFileSync(path.join(DIR, "meta.json"), "utf8")) as MarketMeta;

  // Déduplication par clé produit-présentation (la molécule se répète dans IQVIA ;
  // on garde la ligne de plus forte valeur, identique pour les doublons de molécule).
  const byKey = new Map<string, IqviaRow>();
  for (const r of iqvia) {
    const k = r.key ?? `${r.brand}|${r.pres}|${r.lab}`;
    const cur = byKey.get(k);
    if (!cur || (r.valDzd ?? 0) > (cur.valDzd ?? 0)) byKey.set(k, r);
  }
  const iqviaProducts = [...byKey.values()];

  cache = { iqvia, pch, nom, labs, meta, iqviaProducts };
  return cache;
}

export const DZD_PER_USD = 135.0;
export const SRC_IQVIA = "IQVIA VILLE";
export const SRC_PCH = "PCH HOSPITALIER";
