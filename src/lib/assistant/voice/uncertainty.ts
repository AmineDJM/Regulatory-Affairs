/**
 * UN SON MAL ENTENDU NE DOIT JAMAIS DEVENIR UN GESTE IRRÉVERSIBLE.
 *
 * LA RÈGLE DE LA MISSION, mot pour mot : « Never transform uncertain audio into: delete /
 * payment / salary change / permission change / irreversible mutation. Reads can be much more
 * tolerant. »
 *
 * POURQUOI CE MODULE EXISTE SÉPARÉMENT DE LA VAD ET DU MODÈLE. À l'oral, la chaîne est longue —
 * micro, encodage, réseau, transcription, compréhension — et chaque maillon peut se tromper d'un
 * mot. « Envoie ça à Raihana » et « Efface ça, Raihana » ne diffèrent que d'un phonème. Le modèle
 * ne connaît pas la qualité du signal ; la VAD ne connaît pas la gravité de l'action. Seul un
 * point de passage qui voit LES DEUX peut décider — et c'est ici.
 *
 * L'ASYMÉTRIE EST TOTALE, et assumée :
 *
 *   • Une LECTURE mal comprise coûte une phrase (« non, je parlais de Nintedanib »). On tolère
 *     donc largement : un doute sur une lecture ne vaut pas la peine d'une question.
 *   • Une SUPPRESSION, un PAIEMENT, un CHANGEMENT DE SALAIRE ou DE DROITS mal compris ne se
 *     rattrape pas. On exige un signal franc, sinon on demande — en UNE question courte.
 *
 * CE MODULE NE BLOQUE PAS LES ACTIONS : il décide s'il faut CONFIRMER avant. Refuser serait un
 * assistant inutile ; exécuter dans le doute serait un assistant dangereux. La bonne réponse au
 * doute est une question, pas un mur — et c'est pour cela qu'elle doit être COURTE, sinon elle
 * devient elle-même le défaut qu'on cherchait à éviter.
 */

/** Ce que coûte une erreur — l'axe qui détermine l'exigence, et rien d'autre. */
export type ActionRisk =
  /** Consulter. Une erreur coûte une phrase. */
  | "READ"
  /** Créer, préparer, brouillonner. Une erreur se corrige avant l'envoi. */
  | "WRITE"
  /** Argent, droits, rémunération. Une erreur se répare, mais elle se voit. */
  | "SENSITIVE"
  /** Supprimer, expédier, payer. Une erreur ne se répare pas. */
  | "IRREVERSIBLE";

export const RISK_RANK: Record<ActionRisk, number> = { READ: 0, WRITE: 1, SENSITIVE: 2, IRREVERSIBLE: 3 };

/** Ce que la chaîne audio sait du tour — tout est optionnel : l'inconnu n'est pas le pire. */
export interface UncertaintySignal {
  transcript: string;
  /** Confiance du fournisseur, 0..1. `undefined` = non fournie, ce qui n'est PAS une faute. */
  confidence?: number;
  /** Crête du niveau d'entrée, 0..1. */
  inputPeak?: number;
  /** Le signal a-t-il écrêté ? Un micro saturé rend des mots faux avec assurance. */
  clipped?: boolean;
  /** Les autres hypothèses du fournisseur, quand il en donne : leur désaccord EST le doute. */
  alternatives?: string[];
  /** L'énoncé a-t-il été prononcé sur fond sonore identifié (haut-parleur, brouhaha) ? */
  noisy?: boolean;
}

export type UncertaintyDecision =
  | { decision: "PROCEED"; risk: ActionRisk }
  | { decision: "CLARIFY"; risk: ActionRisk; question: string; reason: string };

/**
 * LES OUTILS QUI NE PARDONNENT PAS. Nommés explicitement, jamais devinés par mot-clé : un
 * classement par heuristique se trompe dans le sens dangereux le jour où un outil est renommé.
 */
const IRREVERSIBLE_TOOLS = new Set([
  "delete_record", "destroy_record", "purge_trash",
  "send_prepared_mail", "send_email", "send_mail",
  "execute_payment", "pay_expense_order", "approve_payment",
]);

const SENSITIVE_TOOLS = new Set([
  "update_salary", "update_payroll_line", "set_employee_cost",
  "set_user_role", "set_user_active", "update_permissions", "grant_access", "revoke_access",
  "approve_leave", "reject_leave", "cancel_record",
  "create_expense_order", "create_payment_request",
]);

/** Les préfixes qui disent « je consulte » sans ambiguïté. */
const READ_PREFIXES = ["read_", "list_", "get_", "search_", "inspect_", "find_", "gmail_search", "directory_", "what_", "summarize_"];

/**
 * LE CLASSEMENT PAR DÉFAUT EST PRUDENT, et c'est délibéré : un outil inconnu de ce fichier est
 * traité comme une ÉCRITURE, pas comme une lecture. Se tromper dans ce sens coûte une question de
 * trop ; se tromper dans l'autre coûte une action non voulue.
 */
export function classifyRisk(toolName: string | null | undefined): ActionRisk {
  const name = (toolName ?? "").trim().toLowerCase();
  if (!name) return "READ"; // Pas d'outil = pas d'action : on parle, simplement.
  if (IRREVERSIBLE_TOOLS.has(name)) return "IRREVERSIBLE";
  if (SENSITIVE_TOOLS.has(name)) return "SENSITIVE";
  if (READ_PREFIXES.some((p) => name.startsWith(p))) return "READ";
  if (/^(delete|destroy|remove|purge|send|pay|transfer)_/.test(name)) return "IRREVERSIBLE";
  return "WRITE";
}

/** Le seuil de confiance exigé, par niveau de risque. */
const MIN_CONFIDENCE: Record<ActionRisk, number> = {
  READ: 0,        // On lit même sur un signal médiocre : au pire on relit.
  WRITE: 0.5,
  SENSITIVE: 0.75,
  IRREVERSIBLE: 0.8,
};

/** Les hypothèses concurrentes comptent-elles comme un désaccord réel, ou une variante d'écriture ? */
function alternativesDisagree(transcript: string, alternatives: string[] | undefined): boolean {
  if (!alternatives || alternatives.length === 0) return false;
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const base = norm(transcript);
  // « envoie le » vs « envoie-le » n'est pas un désaccord. « efface » vs « envoie » en est un.
  return alternatives.some((alt) => norm(alt) !== base);
}

/**
 * LA DÉCISION.
 *
 * Elle se lit dans un sens : plus le geste est grave, plus le signal doit être franc. Chaque
 * motif de doute produit une question COURTE et précise — « Je supprime le dossier Raltegravir,
 * c'est bien ça ? » — parce qu'une demande de confirmation vague (« vous êtes sûr ? ») n'apporte
 * aucune information : le PDG dira oui sans savoir à quoi.
 */
export function gateAction(
  toolNameOrRisk: string | ActionRisk | null | undefined,
  signal: UncertaintySignal,
  opts: { subject?: string | null } = {},
): UncertaintyDecision {
  const risk: ActionRisk = isRisk(toolNameOrRisk) ? toolNameOrRisk : classifyRisk(toolNameOrRisk);
  const said = (signal.transcript ?? "").trim();

  // Une LECTURE passe toujours, sauf s'il n'y a littéralement rien à interpréter.
  if (risk === "READ") {
    return said
      ? { decision: "PROCEED", risk }
      : { decision: "CLARIFY", risk, question: "Je n'ai pas saisi — vous disiez ?", reason: "transcription vide" };
  }

  if (!said) {
    return { decision: "CLARIFY", risk, question: "Je n'ai pas saisi — vous disiez ?", reason: "transcription vide" };
  }

  const doubts: string[] = [];
  const min = MIN_CONFIDENCE[risk];
  if (typeof signal.confidence === "number" && signal.confidence < min) {
    doubts.push(`confiance ${signal.confidence.toFixed(2)} < ${min}`);
  }
  // L'écrêtage ne dégrade pas la confiance annoncée par le fournisseur — il la rend MENSONGÈRE.
  // C'est pour cela qu'il compte comme un doute à part entière sur les gestes graves.
  if (signal.clipped && RISK_RANK[risk] >= RISK_RANK.SENSITIVE) doubts.push("signal saturé");
  if (RISK_RANK[risk] >= RISK_RANK.SENSITIVE && alternativesDisagree(said, signal.alternatives)) {
    doubts.push("hypothèses de transcription divergentes");
  }
  if (signal.noisy && risk === "IRREVERSIBLE") doubts.push("fond sonore");

  if (doubts.length === 0) return { decision: "PROCEED", risk };

  return {
    decision: "CLARIFY",
    risk,
    question: confirmationQuestion(risk, opts.subject ?? null, said),
    reason: doubts.join(", "),
  };
}

function isRisk(v: unknown): v is ActionRisk {
  return v === "READ" || v === "WRITE" || v === "SENSITIVE" || v === "IRREVERSIBLE";
}

/**
 * LA QUESTION QU'ON POSE — elle doit RÉPÉTER le geste, pas demander une bénédiction.
 *
 * « Vous confirmez ? » ne vérifie rien : le PDG confirme ce qu'il CROIT avoir dit. Reformuler
 * l'action et son objet est le seul moyen qu'un mot mal entendu apparaisse — c'est la
 * confirmation qui porte l'information, pas le oui.
 */
function confirmationQuestion(risk: ActionRisk, subject: string | null, said: string): string {
  const objet = subject?.trim() || said;
  if (risk === "IRREVERSIBLE") return `Je n'ai pas tout à fait saisi — vous parlez bien de « ${objet} » ? C'est définitif.`;
  if (risk === "SENSITIVE") return `Pour être sûr : « ${objet} » ?`;
  return `Vous parlez bien de « ${objet} » ?`;
}
