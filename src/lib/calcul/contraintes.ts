/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA SATISFACTION DE CONTRAINTES (mandat 5 §39) — pur.
 *
 * Là où la programmation linéaire manipule des quantités, ici on affecte des CHOIX : qui prend
 * quelle garde, quel dossier va à quelle personne, quel créneau pour quelle réunion. Les règles
 * sont logiques — « pas deux nuits de suite », « Sarah et Yassine jamais ensemble », « au plus
 * trois par jour » — et ne se traduisent pas naturellement en coefficients.
 *
 * Moteur : cohérence d'arc (AC-3) pour réduire les domaines AVANT de chercher, puis retour arrière
 * avec la variable la plus contrainte d'abord (MRV) et la valeur la moins gênante d'abord (LCV).
 * Quand il n'y a pas de solution, le code ne dit pas « impossible » : il retire les contraintes une
 * à une pour NOMMER celles dont dépend l'impossibilité, et il rend l'affectation partielle la plus
 * complète qu'il ait atteinte.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { type Rigueur, rigueurVide } from "./rigueur";

export type Valeur = string | number;

export interface VariableCsp {
  nom: string;
  domaine: Valeur[];
  /** Préférences : les valeurs essayées en premier (n'exclut rien). */
  preferees?: Valeur[];
}

export type ContrainteCsp =
  | { type: "toutesDifferentes"; variables: string[]; nom?: string }
  | { type: "egales"; variables: string[]; nom?: string }
  | { type: "differentes"; a: string; b: string; nom?: string }
  | { type: "interdit"; variable: string; valeurs: Valeur[]; nom?: string }
  | { type: "impose"; variable: string; valeurs: Valeur[]; nom?: string }
  | { type: "auPlus"; valeur: Valeur; n: number; variables?: string[]; nom?: string }
  | { type: "auMoins"; valeur: Valeur; n: number; variables?: string[]; nom?: string }
  | { type: "pairesInterdites"; a: string; b: string; paires: [Valeur, Valeur][]; nom?: string }
  | { type: "siAlors"; si: { variable: string; vaut: Valeur }; alors: { variable: string; vaut?: Valeur; pasVaut?: Valeur }; nom?: string };

export interface ProblemeCsp {
  variables: VariableCsp[];
  contraintes: ContrainteCsp[];
}

export interface SolutionCsp {
  ok: true;
  affectation: Record<string, Valeur>;
  noeuds: number;
  /** Les domaines après cohérence d'arc — ce que les règles imposaient AVANT toute recherche. */
  domainesReduits: Record<string, Valeur[]>;
  /** Les variables dont la valeur était FORCÉE (domaine réduit à une seule possibilité). */
  forcees: string[];
  rigueur: Rigueur;
  ms: number;
}

export interface EchecCsp {
  ok: false;
  statut: "IMPOSSIBLE" | "LIMITE" | "INVALIDE";
  erreur: string;
  /** Les contraintes dont le retrait rend le problème soluble : la cause de l'impossibilité. */
  contraintesEnCause: string[];
  /** L'affectation partielle la plus complète atteinte. */
  meilleurePartielle: Record<string, Valeur>;
  variablesBloquees: string[];
  noeuds: number;
  rigueur: Rigueur;
  ms: number;
}
export type ResultatCsp = SolutionCsp | EchecCsp;

export const VARIABLES_CSP_MAX = 300;
export const NOEUDS_CSP_MAX = 300_000;

const nomDe = (c: ContrainteCsp, i: number): string => {
  if (c.nom) return c.nom;
  switch (c.type) {
    case "toutesDifferentes": return `toutes différentes (${c.variables.join(", ")})`;
    case "egales": return `égales (${c.variables.join(", ")})`;
    case "differentes": return `${c.a} ≠ ${c.b}`;
    case "interdit": return `${c.variable} ∉ {${c.valeurs.join(", ")}}`;
    case "impose": return `${c.variable} ∈ {${c.valeurs.join(", ")}}`;
    case "auPlus": return `au plus ${c.n} × « ${c.valeur} »`;
    case "auMoins": return `au moins ${c.n} × « ${c.valeur} »`;
    case "pairesInterdites": return `paires interdites ${c.a}/${c.b}`;
    case "siAlors": return `si ${c.si.variable} = ${c.si.vaut} alors ${c.alors.variable} ${c.alors.vaut !== undefined ? `= ${c.alors.vaut}` : `≠ ${c.alors.pasVaut}`}`;
    default: return `contrainte ${i + 1}`;
  }
};

function valider(p: ProblemeCsp): string[] {
  const e: string[] = [];
  const vars = p.variables ?? [];
  if (!vars.length) e.push("Aucune variable à affecter.");
  if (vars.length > VARIABLES_CSP_MAX) e.push(`${vars.length} variables : ${VARIABLES_CSP_MAX} au plus.`);
  const noms = new Set<string>();
  for (const v of vars) {
    if (!v?.nom) { e.push("Variable sans nom."); continue; }
    if (noms.has(v.nom)) e.push(`Variable « ${v.nom} » déclarée deux fois.`);
    noms.add(v.nom);
    if (!Array.isArray(v.domaine) || !v.domaine.length) e.push(`Variable « ${v.nom} » : domaine vide — aucune valeur possible dès le départ.`);
  }
  const connue = (n: string, ou: string) => { if (!noms.has(n)) e.push(`${ou} : variable « ${n} » inconnue.`); };
  for (const [i, c] of (p.contraintes ?? []).entries()) {
    const ou = nomDe(c, i);
    if (c.type === "toutesDifferentes" || c.type === "egales") { for (const v of c.variables) connue(v, ou); if (c.variables.length < 2) e.push(`${ou} : au moins deux variables.`); }
    else if (c.type === "differentes" || c.type === "pairesInterdites") { connue(c.a, ou); connue(c.b, ou); }
    else if (c.type === "interdit" || c.type === "impose") { connue(c.variable, ou); if (!c.valeurs?.length) e.push(`${ou} : aucune valeur donnée.`); }
    else if (c.type === "auPlus" || c.type === "auMoins") { for (const v of c.variables ?? []) connue(v, ou); if (!Number.isInteger(c.n) || c.n < 0) e.push(`${ou} : n doit être un entier ≥ 0.`); }
    else if (c.type === "siAlors") { connue(c.si.variable, ou); connue(c.alors.variable, ou); if (c.alors.vaut === undefined && c.alors.pasVaut === undefined) e.push(`${ou} : dire « vaut » ou « pasVaut ».`); }
  }
  return e;
}

/** Une contrainte est-elle violée par une affectation (même partielle) ? Une variable non affectée ne viole rien. */
function violee(c: ContrainteCsp, a: Record<string, Valeur>, toutes: string[]): boolean {
  switch (c.type) {
    case "toutesDifferentes": {
      const vues = new Set<Valeur>();
      for (const v of c.variables) { const x = a[v]; if (x === undefined) continue; if (vues.has(x)) return true; vues.add(x); }
      return false;
    }
    case "egales": {
      let ref: Valeur | undefined;
      for (const v of c.variables) { const x = a[v]; if (x === undefined) continue; if (ref === undefined) ref = x; else if (x !== ref) return true; }
      return false;
    }
    case "differentes": return a[c.a] !== undefined && a[c.b] !== undefined && a[c.a] === a[c.b];
    case "interdit": return a[c.variable] !== undefined && c.valeurs.includes(a[c.variable]!);
    case "impose": return a[c.variable] !== undefined && !c.valeurs.includes(a[c.variable]!);
    case "auPlus": {
      const portee = c.variables?.length ? c.variables : toutes;
      let n = 0;
      for (const v of portee) if (a[v] === c.valeur) n += 1;
      return n > c.n;
    }
    case "auMoins": {
      const portee = c.variables?.length ? c.variables : toutes;
      let n = 0, libres = 0;
      for (const v of portee) { if (a[v] === c.valeur) n += 1; else if (a[v] === undefined) libres += 1; }
      return n + libres < c.n; // même en affectant tout le reste, on n'y arrive plus
    }
    case "pairesInterdites": {
      const x = a[c.a], y = a[c.b];
      return x !== undefined && y !== undefined && c.paires.some(([u, v]) => u === x && v === y);
    }
    case "siAlors": {
      if (a[c.si.variable] !== c.si.vaut) return false;
      const y = a[c.alors.variable];
      if (y === undefined) return false;
      if (c.alors.vaut !== undefined) return y !== c.alors.vaut;
      return y === c.alors.pasVaut;
    }
  }
}

/** Les variables qu'une règle met en relation — la base de la propagation par paires. */
function variablesLiees(c: ContrainteCsp): string[] {
  switch (c.type) {
    case "toutesDifferentes":
    case "egales": return c.variables;
    case "differentes":
    case "pairesInterdites": return [c.a, c.b];
    case "siAlors": return [c.si.variable, c.alors.variable];
    case "interdit":
    case "impose": return [c.variable];
    case "auPlus":
    case "auMoins": return c.variables ?? [];
  }
}

/** Cohérence d'arc simplifiée : retire d'un domaine toute valeur qui ne peut faire partie d'aucune solution locale. */
function reduireDomaines(domaines: Map<string, Valeur[]>, contraintes: ContrainteCsp[], toutes: string[]): boolean {
  let change = true;
  let tours = 0;
  while (change && tours < 100) {
    change = false; tours += 1;
    for (const nom of toutes) {
      const d = domaines.get(nom)!;
      const garde = d.filter((val) => {
        const essai: Record<string, Valeur> = { [nom]: val };
        // Unaire : la valeur seule viole-t-elle une contrainte ?
        for (const c of contraintes) {
          if (c.type === "interdit" && c.variable === nom && c.valeurs.includes(val)) return false;
          if (c.type === "impose" && c.variable === nom && !c.valeurs.includes(val)) return false;
          if (violee(c, essai, toutes)) return false;
        }
        // Binaire : pour CHAQUE variable liée par une règle, existe-t-il au moins une valeur compatible ?
        // « toutes différentes » compte : c'est la règle la plus fréquente, l'oublier laisserait
        // des domaines que la seule lecture des règles suffisait à réduire.
        for (const c of contraintes) {
          for (const voisin of variablesLiees(c)) {
            if (voisin === nom) continue;
            if (!variablesLiees(c).includes(nom)) continue;
            const dv = domaines.get(voisin);
            if (!dv) continue;
            if (!dv.some((autre) => !violee(c, { [nom]: val, [voisin]: autre }, toutes))) return false;
          }
        }
        return true;
      });
      if (garde.length !== d.length) { domaines.set(nom, garde); change = true; }
      if (!garde.length) return false;
    }
  }
  return true;
}

interface Recherche { noeuds: number; meilleure: Record<string, Valeur>; limite: number }

function chercher(
  domaines: Map<string, Valeur[]>,
  contraintes: ContrainteCsp[],
  toutes: string[],
  preferees: Map<string, Valeur[]>,
  a: Record<string, Valeur>,
  etat: Recherche,
): Record<string, Valeur> | null {
  if (Object.keys(a).length > Object.keys(etat.meilleure).length) etat.meilleure = { ...a };
  const libres = toutes.filter((v) => a[v] === undefined);
  if (!libres.length) {
    // Une solution complète doit satisfaire AUSSI les contraintes globales (auMoins).
    return contraintes.every((c) => !violee(c, a, toutes)) ? { ...a } : null;
  }
  if (etat.noeuds >= etat.limite) return null;
  // MRV : la variable au domaine le plus petit d'abord.
  let choisie = libres[0]!, meilleureTaille = Infinity;
  for (const v of libres) {
    const d = domaines.get(v)!.filter((val) => !contraintes.some((c) => violee(c, { ...a, [v]: val }, toutes)));
    if (d.length < meilleureTaille) { meilleureTaille = d.length; choisie = v; }
    if (d.length <= 1) break;
  }
  const pref = preferees.get(choisie) ?? [];
  const candidats = domaines.get(choisie)!
    .filter((val) => !contraintes.some((c) => violee(c, { ...a, [choisie]: val }, toutes)))
    .sort((x, y) => (pref.indexOf(x) === -1 ? 1e9 : pref.indexOf(x)) - (pref.indexOf(y) === -1 ? 1e9 : pref.indexOf(y)));
  for (const val of candidats) {
    etat.noeuds += 1;
    if (etat.noeuds >= etat.limite) return null;
    a[choisie] = val;
    const r = chercher(domaines, contraintes, toutes, preferees, a, etat);
    if (r) return r;
    delete a[choisie];
  }
  return null;
}

export function resoudreContraintes(p: ProblemeCsp, options: { noeudsMax?: number } = {}): ResultatCsp {
  const t0 = Date.now();
  const rigueur = rigueurVide();
  const erreurs = valider(p);
  if (erreurs.length) return { ok: false, statut: "INVALIDE", erreur: erreurs[0]!, contraintesEnCause: [], meilleurePartielle: {}, variablesBloquees: [], noeuds: 0, rigueur, ms: Date.now() - t0 };
  const toutes = p.variables.map((v) => v.nom);
  const contraintes = p.contraintes ?? [];
  const limite = Math.max(1_000, Math.min(NOEUDS_CSP_MAX, options.noeudsMax ?? 100_000));

  const domaines = new Map<string, Valeur[]>(p.variables.map((v) => [v.nom, [...new Set(v.domaine)]]));
  const preferees = new Map<string, Valeur[]>(p.variables.map((v) => [v.nom, v.preferees ?? []]));
  const coherent = reduireDomaines(domaines, contraintes, toutes);
  const domainesReduits = Object.fromEntries([...domaines.entries()].map(([k, v]) => [k, [...v]]));
  const forcees = [...domaines.entries()].filter(([, d]) => d.length === 1).map(([k]) => k);

  const etat: Recherche = { noeuds: 0, meilleure: {}, limite };
  const solution = coherent ? chercher(domaines, contraintes, toutes, preferees, {}, etat) : null;

  rigueur.hypotheses.push(`${toutes.length} variable(s), ${contraintes.length} règle(s) ; recherche par retour arrière avec cohérence d'arc préalable.`);
  if (forcees.length) rigueur.hypotheses.push(`Valeur FORCÉE par les seules règles, avant toute recherche : ${forcees.map((f) => `${f} = ${domaines.get(f)![0]}`).join(", ")}.`);

  if (solution) {
    rigueur.limites.push("Une solution VALIDE, pas la meilleure : les préférences sont respectées quand elles le peuvent, elles ne sont pas optimisées. Un objectif chiffré relève de l'optimisation.");
    const multiples = [...domaines.values()].reduce((s, d) => s * Math.max(1, d.length), 1);
    if (multiples > toutes.length * 2) rigueur.limites.push("D'autres affectations valides existent probablement : celle-ci n'est pas unique.");
    return { ok: true, affectation: solution, noeuds: etat.noeuds, domainesReduits, forcees, rigueur, ms: Date.now() - t0 };
  }

  if (etat.noeuds >= limite) {
    return {
      ok: false, statut: "LIMITE",
      erreur: `Recherche arrêtée après ${etat.noeuds} essais sans solution ni preuve d'impossibilité (limite opérationnelle). Réduire les domaines ou fixer quelques variables à la main.`,
      contraintesEnCause: [], meilleurePartielle: etat.meilleure, variablesBloquees: toutes.filter((v) => etat.meilleure[v] === undefined), noeuds: etat.noeuds, rigueur, ms: Date.now() - t0,
    };
  }

  // POURQUOI c'est impossible : retirer chaque contrainte et voir laquelle débloque.
  const enCause: string[] = [];
  if (contraintes.length <= 40) {
    for (const [i, c] of contraintes.entries()) {
      const sans = contraintes.filter((_, j) => j !== i);
      const d2 = new Map<string, Valeur[]>(p.variables.map((v) => [v.nom, [...new Set(v.domaine)]]));
      if (!reduireDomaines(d2, sans, toutes)) continue;
      const e2: Recherche = { noeuds: 0, meilleure: {}, limite: Math.min(20_000, limite) };
      if (chercher(d2, sans, toutes, preferees, {}, e2)) enCause.push(nomDe(c, i));
    }
  }
  const vides = [...domaines.entries()].filter(([, d]) => !d.length).map(([k]) => k);
  rigueur.limites.push("L'impossibilité est DÉMONTRÉE (tout l'espace a été parcouru), elle n'est pas un abandon.");
  return {
    ok: false, statut: "IMPOSSIBLE",
    erreur: enCause.length
      ? `Aucune affectation ne satisfait toutes les règles. Retirer l'une de celles-ci suffirait : ${enCause.join(" ; ")}.`
      : `Aucune affectation ne satisfait toutes les règles${vides.length ? ` — ${vides.join(", ")} n'a plus aucune valeur possible` : ""}. Plusieurs règles se contredisent ensemble : en relâcher une seule ne suffit pas.`,
    contraintesEnCause: enCause, meilleurePartielle: etat.meilleure,
    variablesBloquees: vides.length ? vides : toutes.filter((v) => etat.meilleure[v] === undefined),
    noeuds: etat.noeuds, rigueur, ms: Date.now() - t0,
  };
}
