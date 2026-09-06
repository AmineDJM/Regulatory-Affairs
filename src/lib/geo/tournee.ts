/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * TOURNÉES, TERRITOIRES ET IMPLANTATION (mandat 5 §40) — pur.
 *
 * Trois questions qui reviennent, et une quatrième qui les relie :
 *
 *   · « Dans quel ORDRE visiter ces douze hôpitaux ? »  — le voyageur de commerce : plus proche
 *     voisin, puis 2-opt jusqu'à ce que plus aucun croisement ne se défasse. L'optimum exact est
 *     NP-difficile : le code rend une tournée bonne, et DIT de combien elle a amélioré le naïf.
 *   · « Comment découper le pays entre trois délégués ? » — des territoires équilibrés en charge,
 *     pas seulement en surface : un délégué avec Alger a moins de kilomètres et plus de travail.
 *   · « Où poser le dépôt ? » — le point de Weber (Weiszfeld) minimise la distance TOTALE pondérée ;
 *     le p-médian choisit parmi des sites CANDIDATS réels, ce qui est la vraie question quand on
 *     ne peut pas construire au milieu d'un champ.
 *   · Et le lien avec §39 : un choix d'implantation sous contraintes (budget, capacité) est un
 *     programme en nombres entiers — le géospatial pose le problème, le solveur le tranche.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { type Lieu, coordonneesValides, distanceKm, barycentre } from "./distance";

export const ETAPES_TOURNEE_MAX = 300;
export const TERRITOIRES_MAX = 40;

export interface Tournee {
  ordre: Lieu[];
  distanceKm: number;
  distanceNaiveKm: number;
  gainPourcent: number;
  boucle: boolean;
  ameliorations: number;
  limites: string[];
}

const longueur = (ordre: readonly Lieu[], boucle: boolean): number => {
  let d = 0;
  for (let i = 0; i + 1 < ordre.length; i += 1) d += distanceKm(ordre[i]!, ordre[i + 1]!);
  if (boucle && ordre.length > 2) d += distanceKm(ordre[ordre.length - 1]!, ordre[0]!);
  return d;
};

/**
 * L'ORDRE DE VISITE : plus proche voisin depuis le départ, puis 2-opt (on défait les croisements
 * tant qu'un échange raccourcit). Rend aussi la distance de l'ordre FOURNI, pour que le gain soit
 * visible — « on gagne 180 km » vaut mieux que « voici une tournée ».
 */
export function tournee(lieux: readonly Lieu[], options: { depart?: string; boucle?: boolean } = {}): Tournee | { erreur: string } {
  const bons = lieux.filter(coordonneesValides);
  if (bons.length < 2) return { erreur: `${bons.length} lieu(x) avec des coordonnées valides : il en faut au moins deux. Une adresse sans coordonnées demande un service de géocodage, absent de ce serveur.` };
  if (bons.length > ETAPES_TOURNEE_MAX) return { erreur: `${bons.length} étapes : ${ETAPES_TOURNEE_MAX} au plus (limite opérationnelle — au-delà, découper la tournée par territoire).` };
  const boucle = options.boucle !== false;
  const limites: string[] = [
    "Distances à VOL D'OISEAU : ce serveur n'a pas de service de routes, donc ni les kilomètres réels ni les temps de trajet. L'ORDRE reste presque toujours le bon ; les distances sont à majorer d'environ 30 %.",
    "L'optimum exact du voyageur de commerce est hors de portée du calcul : cette tournée est BONNE, pas prouvée optimale.",
  ];
  const depart = options.depart ? bons.find((l) => l.id === options.depart || l.libelle === options.depart) ?? bons[0]! : bons[0]!;
  const distanceNaiveKm = longueur(bons, boucle);

  // Plus proche voisin.
  const restants = bons.filter((l) => l !== depart);
  const ordre: Lieu[] = [depart];
  while (restants.length) {
    const dernier = ordre[ordre.length - 1]!;
    let meilleur = 0, best = Infinity;
    for (let i = 0; i < restants.length; i += 1) {
      const d = distanceKm(dernier, restants[i]!);
      if (d < best) { best = d; meilleur = i; }
    }
    ordre.push(restants.splice(meilleur, 1)[0]!);
  }

  // 2-opt : on inverse un segment tant que ça raccourcit. Le départ reste en tête.
  let ameliorations = 0;
  let encore = true;
  const gardes = Math.min(4000, bons.length * bons.length);
  let tours = 0;
  while (encore && tours < gardes) {
    encore = false; tours += 1;
    for (let i = 1; i < ordre.length - 1; i += 1) {
      for (let j = i + 1; j < ordre.length; j += 1) {
        const a = ordre[i - 1]!, b = ordre[i]!, c = ordre[j]!;
        const d = j + 1 < ordre.length ? ordre[j + 1]! : (boucle ? ordre[0]! : null);
        if (!d) continue;
        const avant = distanceKm(a, b) + distanceKm(c, d);
        const apres = distanceKm(a, c) + distanceKm(b, d);
        if (apres < avant - 1e-9) {
          const segment = ordre.slice(i, j + 1).reverse();
          ordre.splice(i, j - i + 1, ...segment);
          ameliorations += 1;
          encore = true;
        }
      }
    }
  }
  const totale = longueur(ordre, boucle);
  return {
    ordre, distanceKm: totale, distanceNaiveKm,
    gainPourcent: distanceNaiveKm > 0 ? ((distanceNaiveKm - totale) / distanceNaiveKm) * 100 : 0,
    boucle, ameliorations, limites,
  };
}

export interface Territoire {
  numero: number;
  centre: { lat: number; lon: number };
  libelle: string;
  lieux: Lieu[];
  charge: number;
  distanceMoyenneKm: number;
  distanceMaxKm: number;
  rayonKm: number;
}

/**
 * DÉCOUPER EN TERRITOIRES — k-moyennes sur la sphère, puis rééquilibrage par la CHARGE (le poids
 * des lieux, pas leur nombre). Un territoire de trois wilayas denses et un de douze wilayas vides
 * peuvent être équilibrés : c'est le travail qu'on répartit, pas la surface.
 */
export function territoires(
  lieux: readonly Lieu[],
  nombre: number,
  options: { equilibrer?: boolean; graine?: number } = {},
): { territoires: Territoire[]; equilibre: number; limites: string[] } | { erreur: string } {
  const bons = lieux.filter(coordonneesValides);
  const k = Math.max(1, Math.min(Math.trunc(nombre), TERRITOIRES_MAX, bons.length));
  if (bons.length < 2) return { erreur: "Au moins deux lieux localisés sont nécessaires." };
  if (!Number.isFinite(nombre) || nombre < 1) return { erreur: "Le nombre de territoires doit être un entier ≥ 1." };

  // Départ : les k lieux les plus éloignés les uns des autres (k-means++ déterministe par la distance).
  const centres: { lat: number; lon: number }[] = [{ lat: bons[0]!.lat, lon: bons[0]!.lon }];
  while (centres.length < k) {
    let loin = bons[0]!, best = -1;
    for (const l of bons) {
      const d = Math.min(...centres.map((c) => distanceKm(c, l)));
      if (d > best) { best = d; loin = l; }
    }
    centres.push({ lat: loin.lat, lon: loin.lon });
  }
  let affectation = new Array<number>(bons.length).fill(0);
  for (let iter = 0; iter < 60; iter += 1) {
    let bouge = false;
    for (let i = 0; i < bons.length; i += 1) {
      let meilleur = 0, best = Infinity;
      for (let c = 0; c < k; c += 1) { const d = distanceKm(centres[c]!, bons[i]!); if (d < best) { best = d; meilleur = c; } }
      if (affectation[i] !== meilleur) { affectation[i] = meilleur; bouge = true; }
    }
    for (let c = 0; c < k; c += 1) {
      const membres = bons.filter((_, i) => affectation[i] === c);
      const b = barycentre(membres);
      if (b) centres[c] = b;
    }
    if (!bouge && iter > 0) break;
  }

  // RÉÉQUILIBRAGE par la charge : on déplace les lieux du territoire le plus chargé vers le
  // territoire voisin le moins chargé, tant que ça réduit l'écart sans exploser les distances.
  const charge = (c: number) => bons.filter((_, i) => affectation[i] === c).reduce((s, l) => s + (l.poids ?? 1), 0);
  if (options.equilibrer !== false && k > 1) {
    for (let tour = 0; tour < 200; tour += 1) {
      const charges = Array.from({ length: k }, (_, c) => charge(c));
      const plein = charges.indexOf(Math.max(...charges));
      const vide = charges.indexOf(Math.min(...charges));
      if (plein === vide || charges[plein]! - charges[vide]! < 1e-9) break;
      // Le lieu du territoire plein le plus proche du centre du territoire vide.
      let candidat = -1, best = Infinity;
      for (let i = 0; i < bons.length; i += 1) {
        if (affectation[i] !== plein) continue;
        const gain = distanceKm(centres[vide]!, bons[i]!) - distanceKm(centres[plein]!, bons[i]!);
        if (gain < best) { best = gain; candidat = i; }
      }
      if (candidat < 0) break;
      const avant = Math.max(...charges) - Math.min(...charges);
      affectation[candidat] = vide;
      const apres = Math.max(...Array.from({ length: k }, (_, c) => charge(c))) - Math.min(...Array.from({ length: k }, (_, c) => charge(c)));
      if (apres >= avant) { affectation[candidat] = plein; break; }
    }
  }

  const out: Territoire[] = [];
  for (let c = 0; c < k; c += 1) {
    const membres = bons.filter((_, i) => affectation[i] === c);
    if (!membres.length) continue;
    const centre = barycentre(membres) ?? centres[c]!;
    const distances = membres.map((l) => distanceKm(centre, l));
    // Le nom du territoire : son lieu le plus lourd.
    const tete = [...membres].sort((a, b) => (b.poids ?? 1) - (a.poids ?? 1))[0]!;
    out.push({
      numero: 0, centre, libelle: `autour de ${tete.libelle}`, lieux: membres,
      charge: membres.reduce((s, l) => s + (l.poids ?? 1), 0),
      distanceMoyenneKm: distances.reduce((s, d) => s + d, 0) / distances.length,
      distanceMaxKm: Math.max(...distances), rayonKm: Math.max(...distances),
    });
  }
  out.sort((a, b) => b.charge - a.charge);
  out.forEach((t, i) => { t.numero = i + 1; });
  const charges = out.map((t) => t.charge);
  const equilibre = charges.length > 1 && Math.max(...charges) > 0 ? Math.min(...charges) / Math.max(...charges) : 1;
  return {
    territoires: out, equilibre,
    limites: [
      "Découpage par PROXIMITÉ et charge, sans frontières administratives ni routes : à confronter aux wilayas réelles avant d'en faire un secteur commercial.",
      equilibre < 0.6 ? `Équilibre ${(equilibre * 100).toFixed(0)} % entre le territoire le plus léger et le plus lourd : la géographie ne permet pas mieux sans couper une zone dense.` : `Équilibre des charges ${(equilibre * 100).toFixed(0)} %.`,
    ],
  };
}

export interface Implantation {
  point: { lat: number; lon: number };
  distanceTotaleKm: number;
  distanceMoyenneKm: number;
  distanceMaxKm: number;
  /** Le lieu existant le plus proche du point optimal — un dépôt se pose dans une ville, pas dans un champ. */
  villeLaPlusProche: { lieu: Lieu; distanceKm: number } | null;
  iterations: number;
  limites: string[];
}

/**
 * OÙ POSER LE DÉPÔT — le point de Weber par l'algorithme de Weiszfeld : il minimise la somme des
 * distances PONDÉRÉES, pas la distance au barycentre (qui minimise les carrés et se laisse tirer
 * par les extrêmes). La différence est réelle : le barycentre suit les lointains, Weber suit la masse.
 */
export function implantationOptimale(lieux: readonly Lieu[], iterationsMax = 200): Implantation | { erreur: string } {
  const bons = lieux.filter(coordonneesValides);
  if (bons.length < 2) return { erreur: "Au moins deux lieux localisés sont nécessaires." };
  let p = barycentre(bons)!;
  let iterations = 0;
  for (; iterations < iterationsMax; iterations += 1) {
    let numLat = 0, numLon = 0, den = 0;
    let surUnPoint = false;
    for (const l of bons) {
      const d = distanceKm(p, l);
      if (d < 1e-9) { surUnPoint = true; break; }
      const w = (l.poids && l.poids > 0 ? l.poids : 1) / d;
      numLat += l.lat * w; numLon += l.lon * w; den += w;
    }
    if (surUnPoint || den === 0) break;
    const suivant = { lat: numLat / den, lon: numLon / den };
    const bouge = distanceKm(p, suivant);
    p = suivant;
    if (bouge < 1e-4) break;
  }
  const distances = bons.map((l) => ({ l, d: distanceKm(p, l) }));
  const totale = distances.reduce((s, x) => s + x.d * (x.l.poids && x.l.poids > 0 ? x.l.poids : 1), 0);
  const proche = distances.slice().sort((a, b) => a.d - b.d)[0]!;
  return {
    point: p,
    distanceTotaleKm: totale,
    distanceMoyenneKm: distances.reduce((s, x) => s + x.d, 0) / distances.length,
    distanceMaxKm: Math.max(...distances.map((x) => x.d)),
    villeLaPlusProche: { lieu: proche.l, distanceKm: proche.d },
    iterations,
    limites: [
      "Point théorique : il minimise la distance pondérée à vol d'oiseau, sans tenir compte des routes, du foncier, de la main-d'œuvre ni de la réglementation.",
      "Pour choisir entre des sites RÉELS (et non un point sur la carte), donner les candidats : le problème devient un choix sous contraintes, que le solveur d'optimisation tranche exactement.",
    ],
  };
}

/**
 * CHOISIR PARMI DES SITES RÉELS (p-médian, énumération exacte jusqu'à un nombre raisonnable de
 * combinaisons) : quels `p` candidats minimisent la distance pondérée totale des clients ?
 * C'est la question qu'on pose vraiment quand un terrain doit déjà exister.
 */
export function choisirSites(
  clients: readonly Lieu[], candidats: readonly Lieu[], p: number,
): { sites: Lieu[]; distanceTotaleKm: number; affectation: { client: Lieu; site: Lieu; distanceKm: number }[]; combinaisonsTestees: number; limites: string[] } | { erreur: string } {
  const cl = clients.filter(coordonneesValides), ca = candidats.filter(coordonneesValides);
  if (!cl.length) return { erreur: "Aucun client localisé." };
  if (!ca.length) return { erreur: "Aucun site candidat localisé." };
  const k = Math.max(1, Math.min(Math.trunc(p), ca.length));
  const combinaisons = (n: number, r: number): number => { let x = 1; for (let i = 0; i < r; i += 1) x = (x * (n - i)) / (i + 1); return Math.round(x); };
  const total = combinaisons(ca.length, k);
  if (total > 200_000) return { erreur: `${total.toLocaleString("fr-FR")} combinaisons de ${k} sites parmi ${ca.length} : trop pour une énumération exacte. Réduire la liste de candidats, ou poser le problème au solveur d'optimisation en nombres entiers.` };

  const cout = (choix: number[]): number => {
    let s = 0;
    for (const c of cl) {
      let best = Infinity;
      for (const i of choix) best = Math.min(best, distanceKm(c, ca[i]!));
      s += best * (c.poids && c.poids > 0 ? c.poids : 1);
    }
    return s;
  };
  let meilleur: number[] = [], best = Infinity, testees = 0;
  const choisir = (debut: number, courant: number[]): void => {
    if (courant.length === k) { testees += 1; const s = cout(courant); if (s < best) { best = s; meilleur = [...courant]; } return; }
    for (let i = debut; i < ca.length; i += 1) { courant.push(i); choisir(i + 1, courant); courant.pop(); }
  };
  choisir(0, []);
  const sites = meilleur.map((i) => ca[i]!);
  const affectation = cl.map((c) => {
    const proche = sites.map((s) => ({ s, d: distanceKm(c, s) })).sort((a, b) => a.d - b.d)[0]!;
    return { client: c, site: proche.s, distanceKm: proche.d };
  });
  return {
    sites, distanceTotaleKm: best, affectation, combinaisonsTestees: testees,
    limites: [
      "Choix EXACT parmi les candidats fournis, sur la distance pondérée à vol d'oiseau : ni coût du site, ni capacité, ni temps de trajet.",
      "Avec un budget, des capacités ou des coûts d'ouverture différents, c'est un programme en nombres entiers : le passer au solveur d'optimisation.",
    ],
  };
}
