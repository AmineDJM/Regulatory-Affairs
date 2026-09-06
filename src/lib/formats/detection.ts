/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UN FICHIER EST VRAIMENT (mandat 5 §41) — pur.
 *
 * Un CSV exporté d'Excel en France arrive en LATIN-1, séparé par des POINTS-VIRGULES, avec des
 * nombres écrits « 1 234,56 » et des dates « 31/12/2026 ». Lu comme de l'UTF-8 à virgules, il
 * devient une colonne unique pleine de « Ã© », et les montants deviennent du texte. C'est le
 * défaut le plus banal et le plus coûteux de tout import : personne ne le voit, tout le monde
 * en hérite.
 *
 * Ici, tout se DÉTECTE et rien ne se suppose : l'encodage (marque d'ordre, validité UTF-8, repli
 * latin-1), le séparateur (par la RÉGULARITÉ du nombre de colonnes, pas par la fréquence), la
 * présence d'un en-tête, et la LOCALE des nombres et des dates. Chaque décision porte sa
 * confiance et sa raison — et quand deux lectures sont également défendables, le code le DIT
 * plutôt que d'en choisir une en silence.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type Encodage = "utf-8" | "utf-8-bom" | "utf-16le" | "utf-16be" | "latin-1";
export type Separateur = "," | ";" | "\t" | "|";
export const SEPARATEURS: readonly Separateur[] = [",", ";", "\t", "|"];

export interface DetectionEncodage {
  encodage: Encodage;
  confiance: number;
  raison: string;
  /** Le texte décodé avec cet encodage. */
  texte: string;
  /** Des caractères de remplacement (�) subsistent : le fichier est abîmé ou l'encodage est exotique. */
  caracteresPerdus: number;
}

/** L'ENCODAGE d'un fichier texte — par la marque d'ordre d'abord, par la validité UTF-8 ensuite. */
export function detecterEncodage(octets: Buffer): DetectionEncodage {
  if (octets.length >= 3 && octets[0] === 0xef && octets[1] === 0xbb && octets[2] === 0xbf) {
    const texte = octets.subarray(3).toString("utf8");
    return { encodage: "utf-8-bom", confiance: 1, raison: "marque d'ordre UTF-8 en tête du fichier", texte, caracteresPerdus: perdus(texte) };
  }
  if (octets.length >= 2 && octets[0] === 0xff && octets[1] === 0xfe) {
    const texte = octets.subarray(2).toString("utf16le");
    return { encodage: "utf-16le", confiance: 1, raison: "marque d'ordre UTF-16 petit-boutiste", texte, caracteresPerdus: perdus(texte) };
  }
  if (octets.length >= 2 && octets[0] === 0xfe && octets[1] === 0xff) {
    // Node ne décode pas l'UTF-16 gros-boutiste : on retourne les octets deux à deux.
    const retourne = Buffer.from(octets.subarray(2));
    for (let i = 0; i + 1 < retourne.length; i += 2) { const t = retourne[i]!; retourne[i] = retourne[i + 1]!; retourne[i + 1] = t; }
    const texte = retourne.toString("utf16le");
    return { encodage: "utf-16be", confiance: 1, raison: "marque d'ordre UTF-16 gros-boutiste", texte, caracteresPerdus: perdus(texte) };
  }
  const enUtf8 = octets.toString("utf8");
  const perte = perdus(enUtf8);
  if (perte === 0) {
    const accents = /[àâäçéèêëîïôöùûüÀÂÄÇÉÈÊËÎÏÔÖÙÛÜ]/.test(enUtf8);
    return {
      encodage: "utf-8",
      confiance: accents ? 0.98 : 0.8,
      raison: accents ? "séquences UTF-8 valides, accents français correctement formés" : "séquences UTF-8 valides (aucun accent : l'ASCII pur est aussi du latin-1)",
      texte: enUtf8, caracteresPerdus: 0,
    };
  }
  // UTF-8 invalide : c'est presque toujours du latin-1 (Windows-1252) — l'export d'un tableur français.
  const enLatin = octets.toString("latin1");
  return {
    encodage: "latin-1",
    confiance: 0.9,
    raison: `${perte} séquence(s) UTF-8 invalide(s) : le fichier est lu en latin-1 (Windows-1252), l'encodage des exports de tableur francophones`,
    texte: enLatin, caracteresPerdus: perdus(enLatin),
  };
}

const perdus = (s: string): number => (s.match(/�/g) ?? []).length;

export interface DetectionSeparateur {
  separateur: Separateur;
  confiance: number;
  raison: string;
  colonnes: number;
  /** Les autres séparateurs qui donnaient un découpage régulier — l'ambiguïté est DITE. */
  concurrents: { separateur: Separateur; colonnes: number }[];
}

/** Découpe une ligne CSV en tenant compte des guillemets (un séparateur entre guillemets n'en est pas un). */
export function decouperLigne(ligne: string, separateur: string, guillemet = '"'): string[] {
  const out: string[] = [];
  let courant = "", dansGuillemets = false;
  for (let i = 0; i < ligne.length; i += 1) {
    const c = ligne[i]!;
    if (dansGuillemets) {
      if (c === guillemet) {
        if (ligne[i + 1] === guillemet) { courant += guillemet; i += 1; }
        else dansGuillemets = false;
      } else courant += c;
    } else if (c === guillemet) dansGuillemets = true;
    else if (c === separateur) { out.push(courant); courant = ""; }
    else courant += c;
  }
  out.push(courant);
  return out;
}

/**
 * LE SÉPARATEUR — par la RÉGULARITÉ, jamais par la fréquence. Un texte plein de virgules dans
 * des phrases en contient plus qu'il n'y a de points-virgules ; mais seul le point-virgule
 * découpe TOUTES les lignes en le MÊME nombre de colonnes. C'est ça, un séparateur.
 */
export function detecterSeparateur(texte: string, lignesTestees = 20): DetectionSeparateur {
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, lignesTestees);
  if (!lignes.length) return { separateur: ",", confiance: 0, raison: "fichier vide", colonnes: 1, concurrents: [] };
  const scores = SEPARATEURS.map((sep) => {
    const comptes = lignes.map((l) => decouperLigne(l, sep).length);
    const premier = comptes[0]!;
    const reguliers = comptes.filter((c) => c === premier).length;
    return { separateur: sep, colonnes: premier, regularite: reguliers / comptes.length, moyenne: comptes.reduce((s, c) => s + c, 0) / comptes.length };
  }).filter((s) => s.colonnes > 1);
  if (!scores.length) return { separateur: ",", confiance: 0.2, raison: "aucun séparateur ne découpe le fichier en colonnes : une seule colonne, ou un format qui n'est pas tabulaire", colonnes: 1, concurrents: [] };
  // Le meilleur : parfaitement régulier d'abord, puis le plus de colonnes.
  scores.sort((a, b) => (b.regularite - a.regularite) || (b.colonnes - a.colonnes));
  const meilleur = scores[0]!;
  const exaequo = scores.filter((s) => s !== meilleur && s.regularite >= meilleur.regularite - 1e-9 && s.colonnes > 1);
  return {
    separateur: meilleur.separateur,
    confiance: meilleur.regularite >= 1 ? (exaequo.length ? 0.7 : 0.97) : meilleur.regularite * 0.8,
    raison: meilleur.regularite >= 1
      ? `« ${nomSeparateur(meilleur.separateur)} » découpe les ${lignes.length} premières lignes en ${meilleur.colonnes} colonnes, toutes identiques${exaequo.length ? ` — mais ${exaequo.map((e) => nomSeparateur(e.separateur)).join(" et ")} aussi : à vérifier` : ""}`
      : `« ${nomSeparateur(meilleur.separateur)} » est le plus régulier (${Math.round(meilleur.regularite * 100)} % des lignes à ${meilleur.colonnes} colonnes) : le fichier a des lignes irrégulières`,
    colonnes: meilleur.colonnes,
    concurrents: exaequo.map((e) => ({ separateur: e.separateur, colonnes: e.colonnes })),
  };
}

export const nomSeparateur = (s: string): string => (s === "\t" ? "tabulation" : s === ";" ? "point-virgule" : s === "," ? "virgule" : s === "|" ? "barre verticale" : s);

/** L'EN-TÊTE : une première ligne de textes non numériques, distincts, au-dessus de lignes qui, elles, portent des nombres. */
export function detecterEntete(lignes: readonly string[][]): { entete: boolean; confiance: number; raison: string } {
  if (lignes.length < 2) return { entete: lignes.length === 1, confiance: 0.4, raison: "une seule ligne : impossible de comparer, elle est prise pour un en-tête" };
  const premiere = lignes[0]!;
  const suivantes = lignes.slice(1, 12);
  const numerique = (v: string) => v.trim() !== "" && Number.isFinite(Number(v.trim().replace(/\s/g, "").replace(",", ".")));
  const nombresEnTete = premiere.filter(numerique).length;
  const nombresDessous = suivantes.length ? suivantes.reduce((s, l) => s + l.filter(numerique).length, 0) / suivantes.length : 0;
  const distincts = new Set(premiere.map((v) => v.trim().toLowerCase())).size === premiere.length;
  const videsEnTete = premiere.filter((v) => v.trim() === "").length;
  if (nombresEnTete === 0 && nombresDessous > 0.5 && distincts && videsEnTete === 0) {
    return { entete: true, confiance: 0.95, raison: "la première ligne n'a aucun nombre, ses valeurs sont distinctes, et les lignes suivantes portent des nombres" };
  }
  if (nombresEnTete > 0 && nombresEnTete >= nombresDessous) {
    return { entete: false, confiance: 0.85, raison: "la première ligne contient autant de nombres que les suivantes : c'est une ligne de données, pas un en-tête" };
  }
  return { entete: distincts, confiance: 0.6, raison: distincts ? "première ligne plausible en en-tête (valeurs distinctes), sans certitude" : "valeurs répétées en première ligne : ce n'est probablement pas un en-tête" };
}

export type LocaleNombre = "fr" | "en" | "indetermine";

export interface DetectionLocale {
  nombres: LocaleNombre;
  dates: "jj/mm/aaaa" | "mm/jj/aaaa" | "aaaa-mm-jj" | "indetermine";
  confianceNombres: number;
  confianceDates: number;
  raison: string;
}

/**
 * LA LOCALE — « 1 234,56 » est français, « 1,234.56 » est anglais, et « 1,234 » est AMBIGU
 * (mille deux cent trente-quatre, ou un virgule deux trois quatre ?). L'ambiguïté est dite.
 * Pour les dates, « 03/04/2026 » est indécidable : seul un jour > 12 quelque part tranche.
 */
export function detecterLocale(valeurs: readonly string[]): DetectionLocale {
  let fr = 0, en = 0;
  let jourGrand = 0, moisGrand = 0, iso = 0, datesVues = 0;
  for (const brut of valeurs) {
    const v = String(brut ?? "").trim();
    if (!v) continue;
    // Nombres : la marque est le SÉPARATEUR DÉCIMAL, reconnu à sa position et à ce qui le suit.
    if (/^-?\d{1,3}(?:[  .]\d{3})+,\d+$/.test(v) || /^-?\d+,\d{1,2}$/.test(v)) fr += 1;
    else if (/^-?\d{1,3}(?:,\d{3})+\.\d+$/.test(v) || /^-?\d+\.\d{1,2}$/.test(v)) en += 1;
    else if (/^-?\d{1,3}(?:[  ]\d{3})+$/.test(v)) fr += 1;
    else if (/^-?\d{1,3}(?:,\d{3})+$/.test(v)) en += 0.5; // « 1,234 » : plutôt anglais, mais pas sûr
    // Dates.
    const jjmm = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/.exec(v);
    if (jjmm) {
      datesVues += 1;
      const a = Number(jjmm[1]), b = Number(jjmm[2]);
      if (a > 12 && b <= 12) jourGrand += 1;
      else if (b > 12 && a <= 12) moisGrand += 1;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(v)) { datesVues += 1; iso += 1; }
  }
  const nombres: LocaleNombre = fr > en * 1.5 ? "fr" : en > fr * 1.5 ? "en" : fr + en > 0 ? "indetermine" : "indetermine";
  const dates = iso > 0 && iso >= datesVues * 0.8 ? "aaaa-mm-jj" as const
    : jourGrand > moisGrand ? "jj/mm/aaaa" as const
    : moisGrand > jourGrand ? "mm/jj/aaaa" as const
    : "indetermine" as const;
  const raisons: string[] = [];
  if (nombres === "fr") raisons.push("nombres à virgule décimale et espace de milliers : locale française");
  else if (nombres === "en") raisons.push("nombres à point décimal et virgule de milliers : locale anglaise");
  else if (fr + en > 0) raisons.push("nombres AMBIGUS (« 1,234 » peut valoir 1234 ou 1,234) : la locale n'est pas décidable sur cet échantillon");
  if (dates === "jj/mm/aaaa") raisons.push(`dates jour/mois (${jourGrand} valeur(s) avec un jour > 12)`);
  else if (dates === "mm/jj/aaaa") raisons.push(`dates mois/jour (${moisGrand} valeur(s) avec un mois > 12 en seconde position)`);
  else if (dates === "aaaa-mm-jj") raisons.push("dates ISO");
  else if (datesVues > 0) raisons.push("dates AMBIGUËS : aucune valeur ne dépasse 12, « 03/04 » peut être le 3 avril comme le 4 mars");
  return {
    nombres, dates,
    confianceNombres: nombres === "indetermine" ? (fr + en > 0 ? 0.4 : 0) : Math.min(0.97, 0.6 + Math.max(fr, en) / 20),
    confianceDates: dates === "indetermine" ? (datesVues ? 0.4 : 0) : Math.min(0.97, 0.6 + Math.max(jourGrand, moisGrand, iso) / 10),
    raison: raisons.join(" ; ") || "ni nombre ni date reconnaissable dans l'échantillon",
  };
}

/** Convertit une valeur texte en nombre SELON la locale détectée. Rend `null` sur ce qui n'en est pas un. */
export function versNombre(v: string, locale: LocaleNombre): number | null {
  const t = String(v ?? "").trim();
  if (!t) return null;
  let net = t.replace(/[\s  ]/g, "").replace(/[€$]|DZD|DA\b/gi, "").trim();
  const negatifParenthese = /^\((.*)\)$/.exec(net);
  if (negatifParenthese) net = `-${negatifParenthese[1]}`;
  if (locale === "fr") net = net.replace(/\./g, "").replace(",", ".");
  else if (locale === "en") net = net.replace(/,/g, "");
  else {
    // Indéterminé : on ne devine QUE les cas non ambigus (un seul séparateur, suivi d'autre chose que 3 chiffres).
    const virgule = net.lastIndexOf(","), point = net.lastIndexOf(".");
    if (virgule >= 0 && point >= 0) net = virgule > point ? net.replace(/\./g, "").replace(",", ".") : net.replace(/,/g, "");
    else if (virgule >= 0) net = /,\d{3}$/.test(net) ? net.replace(",", "") : net.replace(",", ".");
  }
  const n = Number(net);
  return Number.isFinite(n) ? n : null;
}

/** Convertit une date texte en ISO (AAAA-MM-JJ) SELON l'ordre détecté. `null` sur ce qui n'en est pas une. */
export function versDateIso(v: string, ordre: DetectionLocale["dates"]): string | null {
  const t = String(v ?? "").trim();
  if (!t) return null;
  const isoDirect = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (isoDirect) return `${isoDirect[1]}-${isoDirect[2]}-${isoDirect[3]}`;
  const m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/.exec(t);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  let annee = Number(m[3]);
  if (annee < 100) annee += annee < 50 ? 2000 : 1900;
  let jour: number, mois: number;
  if (ordre === "mm/jj/aaaa") { mois = a; jour = b; }
  else if (ordre === "jj/mm/aaaa") { jour = a; mois = b; }
  else if (a > 12) { jour = a; mois = b; }
  else if (b > 12) { mois = a; jour = b; }
  else return null; // AMBIGU et aucun ordre donné : on ne devine pas une date.
  if (jour < 1 || jour > 31 || mois < 1 || mois > 12) return null;
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}
