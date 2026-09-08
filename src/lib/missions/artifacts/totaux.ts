import type { Agregat, ColonneSpec, TypeColonne } from "@/lib/missions/artifacts/spec";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN TOTAL EST UNE OPÉRATION, PAS UNE VALEUR — module PUR, sans un seul import de valeur.
 *
 * ── LE DÉFAUT, MESURÉ, ET IL SORT VERIFIED ──────────────────────────────────────────────
 *
 * Le contrat dit au modèle : « tu n'écris JAMAIS de formule Excel : déclare `totals`, le code
 * écrira la formule juste ». Il ne lui dit rien de ce qu'il fait à la place quand il ne suit
 * pas : il écrit le total comme une LIGNE DE DONNÉES.
 *
 *     rows: [ ["Nivolex", "84500"], ["Trastuzex", "91000"], ["TOTAL", "170000"] ]
 *     totals: []
 *
 * Le classeur produit alors : trois lignes de données, ZÉRO formule, aucune cellule en erreur,
 * aucun reste de brouillon. `controlerClasseur` rend `ok: true`, l'artefact passe VERIFIED — le
 * seul statut qui vaut preuve d'achèvement (§118.10) — et part à la direction.
 *
 * Deux choses sont fausses dans ce fichier, et la seconde est la pire :
 *
 *   • il n'est pas FONCTIONNEL. On change une hypothèse, le total ne bouge pas. Ce n'est pas un
 *     tableur, c'est la PHOTOGRAPHIE d'un tableur.
 *   • le total est FAUX. 84 500 + 91 000 = 175 500, pas 170 000. Personne ne l'a vu, parce que
 *     personne — aucun code — n'avait comparé le chiffre annoncé à ses propres lignes.
 *
 * ── POURQUOI ON TRADUIT AU LIEU DE REFUSER ──────────────────────────────────────────────
 *
 * Le modèle n'a pas tort sur l'INTENTION — il veut un total, et il y en a un à faire. Il a tort
 * sur le MÉCANISME, et le mécanisme appartient au code (§118 : « les modèles décident QUOI, le
 * code décide COMMENT »). Refuser lui ferait payer un aller-retour de planification pour une
 * chose qu'on sait faire à sa place. On PROMEUT donc la ligne : elle sort de `rows`, elle entre
 * dans `totals`, et le code écrit `SUM(D2:D3)` avec le bon D et le bon 3.
 *
 * C'est le geste de `personnes/designation.ts` (§118.34) transposé aux chiffres : traduire ce
 * qu'on lit à coup sûr, rendre `null` sur le reste, et ne JAMAIS deviner.
 *
 * ── CE QU'ON NE PROMEUT PAS, ET POURQUOI CE SILENCE EST VOULU ───────────────────────────
 *
 * « Total 2026 », « Total Nivolex », « Sous-total Alger » : ce sont peut-être des agrégats,
 * peut-être des sous-totaux de groupe, peut-être des lignes de données dont le libellé commence
 * par « total ». Promouvoir un SOUS-TOTAL serait ruineux : sa plage engloberait les lignes du
 * groupe suivant, et le classeur afficherait un chiffre faux AVEC une formule — c'est-à-dire un
 * chiffre faux qu'on croit vérifié. On ne promeut donc que ce qu'on lit à coup sûr, et ce qu'on
 * a reconnu sans pouvoir le traduire est DIT (`suspecte`), jamais deviné.
 *
 * L'ÉCART, lui, ne se tait pas. Un total annoncé qui ne tombe pas sur la somme de ses propres
 * lignes signifie l'une de deux choses, toutes deux graves : le modèle a compté faux, ou il a
 * perdu une ligne en chemin. La formule répare l'affichage ; elle ne répond pas à la question
 * de savoir laquelle des deux. C'est un humain qui doit regarder (§118.10 : le contrôle
 * arithmétique a le dernier mot dans le sens négatif).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce qu'un libellé de ligne annonce comme agrégat. Vocabulaire FERMÉ : l'étendre est une décision de revue. */
const VOCABULAIRE: Readonly<Record<string, Agregat | "QUALIFICATIF">> = {
  total: "SUM", totaux: "SUM", somme: "SUM", cumul: "SUM", cumule: "SUM", cumules: "SUM",
  moyenne: "AVG", moy: "AVG",
  // Des mots qui ACCOMPAGNENT sans changer l'opération : « Total général », « Somme globale ».
  general: "QUALIFICATIF", generale: "QUALIFICATIF", generaux: "QUALIFICATIF",
  global: "QUALIFICATIF", globale: "QUALIFICATIF", ensemble: "QUALIFICATIF", globaux: "QUALIFICATIF",
};

/** Ce qui RESSEMBLE à un agrégat sans en être un à coup sûr — dit, jamais promu. */
const AMORCES = /^(?:sous-?)?(?:total|totaux|somme|cumul|moyenne)\b/i;

const sansAccents = (t: string): string =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * L'agrégat qu'un libellé DÉCLARE, ou `null`.
 *
 * Le libellé doit être fait ENTIÈREMENT de mots du vocabulaire — « Total », « TOTAUX »,
 * « Total général » passent ; « Total 2026 » ne passe pas, parce que « 2026 » n'y est pas et
 * qu'on ne sait pas si c'est un agrégat de tout le tableau ou de la seule année.
 */
export function agregatDuLibelle(libelle: string): Agregat | null {
  // Les CHIFFRES comptent comme des mots : « Total 2026 » ne doit pas se lire « total », sans
  // quoi on promouvrait le total d'une seule année comme celui du tableau entier.
  const mots = sansAccents(libelle).split(/[^a-z0-9]+/).filter(Boolean);
  if (mots.length === 0 || mots.length > 3) return null;
  let agregat: Agregat | null = null;
  for (const m of mots) {
    const v = VOCABULAIRE[m];
    if (!v) return null;
    if (v === "QUALIFICATIF") continue;
    // Deux opérations dans un même libellé (« total moyenne ») : on ne choisit pas.
    if (agregat && agregat !== v) return null;
    agregat = v;
  }
  return agregat;
}

export interface EcartTotal {
  feuille: string;
  colonne: string;
  agregat: Agregat;
  /** Le chiffre que le modèle avait écrit dans sa ligne de total. */
  annonce: number;
  /** Ce que ses PROPRES lignes donnent. */
  calcule: number;
}

export interface PromotionTotaux {
  /** Les lignes SANS la ligne d'agrégat — celle-ci est devenue une formule. */
  rows: Record<string, string | number | null>[];
  /** Les totaux déclarés, enrichis de ceux qu'on vient de reconnaître. */
  totals: Record<string, Agregat>;
  /** Les colonnes où le chiffre annoncé ne tombe pas sur ses propres lignes. */
  ecarts: EcartTotal[];
  /** Une ligne reconnue comme un agrégat probable sans avoir pu être traduite. */
  suspecte: string | null;
}

/** Un total annoncé et un total calculé qui diffèrent de ceci sont deux chiffres différents. */
const TOLERANCE = 0.005;

const estNumerique = (t: TypeColonne): boolean => t === "number" || t === "money" || t === "percent";

/**
 * PROMEUT UNE LIGNE D'AGRÉGAT ÉCRITE COMME UNE DONNÉE.
 *
 * Rend `null` quand il n'y a rien à faire — aucune ligne reconnue, ou rien qu'on lise à coup
 * sûr. Un `null` laisse tout passer tel quel : une garde qui refuse ce qu'elle ne comprend pas
 * est désactivée dans la semaine (§118.16).
 */
export function promouvoirTotaux(args: {
  nomFeuille: string;
  columns: ColonneSpec[];
  rows: Record<string, string | number | null>[];
  totals: Record<string, Agregat>;
}): PromotionTotaux | null {
  const { nomFeuille, columns, rows, totals } = args;
  if (rows.length < 2) return null;

  const colonnesTexte = columns.filter((c) => c.type === "text");
  const colonnesNombre = columns.filter((c) => estNumerique(c.type));
  const colonnesDate = columns.filter((c) => c.type === "date");
  if (colonnesTexte.length === 0 || colonnesNombre.length === 0) return null;

  /** Ce qu'une ligne est : un agrégat traduisible, un agrégat probable, ou une donnée. */
  const lire = (r: Record<string, string | number | null>): { agregat: Agregat } | "PROBABLE" | null => {
    const remplies = colonnesTexte.filter((c) => typeof r[c.key] === "string" && String(r[c.key]).trim() !== "");
    if (remplies.length !== 1) return null;
    const libelle = String(r[remplies[0].key]).trim();
    const agregat = agregatDuLibelle(libelle);
    if (!agregat) return AMORCES.test(sansAccents(libelle)) ? "PROBABLE" : null;
    // Une date remplie dit que la ligne porte une période, donc une donnée — pas un agrégat.
    if (colonnesDate.some((c) => r[c.key] !== null && r[c.key] !== "")) return "PROBABLE";
    if (!colonnesNombre.some((c) => typeof r[c.key] === "number")) return null;
    return { agregat };
  };

  const lectures = rows.map(lire);
  const indices = lectures.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
  if (indices.length === 0) return null;

  // PLUSIEURS lignes d'agrégat, ou une AU MILIEU : ce sont des sous-totaux de groupe. Les
  // promouvoir donnerait une plage qui déborde sur le groupe suivant — un chiffre faux MUNI
  // d'une formule, c'est-à-dire un faux succès mieux déguisé que celui qu'on répare.
  const traduisible = indices.length === 1 && lectures[indices[0]] !== "PROBABLE"
    && (indices[0] === 0 || indices[0] === rows.length - 1);
  if (!traduisible) {
    const libelles = indices.map((i) => {
      const c = colonnesTexte.find((col) => typeof rows[i][col.key] === "string" && String(rows[i][col.key]).trim() !== "");
      return c ? String(rows[i][c.key]).trim() : "";
    }).filter(Boolean);
    return libelles.length === 0 ? null : {
      rows, totals, ecarts: [],
      suspecte: indices.length > 1
        ? `${libelles.length} lignes ressemblent à des sous-totaux (${libelles.slice(0, 3).join(", ")}) : leurs chiffres ne sont pas recalculés par le classeur.`
        : `La ligne « ${libelles[0] } » ressemble à un agrégat sans en déclarer un : son chiffre ne sera pas recalculé par le classeur.`,
    };
  }

  const iAgregat = indices[0];
  const agregat = (lectures[iAgregat] as { agregat: Agregat }).agregat;
  const restantes = rows.filter((_, i) => i !== iAgregat);
  const ligne = rows[iAgregat];

  const nouveaux: Record<string, Agregat> = { ...totals };
  const ecarts: EcartTotal[] = [];
  for (const c of colonnesNombre) {
    const annonce = ligne[c.key];
    if (typeof annonce !== "number") continue;
    // Un total DÉJÀ déclaré garde son agrégat : le modèle l'a dit explicitement.
    const effectif = nouveaux[c.key] ?? agregat;
    nouveaux[c.key] = effectif;

    const valeurs = restantes.map((r) => r[c.key]).filter((v): v is number => typeof v === "number");
    if (valeurs.length === 0) continue;
    const somme = valeurs.reduce((s, n) => s + n, 0);
    const calcule = effectif === "AVG" ? somme / valeurs.length
      : effectif === "COUNT" ? valeurs.length
      : effectif === "MIN" ? Math.min(...valeurs)
      : effectif === "MAX" ? Math.max(...valeurs)
      : somme;
    if (Math.abs(calcule - annonce) > TOLERANCE) {
      ecarts.push({ feuille: nomFeuille, colonne: c.key, agregat: effectif, annonce, calcule });
    }
  }

  return { rows: restantes, totals: nouveaux, ecarts, suspecte: null };
}

/** L'écart, dit à quelqu'un — la phrase qui part au rapport de contrôle. */
export function direEcart(e: EcartTotal): string {
  const n = (x: number) => (Math.round(x * 100) / 100).toLocaleString("fr-FR");
  return `« ${e.feuille} », colonne « ${e.colonne} » : le total annoncé était ${n(e.annonce)}, `
    + `ses propres lignes donnent ${n(e.calcule)} (${e.agregat}). Le classeur porte désormais la formule, `
    + `mais l'écart de ${n(Math.abs(e.calcule - e.annonce))} signifie qu'un chiffre a été mal compté ou qu'une ligne manque.`;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA LIGNE DE TOTAUX POUR LES FORMATS QUI N'ONT PAS DE FORMULES.
 *
 * ── LE PIÈGE QUE CECI DÉSAMORCE, ET IL ÉTAIT À DEUX DOIGTS DE PARTIR ────────────────────
 *
 * `promouvoirTotaux` sort la ligne de total des DONNÉES pour en faire une OPÉRATION. Dans le
 * classeur, c'est exactement ce qu'on veut : le code écrit `SUM(D2:D34)`. Mais le Word, le PDF,
 * le CSV et le deck ne rendent que `rows` — ils n'ont pas de moteur de formules et n'ont jamais
 * lu `totals`. La promotion, seule, aurait donc fait DISPARAÎTRE le total de quatre livrables
 * sur cinq : une régression silencieuse, du genre qu'on ne voit qu'en ouvrant le fichier.
 *
 * Ils reçoivent donc la ligne CALCULÉE. Et ce qu'ils affichent est meilleur qu'avant, pas
 * seulement préservé : le nombre vient du code, pas de l'arithmétique mentale d'un modèle.
 *
 * Le LIBELLÉ est commun au classeur et aux autres formats, pour la raison habituelle : deux
 * endroits qui nomment la même ligne finissent par la nommer différemment (§118.5).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** « TOTAL », ou « MOYENNE » quand tous les agrégats en sont une. Le classeur et le Word disent pareil. */
export function libelleDeTotaux(totals: Record<string, Agregat> | undefined): string {
  const valeurs = Object.values(totals ?? {});
  if (valeurs.length === 0) return "TOTAL";
  if (valeurs.every((a) => a === "AVG")) return "MOYENNE";
  if (valeurs.every((a) => a === "COUNT")) return "NOMBRE";
  return "TOTAL";
}

/** La valeur d'un agrégat sur une colonne. `null` si la colonne ne porte aucun nombre. */
export function agreger(valeurs: readonly (string | number | null)[], agregat: Agregat): number | null {
  const nombres = valeurs.filter((v): v is number => typeof v === "number");
  if (nombres.length === 0) return null;
  switch (agregat) {
    case "AVG": return nombres.reduce((s, n) => s + n, 0) / nombres.length;
    case "COUNT": return nombres.length;
    case "MIN": return Math.min(...nombres);
    case "MAX": return Math.max(...nombres);
    default: return nombres.reduce((s, n) => s + n, 0);
  }
}

/**
 * LA LIGNE DE TOTAUX, CALCULÉE — pour les rendus sans formules. `null` quand il n'y a rien à
 * totaliser, auquel cas l'appelant n'ajoute simplement pas de ligne.
 */
export function ligneDeTotaux(f: {
  columns: readonly ColonneSpec[];
  rows: readonly Record<string, string | number | null>[];
  totals?: Record<string, Agregat>;
}): { libelle: string; valeurs: Record<string, number> } | null {
  if (!f.totals || Object.keys(f.totals).length === 0 || f.rows.length === 0) return null;
  const valeurs: Record<string, number> = {};
  for (const c of f.columns) {
    const agregat = f.totals[c.key];
    if (!agregat) continue;
    const v = agreger(f.rows.map((r) => r[c.key]), agregat);
    if (v !== null) valeurs[c.key] = Math.round(v * 1e6) / 1e6;
  }
  return Object.keys(valeurs).length > 0 ? { libelle: libelleDeTotaux(f.totals), valeurs } : null;
}
