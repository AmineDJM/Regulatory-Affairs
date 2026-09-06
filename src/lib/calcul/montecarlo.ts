/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA SIMULATION DE MONTE-CARLO (mandat 5 §39) — pur.
 *
 * Un modèle = des ENTRÉES incertaines (chacune une loi), des CONSTANTES, des FORMULES (compilées,
 * jamais évaluées par `eval`), des CORRÉLATIONS entre entrées (copule gaussienne : la dépendance
 * est de rang, chaque marginale est respectée) et des SEUILS dont on veut la probabilité.
 * Le résultat porte la distribution de chaque sortie (moyenne, écart-type, P1…P99, histogramme),
 * la probabilité de chaque seuil, la SENSIBILITÉ (quelle entrée fait bouger la sortie : Spearman,
 * contribution à la variance, écart bas/haut décile — le tornado), la CONVERGENCE (erreur type de
 * la moyenne, encadrement du P90 par les statistiques d'ordre) et le piège des moyennes : la formule
 * aux valeurs moyennes n'est pas la moyenne de la formule, et l'écart est DIT.
 * Même graine → mêmes tirages. Une limite : le nombre de tirages (opérationnelle, elle porte sa raison).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { type Loi, LOIS, cholesky, esperance, generateur, normaleStandard, phi, quantile, validerLoi } from "./alea";
import { type Compilee, compilerSysteme } from "./expression";
import { type Rigueur, arrondiLisible, ecartType, matriceDepuisPaires, moyenne, percentileTrie, rigueurVide, spearman } from "./rigueur";

export const TIRAGES_DEFAUT = 20_000;
/** Opérationnel : 200 000 tirages × 10 formules ≈ 1 s sur le serveur ; au-delà, l'erreur type ne bouge plus au 3e chiffre significatif. */
export const TIRAGES_MAX = 200_000;
export const TIRAGES_MIN = 1_000;
export const PERCENTILES_DEFAUT: readonly number[] = [1, 5, 10, 25, 50, 75, 90, 95, 99];
export const CLASSES_HISTOGRAMME = 30;
export const ENTREES_MAX = 60;
export const FORMULES_MAX = 40;

export interface Seuil { sortie?: string; sens: "inferieur" | "superieur"; valeur: number; libelle?: string }
export interface Correlation { a: string; b: string; rho: number }

export interface ModeleMonteCarlo {
  entrees: Record<string, Loi>;
  constantes?: Record<string, number>;
  /** Les formules, par nom ; l'une peut utiliser le résultat d'une autre (l'ordre est déduit). */
  formules: Record<string, string>;
  /** La sortie principale (sensibilité, seuils par défaut) ; la dernière formule sinon. */
  sortie?: string;
  correlations?: Correlation[];
  seuils?: Seuil[];
}

export interface OptionsSimulation { tirages?: number; graine?: number | string; percentiles?: readonly number[]; classes?: number }

export interface Distribution {
  nom: string;
  moyenne: number;
  ecartType: number;
  min: number;
  max: number;
  mediane: number;
  /** "P5" → valeur. */
  percentiles: Record<string, number>;
  histogramme: { de: number; a: number; n: number }[];
  /** La formule aux ESPÉRANCES des entrées — à comparer à la moyenne simulée. */
  valeurDeterministe: number | null;
  /** Coefficient de variation σ/|μ| en %, `null` si μ ≈ 0. */
  cvPourcent: number | null;
  /** Probabilité que la sortie soit négative (utile pour une marge, un résultat). */
  pNegatif: number;
}

export interface Sensibilite {
  entree: string;
  spearman: number;
  contributionVariancePourcent: number;
  /** Moyenne de la sortie quand l'entrée est dans son décile bas / haut — les bornes du tornado. */
  sortieBasDecile: number;
  sortieHautDecile: number;
  amplitude: number;
}

export interface Probabilite { sortie: string; sens: "inferieur" | "superieur"; valeur: number; libelle: string; p: number; n: number }

export interface ResultatSimulation {
  ok: true;
  tirages: number;
  tiragesInvalides: number;
  graine: number | string;
  sortie: string;
  sorties: Record<string, Distribution>;
  sensibilite: Sensibilite[];
  probabilites: Probabilite[];
  convergence: {
    erreurTypeMoyenne: number;
    intervalle95Moyenne: [number, number];
    intervalle95P90: [number, number];
    intervalle95P10: [number, number];
  };
  entrees: { nom: string; loi: Loi["loi"]; esperance: number | null; moyenneSimulee: number }[];
  rigueur: Rigueur;
  ms: number;
}
export type ResultatMonteCarlo = ResultatSimulation | { ok: false; erreur: string; details?: string[] };

function loiLisible(l: Loi): string {
  switch (l.loi) {
    case "normale": return `normale(μ=${l.moyenne}, σ=${l.ecartType})`;
    case "lognormale": return `log-normale(μ=${l.moyenne}, σ=${l.ecartType})`;
    case "uniforme": return `uniforme[${l.min}, ${l.max}]`;
    case "triangulaire": return `triangulaire(${l.min}, ${l.mode}, ${l.max})`;
    case "pert": return `PERT(${l.min}, ${l.mode}, ${l.max})`;
    case "discrete": return `discrète{${l.valeurs.map((v) => `${v.valeur}:${v.p}`).join(", ")}}`;
    case "bernoulli": return `Bernoulli(p=${l.p})`;
    case "poisson": return `Poisson(λ=${l.lambda})`;
    case "constante": return `constante ${l.valeur}`;
  }
}

function validerModele(m: ModeleMonteCarlo): string[] {
  const erreurs: string[] = [];
  const noms = Object.keys(m.entrees ?? {});
  if (!noms.length) erreurs.push("Aucune entrée incertaine : une simulation sans loi n'est qu'un calcul — utiliser une formule directe.");
  if (noms.length > ENTREES_MAX) erreurs.push(`${noms.length} entrées : ${ENTREES_MAX} au plus (limite opérationnelle de temps de calcul).`);
  for (const n of noms) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) erreurs.push(`Nom d'entrée invalide « ${n} » : lettres, chiffres et _ seulement, sans espace.`);
    const l = m.entrees[n]!;
    if (!l || typeof l !== "object" || !LOIS.includes(l.loi)) { erreurs.push(`Entrée « ${n} » : loi inconnue (connues : ${LOIS.join(", ")}).`); continue; }
    const e = validerLoi(l);
    if (e) erreurs.push(`Entrée « ${n} » : ${e}`);
  }
  const formules = Object.keys(m.formules ?? {});
  if (!formules.length) erreurs.push("Aucune formule : dire ce qu'on calcule à partir des entrées.");
  if (formules.length > FORMULES_MAX) erreurs.push(`${formules.length} formules : ${FORMULES_MAX} au plus.`);
  for (const f of formules) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(f)) erreurs.push(`Nom de formule invalide « ${f} ».`);
    if (noms.includes(f) || (m.constantes && f in m.constantes)) erreurs.push(`« ${f} » est à la fois une formule et une entrée/constante.`);
  }
  for (const [k, v] of Object.entries(m.constantes ?? {})) if (typeof v !== "number" || !Number.isFinite(v)) erreurs.push(`Constante « ${k} » : nombre attendu.`);
  for (const c of m.correlations ?? []) {
    if (!noms.includes(c.a) || !noms.includes(c.b)) erreurs.push(`Corrélation ${c.a}↔${c.b} : les deux doivent être des entrées incertaines.`);
    if (c.a === c.b) erreurs.push(`Corrélation ${c.a}↔${c.b} : une entrée avec elle-même.`);
    if (typeof c.rho !== "number" || !(c.rho > -1 && c.rho < 1)) erreurs.push(`Corrélation ${c.a}↔${c.b} : ρ doit être strictement entre -1 et 1 (${c.rho}).`);
  }
  if (m.sortie && !formules.includes(m.sortie)) erreurs.push(`Sortie principale « ${m.sortie} » : aucune formule de ce nom.`);
  for (const s of m.seuils ?? []) {
    if (s.sortie && !formules.includes(s.sortie)) erreurs.push(`Seuil sur « ${s.sortie} » : aucune formule de ce nom.`);
    if (s.sens !== "inferieur" && s.sens !== "superieur") erreurs.push(`Seuil ${s.valeur} : sens « inferieur » ou « superieur » attendu.`);
    if (typeof s.valeur !== "number" || !Number.isFinite(s.valeur)) erreurs.push("Seuil : valeur numérique attendue.");
  }
  return erreurs;
}

/** Rend une matrice de corrélation définie positive en la rapprochant de l'identité ; dit de combien. */
function matriceUtilisable(noms: readonly string[], paires: readonly Correlation[]): { L: number[][]; retrecie: number } {
  let facteur = 1;
  for (let k = 0; k < 40; k += 1) {
    const m = matriceDepuisPaires(noms, paires.map((p) => ({ ...p, rho: p.rho * facteur })));
    const L = cholesky(m);
    if (L) return { L, retrecie: 1 - facteur };
    facteur *= 0.95;
  }
  return { L: matriceDepuisPaires(noms, []), retrecie: 1 };
}

function distribution(nom: string, valeurs: Float64Array, n: number, percentiles: readonly number[], classes: number, deterministe: number | null): Distribution {
  const tries = Array.from(valeurs.subarray(0, n)).sort((a, b) => a - b);
  const mu = moyenne(tries);
  const sigma = n > 1 ? ecartType(tries) : 0;
  const min = tries[0]!, max = tries[n - 1]!;
  const pct: Record<string, number> = {};
  for (const p of percentiles) pct[`P${p}`] = percentileTrie(tries, p);
  const histogramme: { de: number; a: number; n: number }[] = [];
  if (max > min) {
    const largeur = (max - min) / classes;
    const comptes = new Array<number>(classes).fill(0);
    for (const x of tries) comptes[Math.min(classes - 1, Math.floor((x - min) / largeur))] += 1;
    for (let i = 0; i < classes; i += 1) histogramme.push({ de: min + i * largeur, a: min + (i + 1) * largeur, n: comptes[i]! });
  } else histogramme.push({ de: min, a: max, n });
  let negatifs = 0;
  for (const x of tries) { if (x < 0) negatifs += 1; else break; }
  return {
    nom, moyenne: mu, ecartType: sigma, min, max, mediane: percentileTrie(tries, 50), percentiles: pct, histogramme, valeurDeterministe: deterministe,
    cvPourcent: Math.abs(mu) > 1e-9 ? (sigma / Math.abs(mu)) * 100 : null, pNegatif: negatifs / n,
  };
}

/** L'encadrement à 95 % d'un quantile par les statistiques d'ordre (sans hypothèse sur la loi). */
function encadrementQuantile(tries: readonly number[], p: number): [number, number] {
  const n = tries.length;
  const k = n * p, demi = 1.96 * Math.sqrt(n * p * (1 - p));
  const lo = Math.max(0, Math.floor(k - demi)), hi = Math.min(n - 1, Math.ceil(k + demi));
  return [tries[lo]!, tries[hi]!];
}

export function simuler(modele: ModeleMonteCarlo, options: OptionsSimulation = {}): ResultatMonteCarlo {
  const t0 = Date.now();
  const erreurs = validerModele(modele);
  if (erreurs.length) return { ok: false, erreur: erreurs[0]!, details: erreurs };
  const rigueur = rigueurVide();
  const nomsEntrees = Object.keys(modele.entrees);
  const constantes = modele.constantes ?? {};
  const systeme = compilerSysteme(modele.formules, [...nomsEntrees, ...Object.keys(constantes)]);
  if (!systeme.ok) return { ok: false, erreur: systeme.erreur };
  const nomsFormules = systeme.ordre.map((o) => o.nom);
  const sortiePrincipale = modele.sortie ?? Object.keys(modele.formules)[Object.keys(modele.formules).length - 1]!;

  const demande = options.tirages ?? TIRAGES_DEFAUT;
  const N = Math.max(TIRAGES_MIN, Math.min(TIRAGES_MAX, Math.trunc(Number.isFinite(demande) ? demande : TIRAGES_DEFAUT)));
  if (demande > TIRAGES_MAX) rigueur.limites.push(`${demande} tirages demandés, ${TIRAGES_MAX} exécutés : plafond opérationnel (temps de calcul) ; au-delà l'erreur type ne change plus le 3e chiffre.`);
  if (demande < TIRAGES_MIN) rigueur.avertissements.push(`${demande} tirages demandés : ${TIRAGES_MIN} au minimum pour que les percentiles extrêmes aient un sens.`);
  const graine = options.graine ?? 42;
  const percentiles = (options.percentiles?.length ? options.percentiles : PERCENTILES_DEFAUT).filter((p) => p >= 0 && p <= 100);
  const classes = Math.max(5, Math.min(100, options.classes ?? CLASSES_HISTOGRAMME));

  // Les lois et la copule.
  const lois = nomsEntrees.map((n) => modele.entrees[n]!);
  const u = generateur(graine);
  const z = normaleStandard(u);
  const paires = modele.correlations ?? [];
  let L: number[][] | null = null;
  if (paires.length) {
    const { L: mat, retrecie } = matriceUtilisable(nomsEntrees, paires);
    L = mat;
    if (retrecie >= 1) rigueur.avertissements.push("Les corrélations déclarées sont incompatibles entre elles (matrice non définie positive) : elles ont été IGNORÉES.");
    else if (retrecie > 0) rigueur.avertissements.push(`Les corrélations déclarées étaient incompatibles entre elles ; elles ont été réduites de ${Math.round(retrecie * 100)} % pour former une matrice valide.`);
    rigueur.hypotheses.push(`Dépendances : ${paires.map((p) => `${p.a}↔${p.b} ρ=${p.rho}`).join(", ")} — appliquées par copule gaussienne (dépendance de rang ; chaque loi marginale est respectée).`);
  } else if (nomsEntrees.length > 1) rigueur.hypotheses.push("Les entrées sont supposées INDÉPENDANTES (aucune corrélation déclarée) : si deux d'entre elles bougent ensemble dans la réalité, le risque est sous-estimé.");
  for (const n of nomsEntrees) rigueur.hypotheses.push(`${n} ~ ${loiLisible(modele.entrees[n]!)}`);

  // Les tirages.
  const k = nomsEntrees.length;
  const colonnesEntrees = nomsEntrees.map(() => new Float64Array(N));
  const colonnesSorties = nomsFormules.map(() => new Float64Array(N));
  const vars: Record<string, number> = { ...constantes };
  const zs = new Float64Array(k);
  let valides = 0;
  const evaluateurs: [string, Compilee][] = systeme.ordre.map((o) => [o.nom, o.compilee]);
  for (let t = 0; t < N; t += 1) {
    if (L) {
      for (let i = 0; i < k; i += 1) zs[i] = z();
      for (let i = 0; i < k; i += 1) {
        let s = 0;
        const ligne = L[i]!;
        for (let j = 0; j <= i; j += 1) s += ligne[j]! * zs[j]!;
        vars[nomsEntrees[i]!] = quantile(lois[i]!, phi(s));
      }
    } else {
      for (let i = 0; i < k; i += 1) vars[nomsEntrees[i]!] = quantile(lois[i]!, u());
    }
    let fini = true;
    for (const [nom, c] of evaluateurs) {
      const v = c.evaluer(vars);
      vars[nom] = v;
      if (!Number.isFinite(v)) fini = false;
    }
    if (!fini) continue;
    for (let i = 0; i < k; i += 1) colonnesEntrees[i]![valides] = vars[nomsEntrees[i]!]!;
    for (let i = 0; i < nomsFormules.length; i += 1) colonnesSorties[i]![valides] = vars[nomsFormules[i]!]!;
    valides += 1;
  }
  const invalides = N - valides;
  if (valides < Math.max(100, N * 0.5)) return { ok: false, erreur: `${invalides} tirages sur ${N} rendent une valeur non finie (division par zéro, logarithme d'un négatif…) : le modèle est mal posé.` };
  if (invalides > 0) rigueur.avertissements.push(`${invalides} tirage(s) sur ${N} (${arrondiLisible((invalides / N) * 100)} %) rendaient une valeur non finie et ont été écartés : les résultats sont CONDITIONNELS aux tirages valides.`);

  // Le déterministe : la formule aux espérances.
  const esperances: Record<string, number> = { ...constantes };
  let toutesConnues = true;
  for (const n of nomsEntrees) { const e = esperance(modele.entrees[n]!); if (e === null) toutesConnues = false; else esperances[n] = e; }
  const deterministes: Record<string, number | null> = {};
  if (toutesConnues) for (const [nom, c] of evaluateurs) { const v = c.evaluer(esperances); esperances[nom] = v; deterministes[nom] = Number.isFinite(v) ? v : null; }

  const sorties: Record<string, Distribution> = {};
  for (let i = 0; i < nomsFormules.length; i += 1) sorties[nomsFormules[i]!] = distribution(nomsFormules[i]!, colonnesSorties[i]!, valides, percentiles, classes, deterministes[nomsFormules[i]!] ?? null);

  // Le piège des moyennes.
  const principale = sorties[sortiePrincipale]!;
  if (principale.valeurDeterministe !== null && principale.ecartType > 0) {
    const ecart = principale.moyenne - principale.valeurDeterministe;
    const erreurType = principale.ecartType / Math.sqrt(valides);
    if (Math.abs(ecart) > 3 * erreurType && Math.abs(ecart) > 0.01 * Math.max(Math.abs(principale.moyenne), 1e-9)) {
      rigueur.avertissements.push(`Piège des moyennes : « ${sortiePrincipale} » calculé avec les valeurs moyennes des entrées donne ${arrondiLisible(principale.valeurDeterministe)}, mais la MOYENNE simulée est ${arrondiLisible(principale.moyenne)} (écart ${arrondiLisible(ecart)}) — le modèle n'est pas linéaire, raisonner sur les moyennes se trompe.`);
    }
  }

  // Les seuils.
  const probabilites: Probabilite[] = [];
  for (const s of modele.seuils ?? []) {
    const nom = s.sortie ?? sortiePrincipale;
    const col = colonnesSorties[nomsFormules.indexOf(nom)]!;
    let n = 0;
    for (let i = 0; i < valides; i += 1) if (s.sens === "inferieur" ? col[i]! < s.valeur : col[i]! > s.valeur) n += 1;
    probabilites.push({ sortie: nom, sens: s.sens, valeur: s.valeur, libelle: s.libelle ?? `${nom} ${s.sens === "inferieur" ? "<" : ">"} ${s.valeur}`, p: n / valides, n });
  }

  // La sensibilité — sur un échantillon borné (les rangs coûtent n log n par entrée).
  const nEch = Math.min(valides, 20_000);
  const pas = valides / nEch;
  const idxPrincipale = nomsFormules.indexOf(sortiePrincipale);
  const yEch: number[] = [];
  for (let i = 0; i < nEch; i += 1) yEch.push(colonnesSorties[idxPrincipale]![Math.floor(i * pas)]!);
  const brute: { entree: string; rho: number; bas: number; haut: number }[] = [];
  for (let e = 0; e < k; e += 1) {
    if (lois[e]!.loi === "constante") continue;
    const xEch: number[] = [];
    for (let i = 0; i < nEch; i += 1) xEch.push(colonnesEntrees[e]![Math.floor(i * pas)]!);
    const rho = spearman(xEch, yEch);
    const tries = [...xEch].sort((a, b) => a - b);
    const q10 = percentileTrie(tries, 10), q90 = percentileTrie(tries, 90);
    let sBas = 0, nBas = 0, sHaut = 0, nHaut = 0;
    for (let i = 0; i < nEch; i += 1) {
      if (xEch[i]! <= q10) { sBas += yEch[i]!; nBas += 1; }
      else if (xEch[i]! >= q90) { sHaut += yEch[i]!; nHaut += 1; }
    }
    brute.push({ entree: nomsEntrees[e]!, rho: Number.isFinite(rho) ? rho : 0, bas: nBas ? sBas / nBas : principale.moyenne, haut: nHaut ? sHaut / nHaut : principale.moyenne });
  }
  const sommeRho2 = brute.reduce((s, b) => s + b.rho * b.rho, 0);
  const sensibilite: Sensibilite[] = brute
    .map((b) => ({ entree: b.entree, spearman: b.rho, contributionVariancePourcent: sommeRho2 > 0 ? (b.rho * b.rho / sommeRho2) * 100 : 0, sortieBasDecile: b.bas, sortieHautDecile: b.haut, amplitude: Math.abs(b.haut - b.bas) }))
    .sort((a, b) => b.amplitude - a.amplitude);
  if (paires.length && sensibilite.length) rigueur.limites.push("Avec des entrées corrélées, la contribution à la variance est indicative : une part de l'effet d'une entrée transite par celles qui lui sont liées.");

  // La convergence.
  const triesPrincipale = Array.from(colonnesSorties[idxPrincipale]!.subarray(0, valides)).sort((a, b) => a - b);
  const erreurTypeMoyenne = principale.ecartType / Math.sqrt(valides);
  const convergence = {
    erreurTypeMoyenne,
    intervalle95Moyenne: [principale.moyenne - 1.96 * erreurTypeMoyenne, principale.moyenne + 1.96 * erreurTypeMoyenne] as [number, number],
    intervalle95P90: encadrementQuantile(triesPrincipale, 0.9),
    intervalle95P10: encadrementQuantile(triesPrincipale, 0.1),
  };
  rigueur.limites.push(`${valides} tirages valides (graine ${graine}, rejouable) : la moyenne de « ${sortiePrincipale} » est connue à ±${arrondiLisible(1.96 * erreurTypeMoyenne)} près (95 %), son P90 entre ${arrondiLisible(convergence.intervalle95P90[0])} et ${arrondiLisible(convergence.intervalle95P90[1])}.`);
  if (Math.abs(principale.moyenne) > 1e-9 && (1.96 * erreurTypeMoyenne) / Math.abs(principale.moyenne) > 0.02) rigueur.avertissements.push("La moyenne n'est connue qu'à plus de 2 % près : augmenter le nombre de tirages avant de trancher sur un écart fin.");
  rigueur.limites.push("Le résultat ne vaut que ce que valent les lois déclarées : une plage trop étroite sur une entrée rend un risque trop rassurant.");

  const entrees = nomsEntrees.map((n, i) => ({ nom: n, loi: modele.entrees[n]!.loi, esperance: esperance(modele.entrees[n]!), moyenneSimulee: moyenne(Array.from(colonnesEntrees[i]!.subarray(0, Math.min(valides, 50_000)))) }));

  return { ok: true, tirages: valides, tiragesInvalides: invalides, graine, sortie: sortiePrincipale, sorties, sensibilite, probabilites, convergence, entrees, rigueur, ms: Date.now() - t0 };
}

/** Le texte court qu'Adam peut citer tel quel — chiffres arrondis, ordre : centre, dispersion, queues, seuils, leviers. */
export function resumerSimulation(r: ResultatSimulation): string[] {
  const s = r.sorties[r.sortie]!;
  const lignes = [
    `${r.sortie} : moyenne ${arrondiLisible(s.moyenne)}, médiane ${arrondiLisible(s.mediane)}, écart-type ${arrondiLisible(s.ecartType)} (${r.tirages} tirages).`,
    `Plage à 80 % : P10 ${arrondiLisible(s.percentiles.P10 ?? percentileTrie([s.min, s.max], 10))} → P90 ${arrondiLisible(s.percentiles.P90 ?? s.max)} ; extrêmes P5 ${arrondiLisible(s.percentiles.P5 ?? s.min)} / P95 ${arrondiLisible(s.percentiles.P95 ?? s.max)}.`,
  ];
  if (s.pNegatif > 0) lignes.push(`Probabilité que ${r.sortie} soit négatif : ${arrondiLisible(s.pNegatif * 100)} %.`);
  for (const p of r.probabilites) lignes.push(`P(${p.libelle}) = ${arrondiLisible(p.p * 100)} %.`);
  if (r.sensibilite.length) lignes.push(`Leviers : ${r.sensibilite.slice(0, 3).map((x) => `${x.entree} (${arrondiLisible(x.contributionVariancePourcent)} % de la variance, ρ=${arrondiLisible(x.spearman)})`).join(" ; ")}.`);
  return lignes;
}
