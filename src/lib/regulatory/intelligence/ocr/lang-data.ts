import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * OCR RÉEL (G13) — mise à disposition LOCALE des données de langue Tesseract (fr/en/ar).
 *
 * Les `.traineddata.gz` proviennent des paquets npm `@tesseract.js-data/*` (donc présents
 * hors-ligne après `npm install`, y compris sur Render — aucune dépendance à un CDN au
 * runtime). On les copie une fois dans un cache local ; `langPath` pointe dessus.
 */

const require = createRequire(import.meta.url);
const SUPPORTED = new Set(["fra", "eng", "ara"]);

let cacheDirPromise: Promise<string> | null = null;

/** Répertoire de cache OCR (données de langue + cache d'exécution Tesseract). */
export function ocrCacheDir(): string {
  return process.env.REG_OCR_CACHE_DIR || path.join(os.tmpdir(), "amd-ocr-langs");
}

/** Localise le `<lang>.traineddata.gz` dans le paquet npm `@tesseract.js-data/<lang>`. */
function findTrainedData(lang: string): string | null {
  try {
    const pkgJson = require.resolve(`@tesseract.js-data/${lang}/package.json`);
    const root = path.dirname(pkgJson);
    // Préférence : dossier standard "4.0.0" (LSTM, bonne précision). Repli : toute variante.
    const candidates = [path.join(root, "4.0.0", `${lang}.traineddata.gz`)];
    for (const c of candidates) if (fs.existsSync(c)) return c;
    // Recherche large (versions futures) : premier .gz trouvé.
    for (const sub of fs.readdirSync(root)) {
      const p = path.join(root, sub, `${lang}.traineddata.gz`);
      if (fs.existsSync(p)) return p;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Garantit la présence des données de langue dans le cache et renvoie le `langPath`.
 * Idempotent (copie seulement si absent). Lève si aucune langue demandée n'est disponible.
 */
export async function ensureLangData(langs: string[]): Promise<string> {
  if (!cacheDirPromise) {
    cacheDirPromise = (async () => {
      const dir = ocrCacheDir();
      await fs.promises.mkdir(dir, { recursive: true });
      return dir;
    })();
  }
  const dir = await cacheDirPromise;

  let staged = 0;
  for (const lang of langs) {
    if (!SUPPORTED.has(lang)) continue;
    const dest = path.join(dir, `${lang}.traineddata.gz`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { staged++; continue; }
    const src = findTrainedData(lang);
    if (!src) continue;
    await fs.promises.copyFile(src, dest);
    staged++;
  }
  if (staged === 0) throw new Error(`Aucune donnée de langue OCR disponible (${langs.join("+")}).`);
  return dir;
}

/** Langues OCR par défaut (configurables). Filtrées sur les langues supportées. */
export function defaultOcrLangs(): string[] {
  const raw = (process.env.REG_OCR_LANGS || "fra+eng").split("+").map((s) => s.trim()).filter(Boolean);
  const langs = raw.filter((l) => SUPPORTED.has(l));
  return langs.length > 0 ? langs : ["fra", "eng"];
}
