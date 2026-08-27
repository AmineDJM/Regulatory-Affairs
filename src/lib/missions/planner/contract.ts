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
  };
  /** Le rôle de modèle demandé pour un WORKER. Jamais un nom de modèle (§11). */
  modelRole?: "cheap" | "standard" | "strong";
  maxAttempts?: number;
}

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
