/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * QUI COMPTE, ET POURQUOI (mandat 5 §40) — pur.
 *
 * Quatre centralités qui ne disent PAS la même chose, et c'est tout l'intérêt :
 *
 *   · DEGRÉ        — qui a le plus de liens. Le plus visible, le plus trompeur : un carnet
 *                    d'adresses n'est pas une influence.
 *   · PAGERANK     — qui est cité par des gens eux-mêmes cités. La réputation transitive.
 *   · INTERMÉDIARITÉ — qui se trouve SUR les chemins des autres (Brandes). Le point de passage :
 *                    la personne dont le départ coupe l'entreprise en deux, même avec peu de liens.
 *   · PROXIMITÉ    — qui atteint tout le monde vite. L'accès, pas le pouvoir.
 *
 * Les COMMUNAUTÉS (Louvain) montrent les groupes que personne n'a déclarés : le service qui
 * travaille de fait avec un fournisseur, le pôle qui s'est formé autour d'un produit.
 *
 * La limite est dite partout : une centralité mesure la STRUCTURE des liens qu'on a saisis. Un
 * lien absent de l'ERP est absent du calcul, et l'influence réelle passe aussi par des couloirs.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { type Graphe, degre, voisins } from "./modele";

export interface Centralite {
  id: string;
  libelle: string;
  type: string;
  degre: number;
  degreEntrant: number;
  degreSortant: number;
  pagerank: number;
  intermediarite: number;
  proximite: number;
}

export const NOEUDS_BRANDES_MAX = 3_000;

/** PageRank par itération de puissance (amortissement 0,85), sur les liens SORTANTS. */
export function pagerank(g: Graphe, amortissement = 0.85, iterations = 60): Map<string, number> {
  const ids = [...g.noeuds.keys()];
  const n = ids.length;
  if (!n) return new Map();
  const index = new Map(ids.map((id, i) => [id, i]));
  const sortants = ids.map((id) => (g.sortants.get(id) ?? []).map((s) => index.get(s.vers)!).filter((x) => x !== undefined));
  let r = new Array<number>(n).fill(1 / n);
  for (let it = 0; it < iterations; it += 1) {
    const suivant = new Array<number>(n).fill((1 - amortissement) / n);
    let fuite = 0;
    for (let i = 0; i < n; i += 1) {
      const liens = sortants[i]!;
      if (!liens.length) { fuite += r[i]!; continue; }
      const part = (amortissement * r[i]!) / liens.length;
      for (const j of liens) suivant[j] += part;
    }
    // Les nœuds sans sortie redistribuent uniformément — sinon la masse disparaît.
    const supplement = (amortissement * fuite) / n;
    for (let i = 0; i < n; i += 1) suivant[i] += supplement;
    let ecart = 0;
    for (let i = 0; i < n; i += 1) ecart += Math.abs(suivant[i]! - r[i]!);
    r = suivant;
    if (ecart < 1e-10) break;
  }
  return new Map(ids.map((id, i) => [id, r[i]!]));
}

/**
 * INTERMÉDIARITÉ par l'algorithme de Brandes (non pondéré, graphe traité comme non orienté :
 * « être sur le chemin » n'a pas de sens de lecture). Normalisée entre 0 et 1.
 */
export function intermediarite(g: Graphe): Map<string, number> {
  const ids = [...g.noeuds.keys()];
  const n = ids.length;
  const score = new Map<string, number>(ids.map((id) => [id, 0]));
  if (n < 3 || n > NOEUDS_BRANDES_MAX) return score;
  for (const s of ids) {
    const pile: string[] = [];
    const predecesseurs = new Map<string, string[]>(ids.map((id) => [id, []]));
    const sigma = new Map<string, number>(ids.map((id) => [id, 0]));
    const distance = new Map<string, number>(ids.map((id) => [id, -1]));
    sigma.set(s, 1); distance.set(s, 0);
    const file: string[] = [s];
    while (file.length) {
      const v = file.shift()!;
      pile.push(v);
      for (const w of voisins(g, v, "les_deux")) {
        if (distance.get(w.id) === -1) { distance.set(w.id, distance.get(v)! + 1); file.push(w.id); }
        if (distance.get(w.id) === distance.get(v)! + 1) {
          sigma.set(w.id, sigma.get(w.id)! + sigma.get(v)!);
          predecesseurs.get(w.id)!.push(v);
        }
      }
    }
    const delta = new Map<string, number>(ids.map((id) => [id, 0]));
    while (pile.length) {
      const w = pile.pop()!;
      for (const v of predecesseurs.get(w)!) delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
      if (w !== s) score.set(w, score.get(w)! + delta.get(w)!);
    }
  }
  // Non orienté : chaque paire est parcourue deux fois, une fois par extrémité — on divise par 2.
  // Puis on rapporte au MAXIMUM THÉORIQUE ((n-1)(n-2)/2, le score d'un nœud par lequel passent
  // tous les chemins). Rapporter au maximum OBSERVÉ donnerait 1 au premier nœud même dans un
  // réseau parfaitement plat : la mesure dirait « très central » là où il n'y a pas de centre.
  const maximumTheorique = ((n - 1) * (n - 2)) / 2;
  for (const id of ids) score.set(id, maximumTheorique > 0 ? score.get(id)! / 2 / maximumTheorique : 0);
  return score;
}

/** PROXIMITÉ : l'inverse de la distance moyenne aux nœuds atteignables, pondérée par la part atteinte. */
export function proximite(g: Graphe): Map<string, number> {
  const ids = [...g.noeuds.keys()];
  const out = new Map<string, number>(ids.map((id) => [id, 0]));
  const n = ids.length;
  if (n < 2 || n > NOEUDS_BRANDES_MAX) return out;
  for (const s of ids) {
    const distance = new Map<string, number>([[s, 0]]);
    const file = [s];
    let somme = 0, atteints = 0;
    while (file.length) {
      const v = file.shift()!;
      for (const w of voisins(g, v, "les_deux")) {
        if (distance.has(w.id)) continue;
        const d = distance.get(v)! + 1;
        distance.set(w.id, d);
        somme += d; atteints += 1;
        file.push(w.id);
      }
    }
    // Formule de Wasserman-Faust : elle ne récompense pas un nœud isolé dans un petit îlot.
    out.set(s, somme > 0 ? (atteints / (n - 1)) * (atteints / somme) : 0);
  }
  return out;
}

/** Toutes les centralités d'un coup, triées par la mesure demandée. */
export function centralites(g: Graphe, trierPar: "degre" | "pagerank" | "intermediarite" | "proximite" = "pagerank"): Centralite[] {
  const pr = pagerank(g);
  const bt = intermediarite(g);
  const cl = proximite(g);
  const out: Centralite[] = [...g.noeuds.values()].map((n) => {
    const d = degre(g, n.id);
    return {
      id: n.id, libelle: n.libelle, type: n.type,
      degre: d.total, degreEntrant: d.entrant, degreSortant: d.sortant,
      pagerank: pr.get(n.id) ?? 0, intermediarite: bt.get(n.id) ?? 0, proximite: cl.get(n.id) ?? 0,
    };
  });
  return out.sort((a, b) => (b[trierPar] as number) - (a[trierPar] as number));
}

export interface Communaute { numero: number; membres: string[]; taille: number; densiteInterne: number; typesDominants: string[]; libelle: string }

/**
 * LES COMMUNAUTÉS (Louvain, une passe d'optimisation de modularité + agrégation).
 * Ce sont les groupes que PERSONNE n'a déclarés : ils sortent des liens réels.
 */
export function communautes(g: Graphe, resolution = 1): { communautes: Communaute[]; modularite: number } {
  const ids = [...g.noeuds.keys()];
  const n = ids.length;
  if (!n) return { communautes: [], modularite: 0 };
  const index = new Map(ids.map((id, i) => [id, i]));
  // Graphe non orienté pondéré (les doubles liens s'additionnent).
  const adj: Map<number, number>[] = ids.map(() => new Map());
  let m2 = 0;
  for (const a of g.aretes) {
    const i = index.get(a.de)!, j = index.get(a.a)!;
    if (i === undefined || j === undefined || i === j) continue;
    const p = a.poids && a.poids > 0 ? a.poids : 1;
    adj[i]!.set(j, (adj[i]!.get(j) ?? 0) + p);
    adj[j]!.set(i, (adj[j]!.get(i) ?? 0) + p);
    m2 += 2 * p;
  }
  if (m2 === 0) return { communautes: ids.map((id, i) => ({ numero: i + 1, membres: [id], taille: 1, densiteInterne: 0, typesDominants: [g.noeuds.get(id)!.type], libelle: g.noeuds.get(id)!.libelle })), modularite: 0 };
  const k = adj.map((v) => [...v.values()].reduce((s, x) => s + x, 0));
  let comm = ids.map((_, i) => i);
  const sommeTot = [...k];
  let bouge = true, tours = 0;
  while (bouge && tours < 30) {
    bouge = false; tours += 1;
    for (let i = 0; i < n; i += 1) {
      const ancien = comm[i]!;
      sommeTot[ancien] = sommeTot[ancien]! - k[i]!;
      const liens = new Map<number, number>();
      for (const [j, p] of adj[i]!) liens.set(comm[j]!, (liens.get(comm[j]!) ?? 0) + p);
      let meilleure = ancien, meilleurGain = (liens.get(ancien) ?? 0) - (resolution * sommeTot[ancien]! * k[i]!) / m2;
      for (const [c, p] of liens) {
        const gain = p - (resolution * sommeTot[c]! * k[i]!) / m2;
        if (gain > meilleurGain + 1e-12) { meilleurGain = gain; meilleure = c; }
      }
      sommeTot[meilleure] = sommeTot[meilleure]! + k[i]!;
      if (meilleure !== ancien) { comm[i] = meilleure; bouge = true; }
    }
  }
  // Renuméroter et mesurer.
  const groupes = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    if (!groupes.has(comm[i]!)) groupes.set(comm[i]!, []);
    groupes.get(comm[i]!)!.push(i);
  }
  let modularite = 0;
  for (const membres of groupes.values()) {
    let interne = 0, total = 0;
    for (const i of membres) {
      total += k[i]!;
      for (const [j, p] of adj[i]!) if (comm[j] === comm[i]) interne += p;
    }
    modularite += interne / m2 - (total / m2) ** 2;
  }
  const out: Communaute[] = [...groupes.values()].map((membres) => {
    let interne = 0;
    for (const i of membres) for (const [j, p] of adj[i]!) if (membres.includes(j)) interne += p;
    const paires = membres.length * (membres.length - 1);
    const types = new Map<string, number>();
    for (const i of membres) { const t = g.noeuds.get(ids[i]!)!.type; types.set(t, (types.get(t) ?? 0) + 1); }
    const typesDominants = [...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    // Le nom du groupe : son membre le plus connecté.
    const tete = membres.slice().sort((a, b) => k[b]! - k[a]!)[0]!;
    return {
      numero: 0, membres: membres.map((i) => ids[i]!), taille: membres.length,
      densiteInterne: paires > 0 ? interne / paires : 0, typesDominants,
      libelle: `autour de ${g.noeuds.get(ids[tete]!)!.libelle}`,
    };
  }).sort((a, b) => b.taille - a.taille);
  out.forEach((c, i) => { c.numero = i + 1; });
  return { communautes: out, modularite };
}
