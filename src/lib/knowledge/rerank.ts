/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RERANKING (§4) — de trente candidats à cinq résultats utiles, sans appeler personne.
 *
 * ── POURQUOI RECLASSER APRÈS AVOIR DÉJÀ CLASSÉ ───────────────────────────────────────────
 *
 * La recherche hybride classe par MOYEN de correspondance : exact, lexical, sémantique. C'est le
 * bon ordre pour trouver, et le mauvais pour CHOISIR. Trois morceaux du même contrat de 80 pages
 * remontent tous les trois ; un document de 2019 qui contient le mot demandé bat un document de
 * la semaine dernière qui parle du même sujet. Le reclassement corrige ce que le rappel ignore.
 *
 * ── AUCUN MODÈLE, ET C'EST UN CHOIX DÉFENDABLE ───────────────────────────────────────────
 *
 * Un reranker de la littérature est un modèle croisé question/document : excellent, et facturé à
 * chaque candidat. Ici les signaux disponibles sont déjà très forts — couverture des mots
 * demandés, fraîcheur, autorité de la source, entités partagées, diversité. Ils coûtent zéro et
 * expliquent leur note. Le jour où ils ne suffiront pas, cette fonction est le point d'insertion
 * évident ; en attendant, payer un modèle pour trier cinq lignes serait la dépense la moins
 * justifiable de toute la couche.
 *
 * ── LA DIVERSITÉ N'EST PAS UN LUXE ───────────────────────────────────────────────────────
 *
 * Cinq extraits du même document répondent cinq fois à la même chose. Le PDG qui demande
 * « pourquoi ce dossier bloque » a besoin de cinq ANGLES, pas de cinq paragraphes voisins. Une
 * pénalité de répétition par document est donc appliquée — c'est ce qui transforme une liste de
 * résultats en un dossier de preuves.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce que le reranker reçoit. Volontairement pauvre : il ne doit rien savoir de la base. */
export interface Rerankable {
  /** Identifiant du DOCUMENT (pas du morceau) — c'est lui qui porte la pénalité de répétition. */
  itemId: string;
  /** Le texte de l'extrait, tel qu'il sera montré. */
  snippet: string;
  /** Le score du rappel : ce que l'étage précédent a conclu. */
  score: number;
  /** Comment il a été trouvé. Une preuve exacte pèse plus qu'une ressemblance. */
  matchedBy: "exact" | "lexical" | "semantic" | "metadata";
  /** La date du document, quand elle est connue. */
  documentDate?: Date | null;
  /** Le type de source — certaines font plus autorité que d'autres sur un fait. */
  sourceType?: string | null;
  /** Les entités que ce document CITE, si le graphe les connaît. */
  entityIds?: string[];
  /**
   * OÙ SE TROUVE L'EXTRAIT DANS LE DOCUMENT — « page 3 », « Feuille Tarifs », « Diapositive 7 ».
   *
   * Le reclassement ne s'en sert PAS pour noter, et c'est voulu : un extrait n'est pas meilleur
   * parce qu'il est page 3. Il les transporte, simplement, parce que l'appelant en a besoin et
   * que l'entonnoir est le seul endroit par lequel ils passent.
   *
   * Sans ce passage, tout le travail de découpage étiqueté était perdu au dernier étage :
   * `search` produisait « Diapositive 7 », le reclassement le jetait, et l'appelant recevait un
   * extrait impossible à CITER. Découper en unités nommées pour perdre le nom au bout de la
   * chaîne, c'est faire le travail deux fois pour ne rien en garder.
   */
  label?: string | null;
  locator?: string | null;
  /** Le titre du document — même raison : il traverse, il ne note pas. */
  title?: string | null;
}

export interface RerankOptions {
  /** Les entités que la question désigne — repérées par le résolveur, pas devinées ici. */
  queryEntityIds?: string[];
  /** L'instant de référence. Explicite pour que les tests soient reproductibles. */
  now?: Date;
  /** Combien de résultats on garde. §4 : cinq suffisent presque toujours. */
  limit?: number;
}

export interface RerankedHit extends Rerankable {
  /** La note finale, après reclassement. */
  finalScore: number;
  /** Le détail de la note — un classement qui ne s'explique pas ne se corrige pas. */
  because: string[];
}

/** Les poids. Ils s'additionnent sur le score de rappel, ils ne le remplacent pas. */
const W = {
  /** Une correspondance exacte est une PREUVE ; une proximité de vecteurs, une ressemblance. */
  exact: 0.30,
  lexical: 0.12,
  semantic: 0.04,
  /** Le document cite une entité que la question désigne — le signal le plus spécifique. */
  entity: 0.25,
  /** Tous les mots demandés se retrouvent dans l'extrait montré. */
  coverage: 0.20,
  /** La fraîcheur, qui décroît doucement. */
  recency: 0.15,
  /** L'autorité de la source sur un FAIT d'entreprise. */
  authority: 0.10,
  /** La pénalité appliquée au deuxième extrait d'un même document, puis au troisième, etc. */
  repeat: 0.35,
} as const;

/**
 * L'AUTORITÉ D'UNE SOURCE.
 *
 * Un dossier Regulatory fait autorité sur l'état d'un dossier ; un e-mail fait autorité sur ce
 * que quelqu'un a écrit, et sur rien d'autre. Classer les deux à égalité ferait remonter une
 * conversation au-dessus de la décision qu'elle commente.
 */
const AUTHORITY: Record<string, number> = {
  regulatory: 1, legal: 1, finance: 0.95, pch: 0.9, product: 0.9, supplier: 0.85,
  decision: 0.9, hr: 0.85, drive_file: 0.8, courrier: 0.8, meeting: 0.7,
  task: 0.6, attachment: 0.6, email: 0.5, comment: 0.4,
};

const fold = (s: string): string =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Les mots de la question qui DISCRIMINENT — les courts n'apprennent rien sur la pertinence. */
export function queryTerms(question: string): string[] {
  return [...new Set(fold(question).split(/[^a-z0-9]+/).filter((t) => t.length >= 4))];
}

/**
 * LA DÉCROISSANCE DE FRAÎCHEUR — une demi-vie, pas une falaise.
 *
 * Un document de treize mois ne devient pas soudain sans valeur le jour de son anniversaire. Une
 * décroissance continue évite qu'un seuil arbitraire fasse disparaître une pièce pertinente d'un
 * jour à l'autre, ce qui est impossible à expliquer à quelqu'un qui l'a vue la veille.
 */
export function recencyScore(date: Date | null | undefined, now: Date): number {
  if (!date) return 0.35; // date inconnue : ni récompensée, ni punie
  const days = Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
  const halfLife = 365;
  return Math.pow(0.5, days / halfLife);
}

/** Quelle part des mots demandés se retrouve dans l'extrait MONTRÉ, pas dans le document entier. */
export function coverage(snippet: string, terms: string[]): number {
  if (!terms.length) return 0;
  const s = fold(snippet);
  let hit = 0;
  for (const t of terms) if (s.includes(t)) hit += 1;
  return hit / terms.length;
}

/**
 * RECLASSE ET COUPE.
 *
 * L'ordre des opérations compte : on note TOUT, on trie, puis on applique la pénalité de
 * répétition en parcourant la liste triée. Appliquer la pénalité avant le tri punirait un
 * document selon l'ordre d'arrivée de ses morceaux, qui n'a aucun sens.
 */
export function rerank(candidates: Rerankable[], question: string, opts: RerankOptions = {}): RerankedHit[] {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 5;
  const terms = queryTerms(question);
  const wanted = new Set(opts.queryEntityIds ?? []);

  const scored: RerankedHit[] = candidates.map((c) => {
    const because: string[] = [];
    let s = c.score;

    const byMatch = c.matchedBy === "exact" ? W.exact : c.matchedBy === "lexical" ? W.lexical : c.matchedBy === "semantic" ? W.semantic : 0;
    if (byMatch > 0) { s += byMatch; because.push(c.matchedBy === "exact" ? "correspondance exacte" : `trouvé en ${c.matchedBy}`); }

    const cov = coverage(c.snippet, terms);
    if (cov > 0) { s += cov * W.coverage; if (cov >= 0.99) because.push("tous les mots demandés sont dans l'extrait"); }

    if (wanted.size && c.entityIds?.length) {
      const shared = c.entityIds.filter((e) => wanted.has(e)).length;
      if (shared > 0) { s += W.entity; because.push(`cite ${shared === 1 ? "l'entité" : "les entités"} de la question`); }
    }

    const rec = recencyScore(c.documentDate, now);
    s += rec * W.recency;
    if (rec > 0.8) because.push("récent");

    const auth = AUTHORITY[c.sourceType ?? ""] ?? 0.5;
    s += auth * W.authority;
    if (auth >= 0.9) because.push("source qui fait autorité");

    return { ...c, finalScore: s, because };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);

  // ── LA DIVERSITÉ, appliquée sur la liste TRIÉE. Le meilleur extrait d'un document garde sa
  //    note ; le deuxième paie, le troisième paie davantage. Cinq extraits du même contrat
  //    répondent cinq fois à la même chose.
  const seen = new Map<string, number>();
  for (const h of scored) {
    const n = seen.get(h.itemId) ?? 0;
    if (n > 0) {
      h.finalScore -= W.repeat * n;
      h.because.push(`${n + 1}ᵉ extrait du même document`);
    }
    seen.set(h.itemId, n + 1);
  }

  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored.slice(0, limit);
}

/**
 * L'ENTONNOIR, DÉCRIT (§4) — et vérifiable.
 *
 * `100 000 → metadata → 300 → hybride → 30 → reranking → 5`. Ce n'est pas une illustration : ce
 * sont les bornes que le code applique, et le rapport les mesure. Un entonnoir qui ne se mesure
 * pas est une figure de style.
 */
export const FUNNEL = {
  /** Après le filtre de métadonnées (type, entité, période) — ce que la base ramène. */
  afterMetadata: 300,
  /** Après la recherche hybride — les candidats qu'on daigne noter. */
  afterHybrid: 30,
  /** Ce qui part au modèle. Au-delà, on paie des jetons pour du bruit. */
  afterRerank: 5,
} as const;

/**
 * LE CACHE — même question, même périmètre, même réponse pendant quelques secondes.
 *
 * Il n'est PAS là pour économiser une requête : il est là parce qu'un tour d'Adam pose souvent
 * deux fois la même question (le plan, puis la vérification), et parce qu'un utilisateur qui
 * reformule à un mot près ne doit pas repayer une recherche vectorielle.
 *
 * La durée est courte À DESSEIN. Un cache long ferait mentir une couche dont toute la valeur est
 * de dire l'état ACTUEL : trente secondes après un dépôt de document, la réponse doit avoir changé.
 */
export const CACHE_TTL_MS = 20_000;
const CACHE_MAX = 200;

interface CacheEntry<T> { at: number; value: T }
const CACHE = new Map<string, CacheEntry<unknown>>();

/** La clé inclut le PÉRIMÈTRE : deux personnes n'ont pas droit aux mêmes documents. */
export function cacheKey(parts: (string | number | null | undefined)[]): string {
  return parts.map((p) => String(p ?? "")).join("|");
}

export function cacheGet<T>(key: string, now = Date.now()): T | null {
  const e = CACHE.get(key);
  if (!e) return null;
  if (now - e.at > CACHE_TTL_MS) { CACHE.delete(key); return null; }
  return e.value as T;
}

export function cacheSet<T>(key: string, value: T, now = Date.now()): void {
  // Éviction la plus ANCIENNE d'abord. Une carte JavaScript conserve l'ordre d'insertion, donc
  // la première clé est la plus vieille — pas besoin d'une structure de plus pour un cache de 200.
  if (CACHE.size >= CACHE_MAX) {
    const oldest = CACHE.keys().next();
    if (!oldest.done) CACHE.delete(oldest.value);
  }
  CACHE.set(key, { at: now, value });
}

export function cacheClear(): void {
  CACHE.clear();
}

export const cacheSize = (): number => CACHE.size;
