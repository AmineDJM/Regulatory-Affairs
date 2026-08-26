import {
  parsePhrase,
  relateIntents,
  COMPLEMENT_WEIGHT,
  DESTRUCTIVE_INTENTS,
  type Intent,
  type IntentRelation,
  type ParsedPhrase,
} from "./lexicon";

/**
 * LE RÉSOLVEUR — de la phrase du PDG au bouton de l'ERP.
 *
 * DÉTERMINISTE D'ABORD, et presque toujours. Le chemin courant est un score sur des jetons : pas
 * d'appel de modèle, pas de réseau, quelques dizaines de microsecondes. Un résolveur qui
 * demanderait l'avis d'un modèle à chaque phrase coûterait une seconde et rendrait la voix
 * inutilisable. Le repli approché n'est tenté QUE lorsque le chemin déterministe ne rend rien —
 * et il reste local, mesurable, sans réseau.
 *
 * LA RÈGLE QUI PRIME SUR LE RAPPEL. Une action manquée est un désagrément : le PDG reformule.
 * Une action DESTRUCTRICE proposée par ressemblance est inacceptable — « modifie le contrat »
 * ne doit jamais faire remonter « Supprimer définitivement ». Le seuil n'est donc pas le même
 * selon ce qui est en jeu, et pour l'irréversible on exige que le PDG ait DIT le verbe, en tête
 * de phrase, là où se porte un ordre.
 *
 * TROIS SIGNAUX, dans cet ordre d'importance :
 *   1. l'OBJET — « enveloppe », « congé », « en-tête » désignent un bouton ; « crée » n'en
 *      désigne aucun. Pondéré par sa rareté : un mot présent partout n'apprend rien.
 *   2. l'INTENTION — créer / modifier / supprimer / valider. L'opposition est rédhibitoire ;
 *      la simple différence ne l'est pas (voir `relateIntents`).
 *   3. le CONTEXTE — l'écran ouvert, le module en cours, l'action déjà proposée. Il départage,
 *      il ne décide pas.
 */

export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface ResolverCandidate<T> {
  action: T;
  score: number;
  confidence: Confidence;
  /** Ce qui a fait pencher : utile pour l'observabilité, et pour comprendre une erreur. */
  matchedObjects: string[];
  intentAgreement: IntentRelation;
}

export interface ResolverResult<T> {
  candidates: ResolverCandidate<T>[];
  /** Deux candidats de force comparable : on propose, on ne choisit pas à la place du PDG. */
  ambiguous: boolean;
  /** Pourquoi rien n'est rendu, quand rien n'est rendu. */
  reason?: "question" | "negated" | "no-object" | "below-threshold" | "destructive-guard";
  /** Le chemin emprunté — mesuré, pour pouvoir affirmer que le déterministe suffit. */
  path: "deterministic" | "fuzzy";
}

/** Ce que le résolveur a besoin de savoir d'une action, quelle que soit sa forme ailleurs. */
export interface ResolvableAction {
  id: string;
  module: string;
  aliases: string[];
  risk: "NORMAL" | "SENSITIVE" | "CRITICAL";
  /**
   * Le libellé du bouton tel qu'il s'affiche. C'est la phrase que le PDG A SOUS LES YEUX
   * quand il parle : l'indexer coûte une ligne et rattrape tout ce que les alias écrits à la
   * main ont oublié de prévoir.
   */
  uiLabel?: string;
}

export interface ResolverContext {
  /** Le module de l'écran ouvert — « Finances », « Regulatory »… Départage, ne décide pas. */
  screenModule?: string | null;
  /** L'entité déjà en discussion : sert les pronoms (« assigne-**le** à Raihana »). */
  activeEntityModule?: string | null;
  /**
   * L'action déjà proposée et non encore tranchée.
   *
   * Elle porte les reprises : « fais-le », « relance-la », « vas-y ». Elle donne une prime, et
   * peut à elle seule répondre d'une phrase SANS objet — jamais si le geste est irréversible :
   * un « vas-y » ne déclenche pas une suppression.
   */
  pendingActionId?: string | null;
  /** Les modules déjà cités dans la conversation : une prime faible, cumulable. */
  conversationModules?: string[] | null;
}

interface IndexedAlias<T> {
  action: T;
  meta: ResolvableAction;
  parsed: ParsedPhrase;
  /** Les jetons qui IDENTIFIENT cet alias (voir `selectors`), groupés par concept. */
  selectorGroups: string[][];
  /** L'alias n'a aucun objet : c'est son VERBE qui le nomme (« invite », « rappelle-moi »). */
  verbNamed: boolean;
  /** Poids total des sélecteurs de l'alias — le dénominateur de la similarité. */
  totalWeight: number;
}

/**
 * CE QUI IDENTIFIE une phrase : ses objets, ou à défaut ses verbes.
 *
 * Un alias comme « rappelle-moi » ou « invite » n'a aucun objet : le verbe EST le nom de
 * l'action. Sans ce repli, ces actions étaient indexées avec un poids nul et ne pouvaient jamais
 * remonter, quoi que dise le PDG. Le repli ne s'applique qu'en dernier ressort : dès qu'un objet
 * existe, c'est lui qui identifie, car « crée » traverse tout l'ERP.
 */
function selectorGroupsOf(parsed: ParsedPhrase): string[][] {
  return parsed.objects.length > 0 ? parsed.objectGroups : parsed.verbs.map((v) => [v]);
}

export interface ResolverIndex<T> {
  entries: IndexedAlias<T>[];
  idf: Map<string, number>;
  /** La rareté maximale du corpus — l'échelle des actions nommées par leur verbe. */
  maxIdf: number;
  /** Le vocabulaire connu : sert au repli approché, et à ignorer les noms propres. */
  vocabulary: string[];
}

/**
 * Construit l'index une fois pour toutes. La rareté (IDF) se calcule sur le corpus d'alias :
 * c'est lui qui dit que « dossier » est banal et « en-tete » distinctif.
 */
export function buildIndex<T>(actions: T[], describe: (a: T) => ResolvableAction): ResolverIndex<T> {
  const entries: IndexedAlias<T>[] = [];
  const df = new Map<string, number>();

  for (const action of actions) {
    const meta = describe(action);
    // Le libellé d'écran vaut un alias : c'est le français que l'utilisateur lit et reprend.
    const phrases = meta.uiLabel ? [...meta.aliases, meta.uiLabel] : meta.aliases;
    for (const alias of phrases) {
      const parsed = parsePhrase(alias);
      const groups = selectorGroupsOf(parsed);
      if (groups.length === 0) continue;
      entries.push({
        action, meta, parsed,
        selectorGroups: groups,
        verbNamed: parsed.objects.length === 0,
        totalWeight: 0,
      });
      for (const o of new Set(groups.flat())) df.set(o, (df.get(o) ?? 0) + 1);
    }
  }

  const n = Math.max(entries.length, 1);
  const idf = new Map<string, number>();
  let maxIdf = 1;
  for (const [token, freq] of df) {
    const v = Math.log(1 + n / (1 + freq));
    idf.set(token, v);
    if (v > maxIdf) maxIdf = v;
  }

  // Un concept ne compte qu'UNE fois, au poids de son écriture la plus distinctive.
  for (const e of entries) {
    e.totalWeight = e.selectorGroups.reduce(
      (s, g) => s + Math.max(...g.map((o) => idf.get(o) ?? 1)),
      0,
    );
  }
  return { entries, idf, maxIdf, vocabulary: [...idf.keys()] };
}

/** Les seuils. Séparés par niveau de risque : c'est là que vit la règle de sûreté. */
const THRESHOLD = {
  /** Similarité minimale pour qu'une action ordinaire soit proposée. */
  normal: 0.42,
  /** Une action SENSIBLE demande davantage : on ne touche pas au salaire par ressemblance. */
  sensitive: 0.55,
  /** Une action IRRÉVERSIBLE demande la quasi-certitude ET le verbe en tête. */
  critical: 0.7,
  /** Ce que le repli approché ajoute à l'exigence : il est moins sûr, il prouve davantage. */
  fuzzyPenalty: 0.12,
  /** En deçà de cet écart relatif, deux candidats sont jugés à égalité — donc ambigus. */
  ambiguityMargin: 0.12,
};

function thresholdFor(risk: ResolvableAction["risk"], intents: Set<Intent>): number {
  if (risk === "CRITICAL") return THRESHOLD.critical;
  if (risk === "SENSITIVE") return THRESHOLD.sensitive;
  // Une action ordinaire dont l'INTENTION est destructrice reste traitée comme telle : c'est
  // l'effet qui compte, pas l'étiquette posée dans le registre.
  for (const i of intents) if (DESTRUCTIVE_INTENTS.has(i)) return THRESHOLD.sensitive;
  return THRESHOLD.normal;
}

function confidenceOf(similarity: number, relation: IntentRelation, fuzzy: boolean): Confidence {
  if (fuzzy) return similarity >= 0.75 ? "LOW" : "NONE";
  if (similarity >= 0.8 && relation === "MATCH") return "HIGH";
  if (similarity >= 0.6 && (relation === "MATCH" || relation === "RELATED")) return "MEDIUM";
  if (similarity >= 0.42) return "LOW";
  return "NONE";
}

// ───────────────────────────── Rapprochement approché ─────────────────────────────

function trigrams(word: string): Set<string> {
  const padded = `  ${word} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i += 1) out.add(padded.slice(i, i + 3));
  return out;
}

/**
 * Deux mots désignent-ils PROBABLEMENT la même chose ?
 *
 * Pas de sémantique ici : de la forme. Une faute de frappe, une variante orthographique, une
 * dérivation que la radicalisation n'a pas rabotée. C'est délibérément grossier — c'est un
 * DERNIER recours, borné, et jamais autorisé sur un geste irréversible.
 */
function nearlyEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 4) return false;
  const min = Math.min(a.length, b.length);
  if (min >= 5 && (a.startsWith(b) || b.startsWith(a))) return true;
  if (min < 4) return false;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter) >= 0.55;
}

// ───────────────────────────── Résolution ─────────────────────────────

interface Pass<T> {
  candidates: ResolverCandidate<T>[];
  destructiveBlocked: boolean;
}

/**
 * Un vecteur de requête : chaque jeton porte le poids de SON CONCEPT et le numéro de celui-ci,
 * pour qu'un alias qui écrit « fichier » et « document » ne compte pas deux fois la même idée.
 */
interface QueryVector {
  vec: Map<string, { weight: number; group: number }>;
  weight: number;
}

function score<T>(
  index: ResolverIndex<T>,
  q: ParsedPhrase,
  objectVec: QueryVector,
  verbVec: QueryVector,
  ctx: ResolverContext,
  fuzzy: boolean,
): Pass<T> {
  const out = new Map<string, ResolverCandidate<T>>();
  let destructiveBlocked = false;

  for (const e of index.entries) {
    if (e.totalWeight <= 0) continue;

    // Une action NOMMÉE PAR SON VERBE (« invite », « rappelle-moi ») se compare aux verbes de
    // la demande, pas à ses objets — sinon rien ne peut jamais l'atteindre.
    const qv = e.verbNamed ? verbVec : objectVec;
    if (qv.weight <= 0) continue;

    // ── Similarité cosinus sur les objets, pondérés par la rareté ──
    // Le cosinus est SYMÉTRIQUE : il ne punit ni l'alias verbeux (« Nouvelle demande de congrès
    // national / international ») ni la phrase laconique (« crée un congrès »). La couverture
    // simple, elle, écartait le premier dès que le PDG ne récitait pas le libellé en entier.
    let matched = 0;
    const matchedObjects: string[] = [];
    const usedGroups = new Set<number>();
    for (const g of e.selectorGroups) {
      for (const o of g) {
        const hit = qv.vec.get(o);
        if (!hit || usedGroups.has(hit.group)) continue;
        usedGroups.add(hit.group);
        matched += hit.weight;
        matchedObjects.push(o);
        break;
      }
    }
    if (matchedObjects.length === 0) continue;

    // Pour une action nommée par son verbe, le cosinus vaudrait toujours 1 (un jeton contre un
    // jeton) et « crée » ouvrirait tout. Ce qui compte alors est la RARETÉ du verbe : « invite »
    // ne désigne qu'une chose, « crée » n'en désigne aucune.
    // Le facteur qui suit dit qu'un alias nommé par son verbe reste un indice PLUS FAIBLE qu'un
    // vrai objet : « invite quelqu'un à la réunion » doit atteindre « Inviter des participants »
    // et non « Créer un compte (lien d'invitation) », dont le seul nom est « invite ».
    const VERB_NAMED_DISCOUNT = 0.8;
    const similarity = e.verbNamed
      ? Math.min(1, Math.max(...matchedObjects.map((o) => index.idf.get(o) ?? 0)) / index.maxIdf) *
        VERB_NAMED_DISCOUNT
      : matched / Math.sqrt(e.totalWeight * qv.weight);

    // ── Accord d'intention ──
    const relation = relateIntents(q.intents, e.parsed.intents);
    // Une OPPOSITION est rédhibitoire : « modifie » ne doit jamais atteindre « supprime »,
    // même si tous les objets correspondent.
    if (relation === "OPPOSED") continue;

    // L'intention NIÉE d'un côté et présente de l'autre : même verdict.
    if ([...e.parsed.intents].some((i) => q.negatedIntents.has(i))) continue;

    // ── Le garde-fou destructeur ──
    // Une action irréversible n'est proposée que si le PDG a prononcé le geste LUI-MÊME, en
    // tête de phrase. « restaure ce fichier supprimé » contient « supprimé » ; il ne commande
    // rien de tel. « envoie un mail pour annuler la réunion » non plus.
    //
    // La règle vaut des DEUX côtés : l'alias « restaure le dossier supprimé » nomme un geste de
    // restauration, pas de suppression. Le juger sur son verbe de tête plutôt que sur tous ses
    // mots est ce qui l'a rendu de nouveau atteignable — sans rien relâcher sur « supprime… ».
    const aliasDestructive = [...e.parsed.headIntents].filter((i) => DESTRUCTIVE_INTENTS.has(i));
    const isDestructive = e.meta.risk === "CRITICAL" || aliasDestructive.length > 0;
    if (isDestructive) {
      const commanded = aliasDestructive.some((i) => q.headIntents.has(i));
      const criticalOk = e.meta.risk === "CRITICAL" && relation === "MATCH" && aliasDestructive.length === 0;
      if (!commanded && !criticalOk) {
        destructiveBlocked = true;
        continue;
      }
      // Le repli approché ne touche JAMAIS à l'irréversible : il devine, et on ne devine pas ici.
      if (fuzzy) {
        destructiveBlocked = true;
        continue;
      }
    }

    const min = thresholdFor(e.meta.risk, e.parsed.intents) + (fuzzy ? THRESHOLD.fuzzyPenalty : 0);
    if (similarity < min) {
      if (isDestructive) destructiveBlocked = true;
      continue;
    }

    // ── Le contexte départage, il ne décide pas : une petite prime, jamais un laissez-passer ──
    let s = similarity;
    if (relation === "MATCH") s += 0.15;
    else if (relation === "RELATED") s += 0.05;
    // Des intentions ÉTRANGÈRES l'une à l'autre — créer face à approuver — ne s'opposent pas,
    // mais elles ne se confirment pas non plus. Le prix doit être assez lourd pour qu'une
    // simple identité de mots ne l'emporte pas sur le geste demandé.
    else if (relation === "DIVERGENT") s -= 0.12;
    // Le MÊME VERBE des deux côtés est la meilleure corroboration qui soit : « mets ce fichier
    // à la corbeille » et le bouton « Mettre à la corbeille » disent le mot pour mot, là où
    // « sors ce fichier de la corbeille » partage les mêmes noms sans être le même geste.
    if (q.headVerbs.some((v) => e.parsed.headVerbs.includes(v))) s += 0.1;
    const mod = e.meta.module.toLowerCase();
    if (ctx.screenModule && mod.includes(ctx.screenModule.toLowerCase())) s += 0.08;
    else if (ctx.activeEntityModule && mod.includes(ctx.activeEntityModule.toLowerCase())) s += 0.05;
    else if (ctx.conversationModules?.some((m) => m && mod.includes(m.toLowerCase()))) s += 0.03;
    if (ctx.pendingActionId && e.meta.id === ctx.pendingActionId) s += 0.1;
    // Un alias plus spécifique (plus d'objets couverts) l'emporte à couverture égale.
    s += Math.min(matchedObjects.length, 4) * 0.01;
    if (fuzzy) s -= 0.1;

    const prev = out.get(e.meta.id);
    if (prev && prev.score >= s) continue;
    out.set(e.meta.id, {
      action: e.action,
      score: s,
      confidence: confidenceOf(similarity, relation, fuzzy),
      matchedObjects,
      intentAgreement: relation,
    });
  }

  return { candidates: [...out.values()], destructiveBlocked };
}

/**
 * RÉSOUT une demande.
 *
 * L'ordre des refus n'est pas indifférent : on écarte d'abord ce qui ne DOIT pas produire
 * d'action (une question, une négation), avant même de chercher — sinon « ne supprime surtout
 * pas ce dossier » irait chercher un bouton de suppression, et le trouverait.
 */
export function resolve<T>(
  index: ResolverIndex<T>,
  question: string,
  ctx: ResolverContext = {},
  limit = 2,
): ResolverResult<T> {
  const q = parsePhrase(question);

  // 1. Une QUESTION ne demande pas d'écriture — et un MOT interrogatif suffit à la trancher,
  //    quel que soit le verbe qui suit. « Qui a supprimé ce fichier ? » contient « supprimer »
  //    et ne demande rien ; sans cette règle, la question faisait remonter deux boutons de
  //    suppression. Le seul point d'interrogation, lui, ne suffit pas : « peux-tu créer une
  //    facture ? » demande bien quelque chose.
  if (q.hasQuestionWord || (q.isQuestion && q.intents.size === 0)) {
    return { candidates: [], ambiguous: false, reason: "question", path: "deterministic" };
  }
  // Une intention de LECTURE explicite ferme la porte de la même façon.
  if (q.intents.has("READ") && q.intents.size === 1) {
    return { candidates: [], ambiguous: false, reason: "question", path: "deterministic" };
  }
  // 2. Un CONSTAT n'est pas un ordre. « La facture de Kwality est arrivée ce matin » énumère les
  //    mots d'un bouton sans rien commander ; « le dossier Nintedanib avance bien » aussi.
  //    Un ordre français commence par son verbe — c'est ce que cette règle écoute.
  if (q.isStatement) {
    return { candidates: [], ambiguous: false, reason: "question", path: "deterministic" };
  }
  // 3. Tout ce qui était demandé a été NIÉ : on ne devine pas ce qui reste.
  if (q.intents.size === 0 && q.negatedIntents.size > 0) {
    return { candidates: [], ambiguous: false, reason: "negated", path: "deterministic" };
  }

  const qGroups = selectorGroupsOf(q);

  /**
   * LA REPRISE — « fais-le », « crée-le », « relance-la ».
   *
   * Une phrase sans objet ne peut désigner un bouton que si la conversation en tenait déjà un.
   * Et jamais s'il est irréversible : un « vas-y » ne déclenche pas une suppression. La
   * confiance rendue est FAIBLE, ce qui vaut proposition et non exécution.
   */
  const repriseDuContexte = (): ResolverResult<T> | null => {
    if (q.objects.length > 0 || q.intents.size === 0 || !ctx.pendingActionId) return null;
    const pending = index.entries.find((e) => e.meta.id === ctx.pendingActionId);
    if (!pending) return null;
    const destructive =
      pending.meta.risk === "CRITICAL" ||
      [...pending.parsed.intents].some((i) => DESTRUCTIVE_INTENTS.has(i));
    if (destructive) return null;
    const relation = relateIntents(q.intents, pending.parsed.intents);
    if (relation === "OPPOSED" || relation === "DIVERGENT") return null;
    return {
      candidates: [{
        action: pending.action,
        score: 0.5,
        confidence: "LOW",
        matchedObjects: [],
        intentAgreement: relation,
      }],
      ambiguous: false,
      path: "deterministic",
    };
  };

  if (qGroups.length === 0) {
    return (
      repriseDuContexte() ??
      { candidates: [], ambiguous: false, reason: "no-object", path: "deterministic" }
    );
  }

  // Les jetons que l'ERP n'a JAMAIS vus sont des ARGUMENTS, pas des sélecteurs : « Nintedanib »,
  // « Raihana », « Kwality » ne désignent aucun bouton et ne doivent pas diluer le score de
  // celui qu'ils accompagnent.
  // Ce qui ACCOMPAGNE pèse moins que ce qui est VISÉ : « crée une réunion avec l'équipe » crée
  // une réunion. Le premier résolveur les pesait à égalité et, « équipe » étant le mot le plus
  // rare de la phrase, proposait « Créer une équipe de vente ».
  const buildQueryVector = (groups: string[][], demote?: ReadonlySet<string>): QueryVector => {
    const vec = new Map<string, { weight: number; group: number }>();
    let weight = 0;
    let g = 0;
    for (const group of groups) {
      const known = group.filter((o) => index.idf.has(o));
      if (known.length === 0) continue;
      // Le concept vaut le poids de son écriture la plus distinctive — une seule fois.
      let w = Math.max(...known.map((o) => index.idf.get(o)!));
      if (known.some((o) => demote?.has(o))) w *= COMPLEMENT_WEIGHT;
      for (const o of known) vec.set(o, { weight: w, group: g });
      weight += w;
      g += 1;
    }
    return { vec, weight };
  };

  const objectVec = buildQueryVector(qGroups, q.complements);
  // « Rappelle-moi mardi de relancer Deepak » : tous les noms sont des ARGUMENTS (un jour, une
  // personne). Il reste le verbe — et « rappelle » suffit à désigner le bouton « Rappel ».
  // Seul le verbe de TÊTE est retenu : « relancer » est le contenu du rappel, pas l'ordre.
  const verbVec = buildQueryVector(q.headVerbs.map((v) => [v]));

  /**
   * Classe, puis applique la dernière règle de sûreté : un geste IRRÉVERSIBLE n'est proposé que
   * s'il arrive PREMIER.
   *
   * S'il n'arrive que second, c'est qu'une lecture NON destructrice de la phrase l'a emporté —
   * et énoncer le geste irréversible à côté suffit à ce qu'il soit choisi par erreur. Mesuré :
   * « annule la suppression du dossier » désignait bien « Restaurer », mais traînait « Annuler
   * le dossier » du matériel promotionnel en second.
   *
   * La règle ne joue QUE dans ce cas. Quand le premier candidat est lui-même irréversible, le
   * PDG a prononcé le geste sans ambiguïté : lui présenter les deux boutons qui l'exécutent est
   * une désambiguïsation, pas un piège — et la confirmation reste due.
   */
  const estDestructeur = (c: ResolverCandidate<T>) => {
    const e = index.entries.find((x) => x.action === c.action)!;
    return (
      e.meta.risk === "CRITICAL" || [...e.parsed.headIntents].some((x) => DESTRUCTIVE_INTENTS.has(x))
    );
  };
  const rank = (cands: ResolverCandidate<T>[]) => {
    const sorted = [...cands].sort((a, b) => b.score - a.score);
    // Une DÉLÉGATION n'a qu'une destination : la demande de tâche. Proposer un second bouton à
    // côté rouvre exactement la confusion que la règle métier ferme.
    if (q.isDelegation) return sorted.slice(0, 1);
    if (sorted.length === 0 || estDestructeur(sorted[0])) return sorted.slice(0, limit);
    return sorted.filter((c, i) => i === 0 || !estDestructeur(c)).slice(0, limit);
  };

  /**
   * LE REPLI APPROCHÉ — dernier recours, borné, jamais destructeur.
   *
   * Il n'existe que pour ce que le chemin exact ne peut pas rattraper : une faute de frappe, une
   * élision (« modifie l'enveloppe » écrit « lenveloppe »), une variante orthographique. Il
   * élargit les mots de la demande à ceux du vocabulaire qui leur RESSEMBLENT — par trigrammes,
   * localement, sans réseau ni modèle — puis rejoue exactement le même calcul, seuils relevés et
   * gestes irréversibles interdits. Le banc mesure combien de fois il sert : sur les 180 phrases
   * du corpus, jamais. C'est le résultat attendu — il est là pour le jour où.
   */
  const essaiApproche = (): ResolverResult<T> | null => {
    const widened = new Map(objectVec.vec);
    let widenedWeight = objectVec.weight;
    let nextGroup = qGroups.length;
    let grew = false;
    for (const o of qGroups.flat()) {
      if (objectVec.vec.has(o)) continue;
      for (const v of index.vocabulary) {
        if (widened.has(v)) continue;
        if (!nearlyEqual(o, v)) continue;
        const w = index.idf.get(v)!;
        widened.set(v, { weight: w, group: nextGroup });
        widenedWeight += w;
        nextGroup += 1;
        grew = true;
      }
    }
    if (!grew) return null;
    const loose = score(index, q, { vec: widened, weight: widenedWeight }, verbVec, ctx, true);
    if (loose.candidates.length === 0) return null;
    const ranked = rank(loose.candidates);
    return { candidates: ranked, ambiguous: ranked.length > 1, path: "fuzzy" };
  };

  // ── Chemin déterministe ──
  const strict =
    objectVec.weight > 0 || verbVec.weight > 0
      ? score(index, q, objectVec, verbVec, ctx, false)
      : { candidates: [] as ResolverCandidate<T>[], destructiveBlocked: false };
  if (strict.candidates.length > 0) {
    const ranked = rank(strict.candidates);
    const ambiguous =
      ranked.length > 1 && (ranked[0].score - ranked[1].score) / ranked[0].score < THRESHOLD.ambiguityMargin;
    return { candidates: ranked, ambiguous, path: "deterministic" };
  }

  // Rien de déterministe : c'est peut-être une reprise de la conversation.
  const reprise = repriseDuContexte();
  if (reprise) return reprise;

  const approche = essaiApproche();
  if (approche) return approche;

  return {
    candidates: [],
    ambiguous: false,
    reason: strict.destructiveBlocked ? "destructive-guard" : "below-threshold",
    path: "deterministic",
  };
}
