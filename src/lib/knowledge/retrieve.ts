import { routeKnowledge, documentBudget, type RouteDecision } from "./router";
import { search, type AccessFilter, type SearchHit, type SearchQuery } from "./retrieval";
import { rerank, FUNNEL, cacheGet, cacheSet, cacheKey, type RerankedHit } from "./rerank";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ENTONNOIR COMPLET (§3 + §4) — la seule porte que les appelants doivent connaître.
 *
 * ── CE QUE CETTE FONCTION FAIT, DANS L'ORDRE ─────────────────────────────────────────────
 *
 *   1. ROUTER — sans appeler personne, en dix microsecondes. Si la question porte sur un état,
 *      on s'arrête ici : AUCUN document n'est lu. C'est l'économie principale de tout le système.
 *   2. CACHE — même question, même périmètre, moins de vingt secondes : on rend la réponse.
 *   3. RAPPEL — la recherche hybride, bornée par le budget de la route.
 *   4. RECLASSEMENT — de trente candidats à cinq, avec diversité et fraîcheur.
 *
 * ── POURQUOI CETTE FONCTION EXISTE PLUTÔT QUE D'APPELER `search` DIRECTEMENT ─────────────
 *
 * Parce que `search` ne sait pas s'il DEVAIT être appelé. Laisser chaque appelant décider, c'est
 * garantir qu'un jour l'un d'eux enverra une recherche vectorielle pour compter des dossiers. Le
 * routage n'est utile que s'il est sur le chemin, pas s'il est disponible à côté.
 *
 * ── CE QUI EST MESURÉ, ET POURQUOI ───────────────────────────────────────────────────────
 *
 * Chaque étage rapporte son nombre de candidats et sa durée. Un entonnoir qu'on ne mesure pas est
 * une figure de style : c'est cette trace qui permet de dire « 300 → 30 → 5 » et de le PROUVER.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface RetrieveInput {
  question: string;
  /** Le périmètre, tel que l'appelant le connaît. Il entre dans la clé de cache. */
  companyId?: string | null;
  sourceTypes?: SearchQuery["sourceTypes"];
  docType?: string;
  asOf?: Date;
  /** Les entités que la question désigne — repérées en amont, jamais devinées ici. */
  entityIds?: string[];
  /** Forcer un plafond plus bas que celui de la route. Jamais plus haut. */
  limit?: number;
}

export interface RetrieveResult {
  route: RouteDecision;
  hits: RerankedHit[];
  /** L'entonnoir, étage par étage. C'est la preuve, pas la promesse. */
  funnel: { recalled: number; reranked: number; kept: number };
  /** Millisecondes par étage. Le routage doit rester invisible ; la recherche, brève. */
  timings: { routeMs: number; searchMs: number; rerankMs: number; totalMs: number };
  /** Vrai quand la réponse vient du cache — utile pour ne pas confondre vitesse et efficacité. */
  cached: boolean;
  /** Vrai quand la route a décidé qu'aucun document n'était nécessaire. */
  skipped: boolean;
}

/**
 * CHERCHE — ou décide qu'il n'y a rien à chercher.
 *
 * Ne lève jamais : une recherche qui échoue rend zéro résultat et le dit. Un écran qui casse
 * parce que l'index est indisponible serait une régression bien pire que l'absence d'extraits.
 */
export async function retrieve(input: RetrieveInput, canSee: AccessFilter): Promise<RetrieveResult> {
  const t0 = performance.now();

  const route = routeKnowledge(input.question);
  const routeMs = performance.now() - t0;

  const empty = (skipped: boolean, cached = false): RetrieveResult => ({
    route, hits: [], cached, skipped,
    funnel: { recalled: 0, reranked: 0, kept: 0 },
    timings: { routeMs, searchMs: 0, rerankMs: 0, totalMs: performance.now() - t0 },
  });

  // ── ÉTAGE 1. La route dit que la réponse est dans une colonne. On s'arrête, et c'est ici que
  //    le système gagne le plus : zéro octet lu, zéro vecteur comparé, zéro jeton dépensé.
  if (!route.scope.documents) return empty(true);

  const budget = Math.min(input.limit ?? Number.MAX_SAFE_INTEGER, documentBudget(route.route));
  if (budget <= 0) return empty(true);

  // ── ÉTAGE 2. Le cache. La clé porte le PÉRIMÈTRE : deux personnes n'ont pas droit aux mêmes
  //    documents, et servir à l'une ce qui a été calculé pour l'autre serait une fuite.
  const key = cacheKey([
    "retrieve", input.question.trim().toLowerCase(), input.companyId,
    (input.sourceTypes ?? []).join(","), input.docType, input.asOf?.toISOString(), budget,
  ]);
  const hit = cacheGet<RetrieveResult>(key);
  if (hit) return { ...hit, cached: true, timings: { ...hit.timings, totalMs: performance.now() - t0 } };

  try {
    // ── ÉTAGE 3. LE RAPPEL. On demande large — mais borné par `afterHybrid`, pas par le nombre
    //    de résultats voulus : un reclassement n'a de valeur que s'il a de quoi choisir.
    const tSearch = performance.now();
    const recalled: SearchHit[] = await search(
      {
        text: input.question,
        companyId: input.companyId,
        sourceTypes: input.sourceTypes,
        docType: input.docType,
        asOf: input.asOf,
        limit: FUNNEL.afterHybrid,
      },
      canSee,
    );
    const searchMs = performance.now() - tSearch;

    // ── ÉTAGE 4. LE RECLASSEMENT. De trente à cinq, avec diversité, fraîcheur et autorité.
    const tRerank = performance.now();
    const hits = rerank(
      recalled.map((h) => ({
        itemId: h.itemId,
        snippet: h.snippet,
        score: h.score,
        matchedBy: h.matchedBy,
        documentDate: h.documentDate,
        sourceType: h.sourceType,
      })),
      input.question,
      { queryEntityIds: input.entityIds, limit: budget },
    );
    const rerankMs = performance.now() - tRerank;

    const out: RetrieveResult = {
      route, hits, cached: false, skipped: false,
      funnel: { recalled: recalled.length, reranked: Math.min(recalled.length, FUNNEL.afterHybrid), kept: hits.length },
      timings: { routeMs, searchMs, rerankMs, totalMs: performance.now() - t0 },
    };
    cacheSet(key, out);
    return out;
  } catch (err) {
    console.error("[knowledge] retrieve failed", err);
    return empty(false);
  }
}

/**
 * CE QUI PART AU MODÈLE — le texte, et rien que le texte utile.
 *
 * §4 : « ne jamais donner 100 documents à Terra lorsque 5 suffisent ». Cette fonction est le
 * dernier rempart : elle borne le NOMBRE et la TAILLE, et elle numérote les sources pour que le
 * modèle puisse citer plutôt que paraphraser — une réponse sans source est invérifiable.
 */
export function toContext(r: RetrieveResult, maxCharsPerHit = 1_200): string {
  if (!r.hits.length) {
    return r.skipped
      ? "" // la route a conclu qu'aucun document n'était nécessaire : ne rien dire vaut mieux que dire « rien trouvé »
      : "Aucun document pertinent trouvé pour cette question.";
  }
  return r.hits
    .map((h, i) => `[${i + 1}] ${h.snippet.slice(0, maxCharsPerHit)}`)
    .join("\n\n");
}
