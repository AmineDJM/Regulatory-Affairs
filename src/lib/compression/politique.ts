/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA POLITIQUE DE COMPRESSION — ce que la MESURE justifie, et rien de plus. Module PUR (zéro
 * import) : le stockage, les routes de téléchargement ET le bouton du navigateur la lisent, et
 * aucun des trois n'a le droit d'importer les autres (§118.72).
 *
 * Deux questions qui ne se confondent pas (§118.16 : deux axes, jamais mêlés) :
 *
 *  1. AU REPOS — « ce contenu vaut-il d'être compressé AVANT d'être chiffré ? » Sans perte, à
 *     l'insu de tous : `FileBlob.codec`. L'empreinte (`sha256`) et la taille (`size`) disent
 *     TOUJOURS le clair d'origine ; lire rend exactement les octets déposés.
 *
 *  2. AU TÉLÉCHARGEMENT — « existe-t-il une version PLUS PETITE, lisible, qu'on peut proposer
 *     à côté de l'original ? » Elle ne remplace JAMAIS l'original stocké et ne sert à aucun
 *     contrôle, signature ou contrat.
 *
 * Mesuré sur un corpus généré (voir §118.214 : les chiffres sont indicatifs, pas garantis) :
 *   • texte structuré (CSV, JSON, XML, HTML) : 73 à 87 % économisés (brotli q6) ;
 *   • PDF non compressé : −89 % ; PDF déjà compressé : −17 à −22 % ; PDF de scan (JPEG) : 0 % ;
 *   • DOCX/XLSX/PPTX, ZIP, JPEG, PNG, MP4 : 0 % — déjà compressés. On NE les recompresse PAS ;
 *   • BMP, WAV : 10 à 25 %.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const CODEC_BROTLI = "br" as const;
export type Codec = typeof CODEC_BROTLI;

/** Les seuls codecs que le stockage sait relire. Un autre est REFUSÉ à la lecture, jamais deviné. */
export function codecConnu(codec: string | null | undefined): codec is Codec {
  return codec === CODEC_BROTLI;
}

/** Sous cette taille le gain absolu est négligeable et la ligne de base pèse déjà davantage. */
export const TAILLE_MIN_COMPRESSION = 4 * 1024;

/**
 * Un contenu n'est stocké compressé que s'il économise au moins ce pourcentage — SUR LE
 * RÉSULTAT RÉEL, pas sur l'estimation. En dessous, la lecture paierait une décompression pour
 * rien, et un fichier qui gonfle ne doit JAMAIS être stocké plus gros.
 */
export const GAIN_MIN = 0.10;

/** Essai sur échantillon : en dessous de ce gain, on ne tente même pas le fichier entier. */
export const GAIN_ECHANTILLON_MIN = 0.15;

/** Trois tranches (début, milieu, fin) de cette taille : un PDF commence par du texte et finit par des images. */
export const TRANCHE_ECHANTILLON = 64 * 1024;

/** Brotli : q6 est le point de rendement (gain de q9 à un tiers du temps) ; q4 au-delà de 64 Mo (3× plus vite). */
export const SEUIL_QUALITE_RAPIDE = 64 * 1024 * 1024;
export function qualiteBrotli(taille: number): number {
  return taille > SEUIL_QUALITE_RAPIDE ? 4 : 6;
}

/**
 * Les formats DÉJÀ compressés, reconnus à leurs premiers octets — le contenu, pas le nom : le
 * stockage reçoit des octets (`putBlob(buffer)`), jamais un nom de fichier, et un `.dat` peut
 * être un ZIP. Ce test évite l'essai ; il n'est pas la garantie (l'essai et le gain réel le sont).
 */
export function formatDejaCompresse(tete: Uint8Array): string | null {
  const t = tete;
  const at = (o: number, ...octets: number[]) => octets.every((b, i) => t[o + i] === b);
  if (t.length < 4) return null;
  if (at(0, 0x50, 0x4b, 0x03, 0x04) || at(0, 0x50, 0x4b, 0x05, 0x06) || at(0, 0x50, 0x4b, 0x07, 0x08)) return "zip";
  if (at(0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "png";
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return "gif";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && t.length >= 12 && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp";
  if (at(0, 0x1f, 0x8b)) return "gzip";
  if (at(0, 0x42, 0x5a, 0x68)) return "bzip2";
  if (at(0, 0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)) return "7z";
  if (at(0, 0x52, 0x61, 0x72, 0x21)) return "rar";
  if (at(0, 0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00)) return "xz";
  if (at(0, 0x28, 0xb5, 0x2f, 0xfd)) return "zstd";
  if (t.length >= 8 && at(4, 0x66, 0x74, 0x79, 0x70)) return "mp4"; // ftyp : mp4, mov, heic, m4a…
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return "matroska";
  if (at(0, 0x49, 0x44, 0x33) || (t[0] === 0xff && (t[1] & 0xe0) === 0xe0 && (t[1] & 0x06) !== 0)) return "mp3";
  if (at(0, 0x4f, 0x67, 0x67, 0x53)) return "ogg";
  if (at(0, 0x66, 0x4c, 0x61, 0x43)) return "flac";
  if (at(0, 0x77, 0x4f, 0x46, 0x32) || at(0, 0x77, 0x4f, 0x46, 0x46)) return "woff";
  return null;
}

// ───────────────────────── le choix proposé au téléchargement ─────────────────────────────

export type Qualite = "max" | "reduite" | "estimer";

/** `?qualite=` : le défaut est l'ORIGINAL — sans le paramètre, rien ne change pour personne. */
export function lireQualite(valeur: string | null | undefined): Qualite {
  return valeur === "reduite" || valeur === "estimer" ? valeur : "max";
}

export type NatureReduction = "jpeg" | "png" | "webp" | "tiff" | "pdf" | "office" | "texte";

export interface ProfilReduction {
  /** Ce qu'on saurait faire de ce fichier, ou null. */
  nature: NatureReduction | null;
  /** Pourquoi pas, en une phrase — affichée telle quelle (« déjà optimisé »). */
  raison: string;
}

const EXT_TEXTE = new Set(["txt", "csv", "tsv", "json", "xml", "html", "htm", "md", "log", "sql", "yaml", "yml", "ini", "svg", "rtf", "ndjson", "tex", "xsd", "xsl", "xslt"]);
const EXT_OOXML = new Set(["docx", "xlsx", "pptx", "docm", "xlsm", "pptm"]);

/** Seuils du profil (octets) : en dessous, le gain ne vaut pas un choix de plus à l'écran. */
export const SEUILS_REDUCTION = {
  jpeg: 150 * 1024,
  png: 100 * 1024,
  webp: 150 * 1024,
  tiff: 500 * 1024,
  pdf: 100 * 1024,
  /** Au-delà, mupdf et JSZip tiendraient trop de mémoire sur une instance bornée. */
  pdfMax: 100 * 1024 * 1024,
  office: 300 * 1024,
  officeMax: 60 * 1024 * 1024,
  texte: 20 * 1024,
  texteMax: 512 * 1024 * 1024,
  imageMax: 120 * 1024 * 1024,
} as const;

export function extensionDe(nom: string): string {
  const i = nom.lastIndexOf(".");
  return i > 0 ? nom.slice(i + 1).toLowerCase() : "";
}

/**
 * LE PROFIL STATIQUE : ce qu'on peut dire SANS lire le fichier — c'est ce qui décide si le bouton
 * affiche un menu. Il est PRUDENT : « oui » veut dire « une réduction est plausible », et c'est la
 * mesure réelle (`/api/…?qualite=estimer`) qui dit si elle est vraiment plus petite. Un « non »
 * est définitif : on ne propose pas un choix qui ne peut rien donner.
 */
export function profilReduction(nom: string, mime: string | null | undefined, taille: number | null | undefined): ProfilReduction {
  const ext = extensionDe(nom);
  const m = (mime ?? "").toLowerCase();
  const t = typeof taille === "number" && Number.isFinite(taille) ? taille : null;
  const trop = (min: number, max: number): ProfilReduction | null => {
    if (t === null) return null;
    if (t < min) return { nature: null, raison: "Déjà optimisé (fichier léger)." };
    if (t > max) return { nature: null, raison: `Trop volumineux pour être optimisé ici (plus de ${Math.round(max / 1048576)} Mo).` };
    return null;
  };

  if (ext === "jpg" || ext === "jpeg" || m === "image/jpeg") {
    return trop(SEUILS_REDUCTION.jpeg, SEUILS_REDUCTION.imageMax) ?? { nature: "jpeg", raison: "" };
  }
  if (ext === "png" || m === "image/png") return trop(SEUILS_REDUCTION.png, SEUILS_REDUCTION.imageMax) ?? { nature: "png", raison: "" };
  if (ext === "webp" || m === "image/webp") return trop(SEUILS_REDUCTION.webp, SEUILS_REDUCTION.imageMax) ?? { nature: "webp", raison: "" };
  if (ext === "tif" || ext === "tiff" || m === "image/tiff") return trop(SEUILS_REDUCTION.tiff, SEUILS_REDUCTION.imageMax) ?? { nature: "tiff", raison: "" };
  if (ext === "pdf" || m === "application/pdf") return trop(SEUILS_REDUCTION.pdf, SEUILS_REDUCTION.pdfMax) ?? { nature: "pdf", raison: "" };
  if (EXT_OOXML.has(ext)) return trop(SEUILS_REDUCTION.office, SEUILS_REDUCTION.officeMax) ?? { nature: "office", raison: "" };
  if (EXT_TEXTE.has(ext) || m.startsWith("text/") || m === "application/json" || m === "application/xml") {
    return trop(SEUILS_REDUCTION.texte, SEUILS_REDUCTION.texteMax) ?? { nature: "texte", raison: "" };
  }
  return { nature: null, raison: "Déjà optimisé." };
}

/** Un fichier de cette nature se rend, réduit, SOUS CE NOM et ce type. Le texte devient une archive ZIP. */
export function nomReduit(nom: string, nature: NatureReduction): string {
  return nature === "texte" ? `${nom}.zip` : nom;
}
export function typeReduit(nature: NatureReduction, typeOrigine: string): string {
  return nature === "texte" ? "application/zip" : typeOrigine;
}

/** Un gain n'est annoncé que s'il est réel : la réduction doit économiser au moins ce pourcentage. */
export const GAIN_MIN_REDUCTION = 0.10;
export function reductionRetenue(tailleOrigine: number, tailleReduite: number): boolean {
  return tailleOrigine > 0 && tailleReduite > 0 && tailleReduite <= tailleOrigine * (1 - GAIN_MIN_REDUCTION);
}

/**
 * Les extensions dont le contenu est DÉJÀ compressé : mises dans une archive, elles ne rétrécissent
 * pas. Sert à juger, sans rien lire, si un dossier peut gagner quoi que ce soit à être zippé réduit.
 * (Le PDF n'y est pas : ses flux sont souvent déjà compressés, mais pas toujours — la mesure tranche.)
 */
const EXT_DEJA_COMPRESSEES = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "heic", "avif", "zip", "docx", "xlsx", "pptx", "docm", "xlsm", "pptm", "odt", "ods", "odp", "epub",
  "mp4", "mov", "mkv", "avi", "webm", "mp3", "m4a", "aac", "ogg", "flac", "7z", "rar", "gz", "bz2", "xz", "zst", "jar", "woff", "woff2",
]);
export function extensionDejaCompressee(nom: string): boolean {
  return EXT_DEJA_COMPRESSEES.has(extensionDe(nom));
}

/** « 12,4 Mo », « 830 Ko » — la forme que montre le menu. */
export function formaterTaille(octets: number): string {
  if (octets >= 1024 ** 3) return `${(octets / 1024 ** 3).toFixed(2).replace(".", ",")} Go`;
  if (octets >= 1024 ** 2) return `${(octets / 1024 ** 2).toFixed(1).replace(".", ",")} Mo`;
  if (octets >= 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${octets} o`;
}

/** Forme de la réponse de `?qualite=estimer`, partagée par la porte et le bouton. */
export interface EstimationTelechargement {
  max: { taille: number; nom: string };
  /** Absente : aucune version réduite réellement plus petite — « déjà optimisé ». */
  reduite: { taille: number | null; nom: string; gain: number | null; methode: string } | null;
  /** Pourquoi pas de version réduite (affiché). */
  raison?: string;
}
