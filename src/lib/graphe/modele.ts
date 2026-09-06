/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE GRAPHE DE L'ENTREPRISE (mandat 5 §40) — pur.
 *
 * Personnes, sociétés, produits, fournisseurs, contrats, dossiers, e-mails, décisions : ce ne
 * sont pas des tables séparées, c'est un RÉSEAU. « Qui connaît qui chez Sofradis », « quel
 * fournisseur touche combien de nos dossiers », « qu'est-ce qui tombe si ce contrat saute » sont
 * des questions de chemins, pas de jointures.
 *
 * LA DIMENSION TEMPORELLE N'EST PAS UNE OPTION. Un lien a une période de validité, et
 * `auMoment` rend le graphe TEL QU'IL ÉTAIT. « Qui était responsable au moment de cette
 * décision ? » n'a de réponse que si l'histoire n'a pas été écrasée par le présent : un
 * responsable remplacé ne disparaît pas, sa période se ferme. Un graphe sans temps répond
 * toujours avec les gens d'aujourd'hui, et il a l'air d'avoir raison.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface Noeud {
  id: string;
  /** PERSONNE, SOCIETE, PRODUIT, FOURNISSEUR, CONTRAT, DOSSIER, EMAIL, DECISION… — libre, c'est l'appelant qui nomme son monde. */
  type: string;
  libelle: string;
  /** Ce que l'écran doit ouvrir pour ce nœud, quand il existe. */
  href?: string | null;
  /** Poids propre (montant, effectif) — sert aux mesures pondérées et au rendu. */
  poids?: number;
  attributs?: Record<string, string | number | boolean | null>;
}

export interface Arete {
  de: string;
  a: string;
  /** « responsable_de », « fournit », « signe », « mentionne »… */
  relation: string;
  /** Force du lien : un poids ÉLEVÉ = un lien fort. Les distances en sont l'inverse. */
  poids?: number;
  /** Le lien vaut à partir de cet instant (inclus). Absent = depuis toujours. */
  depuis?: Date | string | null;
  /** Le lien cesse à cet instant (exclus). Absent = toujours valide. */
  jusqua?: Date | string | null;
  /** Un lien orienté (« signe ») ou réciproque (« travaille avec »). Orienté par défaut. */
  reciproque?: boolean;
  note?: string | null;
}

export interface Graphe {
  noeuds: Map<string, Noeud>;
  aretes: Arete[];
  /** Sortants par nœud (les réciproques apparaissent des deux côtés). */
  sortants: Map<string, { vers: string; arete: Arete }[]>;
  entrants: Map<string, { depuis: string; arete: Arete }[]>;
}

export const NOEUDS_MAX = 50_000;
export const ARETES_MAX = 300_000;

const instant = (v: Date | string | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

/** Une arête est-elle VALIDE à cet instant ? Sans borne, elle l'est toujours. */
export function valideA(a: Arete, quand: Date | number): boolean {
  const t = quand instanceof Date ? quand.getTime() : quand;
  const debut = instant(a.depuis);
  const fin = instant(a.jusqua);
  if (debut !== null && t < debut) return false;
  if (fin !== null && t >= fin) return false;
  return true;
}

/** Le graphe est-il temporel ? (au moins une arête bornée) — sert à DIRE quand la question du temps a un sens. */
export const estTemporel = (g: Graphe): boolean => g.aretes.some((a) => a.depuis || a.jusqua);

export type ConstructionGraphe = { ok: true; graphe: Graphe; ignorees: number } | { ok: false; erreur: string };

/**
 * Construit le graphe et son index. Une arête dont un bout n'existe pas est IGNORÉE et comptée :
 * inventer le nœud manquant produirait un réseau plus riche que la réalité, ce qui est pire que
 * de le dire.
 */
export function construire(noeuds: readonly Noeud[], aretes: readonly Arete[]): ConstructionGraphe {
  if (!noeuds.length) return { ok: false, erreur: "Aucun nœud : il n'y a pas de réseau à analyser." };
  if (noeuds.length > NOEUDS_MAX) return { ok: false, erreur: `${noeuds.length} nœuds : ${NOEUDS_MAX} au plus (limite opérationnelle de mémoire).` };
  if (aretes.length > ARETES_MAX) return { ok: false, erreur: `${aretes.length} liens : ${ARETES_MAX} au plus.` };
  const carte = new Map<string, Noeud>();
  for (const n of noeuds) {
    if (!n?.id) continue;
    if (!carte.has(n.id)) carte.set(n.id, n);
  }
  const sortants = new Map<string, { vers: string; arete: Arete }[]>();
  const entrants = new Map<string, { depuis: string; arete: Arete }[]>();
  for (const id of carte.keys()) { sortants.set(id, []); entrants.set(id, []); }
  const gardees: Arete[] = [];
  let ignorees = 0;
  for (const a of aretes) {
    if (!a?.de || !a?.a || !carte.has(a.de) || !carte.has(a.a)) { ignorees += 1; continue; }
    gardees.push(a);
    sortants.get(a.de)!.push({ vers: a.a, arete: a });
    entrants.get(a.a)!.push({ depuis: a.de, arete: a });
    if (a.reciproque) {
      sortants.get(a.a)!.push({ vers: a.de, arete: a });
      entrants.get(a.de)!.push({ depuis: a.a, arete: a });
    }
  }
  return { ok: true, graphe: { noeuds: carte, aretes: gardees, sortants, entrants }, ignorees };
}

/** LE GRAPHE TEL QU'IL ÉTAIT — seules les arêtes valides à cet instant subsistent. Les nœuds restent. */
export function auMoment(g: Graphe, quand: Date | number): Graphe {
  const gardees = g.aretes.filter((a) => valideA(a, quand));
  const r = construire([...g.noeuds.values()], gardees);
  return r.ok ? r.graphe : g;
}

/** Les relations d'un TYPE donné seulement (« qui fournit quoi », sans le bruit du reste). */
export function filtrerRelations(g: Graphe, relations: readonly string[]): Graphe {
  const set = new Set(relations.map((r) => r.toLowerCase()));
  const r = construire([...g.noeuds.values()], g.aretes.filter((a) => set.has(a.relation.toLowerCase())));
  return r.ok ? r.graphe : g;
}

/** Les voisins immédiats d'un nœud, dans les deux sens, dédoublonnés. */
export function voisins(g: Graphe, id: string, sens: "sortant" | "entrant" | "les_deux" = "les_deux"): { id: string; arete: Arete; sens: "sortant" | "entrant" }[] {
  const out: { id: string; arete: Arete; sens: "sortant" | "entrant" }[] = [];
  const vus = new Set<string>();
  if (sens !== "entrant") for (const s of g.sortants.get(id) ?? []) { const c = `s:${s.vers}:${s.arete.relation}`; if (!vus.has(c)) { vus.add(c); out.push({ id: s.vers, arete: s.arete, sens: "sortant" }); } }
  if (sens !== "sortant") for (const e of g.entrants.get(id) ?? []) { const c = `e:${e.depuis}:${e.arete.relation}`; if (!vus.has(c)) { vus.add(c); out.push({ id: e.depuis, arete: e.arete, sens: "entrant" }); } }
  return out;
}

/** Le degré d'un nœud, séparé en entrant et sortant (les réciproques comptent des deux côtés). */
export function degre(g: Graphe, id: string): { entrant: number; sortant: number; total: number } {
  const s = (g.sortants.get(id) ?? []).length;
  const e = (g.entrants.get(id) ?? []).length;
  return { entrant: e, sortant: s, total: s + e };
}

/** Les types de nœuds présents, comptés — le sommaire d'un réseau avant de l'analyser. */
export function sommaire(g: Graphe): { noeuds: number; aretes: number; parType: Record<string, number>; parRelation: Record<string, number>; temporel: boolean; periode: { de: string | null; a: string | null } } {
  const parType: Record<string, number> = {};
  for (const n of g.noeuds.values()) parType[n.type] = (parType[n.type] ?? 0) + 1;
  const parRelation: Record<string, number> = {};
  for (const a of g.aretes) parRelation[a.relation] = (parRelation[a.relation] ?? 0) + 1;
  const debuts = g.aretes.map((a) => instant(a.depuis)).filter((x): x is number => x !== null);
  const fins = g.aretes.map((a) => instant(a.jusqua)).filter((x): x is number => x !== null);
  return {
    noeuds: g.noeuds.size, aretes: g.aretes.length, parType, parRelation, temporel: estTemporel(g),
    periode: {
      de: debuts.length ? new Date(Math.min(...debuts)).toISOString().slice(0, 10) : null,
      a: fins.length ? new Date(Math.max(...fins)).toISOString().slice(0, 10) : null,
    },
  };
}

/** Le libellé d'un nœud, ou son identifiant s'il n'en a pas — pour que rien ne s'affiche vide. */
export const nom = (g: Graphe, id: string): string => g.noeuds.get(id)?.libelle ?? id;
