/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PROPOSER L'ACTION ET L'ARTICLE D'UNE LIGNE DE DEVIS LUE (Direction, 07/10 — « Luna doit être plus smart »).
 *
 * Une ligne lue sur le scan arrive avec sa désignation, sa quantité, son unité. L'assistante devait
 * ensuite choisir, ligne à ligne, l'ACTION (conception, impression…) et l'ARTICLE DEMANDÉ qu'elle chiffre.
 * Ce module PROPOSE les deux, par règles simples — une proposition reste modifiable à l'écran :
 *
 *   • l'ACTION : d'abord le verbe imprimé (« Impression de… », « Conception… », « Livraison »), le
 *     premier qui apparaît ; sinon la nature de l'objet (dépliant → impression, présentoir → fabrication,
 *     stylo → achat) ; sinon l'action UNIQUE que l'article rapproché demande ; sinon rien ;
 *   • l'ARTICLE : la référence catalogue citée, puis les mots partagés avec le nom de l'article (et ce
 *     qu'il promeut), puis une quantité égale à la quantité demandée ; un seul article demandé sur le
 *     dossier rattache toute ligne. Un ex æquo ne choisit pas : la ligne reste « en plus ».
 *
 * Module PUR, sans import de valeur : l'éditeur (composant client) le lit.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { PromoAction } from "@/lib/promo-material/actions-fournisseur";
import type { ArticleDemandeLu } from "@/lib/promo-material/achats";

export type ArticlePourRapprochement = Pick<ArticleDemandeLu, "id" | "reference" | "nom" | "quantite" | "actions"> & {
  produits?: { nom: string }[];
  promus?: string[];
};

export interface LignePourProposition {
  designation: string;
  quantite: number | null;
  unite?: string | null;
}

export interface PropositionLigne {
  action: PromoAction | null;
  /** L'identifiant de l'article demandé ; `null` : « en plus (non demandé) ». */
  articleId: string | null;
}

/** Minuscules, sans accents, ponctuation en espaces. */
export function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Les VERBES de prestation — le premier imprimé l'emporte (« Conception et impression » → conception). */
const VERBES: readonly [PromoAction, RegExp][] = [
  ["CONCEPTION", /\b(conception|concevoir|creation|creations|maquettes?|design|graphisme|graphique|infographie|mise en page|bat|declinaisons?|adaptation|redaction|illustrations?|retouches?)\b/],
  ["IMPRESSION", /\b(impressions?|imprime|imprimes|imprimer|tirages?|reimpression|offset|quadri|quadrichromie|serigraphie|reproduction)\b/],
  ["FABRICATION", /\b(fabrication|fabrique|confection|menuiserie|decoupe)\b/],
  ["LIVRAISON", /\b(livraison|livraisons|transport|expedition|acheminement|frais de port|port)\b/],
  ["INSTALLATION", /\b(installation|montage|pose|demontage|mise en place|amenagement)\b/],
  ["LOCATION", /\b(location|loue|louer|locations)\b/],
  ["ACHAT", /\b(achat|fourniture|acquisition)\b/],
];

/** La NATURE de l'objet, quand aucun verbe n'est imprimé. */
const OBJETS: readonly [PromoAction, RegExp][] = [
  ["IMPRESSION", /\b(depliants?|flyers?|brochures?|affiches?|fiches?|cartes? de visite|cartes?|catalogues?|plaquettes?|leaflets?|autocollants?|stickers?|etiquettes?|baches?|calendriers?|blocs? notes?|ordonnanciers?|posters?|enveloppes?|chemises?|papier|couche|recto|verso|\d+ ?g|a[3456]|banderoles?|invitations?)\b/],
  ["FABRICATION", /\b(presentoirs?|plv|stands?|displays?|totems?|comptoirs?|kakemonos?|roll ?ups?|x ?banners?|caissons?|panneaux?|vitrines?|enseignes?|cubes?|structures?)\b/],
  ["ACHAT", /\b(stylos?|mugs?|tasses?|cles? usb|sacs?|sacoches?|casquettes?|t ?shirts?|polos?|porte ?cles?|parapluies?|tapis de souris|power ?banks?|gourdes?|goodies|agendas?|blouses?|trousses?|cartables?|montres?|horloges?)\b/],
];

const premierePosition = (texte: string, motifs: readonly [PromoAction, RegExp][]): PromoAction | null => {
  let meilleure: { action: PromoAction; index: number } | null = null;
  for (const [action, re] of motifs) {
    const m = re.exec(texte);
    if (m && (meilleure === null || m.index < meilleure.index)) meilleure = { action, index: m.index };
  }
  return meilleure?.action ?? null;
};

/** L'action que la désignation dit — verbe imprimé d'abord, nature de l'objet ensuite ; `null` si rien ne la dit. */
export function devinerAction(designation: string): PromoAction | null {
  const t = normaliser(designation);
  if (!t) return null;
  return premierePosition(t, VERBES) ?? premierePosition(t, OBJETS);
}

/** Des mots qui ne disent rien d'un article. */
const VIDES = new Set([
  "les", "des", "une", "pour", "avec", "sans", "sur", "par", "aux", "dans", "format", "type", "modele", "produit", "produits",
  "unite", "unites", "piece", "pieces", "lot", "ref", "reference", "selon", "compris", "inclus", "couleur", "couleurs", "face", "faces",
  "societe", "general", "gamme", "autre", "laboratoire", "adventum", "pharma",
]);

/** Le radical grossier d'un mot : pluriel retiré. */
const radical = (m: string): string => (m.length > 3 ? m.replace(/[sx]$/, "") : m);

function mots(s: string): Set<string> {
  return new Set(normaliser(s).split(" ").filter((m) => m.length >= 3 && !VIDES.has(m) && !/^\d+$/.test(m)).map(radical));
}

const memeQuantite = (a: number | null, b: number | null): boolean => a !== null && b !== null && Math.abs(a - b) < 0.0005;

/**
 * L'ARTICLE DEMANDÉ que la ligne chiffre, s'il se reconnaît — `null` sinon (« en plus »). Un ex æquo
 * entre deux articles ne tranche pas.
 */
export function rapprocherArticle(ligne: LignePourProposition, articles: readonly ArticlePourRapprochement[], action: PromoAction | null = null): string | null {
  if (articles.length === 0) return null;
  if (articles.length === 1) return articles[0].id;
  const designation = normaliser(ligne.designation);
  const motsLigne = mots(ligne.designation);
  const scores = articles.map((a) => {
    let score = 0;
    const ref = normaliser(a.reference);
    if (ref && designation.includes(ref)) score += 10;
    const motsArticle = mots([a.nom, ...(a.promus ?? []), ...(a.produits ?? []).map((p) => p.nom)].join(" "));
    for (const m of motsLigne) if (motsArticle.has(m)) score += 2;
    if (memeQuantite(ligne.quantite, a.quantite)) score += 1.5;
    if (score > 0 && action && a.actions.includes(action)) score += 0.5;
    return { id: a.id, score };
  }).sort((x, y) => y.score - x.score);
  const [premier, second] = scores;
  if (premier.score < 1.5) return null;
  if (second && second.score === premier.score) return null;
  return premier.id;
}

/** ACTION ET ARTICLE PROPOSÉS pour une ligne lue. */
export function proposerLigne(ligne: LignePourProposition, articles: readonly ArticlePourRapprochement[]): PropositionLigne {
  const lue = devinerAction(ligne.designation);
  const articleId = rapprocherArticle(ligne, articles, lue);
  if (lue) return { action: lue, articleId };
  // Rien d'imprimé ne dit l'action : celle que l'article rapproché demande, si elle est UNIQUE.
  const article = articleId ? articles.find((a) => a.id === articleId) : undefined;
  return { action: article && article.actions.length === 1 ? article.actions[0] : null, articleId };
}
