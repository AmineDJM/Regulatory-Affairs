/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES CHEMINS ET LES DÉPENDANCES (mandat 5 §40) — pur.
 *
 * « Comment sommes-nous liés à cette institution ? » se répond par un CHEMIN, pas par un score :
 * Sofradis → contrat 2024 → Karim Mouffok → ANPP. Un chemin se lit, se vérifie, et se cite.
 *
 * Ici : le plus court chemin (pondéré ou non), PLUSIEURS chemins distincts quand ils existent
 * (un lien unique et un lien multiple ne valent pas la même chose), la portée d'un nœud (ce qui
 * dépend de lui, ce dont il dépend), les cycles, et les POINTS DE RUPTURE — les nœuds et les
 * liens dont la disparition couperait le réseau en deux. « Qu'est-ce qui tombe si ce contrat
 * saute ? » est une question d'articulation, et le code y répond exactement.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { type Arete, type Graphe, nom, voisins } from "./modele";

export interface Etape { de: string; a: string; relation: string; sens: "sortant" | "entrant"; note?: string | null }
export interface Chemin { noeuds: string[]; etapes: Etape[]; longueur: number; cout: number; recit: string }

export const PROFONDEUR_MAX = 12;
export const CHEMINS_MAX = 20;

/** Le coût d'une arête : l'inverse de sa force. Un lien fort RAPPROCHE. */
const cout = (a: Arete): number => {
  const p = a.poids;
  if (p === undefined || !Number.isFinite(p) || p <= 0) return 1;
  return 1 / p;
};

function raconter(g: Graphe, etapes: readonly Etape[]): string {
  if (!etapes.length) return "";
  const morceaux = [nom(g, etapes[0]!.de)];
  for (const e of etapes) morceaux.push(`—[${e.relation}]→ ${nom(g, e.a)}`);
  return morceaux.join(" ");
}

/**
 * LE PLUS COURT CHEMIN (Dijkstra sur l'inverse des poids ; en nombre de sauts si aucun poids).
 * `orientation: "orientee"` suit le sens des liens ; `"libre"` les remonte aussi — « comment
 * sommes-nous liés » n'a pas de sens de lecture, « qui dépend de qui » en a un.
 */
export function plusCourtChemin(
  g: Graphe, de: string, a: string,
  options: { orientation?: "orientee" | "libre"; relations?: readonly string[]; profondeurMax?: number } = {},
): Chemin | null {
  if (!g.noeuds.has(de) || !g.noeuds.has(a)) return null;
  if (de === a) return { noeuds: [de], etapes: [], longueur: 0, cout: 0, recit: nom(g, de) };
  const sens = options.orientation === "libre" ? "les_deux" : "sortant";
  const filtre = options.relations?.length ? new Set(options.relations.map((r) => r.toLowerCase())) : null;
  const profondeurMax = Math.min(options.profondeurMax ?? PROFONDEUR_MAX, PROFONDEUR_MAX);

  const distance = new Map<string, number>([[de, 0]]);
  const sauts = new Map<string, number>([[de, 0]]);
  const parent = new Map<string, Etape>();
  // File à priorité simple (tableau trié) : suffisant jusqu'à quelques dizaines de milliers de nœuds.
  const file: { id: string; d: number }[] = [{ id: de, d: 0 }];
  const vus = new Set<string>();
  while (file.length) {
    file.sort((x, y) => x.d - y.d);
    const courant = file.shift()!;
    if (vus.has(courant.id)) continue;
    vus.add(courant.id);
    if (courant.id === a) break;
    if ((sauts.get(courant.id) ?? 0) >= profondeurMax) continue;
    for (const v of voisins(g, courant.id, sens)) {
      if (filtre && !filtre.has(v.arete.relation.toLowerCase())) continue;
      const d = courant.d + cout(v.arete);
      if (d < (distance.get(v.id) ?? Infinity)) {
        distance.set(v.id, d);
        sauts.set(v.id, (sauts.get(courant.id) ?? 0) + 1);
        parent.set(v.id, { de: courant.id, a: v.id, relation: v.arete.relation, sens: v.sens, note: v.arete.note ?? null });
        file.push({ id: v.id, d });
      }
    }
  }
  if (!parent.has(a)) return null;
  const etapes: Etape[] = [];
  let curseur = a;
  while (curseur !== de) {
    const e = parent.get(curseur)!;
    etapes.unshift(e);
    curseur = e.de;
  }
  return { noeuds: [de, ...etapes.map((e) => e.a)], etapes, longueur: etapes.length, cout: distance.get(a) ?? etapes.length, recit: raconter(g, etapes) };
}

/**
 * PLUSIEURS CHEMINS DISTINCTS (Yen simplifié : on retire une arête du meilleur chemin et on
 * recommence). Un lien unique et trois liens indépendants ne se valent pas — dire « ils sont
 * liés » sans dire par combien de chemins cache l'essentiel.
 */
export function cheminsMultiples(
  g: Graphe, de: string, a: string,
  options: { maximum?: number; orientation?: "orientee" | "libre"; relations?: readonly string[] } = {},
): Chemin[] {
  const maximum = Math.max(1, Math.min(options.maximum ?? 3, CHEMINS_MAX));
  const trouves: Chemin[] = [];
  const interdites = new Set<string>();
  const cle = (e: Etape) => `${e.de}→${e.a}:${e.relation}`;
  for (let i = 0; i < maximum; i += 1) {
    const sansInterdites: Graphe = interdites.size
      ? { ...g, aretes: g.aretes, sortants: filtrer(g.sortants, interdites, "sortant"), entrants: filtrer(g.entrants, interdites, "entrant") }
      : g;
    const c = plusCourtChemin(sansInterdites, de, a, options);
    if (!c || !c.etapes.length) break;
    if (trouves.some((t) => t.noeuds.join(">") === c.noeuds.join(">"))) break;
    trouves.push(c);
    // On retire l'arête la MOINS partagée du chemin (celle du milieu) pour chercher un vrai détour.
    const pivot = c.etapes[Math.floor(c.etapes.length / 2)]!;
    interdites.add(cle(pivot));
  }
  return trouves;
}

function filtrer<T extends { arete: Arete }>(index: Map<string, T[]>, interdites: Set<string>, sens: "sortant" | "entrant"): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const [id, liste] of index) {
    out.set(id, liste.filter((x) => {
      const de = sens === "sortant" ? id : (x as unknown as { depuis: string }).depuis;
      const a = sens === "sortant" ? (x as unknown as { vers: string }).vers : id;
      return !interdites.has(`${de}→${a}:${x.arete.relation}`) && !interdites.has(`${a}→${de}:${x.arete.relation}`);
    }));
  }
  return out;
}

/** TOUT CE QU'ON ATTEINT depuis un nœud, par niveau de distance — la portée d'une décision. */
export function portee(
  g: Graphe, de: string,
  options: { sens?: "sortant" | "entrant" | "les_deux"; profondeurMax?: number; relations?: readonly string[] } = {},
): { id: string; distance: number; via: string | null; relation: string | null }[] {
  if (!g.noeuds.has(de)) return [];
  const sens = options.sens ?? "sortant";
  const max = Math.min(options.profondeurMax ?? 4, PROFONDEUR_MAX);
  const filtre = options.relations?.length ? new Set(options.relations.map((r) => r.toLowerCase())) : null;
  const out: { id: string; distance: number; via: string | null; relation: string | null }[] = [];
  const vus = new Set([de]);
  let front: { id: string; via: string | null; relation: string | null }[] = [{ id: de, via: null, relation: null }];
  for (let d = 1; d <= max && front.length; d += 1) {
    const suivant: { id: string; via: string | null; relation: string | null }[] = [];
    for (const f of front) {
      for (const v of voisins(g, f.id, sens)) {
        if (filtre && !filtre.has(v.arete.relation.toLowerCase())) continue;
        if (vus.has(v.id)) continue;
        vus.add(v.id);
        out.push({ id: v.id, distance: d, via: f.id, relation: v.arete.relation });
        suivant.push({ id: v.id, via: f.id, relation: v.arete.relation });
      }
    }
    front = suivant;
  }
  return out;
}

/** Les CYCLES : « A dépend de B qui dépend de A » est un défaut, pas une curiosité. */
export function cycles(g: Graphe, maximum = 20): string[][] {
  const trouves: string[][] = [];
  const couleur = new Map<string, 0 | 1 | 2>();
  const pile: string[] = [];
  const visiter = (id: string): void => {
    if (trouves.length >= maximum) return;
    couleur.set(id, 1);
    pile.push(id);
    for (const s of g.sortants.get(id) ?? []) {
      if (trouves.length >= maximum) break;
      const c = couleur.get(s.vers) ?? 0;
      if (c === 1) {
        const i = pile.indexOf(s.vers);
        if (i >= 0) {
          const cycle = pile.slice(i);
          const signature = [...cycle].sort().join("|");
          if (!trouves.some((t) => [...t].sort().join("|") === signature)) trouves.push(cycle);
        }
      } else if (c === 0) visiter(s.vers);
    }
    pile.pop();
    couleur.set(id, 2);
  };
  for (const id of g.noeuds.keys()) if ((couleur.get(id) ?? 0) === 0) visiter(id);
  return trouves;
}

/** Les COMPOSANTES : des îlots sans aucun lien entre eux. Un réseau en morceaux ne se lit pas comme un tout. */
export function composantes(g: Graphe): string[][] {
  const vus = new Set<string>();
  const out: string[][] = [];
  for (const id of g.noeuds.keys()) {
    if (vus.has(id)) continue;
    const groupe: string[] = [];
    const file = [id];
    vus.add(id);
    while (file.length) {
      const courant = file.shift()!;
      groupe.push(courant);
      for (const v of voisins(g, courant, "les_deux")) if (!vus.has(v.id)) { vus.add(v.id); file.push(v.id); }
    }
    out.push(groupe);
  }
  return out.sort((a, b) => b.length - a.length);
}

/**
 * LES POINTS DE RUPTURE — les nœuds dont le retrait casse le réseau en morceaux (points
 * d'articulation, algorithme de Hopcroft-Tarjan sur le graphe non orienté).
 * « Si cette personne part, qu'est-ce qui se retrouve isolé ? »
 */
export function pointsDeRupture(g: Graphe): { id: string; composantesApres: number; isole: string[] }[] {
  const avant = composantes(g).length;
  const disc = new Map<string, number>(), low = new Map<string, number>(), parent = new Map<string, string | null>();
  const articulation = new Set<string>();
  let temps = 0;
  const visiter = (u: string): void => {
    disc.set(u, temps); low.set(u, temps); temps += 1;
    let enfants = 0;
    for (const v of voisins(g, u, "les_deux")) {
      if (!disc.has(v.id)) {
        enfants += 1;
        parent.set(v.id, u);
        visiter(v.id);
        low.set(u, Math.min(low.get(u)!, low.get(v.id)!));
        if (parent.get(u) !== null && parent.get(u) !== undefined && low.get(v.id)! >= disc.get(u)!) articulation.add(u);
      } else if (v.id !== parent.get(u)) low.set(u, Math.min(low.get(u)!, disc.get(v.id)!));
    }
    if ((parent.get(u) === null || parent.get(u) === undefined) && enfants > 1) articulation.add(u);
  };
  for (const id of g.noeuds.keys()) if (!disc.has(id)) { parent.set(id, null); visiter(id); }

  // Ce qui se retrouve ISOLÉ : les composantes qui apparaissent quand on retire le nœud.
  return [...articulation].map((id) => {
    const restants = new Set([...g.noeuds.keys()].filter((x) => x !== id));
    const vus = new Set<string>();
    const groupes: string[][] = [];
    for (const depart of restants) {
      if (vus.has(depart)) continue;
      const groupe: string[] = [];
      const file = [depart];
      vus.add(depart);
      while (file.length) {
        const courant = file.shift()!;
        groupe.push(courant);
        for (const v of voisins(g, courant, "les_deux")) if (v.id !== id && restants.has(v.id) && !vus.has(v.id)) { vus.add(v.id); file.push(v.id); }
      }
      groupes.push(groupe);
    }
    groupes.sort((a, b) => b.length - a.length);
    return { id, composantesApres: groupes.length, isole: groupes.slice(1).flat() };
  }).filter((x) => x.composantesApres > avant).sort((a, b) => b.isole.length - a.isole.length);
}
