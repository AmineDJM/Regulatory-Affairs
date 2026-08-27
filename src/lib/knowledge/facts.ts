/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LE CODE SAIT LIRE TOUT SEUL — dates, langue, montants, échéances.
 *
 * ── POURQUOI C'EST ICI ET PAS DANS UN APPEL DE MODÈLE ────────────────────────────────────
 *
 * §2, littéralement : « ne jamais appeler un modèle pour une donnée que le code sait déjà
 * comprendre parfaitement ». « 12/03/2026 » est une date. « Le présent contrat prend effet le
 * 1er avril 2026 » contient une date. Un modèle rendrait le même résultat, en 800 ms, contre
 * facturation, et avec le droit de se tromper de siècle.
 *
 * ── LE PIÈGE DU JOUR ET DU MOIS ──────────────────────────────────────────────────────────
 *
 * « 03/04/2026 » est le 3 avril en France et le 4 mars aux États-Unis. L'ERP est algérien et
 * francophone : le format est JJ/MM/AAAA, et c'est écrit ici plutôt que supposé ailleurs. Quand
 * le premier nombre dépasse 12, l'ambiguïté se lève d'elle-même et sert de contrôle.
 *
 * ── CE QU'ON NE FAIT PAS ─────────────────────────────────────────────────────────────────
 *
 * On ne DEVINE pas l'année manquante. « le 12 mars » sans année ne devient pas « 12 mars de
 * l'année en cours » : ce serait fabriquer un fait à partir du hasard de la date d'exécution, et
 * ce fait irait ensuite s'afficher comme s'il venait du document.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const fold = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** JJ/MM/AAAA, JJ-MM-AAAA, JJ.MM.AAAA — et la variante à deux chiffres d'année. */
const NUMERIC_DATE = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g;
/** AAAA-MM-JJ — le format ISO, sans ambiguïté possible. */
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
/** « 1er avril 2026 », « 12 mars 2025 ». */
const TEXT_DATE = /\b(\d{1,2})(?:er)?\s+([a-zA-Zéûôà]+)\s+(\d{4})\b/g;

/**
 * TOUTES LES DATES D'UN TEXTE, dédoublonnées, en ISO (AAAA-MM-JJ).
 *
 * Une date invalide (« 32/13/2026 ») est écartée sans bruit : c'est presque toujours un numéro de
 * série ou une référence qui ressemble à une date, pas une erreur à signaler.
 */
export function extractDates(text: string, max = 20): string[] {
  if (!text) return [];
  const out = new Set<string>();

  for (const m of text.matchAll(ISO_DATE)) {
    const iso = validIso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) out.add(iso);
  }
  for (const m of text.matchAll(NUMERIC_DATE)) {
    const [d, mo] = [Number(m[1]), Number(m[2])];
    const y = normalizeYear(Number(m[3]), m[3].length);
    if (y == null) continue;
    // JJ/MM en français. Si le premier nombre est un mois plausible et le second non, le document
    // est probablement en format américain : on inverse plutôt que de jeter la date.
    const iso = validIso(y, mo, d) ?? (d <= 12 && mo > 12 ? validIso(y, d, mo) : null);
    if (iso) out.add(iso);
  }
  for (const m of text.matchAll(TEXT_DATE)) {
    const month = MONTHS[fold(m[2])];
    if (!month) continue;
    const iso = validIso(Number(m[3]), month, Number(m[1]));
    if (iso) out.add(iso);
  }

  return [...out].sort().slice(0, max);
}

function normalizeYear(y: number, digits: number): number | null {
  if (digits === 4) return y >= 1900 && y <= 2200 ? y : null;
  // Deux chiffres : le siècle se choisit sur la charnière habituelle des systèmes de gestion.
  if (digits === 2) return y <= 79 ? 2000 + y : 1900 + y;
  return null;
}

function validIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Le report automatique de JavaScript (« 31 février » → 3 mars) est précisément ce qu'on refuse.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * LA DATE DU DOCUMENT — la plus ancienne date plausible trouvée dans son EN-TÊTE.
 *
 * Pourquoi l'en-tête et pas tout le texte : un contrat cite des échéances futures et des dates
 * historiques ; celle qui le date est en haut, à côté du lieu et de l'objet. Prendre la première
 * date du document entier donnerait souvent une échéance de la dernière page.
 */
export function documentDateOf(text: string, headLength = 1500): Date | null {
  const dates = extractDates(text.slice(0, headLength));
  if (!dates.length) return null;
  // Parmi les dates de l'en-tête, la plus RÉCENTE est la date d'émission : les plus anciennes sont
  // presque toujours des références (« notre courrier du 3 janvier »).
  const iso = dates[dates.length - 1];
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ────────────────────────────────── La langue ──────────────────────────────────

/**
 * LA LANGUE, par comptage de mots-témoins. Trois valeurs seulement — celles que l'entreprise
 * manipule réellement — et `null` quand rien ne tranche.
 *
 * L'arabe se reconnaît à son ALPHABET, ce qui est plus sûr que n'importe quelle liste de mots :
 * c'est un test sur les points de code, pas sur le vocabulaire.
 */
export function detectLanguage(text: string): "fr" | "en" | "ar" | null {
  const t = text.slice(0, 4000);
  if (!t.trim()) return null;

  const arabic = (t.match(/[؀-ۿ]/g) ?? []).length;
  if (arabic > t.length * 0.1) return "ar";

  const words = fold(t).match(/[a-z]+/g) ?? [];
  if (words.length < 12) return null;
  const FR = new Set(["le", "la", "les", "des", "une", "est", "pour", "dans", "sur", "avec", "par", "que", "qui", "aux", "cette", "nous", "vous", "sont", "plus"]);
  const EN = new Set(["the", "and", "for", "with", "that", "this", "are", "from", "have", "was", "will", "shall", "been", "were", "which", "you", "not"]);
  let fr = 0, en = 0;
  for (const w of words) { if (FR.has(w)) fr += 1; else if (EN.has(w)) en += 1; }
  // Une marge est exigée : sous cet écart, le texte est probablement bilingue ou trop court, et
  // « je ne sais pas » vaut mieux qu'un drapeau posé à pile ou face.
  if (fr === 0 && en === 0) return null;
  if (fr >= en * 1.5) return "fr";
  if (en >= fr * 1.5) return "en";
  return null;
}

// ────────────────────────────────── Les montants ──────────────────────────────────

/** Un montant repéré, avec sa devise quand elle est écrite. */
export interface Amount {
  value: number;
  currency: "DZD" | "EUR" | "USD" | null;
  raw: string;
}

const AMOUNT_RE = /\b(\d{1,3}(?:[  .,]\d{3})+|\d+(?:[.,]\d{1,2})?)\s*(DA|DZD|dinars?|€|EUR|euros?|\$|USD|dollars?)\b/gi;

/**
 * LES MONTANTS D'UN TEXTE. La séparation milliers/décimales est le vrai piège : « 1.500 » est mille
 * cinq cents en français et un virgule cinq en anglais. On tranche par la TAILLE du groupe final —
 * trois chiffres après un séparateur, c'est un millier, pas des centimes.
 */
export function extractAmounts(text: string, max = 12): Amount[] {
  const out: Amount[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const value = parseAmount(m[1]);
    if (value == null) continue;
    out.push({ value, currency: currencyOf(m[2]), raw: m[0].trim() });
    if (out.length >= max) break;
  }
  return out;
}

function parseAmount(raw: string): number | null {
  const s = raw.replace(/[  ]/g, "");
  const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (lastSep === -1) { const n = Number(s); return Number.isFinite(n) ? n : null; }
  const tail = s.slice(lastSep + 1);
  // Trois chiffres après le dernier séparateur = séparateur de milliers, pas de décimales.
  const normalized = tail.length === 3 ? s.replace(/[.,]/g, "") : `${s.slice(0, lastSep).replace(/[.,]/g, "")}.${tail}`;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function currencyOf(unit: string): Amount["currency"] {
  const u = fold(unit);
  if (u === "da" || u === "dzd" || u.startsWith("dinar")) return "DZD";
  if (u === "€" || u === "eur" || u.startsWith("euro")) return "EUR";
  if (u === "$" || u === "usd" || u.startsWith("dollar")) return "USD";
  return null;
}
