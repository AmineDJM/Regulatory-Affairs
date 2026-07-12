import { createHash } from "crypto";
import { stat } from "fs/promises";
import JSZip from "jszip";
import yauzl from "yauzl";
import type { Entry, ZipFile } from "yauzl";

/**
 * INSPECTEUR ZIP SÉCURISÉ (Regulatory Intelligence — Phase 1).
 *
 * Traite l'archive fournisseur comme **hostile**. Applique des garde-fous AVANT toute
 * extraction (anti ZIP-bomb par taille/ratio déclarés, nombre de fichiers, profondeur),
 * refuse le path traversal et les exécutables/scripts/macros, signale archives imbriquées
 * et entrées chiffrées, et produit un **manifest** (chemin/nom d'origine, taille, SHA-256,
 * ratio, statut de sécurité). Fonction PURE (aucune base) → unitairement testable.
 *
 * Note d'implémentation : JSZip charge en mémoire ; le durcissement « lecture en flux »
 * (yauzl) est prévu en Phase 1.b (voir SECURITY_RISK_ASSESSMENT). Ici on rejette les bombes
 * via les tailles déclarées du répertoire central + un plafond par fichier en défense.
 */

const MB = 1024 * 1024;

export interface ZipLimits {
  maxArchiveBytes: number;
  maxEntries: number;
  maxTotalUncompressed: number;
  maxFileUncompressed: number;
  maxRatio: number; // total décompressé / archive compressée
  maxDepth: number; // profondeur d'arborescence
}

// Plafonds de TAILLE volontairement LARGES (gros dossiers CTD réels : plusieurs centaines de Mo).
// Ces défauts pilotent en un seul point le contrôle d'archive (route directe + session résumable
// + inspecteur) — voir `MAX_TOTAL_BYTES` (session) aligné dessus. Tout reste réglable par variables
// d'env : à la HAUSSE si l'hôte a la RAM (l'archive est inspectée en mémoire → pic ≈ archive + plus
// gros fichier ; prévoir une instance dimensionnée), ou à la BAISSE pour re-durcir.
// Les gardes anti ZIP-bomb (ratio de compression, profondeur, nombre d'entrées) restent actives :
// elles protègent contre l'abus SANS brider la taille d'un dossier légitime.
export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxArchiveBytes: Number(process.env.REG_ZIP_MAX_ARCHIVE_MB ?? "4096") * MB, // 4 Go compressés
  maxEntries: Number(process.env.REG_ZIP_MAX_ENTRIES ?? "50000"),
  maxTotalUncompressed: Number(process.env.REG_ZIP_MAX_TOTAL_MB ?? "16384") * MB, // 16 Go décompressés
  maxFileUncompressed: Number(process.env.REG_ZIP_MAX_FILE_MB ?? "4096") * MB, // 4 Go / fichier
  maxRatio: Number(process.env.REG_ZIP_MAX_RATIO ?? "500"),
  maxDepth: Number(process.env.REG_ZIP_MAX_DEPTH ?? "16"),
};

export type SecurityStatus =
  | "SAFE" | "BLOCKED_EXECUTABLE" | "BLOCKED_ENCRYPTED" | "BLOCKED_PATH"
  | "BLOCKED_OVERSIZE" | "SUSPICIOUS" | "CORRUPTED";

export type RejectionCode =
  | "ARCHIVE_TOO_LARGE" | "TOO_MANY_FILES" | "TOTAL_TOO_LARGE" | "RATIO_EXCEEDED"
  | "CORRUPT_ARCHIVE" | "EMPTY";

export interface ManifestEntry {
  path: string;
  filename: string;
  ext: string;
  sizeBytes: number;
  sha256: string;
  compressionRatio?: number;
  securityStatus: SecurityStatus;
  note?: string;
}

export interface ZipInspection {
  ok: boolean;
  rejection?: { code: RejectionCode; message: string };
  entries: ManifestEntry[];
  totals: { files: number; totalBytes: number; archiveBytes: number };
}

/**
 * Options de l'inspecteur : plafonds + rappel de stockage optionnel.
 * `onStorableEntry` est appelé pour chaque entrée SÛRE/SUSPECTE avec ses octets déjà
 * décompressés — permettant à l'ingestion de **stocker immédiatement** le blob (un
 * fichier à la fois → mémoire bornée) sans re-décompresser ni retenir tout le contenu.
 */
export type InspectOptions = Partial<ZipLimits> & {
  onStorableEntry?: (entry: ManifestEntry, data: Buffer) => Promise<void>;
};

// Exécutables / scripts / macros / contenu actif : jamais matérialisés.
const BLOCKED_EXT = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "cpl", "jar", "js", "mjs", "cjs",
  "vbs", "vbe", "ws", "wsf", "wsh", "ps1", "psm1", "sh", "bash", "zsh", "app", "dmg",
  "deb", "rpm", "apk", "dll", "so", "sys", "scf", "lnk", "reg", "hta", "jse", "msc",
  "gadget", "vb", "vba", "docm", "xlsm", "pptm", "dotm", "xltm", "potm", "xlam", "ppam",
]);

// Archives imbriquées : signalées (non décompressées récursivement).
const NESTED_ARCHIVE_EXT = new Set(["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "cab", "iso"]);

const extOf = (name: string) => {
  const base = name.split("/").pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
};

/**
 * Détecte un chemin dangereux (traversal `..`, absolu, octet nul, backslash, lecteur, `~`).
 *
 * Prédicat de sécurité PUR et exhaustif : il ne dépend PAS de JSZip. À noter que JSZip
 * *normalise* déjà `../a` → `a` à la lecture, et que notre stockage est adressé par
 * SHA-256 (jamais par ce chemin) — cette fonction reste la défense explicite pour les
 * vecteurs que JSZip préserve (chemins absolus, backslashes, octet nul, `C:`) et documente
 * l'intention de sécurité indépendamment de la lib.
 */
export function unsafePath(path: string): boolean {
  if (!path) return true;
  if (path.includes("\0")) return true;
  if (path.includes("\\")) return true; // séparateurs Windows normalisés côté sûr
  if (path.startsWith("/")) return true; // absolu POSIX
  if (/^[a-zA-Z]:/.test(path)) return true; // lecteur Windows (C:)
  const segs = path.split("/");
  return segs.some((s) => s === ".." || s === "~");
}

/** Tailles déclarées dans le répertoire central (JSZip interne, avec repli). */
function declaredSizes(file: JSZip.JSZipObject): { compressed?: number; uncompressed?: number } {
  const d = (file as unknown as { _data?: { compressedSize?: number; uncompressedSize?: number } })._data;
  return { compressed: d?.compressedSize, uncompressed: d?.uncompressedSize };
}

export async function inspectZip(buffer: Buffer, opts: InspectOptions = {}): Promise<ZipInspection> {
  const { onStorableEntry, ...limOpts } = opts;
  const lim = { ...DEFAULT_ZIP_LIMITS, ...limOpts };
  const archiveBytes = buffer.length;

  if (archiveBytes === 0) return reject("EMPTY", "Archive vide.", archiveBytes);
  if (archiveBytes > lim.maxArchiveBytes) {
    return reject("ARCHIVE_TOO_LARGE", `Archive trop volumineuse (${Math.round(archiveBytes / MB)} Mo > ${Math.round(lim.maxArchiveBytes / MB)} Mo).`, archiveBytes);
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return reject("CORRUPT_ARCHIVE", "Archive illisible ou corrompue.", archiveBytes);
  }

  const files = Object.values(zip.files).filter((f) => !f.dir);
  if (files.length === 0) return reject("EMPTY", "Aucun fichier dans l'archive.", archiveBytes);
  if (files.length > lim.maxEntries) {
    return reject("TOO_MANY_FILES", `Trop de fichiers (${files.length} > ${lim.maxEntries}).`, archiveBytes);
  }

  // Pré-contrôle anti-bombe : total décompressé DÉCLARÉ + ratio, sans extraire.
  let declaredTotal = 0;
  for (const f of files) {
    const u = declaredSizes(f).uncompressed;
    if (typeof u === "number") declaredTotal += u;
  }
  if (declaredTotal > lim.maxTotalUncompressed) {
    return reject("TOTAL_TOO_LARGE", `Contenu décompressé annoncé trop volumineux (${Math.round(declaredTotal / MB)} Mo).`, archiveBytes);
  }
  if (archiveBytes > 0 && declaredTotal / archiveBytes > lim.maxRatio) {
    return reject("RATIO_EXCEEDED", `Ratio de compression suspect (${Math.round(declaredTotal / archiveBytes)}:1) — possible ZIP bomb.`, archiveBytes);
  }

  const entries: ManifestEntry[] = [];
  let accumulated = 0;

  for (const f of files) {
    const path = f.name;
    const filename = path.split("/").pop() ?? path;
    const ext = extOf(path);
    const declared = declaredSizes(f);

    // 1) Chemin dangereux → bloqué, non extrait.
    if (unsafePath(path) || path.split("/").length - 1 > lim.maxDepth) {
      entries.push({ path, filename, ext, sizeBytes: declared.uncompressed ?? 0, sha256: "", securityStatus: "BLOCKED_PATH", note: "Chemin non sûr ou profondeur excessive — non extrait." });
      continue;
    }
    // 2) Exécutable / script / macro → jamais matérialisé.
    if (BLOCKED_EXT.has(ext)) {
      entries.push({ path, filename, ext, sizeBytes: declared.uncompressed ?? 0, sha256: "", securityStatus: "BLOCKED_EXECUTABLE", note: "Exécutable/script/macro — refusé." });
      continue;
    }
    // 3) Garde total avant extraction.
    if (typeof declared.uncompressed === "number" && accumulated + declared.uncompressed > lim.maxTotalUncompressed) {
      return reject("TOTAL_TOO_LARGE", "Dépassement du volume total à l'extraction.", archiveBytes);
    }

    // 4) Extraction bornée + hash. Entrée chiffrée → JSZip échoue → BLOCKED_ENCRYPTED.
    let data: Buffer;
    try {
      data = await f.async("nodebuffer");
    } catch {
      entries.push({ path, filename, ext, sizeBytes: declared.uncompressed ?? 0, sha256: "", securityStatus: "BLOCKED_ENCRYPTED", note: "Entrée chiffrée/illisible — non traitée." });
      continue;
    }
    if (data.length > lim.maxFileUncompressed) {
      entries.push({ path, filename, ext, sizeBytes: data.length, sha256: "", securityStatus: "BLOCKED_OVERSIZE", note: "Fichier trop volumineux — non conservé." });
      continue;
    }
    accumulated += data.length;
    if (accumulated > lim.maxTotalUncompressed) {
      return reject("TOTAL_TOO_LARGE", "Dépassement du volume total à l'extraction.", archiveBytes);
    }

    const sha256 = createHash("sha256").update(data).digest("hex");
    const ratio = declared.compressed && declared.compressed > 0 ? data.length / declared.compressed : undefined;
    const nested = NESTED_ARCHIVE_EXT.has(ext);
    const entry: ManifestEntry = {
      path, filename, ext, sizeBytes: data.length, sha256,
      compressionRatio: ratio,
      securityStatus: nested ? "SUSPICIOUS" : "SAFE",
      note: nested ? "Archive imbriquée — non décompressée automatiquement." : undefined,
    };
    entries.push(entry);
    // Stockage inline (un fichier à la fois) : l'ingestion persiste le blob ici même.
    if (onStorableEntry) await onStorableEntry(entry, data);
  }

  const totalBytes = entries.reduce((s, e) => s + (e.securityStatus === "SAFE" || e.securityStatus === "SUSPICIOUS" ? e.sizeBytes : 0), 0);
  return { ok: true, entries, totals: { files: entries.length, totalBytes, archiveBytes } };
}

function reject(code: RejectionCode, message: string, archiveBytes: number): ZipInspection {
  return { ok: false, rejection: { code, message }, entries: [], totals: { files: 0, totalBytes: 0, archiveBytes } };
}

// ─────────────────────── INSPECTION EN FLUX (gros dossiers, mémoire bornée) ───────────────────────
//
// Version STREAMING de `inspectZip`, lisant l'archive depuis un FICHIER sur disque via yauzl, UNE
// entrée à la fois : le pic mémoire ≈ le plus gros fichier de l'archive (pas l'archive entière).
// Corrige l'OOM d'ingestion des gros ZIP (jszip charge tout en RAM). Sémantique de sécurité
// IDENTIQUE à `inspectZip` (mêmes prédicats : `unsafePath`, exécutables, chiffrement, plafonds).
//
// `decodeStrings:false` → noms d'entrée BRUTS (aucune validation/normalisation par yauzl) : ce sont
// NOS gardes qui tranchent, et une entrée hostile (chemin absolu…) NE fait PAS avorter toute
// l'archive — elle est marquée BLOQUÉE tandis que les fichiers sains restent traités.

/** Nom d'entrée décodé (yauzl renvoie un Buffer quand `decodeStrings:false`). */
function entryName(e: Entry): string {
  const raw = e.fileName as unknown as string | Buffer;
  return typeof raw === "string" ? raw : raw.toString("utf8");
}

function openZipFile(path: string): Promise<ZipFile> {
  return new Promise((resolve, rej) => {
    yauzl.open(path, { lazyEntries: true, autoClose: false, decodeStrings: false, validateEntrySizes: true }, (err, zip) => {
      if (err || !zip) return rej(err ?? new Error("Ouverture ZIP impossible."));
      resolve(zip);
    });
  });
}

/** Tire l'entrée suivante (mode lazyEntries) ; `null` à la fin ; rejette sur erreur d'archive. */
function nextEntry(zip: ZipFile): Promise<Entry | null> {
  return new Promise((resolve, rej) => {
    const cleanup = () => { zip.removeListener("entry", onEntry); zip.removeListener("end", onEnd); zip.removeListener("error", onErr); };
    const onEntry = (e: Entry) => { cleanup(); resolve(e); };
    const onEnd = () => { cleanup(); resolve(null); };
    const onErr = (e: Error) => { cleanup(); rej(e); };
    zip.on("entry", onEntry); zip.on("end", onEnd); zip.on("error", onErr);
    zip.readEntry();
  });
}

/** Lit une entrée EN FLUX vers un buffer, plafonné à `cap` octets → « OVERSIZE » si dépassé. */
function readEntryCapped(zip: ZipFile, entry: Entry, cap: number): Promise<Buffer | "OVERSIZE"> {
  return new Promise((resolve, rej) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err || !stream) return rej(err ?? new Error("Flux d'entrée indisponible."));
      const chunks: Buffer[] = [];
      let total = 0, settled = false;
      const finish = (v: Buffer | "OVERSIZE") => { if (!settled) { settled = true; resolve(v); } };
      stream.on("data", (c: Buffer) => {
        if (settled) return;
        total += c.length;
        if (total > cap) { finish("OVERSIZE"); stream.destroy(); return; } // stoppe net (anti-bombe par fichier)
        chunks.push(c);
      });
      stream.on("error", (e) => { if (!settled) { settled = true; rej(e); } });
      stream.on("end", () => finish(Buffer.concat(chunks)));
    });
  });
}

export async function inspectZipFile(zipPath: string, opts: InspectOptions = {}): Promise<ZipInspection> {
  const { onStorableEntry, ...limOpts } = opts;
  const lim = { ...DEFAULT_ZIP_LIMITS, ...limOpts };
  const archiveBytes = (await stat(zipPath)).size;

  if (archiveBytes === 0) return reject("EMPTY", "Archive vide.", archiveBytes);
  if (archiveBytes > lim.maxArchiveBytes) {
    return reject("ARCHIVE_TOO_LARGE", `Archive trop volumineuse (${Math.round(archiveBytes / MB)} Mo > ${Math.round(lim.maxArchiveBytes / MB)} Mo).`, archiveBytes);
  }

  // ── PASSE 1 — métadonnées du répertoire central UNIQUEMENT (anti-bombe sur tailles déclarées).
  let files: { uncompressed: number }[];
  {
    let zip: ZipFile;
    try { zip = await openZipFile(zipPath); } catch { return reject("CORRUPT_ARCHIVE", "Archive illisible ou corrompue.", archiveBytes); }
    try {
      const metas: { uncompressed: number }[] = [];
      for (;;) {
        let e: Entry | null;
        try { e = await nextEntry(zip); } catch { return reject("CORRUPT_ARCHIVE", "Archive illisible ou corrompue.", archiveBytes); }
        if (!e) break;
        if (/\/$/.test(entryName(e))) continue; // dossier
        metas.push({ uncompressed: Number(e.uncompressedSize) || 0 });
      }
      files = metas;
    } finally { zip.close(); }
  }

  if (files.length === 0) return reject("EMPTY", "Aucun fichier dans l'archive.", archiveBytes);
  if (files.length > lim.maxEntries) return reject("TOO_MANY_FILES", `Trop de fichiers (${files.length} > ${lim.maxEntries}).`, archiveBytes);
  const declaredTotal = files.reduce((s, f) => s + f.uncompressed, 0);
  if (declaredTotal > lim.maxTotalUncompressed) {
    return reject("TOTAL_TOO_LARGE", `Contenu décompressé annoncé trop volumineux (${Math.round(declaredTotal / MB)} Mo).`, archiveBytes);
  }
  if (archiveBytes > 0 && declaredTotal / archiveBytes > lim.maxRatio) {
    return reject("RATIO_EXCEEDED", `Ratio de compression suspect (${Math.round(declaredTotal / archiveBytes)}:1) — possible ZIP bomb.`, archiveBytes);
  }

  // ── PASSE 2 — extraction EN FLUX, une entrée à la fois (pic mémoire ≈ plus gros fichier).
  const entries: ManifestEntry[] = [];
  let accumulated = 0;
  let zip: ZipFile;
  try { zip = await openZipFile(zipPath); } catch { return reject("CORRUPT_ARCHIVE", "Archive illisible ou corrompue.", archiveBytes); }
  try {
    for (;;) {
      let e: Entry | null;
      try { e = await nextEntry(zip); } catch { return reject("CORRUPT_ARCHIVE", "Archive illisible ou corrompue.", archiveBytes); }
      if (!e) break;
      const path = entryName(e);
      if (/\/$/.test(path)) continue; // dossier
      const filename = path.split("/").pop() ?? path;
      const ext = extOf(path);
      const declaredU = Number(e.uncompressedSize) || 0;
      const declaredC = Number(e.compressedSize) || 0;

      // 1) Chemin dangereux → bloqué, non extrait.
      if (unsafePath(path) || path.split("/").length - 1 > lim.maxDepth) {
        entries.push({ path, filename, ext, sizeBytes: declaredU, sha256: "", securityStatus: "BLOCKED_PATH", note: "Chemin non sûr ou profondeur excessive — non extrait." });
        continue;
      }
      // 2) Exécutable / script / macro → jamais matérialisé.
      if (BLOCKED_EXT.has(ext)) {
        entries.push({ path, filename, ext, sizeBytes: declaredU, sha256: "", securityStatus: "BLOCKED_EXECUTABLE", note: "Exécutable/script/macro — refusé." });
        continue;
      }
      // 3) Entrée chiffrée → non traitée (yauzl le signale sans lire).
      if (typeof e.isEncrypted === "function" && e.isEncrypted()) {
        entries.push({ path, filename, ext, sizeBytes: declaredU, sha256: "", securityStatus: "BLOCKED_ENCRYPTED", note: "Entrée chiffrée — non traitée." });
        continue;
      }
      // 4) Garde total avant extraction (taille déclarée).
      if (accumulated + declaredU > lim.maxTotalUncompressed) {
        return reject("TOTAL_TOO_LARGE", "Dépassement du volume total à l'extraction.", archiveBytes);
      }

      // 5) Extraction EN FLUX bornée + hash.
      let data: Buffer | "OVERSIZE";
      try { data = await readEntryCapped(zip, e, lim.maxFileUncompressed); }
      catch { entries.push({ path, filename, ext, sizeBytes: declaredU, sha256: "", securityStatus: "BLOCKED_ENCRYPTED", note: "Entrée illisible/chiffrée — non traitée." }); continue; }
      if (data === "OVERSIZE") {
        entries.push({ path, filename, ext, sizeBytes: declaredU, sha256: "", securityStatus: "BLOCKED_OVERSIZE", note: "Fichier trop volumineux — non conservé." });
        continue;
      }
      accumulated += data.length;
      if (accumulated > lim.maxTotalUncompressed) {
        return reject("TOTAL_TOO_LARGE", "Dépassement du volume total à l'extraction.", archiveBytes);
      }

      const sha256 = createHash("sha256").update(data).digest("hex");
      const ratio = declaredC > 0 ? data.length / declaredC : undefined;
      const nested = NESTED_ARCHIVE_EXT.has(ext);
      const entry: ManifestEntry = {
        path, filename, ext, sizeBytes: data.length, sha256, compressionRatio: ratio,
        securityStatus: nested ? "SUSPICIOUS" : "SAFE",
        note: nested ? "Archive imbriquée — non décompressée automatiquement." : undefined,
      };
      entries.push(entry);
      if (onStorableEntry) await onStorableEntry(entry, data); // stockage inline, un fichier à la fois
    }
  } finally { zip.close(); }

  const totalBytes = entries.reduce((s, e) => s + (e.securityStatus === "SAFE" || e.securityStatus === "SUSPICIOUS" ? e.sizeBytes : 0), 0);
  return { ok: true, entries, totals: { files: entries.length, totalBytes, archiveBytes } };
}
