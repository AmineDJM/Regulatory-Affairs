/**
 * UNIFORMISER L'ÉCRITURE DU CATALOGUE D'ARTICLES.
 *
 * Le catalogue est alimenté depuis deux écrans, par plusieurs personnes, sur des années. On y
 * trouve donc « RAMETTE A4 », « ramette a4 », « Ramette  A4 80g » et « Rame A4 » — quatre lignes
 * pour un seul article. Les conséquences ne sont pas cosmétiques :
 *
 *   • le menu déroulant d'une demande d'achat devient illisible, et l'on recrée un doublon plutôt
 *     que de chercher celui qui existe ;
 *   • la consommation par article ne veut plus rien dire : elle se répartit entre les orthographes ;
 *   • deux services commandent « le même » article à deux prix indicatifs différents.
 *
 * Ce module écrit donc TOUJOURS de la même façon. Deux principes, et ils comptent autant l'un
 * que l'autre :
 *
 *   • on NORMALISE, on ne TRADUIT pas. « Ramette » ne devient pas « Rame » : ce serait décider à
 *     la place de celui qui a saisi, et transformer un article en un autre. On corrige la casse,
 *     les espaces et la ponctuation — pas le vocabulaire ;
 *   • les SIGLES ET FORMATS restent en majuscules. « Cable hdmi » écrit « Câble Hdmi » serait
 *     pire que le désordre de départ : personne n'écrit « Hdmi », et une liste qui invente une
 *     orthographe perd la confiance de ceux qui la lisent.
 *
 * Module PUR — testé, sans base de données.
 */

/**
 * Ce qui reste EN MAJUSCULES : sigles, formats et normes du matériel de bureau.
 *
 * Liste explicite plutôt qu'une règle « trois lettres ou moins » : « lot », « kit », « bic » ont
 * trois lettres et ne sont pas des sigles, tandis que « HDMI » en a quatre.
 */
const ACRONYMS = new Set([
  "A0", "A1", "A2", "A3", "A4", "A5", "A6",
  "USB", "HDMI", "VGA", "DVI", "RJ45", "RJ11", "LED", "LCD", "OLED", "SSD", "HDD", "RAM",
  "PC", "TV", "UC", "CD", "DVD", "PVC", "PET", "PP", "OK", "ISO", "UV", "IP", "AC", "DC",
  "TVA", "HT", "TTC", "REF", "N°",
  "HP", "IBM", "MSI", "AOC", "LG", "TP-LINK", "D-LINK", "3M",
]);

/** Une chaîne comparable : sans accent, sans casse, sans ponctuation, espaces réduits. */
export function comparable(raw: string): string {
  return raw
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * La CLÉ d'un article — ce qui permet de dire « c'est déjà dans le catalogue ».
 *
 * Deux libellés qui ne diffèrent que par la casse, les accents, les espaces ou la ponctuation
 * désignent le même article. C'est cette clé, et non le libellé, qui sert à refuser un doublon.
 */
export function articleKey(name: string): string {
  return comparable(name);
}

/** Un mot déjà tout en majuscules et contenant un chiffre (« B/30 », « 80G ») reste tel quel. */
function isCodeLike(word: string): boolean {
  return /\d/.test(word) && word === word.toUpperCase();
}

function capitalizeWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toLocaleUpperCase("fr-FR") + word.slice(1).toLocaleLowerCase("fr-FR");
}

/**
 * Le libellé d'un article, écrit UNE seule façon.
 *
 * Première lettre en capitale, le reste en minuscules — sauf les sigles, les formats et les
 * mesures. Les espaces multiples et les espaces autour des séparateurs sont réduits : « Stylo
 * bic  -  bleu » et « stylo BIC- bleu » deviennent le même « Stylo bic - bleu ».
 */
export function normalizeArticleName(raw: string): string {
  const cleaned = (raw ?? "")
    .replace(/\s+/g, " ")
    // Un séparateur reste entouré d'une seule espace : c'est là que les saisies divergent le plus.
    .replace(/\s*([/\-–—])\s*/g, " $1 ")
    .replace(/\s*([,;:])\s*/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  const words = cleaned.split(" ");
  const out = words.map((w, i) => {
    const bare = w.replace(/[^\p{L}\p{N}°/-]/gu, "");
    const upper = bare.toUpperCase();
    // Un sigle, un format ou une mesure : on garde les majuscules.
    if (ACRONYMS.has(upper)) return w.replace(bare, upper);
    if (isCodeLike(bare)) return w;
    // « 80g », « 500ml », « 1,5L » : le nombre garde son unité en minuscules, sans capitale.
    if (/^\d/.test(bare)) return w.toLocaleLowerCase("fr-FR");
    // CASSE DE PHRASE, pas casse de titre : seule la première lettre du libellé prend une
    // capitale. « Stylo Bille Bleu » se lit comme un nom propre et ne s'aligne avec rien du
    // reste de la plateforme, où l'on écrit « Stylo bille bleu ».
    if (i > 0) return w.toLocaleLowerCase("fr-FR");
    return capitalizeWord(w);
  });
  return out.join(" ");
}

/**
 * Une RÉFÉRENCE fournisseur : majuscules, espaces retirés autour des séparateurs.
 *
 * Une référence est un CODE : « hp-cf217a » et « HP CF217A » désignent la même cartouche, et les
 * écrire différemment empêche de les rapprocher.
 */
export function normalizeReference(raw: string | null | undefined): string | null {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.toUpperCase().replace(/\s*([/\-_])\s*/g, "$1");
}

/** Un nom de fournisseur — même traitement qu'un libellé, sigles compris. */
export function normalizeSupplier(raw: string | null | undefined): string | null {
  const s = normalizeArticleName(raw ?? "");
  return s || null;
}

/**
 * Ramène une CATÉGORIE ou une UNITÉ écrite librement sur le code de la liste fermée.
 *
 * Le catalogue a vécu avant que ces listes n'existent : d'anciennes lignes portent « papeterie »,
 * « Informatique & bureautique » ou « pcs ». On accepte le code, le libellé exact, et une poignée
 * de variantes usuelles ; ce qu'on ne reconnaît pas est LAISSÉ TEL QUEL plutôt qu'écrasé — perdre
 * une information parce qu'on ne sait pas la classer serait pire que de la garder imparfaite.
 */
export function normalizeToCode(
  raw: string | null | undefined,
  labels: Record<string, string>,
  aliases: Record<string, string> = {},
): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const needle = comparable(s);
  if (labels[s.toUpperCase()]) return s.toUpperCase();
  for (const [code, label] of Object.entries(labels)) {
    if (comparable(code) === needle || comparable(label) === needle) return code;
  }
  for (const [alias, code] of Object.entries(aliases)) {
    if (comparable(alias) === needle) return code;
  }
  return s;
}

/** Variantes usuelles rencontrées dans le catalogue existant. */
export const CATEGORY_ALIASES: Record<string, string> = {
  "info": "INFORMATIQUE", "informatique et bureautique": "INFORMATIQUE", "bureautique": "INFORMATIQUE",
  "fourniture": "PAPETERIE", "fournitures": "PAPETERIE", "fournitures de bureau": "PAPETERIE",
  "consommables": "CONSOMMABLE", "encre": "CONSOMMABLE", "toner": "CONSOMMABLE",
  "hygiene": "ENTRETIEN", "nettoyage": "ENTRETIEN", "produits d entretien": "ENTRETIEN",
  "cafe": "CUISINE", "cuisine et cafe": "CUISINE",
  "electricite": "ELECTRIQUE", "electrique": "ELECTRIQUE",
  "meuble": "MOBILIER", "meubles": "MOBILIER",
};

export const UNIT_ALIASES: Record<string, string> = {
  "pcs": "PIECE", "pc": "PIECE", "pce": "PIECE", "u": "PIECE", "unite": "PIECE", "piece": "PIECE",
  "bte": "BOITE", "boite": "BOITE", "bt": "BOITE",
  "pqt": "PAQUET", "paq": "PAQUET",
  "ramette": "RAME", "rme": "RAME",
  "ctn": "CARTON", "crt": "CARTON",
  "rlx": "ROULEAU", "rouleaux": "ROULEAU",
  "l": "LITRE", "litres": "LITRE",
  "kilo": "KG", "kilogramme": "KG", "kgs": "KG",
};

export interface ArticleFields {
  name: string;
  category?: string | null;
  unit?: string | null;
  reference?: string | null;
  supplierHint?: string | null;
}

/** L'article entier, réécrit d'une seule façon. */
export function normalizeArticle(
  a: ArticleFields,
  labels: { category: Record<string, string>; unit: Record<string, string> },
): ArticleFields {
  return {
    name: normalizeArticleName(a.name),
    category: normalizeToCode(a.category, labels.category, CATEGORY_ALIASES),
    unit: normalizeToCode(a.unit, labels.unit, UNIT_ALIASES),
    reference: normalizeReference(a.reference),
    supplierHint: normalizeSupplier(a.supplierHint),
  };
}

/** Cet article change-t-il en étant uniformisé ? (sert à ne proposer QUE ce qui bouge) */
export function needsRewrite(before: ArticleFields, after: ArticleFields): boolean {
  return before.name !== after.name
    || (before.category ?? null) !== (after.category ?? null)
    || (before.unit ?? null) !== (after.unit ?? null)
    || (before.reference ?? null) !== (after.reference ?? null)
    || (before.supplierHint ?? null) !== (after.supplierHint ?? null);
}

/** « Ramette a4 → Ramette A4 » — ce qu'on montre avant d'appliquer. */
export function describeRewrite(before: ArticleFields, after: ArticleFields): string[] {
  const out: string[] = [];
  const line = (label: string, b: string | null | undefined, a: string | null | undefined) => {
    if ((b ?? null) !== (a ?? null)) out.push(`${label} : ${b || "(vide)"} → ${a || "(vide)"}`);
  };
  line("Libellé", before.name, after.name);
  line("Catégorie", before.category, after.category);
  line("Unité", before.unit, after.unit);
  line("Référence", before.reference, after.reference);
  line("Fournisseur", before.supplierHint, after.supplierHint);
  return out;
}
