import { routeKnowledge, documentBudget, type RouteDecision } from "./router";
import { search, type AccessFilter, type SearchHit, type SearchQuery } from "./retrieval";

/**
 * LE TYPE DU FILTRE, RÉEXPORTÉ PAR LA PORTE QUI L'EXIGE.
 *
 * `AccessFilter` est le second paramètre de `retrieve`. Obliger l'appelant à ouvrir un second
 * module pour nommer un argument qu'on lui réclame est une couture qui ne sert personne — et,
 * concrètement, une dépendance de plus entre deux domaines pour un simple type.
 */
export type { AccessFilter };
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
  /**
   * L'IDENTITÉ DU PÉRIMÈTRE — sans elle, PAS DE CACHE. Ce n'est pas une option de réglage.
   *
   * ── LA FUITE QUE CE CHAMP FERME ────────────────────────────────────────────────────────
   *
   * La clé de cache portait `companyId`, `sourceTypes`, `docType`, `asOf` et le budget. Le
   * commentaire d'origine affirmait qu'elle portait « le PÉRIMÈTRE » — c'était vrai sur le
   * papier et faux en pratique : `companyId` est le plus souvent absent, et le FILTRE D'ACCÈS,
   * lui, n'entrait pas du tout dans la clé. Deux personnes posant la même question tombaient
   * donc sur la même entrée.
   *
   * MESURÉ, en branchant le premier appelant réel : le Super Admin demande « la posologie de la
   * metformine » et reçoit 5 extraits ; un employé qui n'a accès à AUCUN de ces documents pose
   * la même question juste après et reçoit les 5 mêmes. Le filtre avait bien fait son travail —
   * il n'a simplement jamais été consulté, puisque la réponse venait du cache.
   *
   * ── POURQUOI « ABSENT = PAS DE CACHE » PLUTÔT QU'UNE VALEUR PAR DÉFAUT ────────────────
   *
   * Parce qu'une valeur par défaut serait partagée, donc exactement la fuite qu'on ferme. Un
   * appelant qui oublie ce champ perd de la vitesse ; un appelant qui hérite d'un défaut
   * partagé perd le cloisonnement. La sanction de l'oubli doit tomber du bon côté.
   */
  scopeKey?: string;
  /**
   * L'APPELANT DEMANDE EXPRESSÉMENT LES DOCUMENTS — le verdict du routeur devient un AVIS.
   *
   * ── POURQUOI CETTE PORTE EXISTE ────────────────────────────────────────────────────────
   *
   * Le routage sert à ÉVITER une recherche inutile quand personne ne l'a demandée. Il n'a rien
   * à dire quand quelqu'un la demande explicitement : un appelant dont la fonction ENTIÈRE est
   * de fouiller les documents ne peut pas se voir répondre « la réponse est dans une colonne ».
   *
   * Mesuré : sur 25 questions à réponse connue, le routeur en écartait 9 avant toute recherche,
   * dont 8 dont la réponse était indexée au rang #1 ou #2. Pour l'écran ou pour Adam qui
   * interroge l'ERP d'abord, ce refus est une économie. Pour un outil « cherche dans les
   * documents », c'est un refus de faire son travail.
   *
   * Le cache et les plafonds continuent de s'appliquer : on ne saute que le VETO, pas les bornes.
   */
  force?: boolean;
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
  //    Sauf si l'appelant a explicitement demandé les documents — voir `force`.
  if (!route.scope.documents && !input.force) return empty(true);

  // Un appel FORCÉ mérite le budget d'une vraie recherche documentaire : la route qui l'a écarté
  // ne lui en accorde aucun, et hériter de son zéro reviendrait à refuser autrement.
  const budgetRoute = route.scope.documents ? documentBudget(route.route) : FUNNEL.afterRerank;
  const budget = Math.min(input.limit ?? Number.MAX_SAFE_INTEGER, budgetRoute);
  if (budget <= 0) return empty(true);

  // ── ÉTAGE 2. Le cache. La clé porte le PÉRIMÈTRE : deux personnes n'ont pas droit aux mêmes
  //    documents, et servir à l'une ce qui a été calculé pour l'autre serait une fuite.
  const key = input.scopeKey
    ? cacheKey([
      "retrieve", input.scopeKey, input.question.trim().toLowerCase(), input.companyId,
      (input.sourceTypes ?? []).join(","), input.docType, input.asOf?.toISOString(), budget,
    ])
    : null;
  const hit = key ? cacheGet<RetrieveResult>(key) : null;
  if (hit) {
    // LES TEMPS DÉCRIVENT CET APPEL-CI, PAS CELUI QUI A REMPLI LE CACHE. Garder le `searchMs`
    // d'origine faisait rapporter une recherche qui n'a pas eu lieu : le total tombait SOUS son
    // propre étage (54 ms de recherche pour un appel de 0,2 ms), et une courbe de latence
    // construite là-dessus aurait compté ce coût à chaque relecture du cache. On ne mesure que
    // ce qu'on vient de faire — routage compris, puisqu'il est bien recalculé.
    return {
      ...hit,
      cached: true,
      timings: { routeMs, searchMs: 0, rerankMs: 0, totalMs: performance.now() - t0 },
    };
  }

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
      // ON PASSE AUSSI CE QUI NE SERT PAS À NOTER. Cette projection ne gardait que les champs
      // dont le reclassement a besoin — ce qui semblait propre et faisait disparaître le TITRE,
      // l'ÉTIQUETTE et le REPÈRE au dernier étage de l'entonnoir. Résultat : `retrieve` rendait
      // des extraits impossibles à CITER, alors que le découpage en unités nommées
      // (« Diapositive 7 », « Feuille Tarifs », « page 3 ») n'existe que pour ça.
      //
      // Découper en unités nommées pour perdre le nom au bout de la chaîne, c'est faire le
      // travail deux fois pour n'en garder aucun. Constaté en branchant le premier appelant réel.
      recalled.map((h) => ({
        itemId: h.itemId,
        snippet: h.snippet,
        score: h.score,
        matchedBy: h.matchedBy,
        documentDate: h.documentDate,
        sourceType: h.sourceType,
        title: h.title,
        label: h.label,
        locator: h.locator,
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
    if (key) cacheSet(key, out);
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
