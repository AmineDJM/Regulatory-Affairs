import type { ModelRole, ReasoningEffort } from "./contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BUDGET DE SORTIE — et pourquoi il ne se choisit pas au doigt mouillé.
 *
 * ── LE PIÈGE, EN UNE PHRASE ──────────────────────────────────────────────────────────────
 *
 * `max_output_tokens` NE PLAFONNE PAS LA RÉPONSE : il plafonne la réflexion PLUS la réponse.
 * Un modèle de raisonnement qui reçoit 1 400 peut en dépenser 1 400 à réfléchir, et rendre une
 * réponse VIDE avec `status: "incomplete"`. Le symptôme n'est pas « réponse tronquée », c'est
 * « pas de réponse » — et il se transforme deux couches plus loin en « JSON invalide » ou en
 * « Adam n'a rien répondu », sans que rien ne nomme la cause.
 *
 * ── POURQUOI CE FICHIER EXISTE MAINTENANT ────────────────────────────────────────────────
 *
 * Les budgets du produit ont été écrits quand le cerveau était Claude et que `max_tokens` voulait
 * dire « longueur de la réponse ». Ils sont donc calibrés sur la RÉPONSE VISIBLE, et ils sont
 * justes vus comme ça : 700 pour une lecture rapide, 1 400 pour un tour de boucle, 2 600 pour une
 * revue. Le cerveau a changé, le sens du nombre a changé, les nombres non — la boucle d'agent
 * tourne aujourd'hui avec 1 400 jetons TOTAUX sur un Terra `medium`.
 *
 * D'où la règle de ce module, et c'est la seule qu'il faut retenir :
 *
 *     `maxOutputTokens` demandé par un appelant = LA RÉPONSE VISIBLE qu'il veut.
 *     Le plafond réellement envoyé  = cette réponse  +  une RÉSERVE DE RAISONNEMENT.
 *
 * Un appelant n'a donc jamais à savoir combien un modèle réfléchit — c'est une propriété du
 * modèle et de l'effort demandé, pas de la question posée. Corollaire vérifié par un test : à
 * effort `none`, la réserve vaut zéro et TOUS les budgets existants restent inchangés au jeton
 * près. Les workers et le volume ne paient pas la note d'un problème qui n'est pas le leur.
 *
 * ── D'OÙ SORTENT LES CHIFFRES ────────────────────────────────────────────────────────────
 *
 * Les RÉPONSES VISIBLES sont relevées dans le dépôt, pas inventées : 350 (point du matin),
 * 500–700 (lectures rapides), 900–1 400 (boucle d'agent, critique, rédaction courte),
 * 2 600–3 200 (revue, audit, présentation), 4 000–4 096 (agents CTD), 8 000–16 000 (extraction
 * documentaire en volume). Le défaut par charge de travail se place dans cette échelle.
 *
 * Les RÉSERVES DE RAISONNEMENT, elles, ne sont pas mesurables sans clé : personne ici n'a encore
 * vu un `reasoning_tokens` réel. Elles reposent sur un seul point d'ancrage empirique, et il faut
 * le dire tel quel : le rattrapage « réponse vide » en production multipliait le budget par trois
 * depuis 2 000, donc ~6 000 suffisait aux cas qui s'en sortaient. `medium` hérite de ce 6 000 ;
 * le reste de l'échelle est une extrapolation assumée.
 *
 * C'EST EXACTEMENT POURQUOI LA MESURE EST BRANCHÉE EN MÊME TEMPS. Chaque appel journalise
 * `max_output_tokens`, `output_tokens`, `reasoning_tokens` et `incomplete_details` : au premier
 * jeu de données réel, ces constantes se corrigent sur des faits. `ADAM_REASONING_HEADROOM_SCALE`
 * permet de les ajuster sans redéploiement, le temps de trancher.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LA CHARGE DE TRAVAIL — quatre, parce qu'il y a quatre façons de dépenser un budget.
 *
 *   • `worker` — aucune réflexion (`effort: none`). Extraire, classer, normaliser. Le budget est
 *                la réponse, un point c'est tout. C'est le cas des rôles `worker` et `bulk`.
 *   • `simple` — le modèle réfléchit puis rédige, sans outil : synthèse, critique, arbitrage.
 *   • `loop`   — un tour de boucle d'agent outillée : réfléchir à QUOI appeler, puis appeler.
 *   • `deep`   — la mission qui doit DÉCOUVRIR : beaucoup d'outils décrits, donc beaucoup de
 *                réflexion rien que pour choisir, et une synthèse plus longue au bout.
 */
export type Workload = "worker" | "simple" | "loop" | "deep";

/**
 * LE SEUIL ENTRE UNE BOUCLE ET UNE DÉCOUVERTE — 30 outils décrits.
 *
 * Ce n'est pas un chiffre rond choisi ici : c'est `LEVEL_CAP.B` du résolveur d'outils
 * (`src/lib/assistant/context/tool-resolver.ts`), c'est-à-dire le plafond d'outils qu'un niveau B
 * peut recevoir. Au-delà, seul un niveau C est servi. Le nombre d'outils envoyés est donc le
 * témoin OBSERVABLE du niveau, et la couche modèle peut lire le niveau sans connaître le triage.
 *
 * La constante est RECOPIÉE plutôt qu'importée, volontairement : la couche modèle est en dessous
 * de la couche assistant et ne doit pas dépendre d'elle. Si le plafond du résolveur bouge, ce
 * seuil peut le suivre — ou pas ; ce sont deux décisions distinctes.
 */
const SEUIL_DECOUVERTE = 30;

/**
 * LA RÉSERVE DE RAISONNEMENT, par effort — des jetons qui ne serviront PAS à la réponse.
 *
 * `none` vaut zéro et doit rester à zéro : c'est ce qui garantit qu'aucun budget de worker ne
 * change. Seul `medium` a un appui empirique (voir l'en-tête) ; au-dessus, c'est une progression
 * assumée, à corriger dès les premières mesures de `reasoning_tokens`.
 */
const RESERVE_RAISONNEMENT: Record<ReasoningEffort, number> = {
  none: 0,
  low: 2_000,
  medium: 6_000,
  high: 12_000,
  xhigh: 20_000,
  max: 32_000,
};

/**
 * LA RÉPONSE VISIBLE PAR DÉFAUT, quand l'appelant n'en demande pas — relevée sur les usages du
 * dépôt. 2 000 est le défaut historique et il couvre la grande majorité des appels ; seule la
 * mission de découverte produit régulièrement plus long (les agents CTD comparables tournent
 * entre 3 200 et 4 096).
 */
const REPONSE_VISIBLE: Record<Workload, number> = {
  worker: 2_000,
  simple: 2_000,
  loop: 2_000,
  deep: 3_000,
};

/**
 * LE SUPPLÉMENT DE DÉCOUVERTE. Choisir parmi quarante outils décrits coûte de la réflexion avant
 * même de commencer à travailler — c'est le tour le plus cher en raisonnement de tout le produit,
 * et c'est précisément celui qu'on ne veut pas voir couper.
 */
const SUPPLEMENT_DECOUVERTE = 4_000;

/**
 * LE PLAFOND ABSOLU. Ce n'est pas une politique, c'est un garde-fou : une variable d'environnement
 * mal réglée ou un appelant qui demande 900 000 jetons de réponse doit échouer petit, pas
 * commander une facture. Aucun usage légitime du dépôt n'en approche.
 */
const PLAFOND = 64_000;

/** Le facteur de réglage, pour corriger la réserve sur mesures réelles sans redéployer. */
function facteur(): number {
  const brut = Number((process.env.ADAM_REASONING_HEADROOM_SCALE ?? "").trim());
  if (!Number.isFinite(brut) || brut <= 0) return 1;
  return Math.min(4, Math.max(0.25, brut));
}

export interface BudgetInput {
  role: ModelRole;
  effort: ReasoningEffort;
  /** Nombre d'outils DÉCRITS au modèle pour ce tour (0 = pas de boucle outillée). */
  toolCount: number;
  /** Ce que l'appelant demande comme RÉPONSE VISIBLE. Absent = le défaut de la charge. */
  requested?: number | null;
}

export interface OutputBudget {
  workload: Workload;
  /** La part destinée à ce que l'utilisateur lira. */
  visible: number;
  /** La part réservée à la réflexion interne — nulle à effort `none`. */
  headroom: number;
  /** La somme : le `max_output_tokens` réellement envoyé. */
  maxOutputTokens: number;
}

/**
 * QUELLE CHARGE DE TRAVAIL — à partir de faits que la passerelle connaît déjà, et d'eux seuls.
 *
 * On ne devine pas le niveau A/B/C : on lit l'effort et le nombre d'outils, qui sont les deux
 * traces observables de la décision prise plus haut. Une couche qui rejugerait le triage
 * réintroduirait l'erreur que `triage.ts` nomme explicitement — croire que compter des choses
 * définit la complexité.
 */
export function workloadOf(input: Pick<BudgetInput, "role" | "effort" | "toolCount">): Workload {
  if (input.effort === "none") return "worker";
  if (input.toolCount <= 0) return "simple";
  return input.toolCount > SEUIL_DECOUVERTE ? "deep" : "loop";
}

/**
 * LE BUDGET D'UN APPEL. Pure : aucune lecture de réseau, aucune dépendance — donc vérifiable au
 * jeton près, ce qui est le minimum pour un nombre dont dépend la présence même d'une réponse.
 */
export function outputBudget(input: BudgetInput): OutputBudget {
  const workload = workloadOf(input);

  const demande = Number(input.requested);
  const visible =
    Number.isFinite(demande) && demande > 0 ? Math.floor(demande) : REPONSE_VISIBLE[workload];

  const brut =
    RESERVE_RAISONNEMENT[input.effort] + (workload === "deep" ? SUPPLEMENT_DECOUVERTE : 0);
  const headroom = Math.round(brut * facteur());

  return {
    workload,
    visible: Math.min(visible, PLAFOND),
    headroom,
    maxOutputTokens: Math.min(visible + headroom, PLAFOND),
  };
}

/**
 * LE RATTRAPAGE, quand le budget calculé n'a MALGRÉ TOUT pas suffi.
 *
 * Il existe encore parce qu'une réponse vide chez l'utilisateur est pire qu'un appel payé deux
 * fois. Mais avec une politique explicite au-dessus, son déclenchement n'est plus une fatalité du
 * modèle : c'est le signe que la politique est mal calibrée. Il se journalise comme tel, et il ne
 * double qu'UNE fois — au-delà, masquer le problème empêcherait de le corriger.
 */
export function budgetDeSecours(courant: number): number {
  return Math.min(PLAFOND, Math.max(courant * 2, RESERVE_RAISONNEMENT.medium));
}

/** Exposé pour les tests et le rapport d'observabilité — pas pour être lu en chemin critique. */
export const BUDGET_POLICY = {
  RESERVE_RAISONNEMENT,
  REPONSE_VISIBLE,
  SUPPLEMENT_DECOUVERTE,
  SEUIL_DECOUVERTE,
  PLAFOND,
} as const;
