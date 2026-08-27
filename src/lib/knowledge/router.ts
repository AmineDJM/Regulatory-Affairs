/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE KNOWLEDGE ROUTER (§3) — « où faut-il chercher ? », décidé en moins d'une milliseconde.
 *
 * ── LA RÈGLE QUI DÉFINIT CE FICHIER ──────────────────────────────────────────────────────
 *
 * **Aucun modèle n'intervient ici, et le module n'importe RIEN.** Appeler un LLM pour décider
 * s'il faut interroger l'ERP ou les documents coûterait 400 ms et quelques centimes pour une
 * décision que des marqueurs de langue tranchent en une passe d'expressions régulières — et
 * ajouterait un point de panne réseau devant CHAQUE question posée à Adam.
 *
 * ── POURQUOI LE ROUTAGE EXISTE ───────────────────────────────────────────────────────────
 *
 * Sans lui, Adam interroge tout, à chaque fois. « Combien de dossiers en cours ? » déclenche une
 * recherche vectorielle sur quarante mille documents pour une réponse qu'un `COUNT` donne en
 * trois millisecondes. Le routage n'est pas une optimisation : c'est ce qui empêche une question
 * simple de coûter le prix d'une enquête.
 *
 * ── LES CINQ ROUTES, ET CE QUI LES SÉPARE ────────────────────────────────────────────────
 *
 *   ERP_ONLY          — l'ÉTAT ACTUEL. Un chiffre, un statut, un responsable, une date. La
 *                       réponse est dans une colonne ; un document ne pourrait que la contredire.
 *   RAG_ONLY          — le CONTENU d'un écrit. « Que disait le courrier de l'ANPP ? » L'ERP ne
 *                       sait pas ce qu'il y a DANS un PDF, seulement qu'il existe.
 *   ERP_AND_RAG       — le POURQUOI. Expliquer, vérifier, comparer, remonter une cause. Il faut
 *                       l'état ET les écrits, interrogés EN PARALLÈLE — l'un ne suffit jamais.
 *   GRAPH_AUGMENTED   — les RELATIONS. « Quels dossiers dépendent de ce fournisseur ? » La
 *                       réponse est dans les arêtes, pas dans les lignes ni dans les textes.
 *   AGENTIC_RESEARCH  — la vraie recherche ouverte. Rare, chère, et assumée comme telle.
 *
 * ── LE BIAIS ASSUMÉ ──────────────────────────────────────────────────────────────────────
 *
 * En cas d'égalité, on descend vers la route la moins chère qui reste PLAUSIBLE, jamais vers la
 * plus complète. Se tromper vers le bas coûte une seconde requête ; se tromper vers le haut coûte
 * une enquête complète sur une question à laquelle un `WHERE` répondait.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type KnowledgeRoute =
  | "ERP_ONLY"
  | "RAG_ONLY"
  | "ERP_AND_RAG"
  | "GRAPH_AUGMENTED"
  | "AGENTIC_RESEARCH";

export const KNOWLEDGE_ROUTES: readonly KnowledgeRoute[] = [
  "ERP_ONLY", "RAG_ONLY", "ERP_AND_RAG", "GRAPH_AUGMENTED", "AGENTIC_RESEARCH",
] as const;

/** Ce que la route AUTORISE à interroger. Le routage borne, il ne suggère pas. */
export interface RouteScope {
  /** Interroger les tables métier (statuts, montants, responsables, dates). */
  erp: boolean;
  /** Interroger la couche documentaire (texte, morceaux, vecteurs). */
  documents: boolean;
  /** Interroger le graphe d'entités et de relations. */
  graph: boolean;
  /** Autoriser une exploration multi-étapes pilotée par l'orchestrateur. */
  agentic: boolean;
  /** ERP et documents doivent-ils partir EN MÊME TEMPS ? §3 l'exige pour ERP_AND_RAG. */
  parallel: boolean;
}

export interface RouteDecision {
  route: KnowledgeRoute;
  scope: RouteScope;
  /** La raison LISIBLE — un routage qui ne s'explique pas ne se corrige pas. */
  why: string;
  /** Les marqueurs qui ont pesé. Sert au banc d'essai et au débogage, pas à l'utilisateur. */
  signals: string[];
  /** 0..1 — l'écart avec la deuxième route. Bas = question ambiguë, pas erreur de routage. */
  confidence: number;
}

const SCOPES: Record<KnowledgeRoute, RouteScope> = {
  ERP_ONLY: { erp: true, documents: false, graph: false, agentic: false, parallel: false },
  RAG_ONLY: { erp: false, documents: true, graph: false, agentic: false, parallel: false },
  ERP_AND_RAG: { erp: true, documents: true, graph: false, agentic: false, parallel: true },
  GRAPH_AUGMENTED: { erp: true, documents: true, graph: true, agentic: false, parallel: true },
  AGENTIC_RESEARCH: { erp: true, documents: true, graph: true, agentic: true, parallel: true },
};

/** Minuscules sans accents. Le repli est fait UNE fois : tout le reste travaille dessus. */
function fold(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * UN MARQUEUR : son motif, sa route, son poids, et son nom.
 *
 * Le NOM n'est pas décoratif — c'est lui qui apparaît dans `signals`, et c'est la seule façon de
 * comprendre, six mois plus tard, pourquoi une question a été routée ainsi. Un routeur muet est
 * un routeur qu'on finit par contourner.
 */
interface Marker {
  name: string;
  re: RegExp;
  route: KnowledgeRoute;
  weight: number;
  /**
   * Les marqueurs que celui-ci ÉTEINT quand il se déclenche.
   *
   * « Trouve pourquoi X ne marche pas » contient « pourquoi ». Sans cette relation, les deux
   * marqueurs comptent, s'égalisent, et le départage par le moins cher choisit ERP_AND_RAG —
   * alors que la formulation dit précisément qu'il faut chercher. Un marqueur spécifique n'est
   * pas un marqueur de plus : c'est une lecture PLUS PRÉCISE de la même phrase.
   */
  subsumes?: string[];
}

/**
 * LES MARQUEURS, PAR ROUTE.
 *
 * Ils portent sur la LANGUE de la question, jamais sur son sujet : « Regulatory » ne dit pas où
 * chercher, « quel est le statut de » si. Un routeur qui connaîtrait les noms de domaine serait
 * à réécrire au premier module ajouté.
 */
const MARKERS: Marker[] = [
  // ── ERP_ONLY — l'état actuel, un chiffre, une colonne ────────────────────────────────
  { name: "combien", re: /\bcombien\b/, route: "ERP_ONLY", weight: 3 },
  { name: "quel-statut", re: /\b(statut|etat|situation actuelle|ou en est|ou en sont)\b/, route: "ERP_ONLY", weight: 3 },
  { name: "qui-responsable", re: /\bqui (est|sont) (le |la |les )?(responsable|charge|en charge|titulaire)/, route: "ERP_ONLY", weight: 3 },
  { name: "liste", re: /\b(liste|listes?[- ]moi|donne[- ]moi la liste|affiche|montre[- ]moi)\b/, route: "ERP_ONLY", weight: 2 },
  { name: "total", re: /\b(total|montant|somme|solde|budget|reste|consomme|chiffre d affaires|ca\b)/, route: "ERP_ONLY", weight: 2 },
  { name: "compte", re: /\b(nombre de|combien de|effectif)\b/, route: "ERP_ONLY", weight: 3 },
  { name: "stock", re: /\b(stock|stocks|quantite|disponible|rupture)\b/, route: "ERP_ONLY", weight: 2 },
  { name: "echeance", re: /\b(echeance|deadline|date limite|expire|arrive a terme)\b/, route: "ERP_ONLY", weight: 2 },
  { name: "temps-present", re: /\b(aujourd hui|cette semaine|ce mois|en cours|actuellement|maintenant)\b/, route: "ERP_ONLY", weight: 2 },
  { name: "en-attente", re: /\b(en attente|a valider|a approuver|en retard|bloques?\b)/, route: "ERP_ONLY", weight: 2 },

  // ── RAG_ONLY — le contenu d'un écrit ────────────────────────────────────────────────
  { name: "que-disait", re: /\b(que dit|que disait|qu est ce que dit|selon le|d apres le|dans le)\b/, route: "RAG_ONLY", weight: 3 },
  { name: "type-document", re: /\b(contrat|courrier|lettre|proces verbal|compte rendu|procedure|note de service|convention|avenant|cahier des charges)\b/, route: "RAG_ONLY", weight: 2 },
  { name: "ecrit-dans", re: /\b(ecrit dans|figure dans|mentionne dans|il y avait quoi|dit quoi|parle t il de|parle t elle de)\b/, route: "RAG_ONLY", weight: 3 },
  { name: "support", re: /\b(pdf|document|fichier|piece jointe|annexe|rapport ecrit|le mail de|l email de)\b/, route: "RAG_ONLY", weight: 2 },
  { name: "clause", re: /\b(clause|article \d|paragraphe|mention|stipule|prevoit que|indique que)\b/, route: "RAG_ONLY", weight: 3 },
  { name: "citation", re: /\b(cite|extrait|passage|texte exact|mot pour mot)\b/, route: "RAG_ONLY", weight: 2 },
  { name: "resume-doc", re: /\bresume (le|la|ce|cette|moi le|moi la)\b/, route: "RAG_ONLY", weight: 2 },

  // ── ERP_AND_RAG — le pourquoi, la vérification, la comparaison ──────────────────────
  { name: "pourquoi", re: /\bpourquoi\b/, route: "ERP_AND_RAG", weight: 4 },
  { name: "explique", re: /\b(explique|expliquer|comment ca se fait|comment se fait il)\b/, route: "ERP_AND_RAG", weight: 3 },
  { name: "verifie", re: /\b(verifie|verifier|confirme|est ce (bien )?vrai|est ce exact|controle)\b/, route: "ERP_AND_RAG", weight: 3 },
  { name: "compare", re: /\b(compare|comparer|difference entre|ecart entre|par rapport a)\b/, route: "ERP_AND_RAG", weight: 3 },
  { name: "origine", re: /\b(d ou vient|origine du|origine de|cause de|a cause de|qui a decide)\b/, route: "ERP_AND_RAG", weight: 3 },
  { name: "contradiction", re: /\b(contradiction|incoherence|ne correspond pas|ne colle pas|ils collent|ca colle|divergence|correspondent)\b/, route: "ERP_AND_RAG", weight: 4 },
  { name: "historique", re: /\b(historique|evolution|depuis quand|s est passe|il s est passe quoi)\b/, route: "ERP_AND_RAG", weight: 2 },

  // ── GRAPH_AUGMENTED — les relations et dépendances ──────────────────────────────────
  { name: "lien-entre", re: /\b(lien entre|rapport entre|relation entre|liens? avec)\b/, route: "GRAPH_AUGMENTED", weight: 4 },
  { name: "depend", re: /\b(depend|dependent|dependance|impacte|impactes|touche par|concerne par)\b/, route: "GRAPH_AUGMENTED", weight: 3 },
  { name: "lies-a", re: /\b(lies? (a|au|aux)|liees? (a|au|aux)|rattaches? (a|au|aux)|associes? (a|au|aux))\b/, route: "GRAPH_AUGMENTED", weight: 3 },
  { name: "touche-quels", re: /\b(touche quels?|concerne quels?|affecte quels?|sur quels? (dossiers|projets|produits))\b/, route: "GRAPH_AUGMENTED", weight: 3 },
  { name: "tout-ce-qui", re: /\b(tout ce qui (touche|concerne)|tous les .{0,25} (lies|liees|rattaches))\b/, route: "GRAPH_AUGMENTED", weight: 3 },
  { name: "qui-travaille", re: /\bqui (travaille|intervient|est implique) (sur|dans)\b/, route: "GRAPH_AUGMENTED", weight: 3 },
  { name: "fournisseur-de", re: /\b(fournisseur (de|du|des)|fournit|approvisionne)\b/, route: "GRAPH_AUGMENTED", weight: 2 },
  { name: "ou-apparait", re: /\b(ou apparait|ou est cite|dans quels dossiers|dans quels documents)\b/, route: "GRAPH_AUGMENTED", weight: 3 },

  // ── AGENTIC_RESEARCH — la recherche réellement ouverte ──────────────────────────────
  { name: "analyse-tout", re: /\b(analyse (tout|toute|l ensemble|la situation)|fais le tour|passe en revue|audite|audit (complet|de))\b/, route: "AGENTIC_RESEARCH", weight: 4, subsumes: ["liste", "en-attente", "statut"] },
  { name: "trouve-pourquoi", re: /\b(trouve|cherche|identifie) pourquoi\b/, route: "AGENTIC_RESEARCH", weight: 4, subsumes: ["pourquoi"] },
  { name: "enquete", re: /\b(enquete|investigation|creuse|fouille|remonte (la piste|jusqu))\b/, route: "AGENTIC_RESEARCH", weight: 3 },
  { name: "ne-fonctionne-pas", re: /\b(ne (fonctionne|marche) pas|dysfonctionne|probleme (general|de fond)|qu est ce qui cloche)\b/, route: "AGENTIC_RESEARCH", weight: 3 },
  { name: "prepare-actions", re: /\b(prepare les actions|identifie .{0,30} et prepare|et propose (les|des) actions)\b/, route: "AGENTIC_RESEARCH", weight: 3 },
];

/**
 * L'ORDRE DE REPLI, du moins cher au plus cher.
 *
 * Il sert à départager une égalité. Descendre vers le moins cher est le bon biais : se tromper
 * vers le bas coûte une seconde requête, se tromper vers le haut coûte une enquête complète.
 */
const CHEAPNESS: KnowledgeRoute[] = ["ERP_ONLY", "RAG_ONLY", "ERP_AND_RAG", "GRAPH_AUGMENTED", "AGENTIC_RESEARCH"];

const WHY: Record<KnowledgeRoute, string> = {
  ERP_ONLY: "La réponse est un état courant : elle vit dans une colonne, pas dans un document.",
  RAG_ONLY: "La question porte sur le CONTENU d'un écrit — l'ERP sait qu'il existe, pas ce qu'il dit.",
  ERP_AND_RAG: "Expliquer ou vérifier demande l'état ET les écrits : les deux partent en même temps.",
  GRAPH_AUGMENTED: "La question porte sur des RELATIONS : la réponse est dans les arêtes du graphe.",
  AGENTIC_RESEARCH: "Recherche ouverte : le plan lui-même doit être découvert avant de pouvoir répondre.",
};

/**
 * ROUTE UNE QUESTION. Pur, synchrone, sans allocation notable — appelable devant chaque tour.
 *
 * Le repli par défaut est `ERP_ONLY` et non « tout interroger » : une question sans aucun
 * marqueur est presque toujours une demande d'état (« Regulatory ? », « Amine »), et lui répondre
 * par une enquête coûterait cher pour paraître confus.
 */
export function routeKnowledge(question_: string): RouteDecision {
  // Les MARQUEURS sont écrits en latin ; la normalisation ci-dessous les sert. Mais elle ne doit
  // pas faire disparaître la question elle-même : réduite à `[a-z0-9]`, une question en arabe
  // devenait VIDE, et le routeur répondait « rien à chercher » à un courrier de l'ANPP. On
  // normalise donc pour la reconnaissance des marqueurs, et on juge la vacuité sur le texte
  // d'origine, qui est le seul à savoir s'il y avait quelque chose à lire.
  const q = fold(question_).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const brut = fold(question_).replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();

  if (!brut) {
    return {
      route: "ERP_ONLY",
      scope: SCOPES.ERP_ONLY,
      why: "Question vide : rien à chercher.",
      signals: [],
      confidence: 0,
    };
  }

  // PREMIÈRE PASSE : quels marqueurs se déclenchent. On ne compte pas encore, parce qu'un
  // marqueur spécifique peut en éteindre un générique repéré plus haut dans la table.
  const fired = MARKERS.filter((m) => m.re.test(q));
  const muted = new Set<string>();
  for (const m of fired) for (const s of m.subsumes ?? []) muted.add(s);

  const scores = new Map<KnowledgeRoute, number>();
  const signals: string[] = [];
  for (const m of fired) {
    if (muted.has(m.name)) continue;
    scores.set(m.route, (scores.get(m.route) ?? 0) + m.weight);
    signals.push(m.name);
  }

  // ── LA RÈGLE DE COMPOSITION. Un « pourquoi » posé sur une question qui contient aussi des
  //    marqueurs d'état N'EST PAS une addition : c'est précisément le cas ERP_AND_RAG, et il
  //    faut que les deux présences le RENFORCENT au lieu de laisser ERP_ONLY gagner au volume.
  const erp = scores.get("ERP_ONLY") ?? 0;
  const rag = scores.get("RAG_ONLY") ?? 0;
  if (erp > 0 && rag > 0) {
    scores.set("ERP_AND_RAG", (scores.get("ERP_AND_RAG") ?? 0) + 2);
    signals.push("etat+ecrit");
  }

  if (scores.size === 0) {
    // ── AUCUN MARQUEUR. Deux situations très différentes se cachaient ici sous une seule règle.
    //
    // « Regulatory », « Amine », « budget 2026 » : un terme jeté dans la barre. C'est de la
    // NAVIGATION, la réponse est un état, et ouvrir les documents ne servirait à rien.
    //
    // « Quelle est la contre-indication rénale de la metformine ? » : une question entière, bien
    // formée, dont la réponse ne peut vivre que dans un écrit. Elle tombait dans le même trou.
    //
    // MESURÉ, PAS SUPPOSÉ. Le commentaire d'origine disait que la demande d'état est « la plus
    // fréquente » — une hypothèse jamais vérifiée. Sur les 25 questions à réponse connue du banc,
    // le routeur en a écarté 23 avant toute recherche, dont 17 dont la réponse était indexée au
    // rang #1 ou #2. L'absence de marqueur ne prouve rien ; la traiter comme une preuve coûtait
    // la réponse.
    //
    // CE QUE ÇA COÛTE, puisque c'est la seule objection sérieuse : une requête lexicale bornée
    // par l'index trigramme, mesurée à 5 ms de médiane sur le corpus d'essai. Aucun jeton, aucun
    // vecteur, aucun modèle — la doctrine interdit de payer un MODÈLE pour ce que le code sait
    // faire ; elle n'a jamais demandé d'économiser cinq millisecondes au prix de la bonne réponse.
    const interrogatif = /\b(quel|quelle|quels|quelles|comment|pourquoi|combien|qui|ou|quand|est ce que|y a t il|what|how|why|who|when|where|which)\b/.test(q);
    const motsPleins = brut.split(" ").filter((w) => w.length >= 3).length;
    // HORS DE L'ALPHABET LATIN, la table de marqueurs est AVEUGLE : elle est écrite en français
    // et en anglais. Une question en arabe ne déclenchera jamais rien, non parce qu'elle porte
    // sur un état, mais parce qu'on ne sait pas la lire. Conclure « c'est dans une colonne »
    // reviendrait à transformer notre propre angle mort en certitude sur la question de
    // quelqu'un d'autre. On ouvre donc les deux côtés, ce qui est la seule position honnête.
    const horsLatin = q.length === 0 && brut.length > 0;
    const question = (interrogatif || /\?|؟/.test(question_) || horsLatin) && motsPleins >= 3;

    return question
      ? {
        route: "ERP_AND_RAG",
        scope: SCOPES.ERP_AND_RAG,
        why: "Question entière sans marqueur : l'état et les écrits partent ensemble — rien ne dit que la réponse est dans une colonne.",
        signals: ["question-sans-marqueur"],
        confidence: 0.2,
      }
      : {
        route: "ERP_ONLY",
        scope: SCOPES.ERP_ONLY,
        why: "Aucun marqueur et pas de question formée : de la navigation, traitée comme une demande d'état, la moins chère.",
        signals: [],
        confidence: 0.2,
      };
  }

  const ranked = [...scores.entries()].sort(
    (a, b) => b[1] - a[1] || CHEAPNESS.indexOf(a[0]) - CHEAPNESS.indexOf(b[0]),
  );
  const [best, bestScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;

  return {
    route: best,
    scope: SCOPES[best],
    why: WHY[best],
    signals,
    // L'écart relatif, borné. Un écart nul veut dire « deux lectures possibles », ce qui est une
    // information utile à l'appelant — pas un échec du routeur.
    confidence: bestScore === 0 ? 0 : Math.min(1, (bestScore - secondScore) / bestScore + 0.35),
  };
}

/**
 * LE ROUTAGE PERMET-IL D'ÉVITER LA RECHERCHE DOCUMENTAIRE ?
 *
 * La question que l'appelant se pose vraiment, et celle qui fait l'économie : `true` signifie
 * qu'aucun octet de la couche documentaire ne sera lu pour répondre.
 */
export const skipsDocuments = (d: RouteDecision): boolean => !d.scope.documents;

/**
 * COMBIEN DE DOCUMENTS LA ROUTE AUTORISE À REMONTER.
 *
 * §4 : « ne jamais donner 100 documents à Terra quand 5 suffisent ». Le plafond dépend de la
 * route, parce qu'une question de contenu a besoin de moins de sources qu'une enquête ouverte —
 * et parce qu'un plafond unique serait forcément trop haut pour le cas le plus fréquent.
 */
export function documentBudget(route: KnowledgeRoute): number {
  switch (route) {
    case "ERP_ONLY": return 0;
    case "RAG_ONLY": return 5;
    case "ERP_AND_RAG": return 8;
    case "GRAPH_AUGMENTED": return 10;
    case "AGENTIC_RESEARCH": return 20;
  }
}
