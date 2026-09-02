/**
 * LES WILAYAS D'ALGÉRIE — la liste, et pourquoi elle est écrite ici.
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * La ville d'une demande se saisissait à la main. On lisait donc, dans la même colonne : « Alger »,
 * « alger », « ALGER », « Alger centre », « Algiers », « Bordj Bou Arreridj », « Bordj Bou
 * Arréridj », « BBA ». Le champ était rempli — il n'était simplement pas exploitable : aucun
 * regroupement par région, aucun total par wilaya, et deux demandes du même endroit qui ne se
 * ressemblaient pas.
 *
 * ── POURQUOI UNE LISTE EN DUR, ET NON UNE TABLE ─────────────────────────────────────────────
 *
 * Le découpage administratif algérien est stable — 58 wilayas depuis 2019 — et il ne se gère pas :
 * personne dans l'entreprise n'a à en créer une. Une table demanderait un écran d'administration,
 * une migration, un import initial et un risque de dérive entre environnements, pour une donnée
 * qui ne bouge qu'à la faveur d'une loi. Le jour où l'État en crée une 59ᵉ, on ajoute une ligne
 * ici et le déploiement suivant la porte partout.
 *
 * Le NUMÉRO fait partie du nom dans l'usage courant (« 16 Alger », « 31 Oran ») : il sert au tri
 * et il aide à trouver dans une liste longue.
 *
 * ── CE QU'ON FAIT DE L'EXISTANT ─────────────────────────────────────────────────────────────
 *
 * Des milliers de demandes portent déjà une ville tapée à la main. `normalizeCity` reconnaît ce
 * qu'elle peut (casse, accents, tirets) et RESPECTE le reste : effacer une valeur qu'on ne sait
 * pas rattacher perdrait une information vraie au nom de la propreté.
 *
 * Module PUR : ni base, ni session. Testé.
 */

export interface Wilaya {
  /** Le code officiel, sur deux chiffres — « 16 » pour Alger. */
  code: string;
  name: string;
}

/** Les 58 wilayas, dans l'ordre officiel des codes. */
export const WILAYAS: readonly Wilaya[] = [
  { code: "01", name: "Adrar" }, { code: "02", name: "Chlef" }, { code: "03", name: "Laghouat" },
  { code: "04", name: "Oum El Bouaghi" }, { code: "05", name: "Batna" }, { code: "06", name: "Béjaïa" },
  { code: "07", name: "Biskra" }, { code: "08", name: "Béchar" }, { code: "09", name: "Blida" },
  { code: "10", name: "Bouira" }, { code: "11", name: "Tamanrasset" }, { code: "12", name: "Tébessa" },
  { code: "13", name: "Tlemcen" }, { code: "14", name: "Tiaret" }, { code: "15", name: "Tizi Ouzou" },
  { code: "16", name: "Alger" }, { code: "17", name: "Djelfa" }, { code: "18", name: "Jijel" },
  { code: "19", name: "Sétif" }, { code: "20", name: "Saïda" }, { code: "21", name: "Skikda" },
  { code: "22", name: "Sidi Bel Abbès" }, { code: "23", name: "Annaba" }, { code: "24", name: "Guelma" },
  { code: "25", name: "Constantine" }, { code: "26", name: "Médéa" }, { code: "27", name: "Mostaganem" },
  { code: "28", name: "M'Sila" }, { code: "29", name: "Mascara" }, { code: "30", name: "Ouargla" },
  { code: "31", name: "Oran" }, { code: "32", name: "El Bayadh" }, { code: "33", name: "Illizi" },
  { code: "34", name: "Bordj Bou Arréridj" }, { code: "35", name: "Boumerdès" }, { code: "36", name: "El Tarf" },
  { code: "37", name: "Tindouf" }, { code: "38", name: "Tissemsilt" }, { code: "39", name: "El Oued" },
  { code: "40", name: "Khenchela" }, { code: "41", name: "Souk Ahras" }, { code: "42", name: "Tipaza" },
  { code: "43", name: "Mila" }, { code: "44", name: "Aïn Defla" }, { code: "45", name: "Naâma" },
  { code: "46", name: "Aïn Témouchent" }, { code: "47", name: "Ghardaïa" }, { code: "48", name: "Relizane" },
  // Les dix wilayas créées en 2019 — le Sud, détaché de ses wilayas d'origine.
  { code: "49", name: "Timimoun" }, { code: "50", name: "Bordj Badji Mokhtar" },
  { code: "51", name: "Ouled Djellal" }, { code: "52", name: "Béni Abbès" }, { code: "53", name: "In Salah" },
  { code: "54", name: "In Guezzam" }, { code: "55", name: "Touggourt" }, { code: "56", name: "Djanet" },
  { code: "57", name: "El M'Ghair" }, { code: "58", name: "El Meniaa" },
];

/** Les options d'un menu déroulant — « 16 · Alger », triées par code. */
export function wilayaOptions(): { value: string; label: string }[] {
  return WILAYAS.map((w) => ({ value: w.name, label: `${w.code} · ${w.name}` }));
}

/** Réduit un libellé à sa forme comparable : sans accents, sans ponctuation, en minuscules. */
function fold(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_FOLD = new Map(WILAYAS.map((w) => [fold(w.name), w]));

/**
 * LA WILAYA RECONNUE DERRIÈRE UNE SAISIE LIBRE — ou `null`.
 *
 * Reconnaît la casse, les accents et les tirets (« bordj bou arreridj » → « Bordj Bou Arréridj »),
 * ainsi que le code seul (« 16 »). Elle ne DEVINE pas au-delà : « Alger centre » n'est pas Alger,
 * c'est une commune, et un rapprochement approximatif ferait entrer dans les statistiques des
 * rattachements que personne n'a validés.
 */
export function findWilaya(raw: string | null | undefined): Wilaya | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const parCode = WILAYAS.find((w) => w.code === t.padStart(2, "0"));
  if (parCode) return parCode;
  return BY_FOLD.get(fold(t)) ?? null;
}

/**
 * LA VILLE À AFFICHER, à partir de ce qui est stocké.
 *
 * Une valeur reconnue prend sa forme officielle ; une valeur inconnue est RENDUE TELLE QUELLE.
 * Effacer ce qu'on ne sait pas rattacher perdrait une information vraie au nom de la propreté —
 * et c'est précisément sur les vieilles demandes qu'on en a le plus besoin.
 */
export function normalizeCity(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  return findWilaya(t)?.name ?? t;
}

/** La valeur est-elle une wilaya du référentiel ? (pour signaler une saisie ancienne) */
export function isKnownWilaya(raw: string | null | undefined): boolean {
  return findWilaya(raw) !== null;
}
