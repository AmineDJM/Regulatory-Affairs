import type { CapabilityMeta, Effect } from "@/lib/missions/registry/capability-meta";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES PORTS — ce que le Mission Runtime attend du monde, sans jamais le nommer.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────────────────
 *
 * Le moteur doit appeler des capacités. La tentation évidente est d'importer le registre
 * d'outils de l'assistant et d'en finir. Ce serait une erreur d'architecture à trois titres :
 *
 *   1. le runtime deviendrait un morceau d'Adam, alors qu'un cron, une route HTTP ou un webhook
 *      doivent pouvoir faire tourner une mission sans conversation ;
 *   2. tester le compilateur exigerait de charger cent soixante-cinq outils, donc la base, donc
 *      les fournisseurs — un test de forme aurait besoin d'un Postgres ;
 *   3. et surtout, le moteur pourrait alors s'octroyer une capacité. Ici il ne le peut pas : il
 *      ne connaît que ce que l'appelant lui a MIS dans le catalogue (§49).
 *
 * ── LE POINT DE SÉCURITÉ ─────────────────────────────────────────────────────────────────
 *
 * `allowed()` n'est pas une politesse : c'est le seul chemin par lequel une capacité entre dans
 * une mission. Une mission n'est pas une porte dérobée (§48) — elle passe par les mêmes droits
 * que l'écran, parce qu'elle passe littéralement par le même code.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * QUI AGIT.
 *
 * Deux identités, et il faut les DEUX. `initiatedBy` est l'humain qui a demandé ; `executedBy`
 * est celui sous les droits duquel le travail se fait. Les confondre rendrait l'audit muet sur
 * la question qui compte : « au nom de qui cet e-mail est-il parti ? » (§30)
 */
export interface MissionActor {
  /** L'identifiant de l'utilisateur ERP dont les droits s'appliquent. */
  userId: string;
  label: string;
  /** Vrai lorsque l'acteur est l'agent système (§29). Jamais un passe-droit : une CONTRAINTE. */
  isAgent: boolean;
}

/**
 * CE QUE LE PLANNER VOIT D'UNE CAPACITÉ — et rien de plus (§5).
 *
 * Pas de schéma d'entrée, pas de description longue : une ligne. Envoyer deux mille schémas
 * complets à un planificateur, c'est payer cent mille jetons pour lui faire relire un annuaire
 * dont il n'utilisera que six lignes. Le schéma complet arrive plus tard, à l'étape qui
 * appelle — quand on sait DE QUOI on parle.
 */
export interface CapabilityBrief {
  id: string;
  domain: string;
  effect: Effect;
  batchable: boolean;
  /** Une phrase, à l'impératif. « Envoie un e-mail préparé. » */
  summary: string;
}

/**
 * LE CATALOGUE — la source de vérité des capacités, vue du runtime.
 *
 * Il est SYNCHRONE à dessein. Le compilateur valide un plan de trois cents étapes ; s'il devait
 * attendre le réseau à chaque vérification, la compilation deviendrait elle-même une opération
 * asynchrone qu'il faudrait rendre reprenable. Le catalogue se construit une fois, en mémoire.
 */
export interface CapabilityCatalog {
  /** La capacité existe-t-elle ? Un `false` ici est un `UNKNOWN_CAPABILITY`. */
  has(name: string): boolean;
  /** L'acteur a-t-il le droit de l'appeler ? Un `false` est un `FORBIDDEN_CAPABILITY`. */
  allowed(name: string, actor: MissionActor): boolean;
  /** Les métadonnées d'exécution : effet, idempotence, groupabilité, latence, confirmation. */
  meta(name: string): CapabilityMeta;
  /**
   * LE SOUS-ENSEMBLE MONTRÉ AU PLANNER. Filtré par droit, puis par pertinence, puis borné.
   * C'est la mise en œuvre littérale de « ne lui envoie jamais deux mille capacités brutes ».
   */
  brief(actor: MissionActor, opts?: { domains?: readonly string[]; limit?: number }): CapabilityBrief[];
  /**
   * LE PLAFOND SOUS LEQUEL CE CATALOGUE A ÉTÉ CONSTRUIT — `null` quand il n'y en a pas.
   *
   * ── LE DÉFAUT MESURÉ QUI LE REND NÉCESSAIRE ────────────────────────────────────────────
   *
   * Sur un run réel, le plafond filtrait les CAPACITÉS montrées au planner — mais le planner ne
   * SAVAIT pas qu'un plafond existait. Il a donc proposé, en replanification, un nœud ARTIFACT
   * (qui ne porte aucune capacité) : le compilateur l'a refusé, correctement, et la mission est
   * morte BLOCKED sans jamais atteindre le juge. Deux appels de planification payés pour un
   * plan structurellement impossible.
   *
   * Le plafond doit VOYAGER AVEC le catalogue : celui qui reçoit la liste filtrée reçoit aussi
   * la raison du filtre — et peut restreindre son schéma et sa consigne en conséquence, au lieu
   * de laisser le modèle deviner puis échouer.
   */
  readonly plafondEffet?: Effect | null;
}

/**
 * L'EXÉCUTION D'UNE CAPACITÉ — le seul point par lequel une mission touche l'ERP.
 *
 * `idempotencyKey` n'est pas facultative pour une écriture : c'est elle qui fait qu'un crash à
 * l'étape 73 sur 127 ne renvoie pas les soixante-douze e-mails précédents (§15). Le runtime la
 * fabrique ; l'adaptateur la fait respecter par le chemin canonique qui existe déjà.
 */
export interface CapabilityCall {
  capability: string;
  input: Record<string, unknown>;
  actor: MissionActor;
  missionId: string;
  stepKey: string;
  idempotencyKey: string | null;
}

export interface CapabilityOutcome {
  ok: boolean;
  /** Le résultat, tel que la capacité le rend. Structuré, jamais du texte libre à re-parser. */
  output: unknown;
  /** Vrai si l'appel a été SERVI PAR LA CLÉ, sans refaire le travail. Compté, pas deviné. */
  deduplicated?: boolean;
  /**
   * LA CAPACITÉ A-T-ELLE RENDU UNE STRUCTURE, OU UNE PHRASE ?
   *
   * Un FAIT observé par l'exécutant — lui seul voit le texte brut avant de l'emballer — et non
   * une interprétation de son contenu. C'est ce fait qui permet à `result-contract.ts` de
   * refuser « Pièce introuvable ou sans fichier » comme résultat d'une lecture, sans jamais lire
   * la phrase ni y chercher un mot-clé.
   *
   * `undefined` signifie NON MESURÉ (§78 : jamais un zéro à la place d'une absence de mesure) —
   * le contrôle s'abstient alors, au lieu de le lire comme un `false` qui condamnerait à tort.
   */
  structured?: boolean;
  error?: { kind: string; message: string; retryable: boolean };
}

export interface CapabilityRunner {
  run(call: CapabilityCall): Promise<CapabilityOutcome>;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE REGISTRE DE RECOURS — ce qui rend « essaie ailleurs » exécutable au lieu de décoratif.
 *
 * ── LE DÉFAUT QU'IL FERME ────────────────────────────────────────────────────────────────
 *
 * `AUTRE_SOURCE` s'appliquait en écrivant `source: "LEGAL"` dans l'entrée de l'étape. Une
 * recherche exhaustive du dépôt a montré qu'AUCUNE capacité ne lit ce champ : le moteur
 * l'écrivait, personne ne le relisait, et la capacité repartait avec un appel identique. Le
 * premier barreau de six échelles sur neuf était un rejeu portant un nom de stratégie.
 *
 * « Chercher dans Legal » ne veut pas dire « rappeler `search_drive` avec une étiquette » : cela
 * veut dire APPELER UNE AUTRE CAPACITÉ, celle qui interroge ce grenier-là.
 *
 * ── POURQUOI UN PORT ─────────────────────────────────────────────────────────────────────
 *
 * Le runtime ne connaît ni les noms d'outils, ni leurs schémas, ni les droits. L'implémentation
 * vit du côté de la plateforme, là où le catalogue existe — et c'est elle qui garantit les deux
 * règles de sûreté : la capacité de remplacement est OUVERTE à l'acteur, et son effet ne dépasse
 * jamais celui de l'étape d'origine. Une mission n'est pas une porte dérobée, y compris quand
 * elle se rattrape.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface RegistreRecours {
  /**
   * L'appel qui interroge CE grenier pour la même recherche.
   *
   * `null` quand aucune capacité ne l'interroge, quand l'acteur n'y a pas droit, quand son
   * effet dépasserait celui de l'étape, ou quand l'appel obtenu serait identique au précédent.
   */
  autreSource(demande: {
    source: string;
    /** La capacité qui vient d'échouer — on ne la reproposera pas. */
    capaciteActuelle: string | null;
    entree: Record<string, unknown>;
    acteur: MissionActor;
    /** L'effet de l'étape d'origine : le remplacement ne peut pas aller au-delà. */
    effetMax: Effect;
  }): { capability: string; input: Record<string, unknown>; ceQuiChange: string } | null;
}

/**
 * L'HORLOGE — injectée, parce qu'un test d'attente de dix jours ne dure pas dix jours.
 *
 * Le runtime ne dit jamais `new Date()` : une mission qui attend un événement compare des
 * échéances, et une échéance non déterministe rend son test non déterministe.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RAISONNEUR — l'UNIQUE couture par laquelle le runtime parle à un modèle.
 *
 * ── POURQUOI UN SEUL PORT POUR CINQ USAGES ───────────────────────────────────────────────
 *
 * Le planificateur, les workers, le juge d'objectif, le contrôle qualité sémantique et le
 * compacteur de mémoire ont tous besoin de la même chose : « voici un contexte, rends-moi un
 * objet conforme à CE schéma ». En faire cinq ports aurait produit cinq interfaces à câbler,
 * cinq faux à écrire dans les tests, et cinq occasions d'en oublier un — c'est-à-dire
 * exactement le « moteur en pièces détachées » que la mission proscrit.
 *
 * La LOGIQUE de chacun (le prompt, le schéma, la validation, la réparation, le refus) vit dans
 * son module et s'exécute pour de vrai ; seule la traversée du réseau passe par ici.
 *
 * ── POURQUOI CE PORT PLUTÔT QU'UN IMPORT DE LA PASSERELLE ────────────────────────────────
 *
 * `src/lib/models/` est déclaré du côté d'ADAM par le cliquet de frontière (voir
 * `boundary-scan.ts` : « c'est littéralement son cerveau »). Le Mission Runtime, lui, est une
 * façade de l'ERP. L'importer créerait une dépendance ERP → Adam — le couplage INVERSE, celui
 * qu'aucun compteur ne regarde et qui rend Adam indéracinable.
 *
 * L'implémentation réelle vit donc dans `src/lib/assistant/missions/reasoner.ts`, du bon côté
 * de la frontière, et le composeur la fournit. Ce n'est PAS un port fantôme : elle existe, elle
 * appelle la vraie passerelle, et c'est elle qui tourne en production.
 *
 * ── CE QUE LE PORT GARANTIT, ET CE QU'IL NE GARANTIT PAS ─────────────────────────────────
 *
 * Il garantit que la réponse est du JSON CONFORME au schéma (sortie structurée stricte imposée
 * au fournisseur), ou `ok: false`. Il ne garantit pas que le contenu soit JUSTE — c'est le
 * travail du compilateur, du contrôle qualité et du juge, qui sont du code.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface ReasonRequest {
  /** Un rôle métier (`MissionModelRole`), jamais un nom de modèle (§4). */
  role: string;
  /** Nom du schéma, transmis au fournisseur et repris dans la trace. */
  schemaName: string;
  /** JSON Schema STRICT. Le fournisseur l'impose ; on ne re-parse pas de la prose. */
  schema: Record<string, unknown>;
  /** Consigne de cadrage. Jamais de secret, jamais de contenu confidentiel superflu. */
  system?: string;
  prompt: string;
  /** Borne haute de la réponse VISIBLE (la réflexion a son propre budget, côté passerelle). */
  maxOutputTokens?: number;
  /** À quoi sert cet appel — pour la télémétrie. Jamais le contenu, juste l'intention. */
  purpose: string;
}

export interface ReasonUsage {
  inputTokens: number;
  outputTokens: number;
  /** Le modèle réellement servi, tel que le fournisseur l'a rapporté. */
  model: string;
  /** Le coût EXACT de l'appel quand le tarif est connu ; `null` sinon — jamais zéro. */
  costUsd?: number | null;
  /**
   * LES JETONS DE RÉFLEXION, quand le fournisseur les distingue.
   *
   * Ils sont COMPTÉS DANS `outputTokens` mais n'apparaissent pas dans la réponse. Sans eux, un
   * plan à 6 563 jetons de sortie pour un JSON qui en pèse 2 500 est un mystère : on ne sait
   * pas s'il faut alléger le schéma ou revoir l'effort de réflexion. Un run réel a posé
   * exactement cette question, et il n'y avait pas de champ pour y répondre.
   *
   * `undefined` = le fournisseur ne les a pas distingués. Jamais zéro par défaut : zéro
   * signifierait « il n'a pas réfléchi », ce qui est une affirmation, pas une absence de mesure.
   */
  reasoningTokens?: number;
  /** Les jetons d'entrée servis depuis le cache du fournisseur — ils ne coûtent pas pareil. */
  cachedInputTokens?: number;
}

export interface ReasonResult<T> {
  ok: boolean;
  data: T | null;
  error?: string;
  /**
   * Ce que le fournisseur a réellement facturé. `null` = NON MESURÉ — jamais zéro, jamais une
   * estimation plausible (§78 : un tableau de bord qui affiche un chiffre inventé fait prendre
   * de vraies décisions sur des faux chiffres).
   */
  usage: ReasonUsage | null;
  latencyMs: number;
}

export interface Reasoner {
  /** Faux quand aucune clé de fournisseur n'est présente. Se DIT, ne se contourne pas. */
  configured(): boolean;
  reason<T>(req: ReasonRequest): Promise<ReasonResult<T>>;
}
