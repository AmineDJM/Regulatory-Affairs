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

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES COORDONNÉES DES CHEFS-LIEUX (mandat 5 §40).
 *
 * Ce dépôt n'a pas de service de géocodage, et l'ERP ne stocke pas de coordonnées : il stocke des
 * WILAYAS. Sans cette table, « montre-moi nos clients sur une carte » resterait une ressource
 * manquante pour toujours. Avec elle, la wilaya devient un point, et tout le moteur géospatial
 * s'applique aux données réelles — distances, tournées, territoires, densités.
 *
 * Ce que ces points SONT : le chef-lieu, le siège administratif de la wilaya, au centième de degré
 * (environ un kilomètre). Ce qu'ils NE SONT PAS : le centre de gravité de la wilaya, ni l'adresse
 * exacte d'un client. Une wilaya du Sud fait la taille d'un pays européen ; y placer un client sur
 * son chef-lieu peut le déplacer de 300 km. Le code le dit à chaque usage plutôt que de le taire.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const COORDONNEES_WILAYAS: Readonly<Record<string, { lat: number; lon: number }>> = {
  "01": { lat: 27.87, lon: -0.29 },   // Adrar
  "02": { lat: 36.17, lon: 1.33 },    // Chlef
  "03": { lat: 33.80, lon: 2.87 },    // Laghouat
  "04": { lat: 35.87, lon: 7.11 },    // Oum El Bouaghi
  "05": { lat: 35.56, lon: 6.17 },    // Batna
  "06": { lat: 36.75, lon: 5.08 },    // Béjaïa
  "07": { lat: 34.85, lon: 5.73 },    // Biskra
  "08": { lat: 31.62, lon: -2.22 },   // Béchar
  "09": { lat: 36.47, lon: 2.83 },    // Blida
  "10": { lat: 36.38, lon: 3.90 },    // Bouira
  "11": { lat: 22.79, lon: 5.52 },    // Tamanrasset
  "12": { lat: 35.40, lon: 8.12 },    // Tébessa
  "13": { lat: 34.88, lon: -1.32 },   // Tlemcen
  "14": { lat: 35.37, lon: 1.32 },    // Tiaret
  "15": { lat: 36.72, lon: 4.05 },    // Tizi Ouzou
  "16": { lat: 36.75, lon: 3.06 },    // Alger
  "17": { lat: 34.67, lon: 3.26 },    // Djelfa
  "18": { lat: 36.82, lon: 5.77 },    // Jijel
  "19": { lat: 36.19, lon: 5.41 },    // Sétif
  "20": { lat: 34.83, lon: 0.15 },    // Saïda
  "21": { lat: 36.88, lon: 6.91 },    // Skikda
  "22": { lat: 35.19, lon: -0.63 },   // Sidi Bel Abbès
  "23": { lat: 36.90, lon: 7.77 },    // Annaba
  "24": { lat: 36.46, lon: 7.43 },    // Guelma
  "25": { lat: 36.37, lon: 6.61 },    // Constantine
  "26": { lat: 36.26, lon: 2.75 },    // Médéa
  "27": { lat: 35.93, lon: 0.09 },    // Mostaganem
  "28": { lat: 35.70, lon: 4.54 },    // M'Sila
  "29": { lat: 35.40, lon: 0.14 },    // Mascara
  "30": { lat: 31.95, lon: 5.33 },    // Ouargla
  "31": { lat: 35.70, lon: -0.63 },   // Oran
  "32": { lat: 33.68, lon: 1.02 },    // El Bayadh
  "33": { lat: 26.48, lon: 8.47 },    // Illizi
  "34": { lat: 36.07, lon: 4.76 },    // Bordj Bou Arréridj
  "35": { lat: 36.77, lon: 3.48 },    // Boumerdès
  "36": { lat: 36.77, lon: 8.31 },    // El Tarf
  "37": { lat: 27.67, lon: -8.15 },   // Tindouf
  "38": { lat: 35.61, lon: 1.81 },    // Tissemsilt
  "39": { lat: 33.37, lon: 6.86 },    // El Oued
  "40": { lat: 35.44, lon: 7.14 },    // Khenchela
  "41": { lat: 36.29, lon: 7.95 },    // Souk Ahras
  "42": { lat: 36.59, lon: 2.45 },    // Tipaza
  "43": { lat: 36.45, lon: 6.26 },    // Mila
  "44": { lat: 36.26, lon: 1.97 },    // Aïn Defla
  "45": { lat: 33.27, lon: -0.31 },   // Naâma
  "46": { lat: 35.30, lon: -1.14 },   // Aïn Témouchent
  "47": { lat: 32.49, lon: 3.67 },    // Ghardaïa
  "48": { lat: 35.74, lon: 0.56 },    // Relizane
  "49": { lat: 29.26, lon: 0.24 },    // Timimoun
  "50": { lat: 21.33, lon: 0.95 },    // Bordj Badji Mokhtar
  "51": { lat: 34.42, lon: 5.07 },    // Ouled Djellal
  "52": { lat: 30.13, lon: -2.17 },   // Béni Abbès
  "53": { lat: 27.20, lon: 2.48 },    // In Salah
  "54": { lat: 19.57, lon: 5.77 },    // In Guezzam
  "55": { lat: 33.11, lon: 6.06 },    // Touggourt
  "56": { lat: 24.55, lon: 9.48 },    // Djanet
  "57": { lat: 33.95, lon: 5.92 },    // El M'Ghair
  "58": { lat: 30.58, lon: 2.88 },    // El Meniaa
};

/** Les bornes de l'Algérie — tout point hors de là est une erreur de saisie, pas un lieu. */
export const BORNES_ALGERIE = { sud: 18.9, nord: 37.2, ouest: -8.7, est: 12.1 } as const;

/**
 * LA WILAYA DEVIENT UN POINT — par son code, son nom, ou un texte qui la contient.
 * Rend `null` sur ce qu'on ne reconnaît pas : un point faux est pire qu'un point absent.
 */
export function coordonneesDe(raw: string | null | undefined): { lat: number; lon: number; wilaya: Wilaya; precision: "chef-lieu" } | null {
  const w = findWilaya(raw);
  if (!w) return null;
  const c = COORDONNEES_WILAYAS[w.code];
  return c ? { ...c, wilaya: w, precision: "chef-lieu" } : null;
}

/** L'avertissement à porter partout où un chef-lieu tient lieu d'adresse. */
export const AVERTISSEMENT_CHEF_LIEU =
  "Chaque lieu est placé au CHEF-LIEU de sa wilaya, pas à son adresse exacte : dans le Sud, l'écart peut atteindre plusieurs centaines de kilomètres. Les distances sont des ordres de grandeur entre wilayas, pas des trajets.";
