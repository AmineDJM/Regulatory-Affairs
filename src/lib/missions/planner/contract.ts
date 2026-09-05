/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LE PLANNER A LE DROIT DE PRODUIRE — et rien d'autre.
 *
 * ── LA RÈGLE FONDATRICE ──────────────────────────────────────────────────────────────────
 *
 * « Models decide WHAT. Code decides HOW. » Le planner propose un PLAN : des étapes nommées,
 * des dépendances, des capacités à appeler. Il ne produit ni code, ni SQL, ni requête, ni
 * schéma d'interface. Ce qu'il écrit passe ensuite par le Compiler, qui refuse tout ce qui
 * n'existe pas.
 *
 * ── POURQUOI CE FICHIER NE DÉPEND DE RIEN ────────────────────────────────────────────────
 *
 * Ce sont des types purs. Le planner (qui appelle un modèle), le compiler (qui valide), le
 * moteur (qui exécute) et les tests les partagent. S'il importait la base ou le registre, un
 * test de compilation aurait besoin d'une base pour vérifier une forme.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** La difficulté de RAISONNEMENT — indépendante de la quantité de travail (§1). */
export const COMPLEXITIES = ["A", "B", "C"] as const;
export type Complexity = (typeof COMPLEXITIES)[number];

/**
 * La quantité de TRAVAIL — indépendante de la difficulté.
 *
 * « Envoie le même message à 33 salariés » est B + MASSIVE : le plan est évident, l'exécution
 * est massive. Confondre les deux enverrait cette mission au planner le plus cher pour rien.
 */
export const SCALES = ["S", "M", "L", "XL", "MASSIVE"] as const;
export type Scale = (typeof SCALES)[number];

/** Le type de nœud du DAG. Tout n'est pas un appel de capacité. */
export const NODE_TYPES = [
  /** Un appel de capacité canonique — le cas courant. */
  "CAPABILITY",
  /** Un travail de MODÈLE : rédiger, résumer, classer. Rendu structuré, jamais du texte libre. */
  "WORKER",
  /** Une attente d'événement métier (§16) — la mission dort sans consommer de modèle. */
  "WAIT_EVENT",
  /** Une attente d'un HUMAIN qui doit fournir quelque chose (§79). */
  "WAIT_INPUT",
  /** Une porte d'approbation (§31). */
  "APPROVAL",
  /** Un contrôle de conformité (§22) — compte les reçus, vérifie les cardinalités. */
  "QA",
  /** La production d'un fichier (§23) : le modèle décrit, le code fabrique. */
  "ARTIFACT",
  /** Une jonction : ne fait rien, attend que ses dépendances soient toutes finies (fan-in). */
  "JOIN",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

/**
 * UNE ÉTAPE PROPOSÉE.
 *
 * `key` est l'identité STABLE de l'étape dans le plan — c'est elle que les dépendances
 * désignent, et c'est elle qui rend la compilation ré-entrante. Le planner doit la choisir
 * lisible (`email:employe-42`), pas la numéroter : une clé numérotée change au moindre replan
 * et casse toutes les dépendances.
 */
export interface PlannedStep {
  key: string;
  title: string;
  workstream?: string;
  nodeType?: NodeType;
  /** La capacité appelée. Obligatoire pour CAPABILITY, interdite ailleurs. */
  capability?: string;
  input?: Record<string, unknown>;
  /** Les clés des étapes qui doivent être TERMINÉES avant celle-ci. */
  dependsOn?: string[];
  /**
   * L'EXPANSION EN ÉVENTAIL (§10). Au lieu de trente-trois étapes écrites à la main, le planner
   * en écrit UNE et déclare sur quoi elle se déploie. C'est le compiler qui la démultiplie —
   * donc le nombre réel d'étapes ne dépend pas de la patience du modèle.
   */
  forEach?: {
    /** D'où vient la collection : la sortie d'une étape précédente, par sa clé. */
    from: string;
    /** Le chemin dans le résultat de cette étape (« employes »). */
    path: string;
    /** Le nom sous lequel chaque élément est injecté dans `input` (« employe »). */
    as: string;
  };
  /** Ce que l'étape attend, pour WAIT_EVENT / WAIT_INPUT. */
  waitFor?: {
    /** Le type d'événement métier attendu (« EMAIL_RECEIVED »). */
    event?: string;
    /** De qui — identifiant de personne, ou adresse. */
    from?: string;
    /** L'entité concernée, en « TYPE:id ». */
    entity?: string;
    /** Ce qu'on demande à l'humain, en français. Pour WAIT_INPUT uniquement. */
    ask?: string;
    /** Échéance indicative — au-delà, la mission propose une relance (§87). */
    withinDays?: number;
    /** RÉVEIL TEMPOREL — ISO 8601. L'attente se règle quand ce moment passe (WAIT_FOR_TIME). */
    until?: string;
    /** E-mail : le FIL exact (threadId) — toujours préféré aux heuristiques de texte. */
    threadId?: string;
    /** E-mail : fragment d'objet, insensible à la casse. */
    subject?: string;
    /** E-mail : pièce jointe EXIGÉE — `true`, ou un motif de nom (« contrat », « *.pdf »). */
    attachment?: true | string;
    /** Composition OU : réglée dès qu'une branche l'est. Une branche = les mêmes champs, à plat. */
    anyOf?: { event?: string; from?: string; entity?: string; until?: string; threadId?: string; subject?: string; attachment?: true | string }[];
    /** Composition ET : réglée quand toutes les branches le sont (progression persistée en base). */
    allOf?: { event?: string; from?: string; entity?: string; until?: string; threadId?: string; subject?: string; attachment?: true | string }[];
  };
  /** Le rôle de modèle demandé pour un WORKER. Jamais un nom de modèle (§11). */
  modelRole?: "cheap" | "standard" | "strong";
  maxAttempts?: number;

  /**
   * ── CE QUE LE PLANNER RÉEL AJOUTE (§2) ────────────────────────────────────────────────
   *
   * Les champs ci-dessous sont OPTIONNELS parce que le compilateur sait s'en passer : ils
   * enrichissent l'exécution, ils ne la conditionnent pas. Les rendre obligatoires aurait
   * cassé les plans écrits à la main dans les tests de forme du compilateur — lesquels
   * doivent continuer à tester le compilateur, pas la richesse du planner.
   */

  /**
   * CE QU'UN WORKER DOIT RENDRE. Un JSON Schema, imposé au fournisseur (sortie structurée
   * stricte). Sans lui, un WORKER rend de la prose et l'étape suivante doit la deviner.
   */
  expectedOutputSchema?: Record<string, unknown>;
  /**
   * À QUELLE CONDITION CETTE ÉTAPE EST FINIE — en français, vérifiable.
   *
   * Ce n'est pas une consigne au modèle : c'est ce que le contrôle qualité et le juge liront.
   * « Le fichier existe et porte 33 lignes » se vérifie ; « le travail est bien fait » non.
   */
  completionCondition?: string;
  /** L'effet ATTENDU par le planner. Le registre reste l'autorité — voir `compile.ts`. */
  effectClass?: string;
  /** La réflexion que cette étape demande, pour choisir le rôle de modèle (§4). */
  reasoningRequirement?: "NONE" | "LIGHT" | "HEAVY";
  retryPolicy?: {
    maxAttempts?: number;
    /** Attente entre deux essais, en secondes. Bornée par le moteur. */
    backoffSeconds?: number;
  };
  /** Le planner PROPOSE une approbation ; la politique en décide (§31). */
  approvalRequirement?: "NONE" | "NORMAL" | "SENSITIVE" | "CRITICAL";
  /**
   * L'ÉTAPE CONDITIONNELLE — la branche « sinon » d'une attente, la garde d'un seuil.
   *
   * « Si Sarah n'a pas répondu avant vendredi, relance-la ; si elle a répondu, remercie-la »
   * s'écrit : une attente `anyOf [sa réponse | vendredi]`, puis DEUX étapes qui en dépendent,
   * l'une `when { step, outcome: "TIMEOUT" }`, l'autre `when { step, outcome: "EVENT" }`.
   * « Si le prix dépasse 5 000, demande validation » : `when { step: "lire-prix", path: "prix",
   * op: "gt", value: "5000" }` sur l'étape d'approbation. Une condition non remplie IGNORE
   * l'étape (SKIPPED) : la suite continue, le contrôle qualité ne la compte pas en manque.
   */
  when?: StepCondition;
}

/** L'issue d'une étape amont qu'une condition peut attendre. */
export const ISSUES_CONDITION = ["EVENT", "TIMEOUT", "DONE", "FAILED", "SKIPPED"] as const;
export type IssueCondition = (typeof ISSUES_CONDITION)[number];
/** Les opérateurs d'un test sur la sortie d'une étape amont. */
export const OPERATEURS_CONDITION = ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "exists", "empty"] as const;
export type OperateurCondition = (typeof OPERATEURS_CONDITION)[number];

export interface StepCondition {
  /** L'étape amont observée. Le compilateur en fait une dépendance implicite. */
  step: string;
  /**
   * L'issue attendue : EVENT (une attente réglée par un FAIT), TIMEOUT (réglée par le TEMPS),
   * DONE, FAILED, SKIPPED. Absente : seule la sortie est testée.
   */
  outcome?: IssueCondition;
  /** Un champ de la sortie de l'étape amont (« prix », « payload.montant », « items.0.statut »). */
  path?: string;
  op?: OperateurCondition;
  /** La valeur de comparaison, toujours en texte ; nombre reconnu quand les deux côtés en sont. */
  value?: string;
}

/** Un axe de travail : le regroupement lisible des étapes (§2). */
export interface PlannedWorkstream {
  id: string;
  title: string;
  /** Ce que cet axe doit produire, en une phrase. */
  outcome?: string;
}

/** Un livrable attendu (§2 / §20) — le fichier qui prouve que la mission a produit quelque chose. */
export interface PlannedArtifact {
  key: string;
  /** XLSX, DOCX, PDF, PPTX, CSV, ZIP — validé par le moteur d'artefacts, pas ici. */
  format: string;
  title: string;
  /** L'étape qui le produit. */
  fromStep?: string;
}

/** La stratégie d'accord : un accord pour un lot cohérent, jamais quatre-vingt-dix-neuf (§32). */
export const APPROVAL_STRATEGIES = [
  /** Aucune approbation : la mission ne produit aucun effet externe. */
  "NONE",
  /** Un accord unique, portant sur un périmètre résumé et figé par empreinte. */
  "BUNDLE",
  /** Un accord par classe d'effet — les envois d'un côté, les écritures financières de l'autre. */
  "PER_EFFECT_CLASS",
  /** Un accord par étape. Réservé aux effets irréversibles isolés. */
  "PER_STEP",
] as const;
export type ApprovalStrategy = (typeof APPROVAL_STRATEGIES)[number];

/**
 * LE PLAN, TEL QUE LE PLANNER LE REND.
 *
 * `acceptance` n'est pas décoratif : c'est ce que le Goal Satisfaction Evaluator vérifiera
 * avant de déclarer la mission terminée (§20). Un plan sans critères d'acceptation produit une
 * mission qui se déclare finie parce qu'elle a fini de tourner — ce qui n'est pas la question.
 */
export interface MissionPlan {
  objective: string;
  acceptance: string[];
  complexity: Complexity;
  scale: Scale;
  steps: PlannedStep[];
  /**
   * ── LA CARTE DU PLAN (§2) ─────────────────────────────────────────────────────────────
   *
   * Optionnels, et pour une raison précise : le compilateur n'en a pas besoin pour valider une
   * forme. Les rendre obligatoires aurait forcé chaque plan écrit à la main dans les tests de
   * COMPILATION à porter quatre champs sans rapport avec ce qu'ils testent — c'est-à-dire à
   * rendre les tests moins lisibles pour satisfaire un type.
   *
   * Ils ne sont pas décoratifs pour autant : `expectedArtifacts` est ce que le contrôle qualité
   * exige de trouver en base, et `completionCriteria` est ce que le juge lit.
   */
  workstreams?: PlannedWorkstream[];
  expectedArtifacts?: PlannedArtifact[];
  approvalStrategy?: ApprovalStrategy;
  /** La règle ARITHMÉTIQUE de fin : ce qu'il faut compter, et à quoi le comparer. */
  completionCriteria?: string;
  /** Ce que le planner n'a PAS su faire avec les capacités disponibles (§6). */
  gaps?: string[];
  /** Pourquoi ce plan, en deux phrases. Sert à la relecture humaine, pas à l'exécution. */
  rationale?: string;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LE COMPILER PEUT REFUSER — et le dire précisément.
 *
 * Un plan refusé sans raison est inexploitable : ni le planner ne peut se corriger, ni
 * l'humain ne peut comprendre. Chaque refus nomme donc l'étape et la règle violée.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const COMPILE_ERRORS = [
  /** La capacité nommée n'existe pas au registre. Le planner ne peut pas inventer un outil. */
  "UNKNOWN_CAPABILITY",
  /** L'appelant n'a pas le droit d'appeler cette capacité. */
  "FORBIDDEN_CAPABILITY",
  /**
   * L'ÉTAPE PRODUIT PLUS QUE LE PLAFOND DE LA MISSION.
   *
   * Distinct de `FORBIDDEN_CAPABILITY` parce que la cause l'est : là, une capacité n'est pas
   * ouverte à l'acteur ; ici, l'étape produit un effet trop fort — et elle peut le faire SANS
   * capacité, comme un nœud ARTIFACT qui fabrique un fichier. Un run Render a montré cette
   * porte ouverte pendant que le rapport annonçait « lecture seule ».
   */
  "FORBIDDEN_EFFECT",
  /** Une dépendance désigne une clé d'étape qui n'existe pas. */
  "UNKNOWN_DEPENDENCY",
  /** Deux étapes portent la même clé. */
  "DUPLICATE_KEY",
  /** Le graphe contient un cycle — il ne peut pas s'exécuter. */
  "CYCLE",
  /** Un champ obligatoire manque, ou un champ interdit est présent pour ce type de nœud. */
  "INVALID_SHAPE",
  /** Une expansion en éventail désigne une étape source inexistante, ou qui n'est pas en amont. */
  "UNKNOWN_FANOUT_SOURCE",
  /** L'éventail porte sur une capacité qui ne sait pas se répéter (§7 `batchable`). */
  "NOT_BATCHABLE",
  /**
   * LA CARDINALITÉ EST FAUSSE (§26).
   *
   * Le cas exact que la mission nomme : « n'envoie jamais un mail groupé en copie à tout le
   * monde par erreur ». Trente-trois messages individuels et un message à trente-trois
   * destinataires se ressemblent dans un plan, et ne se ressemblent pas du tout dans une boîte
   * de réception. Le compilateur tranche AVANT l'envoi, pas après.
   */
  "CARDINALITY",
  /** Le plan dépasse une limite OPÉRATIONNELLE (pas architecturale). */
  "LIMIT_EXCEEDED",
  /**
   * L'ENTRÉE NE CORRESPOND PAS AU CONTRAT DE LA CAPACITÉ.
   *
   * Une clé que l'outil ne lit pas, une clé exigée absente, une valeur hors énumération, ou une
   * référence `{{etape.chemin}}` vers une étape qui n'existe pas. Mesuré sur le banc : sept
   * échecs d'exécution sur onze venaient de là, et tous auraient été refusés ici pour le prix
   * d'un message précis — au lieu d'un accord du dirigeant suivi d'une replanification.
   */
  "INVALID_INPUT",
] as const;
export type CompileError = (typeof COMPILE_ERRORS)[number];

export interface CompileIssue {
  code: CompileError;
  stepKey: string | null;
  message: string;
}

/**
 * LES LIMITES OPÉRATIONNELLES — et pourquoi ce ne sont PAS des limites d'architecture (§4).
 *
 * Le DAG supporte trois mille étapes ; ces chiffres bornent ce qu'on accepte de COMPILER en
 * une fois, pour que le planner ne produise pas un plan que personne ne peut relire. Une
 * mission plus grande se découpe en sous-missions — même runtime, même moteur.
 */
export const PLAN_LIMITS = {
  /** Étapes écrites À LA MAIN par le planner. L'éventail, lui, n'est pas concerné. */
  plannedSteps: 200,
  /** Étapes APRÈS expansion. Trois mille tiennent ; au-delà, on veut une sous-mission. */
  compiledSteps: 3000,
  /** Profondeur du graphe — une chaîne de cent étapes est presque toujours une erreur de plan. */
  depth: 60,
  /** Dépendances par étape. */
  depsPerStep: 20,
} as const;
