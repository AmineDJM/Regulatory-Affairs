/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UNE CONVERSION PERD (mandat 5 §41) — pur.
 *
 * « Convertis-moi ce classeur en CSV » a l'air anodin. Le CSV ne connaît ni les formules, ni les
 * onglets, ni les formats, ni les graphiques : ce qui entre en dix feuilles ressort en une, sans
 * la moindre formule, et personne ne s'en aperçoit avant le trimestre suivant.
 *
 * Cette table dit, pour chaque conversion, ce qui SURVIT et ce qui MEURT. Une conversion
 * DESTRUCTIVE se dit AVANT de la faire — pas dans une note en bas du rapport. Et une conversion
 * qu'aucun outil de ce serveur ne sait faire est nommée comme une RESSOURCE manquante, jamais
 * comme une impossibilité de principe.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type Format =
  | "xlsx" | "xlsm" | "xls" | "csv" | "tsv" | "json" | "jsonl" | "xml"
  | "docx" | "doc" | "pptx" | "ppt" | "pdf" | "txt" | "md" | "html" | "zip" | "parquet"
  | "png" | "jpg" | "inconnu";

export const FORMATS_LISIBLES: readonly Format[] = ["xlsx", "xlsm", "csv", "tsv", "json", "jsonl", "txt", "md", "docx", "pptx", "pdf", "html", "xml", "zip", "png", "jpg"];
export const FORMATS_ECRIVABLES: readonly Format[] = ["xlsx", "csv", "tsv", "json", "jsonl", "txt", "md", "docx", "pptx", "pdf", "html"];

/** Les mêmes formats sous d'autres extensions — un `.htm` est du HTML, un `.jpeg` une image. */
const ALIAS: Readonly<Record<string, Format>> = { jpeg: "jpg", htm: "html", ndjson: "jsonl", text: "txt", markdown: "md" };

export function formatDe(nom: string): Format {
  const ext = nom.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const alias = ALIAS[ext];
  if (alias) return alias;
  const connus: Format[] = ["xlsx", "xlsm", "xls", "csv", "tsv", "json", "jsonl", "xml", "docx", "doc", "pptx", "ppt", "pdf", "txt", "md", "html", "zip", "parquet", "png", "jpg"];
  return connus.includes(ext as Format) ? (ext as Format) : "inconnu";
}

export type Nature = "LOSSLESS" | "DESTRUCTIF" | "IMPOSSIBLE";

export interface Conversion {
  de: Format;
  vers: Format;
  nature: Nature;
  /** Ce que la conversion CONSERVE. */
  conserve: string[];
  /** Ce qu'elle PERD — vide seulement si elle ne perd rien. */
  perd: string[];
  /** Pourquoi elle est impossible sur CE serveur, et ce qu'il faudrait. */
  ressourceManquante?: string;
  /** L'aller-retour rend-il le fichier d'origine ? */
  reversible: boolean;
}

/** Ce que chaque format sait PORTER — la base de tout ce qui suit. */
const PORTE: Readonly<Record<string, string[]>> = {
  xlsx: ["plusieurs feuilles", "formules", "formats de cellule", "graphiques", "styles", "images", "filtres"],
  xlsm: ["plusieurs feuilles", "formules", "macros", "formats de cellule", "graphiques", "styles"],
  csv: ["une table de valeurs"],
  tsv: ["une table de valeurs"],
  json: ["structure imbriquée", "types (nombre, booléen, nul)"],
  jsonl: ["structure imbriquée", "types", "lecture en flux"],
  docx: ["texte", "styles", "images", "en-têtes", "tableaux", "suivi des modifications"],
  pptx: ["diapositives", "texte", "images", "mise en page", "notes"],
  pdf: ["mise en page fixe", "polices incorporées", "texte", "images"],
  txt: ["texte brut"],
  md: ["texte", "titres", "listes", "tableaux simples"],
  html: ["texte", "tableaux", "liens", "mise en forme"],
  parquet: ["colonnes typées", "compression", "grands volumes"],
};

/** CE QUE COÛTE UNE CONVERSION — dit avant, pas après. */
export function conversion(de: Format, vers: Format): Conversion {
  if (de === vers) return { de, vers, nature: "LOSSLESS", conserve: PORTE[de] ?? ["le fichier tel quel"], perd: [], reversible: true };

  const source = PORTE[de] ?? [];
  const cible = PORTE[vers] ?? [];

  // Ce que ce serveur ne sait pas faire, et pourquoi.
  const manquantes: Record<string, string> = {
    "*→xls": "l'ancien format Excel binaire (.xls) ne peut pas être écrit ici : enregistrer en .xlsx, que tout tableur ouvre.",
    "xls→*": "l'ancien format Excel binaire (.xls) n'est pas lisible ici : le rouvrir dans un tableur et l'enregistrer en .xlsx.",
    "doc→*": "l'ancien format Word binaire (.doc) n'est pas lisible ici : le rouvrir dans Word et l'enregistrer en .docx.",
    "ppt→*": "l'ancien format PowerPoint binaire (.ppt) n'est pas lisible ici : l'enregistrer en .pptx.",
    "*→parquet": "Parquet demande une bibliothèque colonnaire absente de ce serveur ; exporter en CSV ou JSONL, que les mêmes outils lisent.",
    "parquet→*": "Parquet demande une bibliothèque colonnaire absente de ce serveur.",
    "pdf→docx": "reconstruire un document modifiable depuis un PDF demande une reconnaissance de mise en page (LibreOffice, absent de ce serveur) : le TEXTE est extractible, la mise en forme ne l'est pas.",
    "pdf→xlsx": "extraire des tableaux d'un PDF vers un classeur demande une reconnaissance de tableaux absente : le texte des pages est extractible, la grille ne l'est pas.",
    "docx→pdf": "l'impression fidèle d'un .docx en PDF demande un moteur de rendu (LibreOffice, absent — mesuré) : le contenu peut être RÉÉCRIT dans un PDF neuf, ce qui n'est pas la même chose que l'imprimer.",
    "pptx→pdf": "l'impression fidèle d'un .pptx en PDF demande un moteur de rendu absent de ce serveur.",
  };
  const cle = manquantes[`${de}→${vers}`] ?? manquantes[`${de}→*`] ?? manquantes[`*→${vers}`];
  if (cle) return { de, vers, nature: "IMPOSSIBLE", conserve: [], perd: source, ressourceManquante: cle, reversible: false };

  const perd = source.filter((x) => !cible.includes(x));
  const conserve = source.filter((x) => cible.includes(x));
  // Les pertes structurelles que la simple comparaison ne dit pas.
  const supplement: string[] = [];
  if ((de === "xlsx" || de === "xlsm") && (vers === "csv" || vers === "tsv")) {
    supplement.push("TOUTES les feuilles sauf une (un CSV ne porte qu'une table)", "les formules, remplacées par leur dernière valeur calculée");
  }
  if (de === "xlsm" && vers !== "xlsm") supplement.push("les macros");
  if ((vers === "csv" || vers === "tsv") && (de === "json" || de === "jsonl")) supplement.push("l'imbrication : un objet dans un objet devient du texte ou une colonne aplatie");
  if (vers === "pdf") supplement.push("la modifiabilité : un PDF se lit, il ne se remanie pas comme sa source");
  if (de === "pdf" && (vers === "txt" || vers === "md")) supplement.push("la mise en page, les colonnes et l'ordre de lecture d'une page complexe");
  const toutesPertes = [...new Set([...perd, ...supplement])];

  return {
    de, vers,
    nature: toutesPertes.length ? "DESTRUCTIF" : "LOSSLESS",
    conserve, perd: toutesPertes,
    reversible: toutesPertes.length === 0,
  };
}

/** La phrase à dire AVANT de convertir — celle qui empêche la mauvaise surprise. */
export function avertissementConversion(c: Conversion): string {
  if (c.nature === "IMPOSSIBLE") return `Conversion ${c.de} → ${c.vers} indisponible sur ce serveur : ${c.ressourceManquante}`;
  if (c.nature === "LOSSLESS") return `Conversion ${c.de} → ${c.vers} SANS PERTE : ${c.conserve.join(", ") || "le contenu"} sont conservés, et l'aller-retour rend le fichier d'origine.`;
  return `Conversion ${c.de} → ${c.vers} DESTRUCTIVE : ${c.perd.join(" ; ")} ${c.perd.length > 1 ? "sont perdus" : "est perdu"}. L'original doit être GARDÉ — l'aller-retour ne le reconstruira pas.`;
}

/** Toutes les conversions possibles depuis un format, classées : sans perte d'abord. */
export function conversionsDepuis(de: Format): Conversion[] {
  return FORMATS_ECRIVABLES
    .filter((v) => v !== de)
    .map((v) => conversion(de, v))
    .filter((c) => c.nature !== "IMPOSSIBLE")
    .sort((a, b) => (a.nature === b.nature ? a.perd.length - b.perd.length : a.nature === "LOSSLESS" ? -1 : 1));
}
