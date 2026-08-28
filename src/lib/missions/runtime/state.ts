/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA MACHINE À ÉTATS D'UNE MISSION — écrite, pas laissée au hasard des mises à jour.
 *
 * ── POURQUOI UNE TABLE DE TRANSITIONS PLUTÔT QUE DES `update` ÉPARPILLÉS ─────────────────
 *
 * Une mission longue traverse une douzaine d'états sur plusieurs jours, à travers un moteur,
 * un routeur d'événements, une approbation et un contrôleur qualité. Si chacun écrit
 * directement `status = …`, il devient impossible de savoir quelles séquences sont réellement
 * possibles — et l'on découvre en production qu'une mission ANNULÉE s'est remise à tourner
 * parce qu'un événement en retard l'a réveillée.
 *
 * La table ci-dessous rend cette question décidable. Elle est PURE : pas de base, pas de
 * réseau. Ce qui la rend testable exhaustivement, ce qui est le but.
 *
 * ── LES DEUX ÉTATS TERMINAUX ─────────────────────────────────────────────────────────────
 *
 * `COMPLETED` et `CANCELLED` n'ont AUCUNE sortie. `FAILED` en a — une mission échouée peut
 * être replanifiée ou reprise, et c'est tout l'objet du Recovery Engine (§74) : un échec de
 * méthode n'est pas un échec d'objectif.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les états d'une mission d'EXÉCUTION. Les états de coordination vivent à part, dans l'enum. */
export const MISSION_STATES = [
  "PLANNING",
  "READY",
  "AWAITING_APPROVAL",
  "RUNNING",
  "WAITING_EVENT",
  "WAITING_INPUT",
  "WAITING_DEPENDENCY",
  "RETRYING",
  "PARTIAL",
  "BLOCKED",
  "PAUSED",
  "FAILED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type MissionState = (typeof MISSION_STATES)[number];

/**
 * CE QUI PEUT SUIVRE QUOI.
 *
 * Trois principes lisibles dans la table :
 *
 *   1. On peut TOUJOURS annuler, sauf depuis un état terminal. Le PDG dit « arrête tout » et
 *      cela doit marcher, quel que soit l'endroit où la mission se trouve.
 *   2. Toute attente revient à `RUNNING`. Une attente n'est pas une fin — c'est une pause dont
 *      on connaît la condition de sortie.
 *   3. `COMPLETED` n'est atteignable QUE depuis `RUNNING` et `PARTIAL` — jamais depuis une
 *      attente, un blocage, une replanification ou un échec. C'est délibéré : la satisfaction
 *      de l'objectif se vérifie sur une mission qui a effectivement travaillé, jamais sur une
 *      mission arrêtée qu'on aurait décidé de considérer comme finie. `PARTIAL` y figure parce
 *      qu'une réparation peut combler le manque trouvé par le QA sans repasser par le moteur ;
 *      ce qui reste interdit, c'est de conclure depuis un état où RIEN n'a été tenté.
 *
 * ── LA PAUSE (§39-40), ET CE QU'ELLE N'EST PAS ───────────────────────────────────────────
 *
 * On entre en PAUSED depuis n'importe quel état vivant, y compris une attente : « arrête-toi »
 * doit marcher quel que soit l'endroit où la mission se trouve, exactement comme l'annulation.
 *
 * On en sort vers RUNNING ou CANCELLED, et vers RIEN d'autre. En particulier PAUSED → COMPLETED
 * n'existe pas : conclure une mission suspendue reviendrait à déclarer atteint un objectif dont
 * on a soi-même interrompu la vérification. La reprise repasse par le moteur, qui refera le
 * contrôle qualité et redemandera le juge — c'est plus long, et c'est le prix de l'honnêteté.
 *
 * La pause ne rend PAS une attente à l'état prêt : une mission suspendue pendant qu'elle
 * attendait un contrat repart en attendant toujours ce contrat. C'est une propriété des ÉTAPES,
 * que la pause ne touche pas — et c'est pourquoi la reprise n'a rien à reconstruire.
 */
export const MISSION_TRANSITIONS: Record<MissionState, readonly MissionState[]> = {
  PLANNING: ["READY", "AWAITING_APPROVAL", "BLOCKED", "PAUSED", "FAILED", "CANCELLED"],
  READY: ["RUNNING", "AWAITING_APPROVAL", "BLOCKED", "PAUSED", "CANCELLED"],
  AWAITING_APPROVAL: ["RUNNING", "READY", "BLOCKED", "PAUSED", "CANCELLED", "FAILED"],
  RUNNING: [
    "WAITING_EVENT", "WAITING_INPUT", "WAITING_DEPENDENCY", "AWAITING_APPROVAL",
    "RETRYING", "PARTIAL", "BLOCKED", "PAUSED", "FAILED", "COMPLETED", "PLANNING", "CANCELLED",
  ],
  WAITING_EVENT: ["RUNNING", "BLOCKED", "PAUSED", "FAILED", "CANCELLED"],
  WAITING_INPUT: ["RUNNING", "BLOCKED", "PAUSED", "FAILED", "CANCELLED"],
  WAITING_DEPENDENCY: ["RUNNING", "BLOCKED", "PAUSED", "FAILED", "CANCELLED"],
  RETRYING: ["RUNNING", "FAILED", "BLOCKED", "PAUSED", "CANCELLED"],
  // PARTIAL n'est pas une fin : le QA a trouvé un manque, le moteur va tenter de le réparer.
  PARTIAL: ["RUNNING", "PLANNING", "COMPLETED", "FAILED", "BLOCKED", "PAUSED", "CANCELLED"],
  BLOCKED: ["RUNNING", "PLANNING", "WAITING_INPUT", "PAUSED", "FAILED", "CANCELLED"],
  // LA PAUSE NE MÈNE QU'À REPRENDRE OU À ARRÊTER. Surtout pas à COMPLETED : voir l'en-tête.
  PAUSED: ["RUNNING", "CANCELLED"],
  // UN ÉCHEC N'EST PAS UNE FIN (§74). On peut replanifier, ou reprendre après correction.
  FAILED: ["PLANNING", "RUNNING", "PAUSED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Un état d'où l'on ne sort plus. Un événement en retard ne réveille jamais ces missions-là. */
export const TERMINAL_STATES: ReadonlySet<MissionState> = new Set(["COMPLETED", "CANCELLED"]);

/** Les états où la mission dort en attendant quelque chose d'extérieur. Aucun modèle consommé. */
export const WAITING_STATES: ReadonlySet<MissionState> = new Set([
  "WAITING_EVENT", "WAITING_INPUT", "WAITING_DEPENDENCY", "AWAITING_APPROVAL",
]);

export function canTransition(from: MissionState, to: MissionState): boolean {
  if (from === to) return true; // Réécrire le même état est un no-op, pas une faute.
  return (MISSION_TRANSITIONS[from] as readonly string[]).includes(to);
}

/**
 * LA TRANSITION, OU UNE ERREUR EXPLICITE.
 *
 * On lève plutôt que de rendre `false` : une transition impossible est un BUG du moteur, pas
 * une situation métier. La faire échouer silencieusement laisserait la mission dans un état
 * incohérent qu'on découvrirait trois jours plus tard, sans savoir qui l'y a mise.
 */
export function assertTransition(from: MissionState, to: MissionState): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `transition de mission impossible : ${from} → ${to}. `
      + `Depuis ${from}, seuls ${MISSION_TRANSITIONS[from].join(", ") || "(aucun)"} sont atteignables.`,
    );
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ÉTAT D'UNE ÉTAPE — plus simple, et c'est voulu.
 *
 * Une étape ne connaît ni approbation ni replan : elle est en attente de ses dépendances,
 * prête, en cours, terminée, échouée, ignorée ou annulée. Toute la richesse est au niveau de
 * la MISSION ; l'étape reste une unité de travail qu'on peut rejouer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const STEP_STATES = [
  "PENDING", "READY", "RUNNING", "WAITING", "DONE", "FAILED", "SKIPPED", "CANCELLED",
] as const;

export type StepState = (typeof STEP_STATES)[number];

export const STEP_TRANSITIONS: Record<StepState, readonly StepState[]> = {
  PENDING: ["READY", "SKIPPED", "CANCELLED"],
  READY: ["RUNNING", "WAITING", "SKIPPED", "CANCELLED"],
  // `SKIPPED` depuis `RUNNING` couvre l'étape qui DÉMARRE puis constate qu'elle n'a rien à
  // faire — un contrôle qualité sans contrôleur branché, par exemple. C'est distinct de `DONE` :
  // marquer « fait » un contrôle qui n'a pas eu lieu serait un mensonge de journal.
  RUNNING: ["DONE", "FAILED", "WAITING", "SKIPPED", "CANCELLED"],
  WAITING: ["READY", "RUNNING", "FAILED", "SKIPPED", "CANCELLED"],
  // UNE ÉTAPE ÉCHOUÉE PEUT REPARTIR — c'est le retry, et c'est ce qui rend le DAG robuste.
  FAILED: ["READY", "RUNNING", "SKIPPED", "CANCELLED"],
  // TERMINÉE, ELLE NE REPART JAMAIS. C'est l'invariant qui protège de la double exécution :
  // sans lui, un replan pourrait renvoyer un e-mail déjà parti.
  DONE: [],
  SKIPPED: [],
  CANCELLED: [],
};

export const STEP_TERMINAL: ReadonlySet<StepState> = new Set(["DONE", "SKIPPED", "CANCELLED"]);

export function canStepTransition(from: StepState, to: StepState): boolean {
  if (from === to) return true;
  return (STEP_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function assertStepTransition(from: StepState, to: StepState): void {
  if (!canStepTransition(from, to)) {
    throw new Error(
      `transition d'étape impossible : ${from} → ${to}. `
      + `Depuis ${from}, seuls ${STEP_TRANSITIONS[from].join(", ") || "(aucun)"} sont atteignables.`,
    );
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ÉTAT DE LA MISSION, DÉDUIT DE SES ÉTAPES.
 *
 * ── POURQUOI DÉDUIRE PLUTÔT QUE MAINTENIR ────────────────────────────────────────────────
 *
 * Maintenir l'état de la mission à chaque changement d'étape, c'est écrire la même vérité à
 * deux endroits — et les voir diverger le jour où un chemin d'erreur oublie de la mettre à
 * jour. Ici, l'état des étapes FAIT FOI et l'état de la mission s'en déduit. Il ne peut pas
 * mentir sur ce que fait réellement le DAG.
 *
 * ── LA RÈGLE QUI COMPTE : UNE BRANCHE BLOQUÉE NE BLOQUE PAS LA MISSION (§37) ─────────────
 *
 * Si une branche attend une approbation, une autre un événement, et qu'une troisième peut
 * tourner — la mission est RUNNING. C'est essentiel : bloquer l'ensemble parce qu'une branche
 * attend transformerait une mission de trois jours en mission de trois semaines.
 *
 * L'ordre des tests ci-dessous EST la priorité : ce qui tourne l'emporte sur ce qui attend,
 * et ce qui attend l'emporte sur ce qui a échoué.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface StepSnapshot {
  status: StepState;
  nodeType: string;
  attempt: number;
  maxAttempts: number;
  /**
   * LE PLAN COURANT NE PORTE PLUS CETTE ÉTAPE — voir `EtatEtape.contournee`.
   *
   * Optionnel pour une raison précise : les tests de forme de ce fichier décrivent des états de
   * DAG, pas des historiques de replan, et leur imposer ce champ les rendrait moins lisibles
   * pour satisfaire un type. Absent = l'étape compte, ce qui est le cas de l'immense majorité.
   */
  contournee?: boolean;
}

/**
 * CE QUI COMPTE ENCORE.
 *
 * Un run Render a montré le coût de l'absence de ce filtre : une étape en échec du plan v1,
 * qu'aucun plan suivant ne reprenait, maintenait la mission BLOCKED alors que le plan v2 avait
 * abouti — et le juge d'objectif n'était jamais atteint. Une obligation appartient au PLAN
 * COURANT ; ce qui l'a précédée est une pièce du dossier, pas une dette.
 */
export const compte = (s: StepSnapshot): boolean => s.contournee !== true;

export function deduireEtat(toutes: readonly StepSnapshot[]): MissionState {
  const steps = toutes.filter(compte);
  if (steps.length === 0) return "PLANNING";

  const par = (s: StepState) => steps.filter((x) => x.status === s).length;
  const enCours = par("RUNNING");
  const pret = par("READY");
  const attente = steps.filter((s) => s.status === "WAITING");
  const echoues = steps.filter((s) => s.status === "FAILED");
  const enAttentePlan = par("PENDING");
  const finis = par("DONE") + par("SKIPPED") + par("CANCELLED");

  // 1. QUELQUE CHOSE TOURNE OU PEUT TOURNER ⇒ la mission tourne. Une branche qui dort ailleurs
  //    ne change rien à ce fait, et c'est précisément §37.
  if (enCours > 0 || pret > 0) return "RUNNING";

  // 2. Un échec encore RÉPARABLE (il reste des tentatives) n'est pas un échec de mission.
  const reparables = echoues.filter((s) => s.attempt < s.maxAttempts);
  if (reparables.length > 0) return "RETRYING";

  // 3. RIEN NE TOURNE, MAIS ON ATTEND. Le type d'attente vient du nœud qui attend — une
  //    approbation ne se lit pas comme un événement, et les confondre ferait pousser une
  //    notification pour une attente que personne ne peut débloquer.
  if (attente.length > 0) {
    if (attente.some((s) => s.nodeType === "APPROVAL")) return "AWAITING_APPROVAL";
    if (attente.some((s) => s.nodeType === "WAIT_INPUT")) return "WAITING_INPUT";
    if (attente.some((s) => s.nodeType === "WAIT_EVENT")) return "WAITING_EVENT";
    // TOUTE AUTRE ATTENTE EST UNE ATTENTE DE DÉPENDANCE — typiquement un éventail déployé qui
    // attend ses trente-trois filles. La ranger dans « attente d'événement » ferait chercher un
    // événement qui n'existe pas, et pousserait une notification que personne ne peut résoudre.
    return "WAITING_DEPENDENCY";
  }

  // 4. Des étapes attendent leurs dépendances, mais aucune n'est prête : le DAG est coincé.
  //    C'est un BLOCAGE, pas une attente — personne ne viendra le débloquer tout seul.
  if (enAttentePlan > 0) return echoues.length > 0 ? "BLOCKED" : "WAITING_DEPENDENCY";

  // 5. Plus rien à faire. Reste à savoir si c'est fini ou fini À MOITIÉ.
  if (echoues.length > 0) return finis > 0 ? "PARTIAL" : "FAILED";

  // 6. Tout est terminé. La mission n'est PAS `COMPLETED` pour autant : la satisfaction de
  //    l'objectif est un contrôle À PART (§20), et c'est le moteur qui le déclenche. Rendre
  //    `RUNNING` ici est la réponse honnête — « il ne reste plus d'étapes », pas « c'est bon ».
  return "RUNNING";
}

/** Toutes les étapes sont-elles arrivées à un état terminal ? Le préalable à l'évaluation finale. */
export function toutTermine(toutes: readonly StepSnapshot[]): boolean {
  const steps = toutes.filter(compte);
  return steps.length > 0 && steps.every((s) => STEP_TERMINAL.has(s.status));
}
