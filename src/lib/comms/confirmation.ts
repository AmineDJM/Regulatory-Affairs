/**
 * « JE CONFIRME. » — reconnaître un ACCORD, et rien d'autre.
 *
 * LE BOGUE QUE CE MODULE EXISTE POUR FERMER. Adam préparait un message, demandait « Tu confirmes
 * l'envoi ? », le PDG répondait « Je confirme. » — et Adam répondait « Je prépare le mail
 * maintenant », puis affichait une carte d'approbation. Le PDG confirmait DEUX fois le même
 * envoi : une fois en français, une fois au clic. Une confirmation qui ne conclut rien apprend au
 * PDG que ses confirmations ne comptent pas ; le jour où l'une comptera vraiment, il ne la lira
 * plus.
 *
 * La cause n'était pas le modèle : c'était qu'aucune couche du serveur ne RATTACHAIT « je
 * confirme » à l'intention d'envoi en attente. Ce module rend ce rattachement possible en
 * décidant, de façon PURE et testable, si un message est un accord sans réserve.
 *
 * LA PRUDENCE EST ASYMÉTRIQUE, et le code doit l'être aussi. Prendre « oui » pour un refus ne
 * coûte qu'une question de plus. Prendre « oui mais change l'objet » pour un accord expédie le
 * mauvais message — et un message parti ne se rattrape pas. D'où la règle : on ne conclut à un
 * ACCORD que si la phrase ENTIÈRE est un accord. Un seul mot porteur de sens en plus (un nom, un
 * destinataire, une réserve) et l'on rend la main au modèle.
 */

export type ReplyIntent = "CONFIRM" | "REJECT" | "OTHER";

const stripAccents = (s: string): string => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Mots-outils sans portée : ils n'ajoutent aucune réserve, donc ils ne disqualifient rien. */
const FILLERS = new Set([
  "adam", "stp", "svp", "s", "il", "te", "vous", "plait", "plais", "merci", "bien", "tres",
  "le", "la", "les", "ce", "cet", "cette", "ca", "cela", "y", "en", "l", "d", "j", "c", "est",
  "de", "du", "je", "tu", "mail", "mails", "email", "emails", "courriel", "message", "envoi",
  "tout", "alors", "donc", "et", "puis", "maintenant", "suite", "meme",
]);

/**
 * Les façons de dire OUI. Pas d'article indéfini ici, et c'est délibéré : « envoie LE mail »
 * désigne quelque chose de déjà posé sur la table, « envoie UN mail » ouvre une demande neuve.
 * L'article porte à lui seul la différence entre confirmer et commander.
 */
const CONFIRM = new Set([
  "oui", "ouais", "yes", "ok", "okay", "dac", "daccord", "accord", "confirme", "confirmee",
  "confirmation", "confirmes", "valide", "validee", "approuve", "approuvee", "parfait",
  "vas", "allez", "go", "envoie", "envoies", "envoyer", "envoyez", "expedie", "expedier",
  "fais", "faites", "bon", "exact", "affirmatif",
]);

/**
 * Les façons de dire NON — testées AVANT l'accord. « ok mais attends » commence par un accord et
 * finit par un frein : c'est le frein qui doit gagner.
 */
const REJECT = new Set([
  "non", "nan", "no", "annule", "annuler", "annulation", "attends", "attend", "attendez",
  "stop", "arrete", "arretez", "pas", "jamais", "surtout", "plus", "laisse", "tombe",
  "modifie", "modifier", "change", "changer", "corrige", "corriger", "reformule", "reprends",
]);

/**
 * Découpe en mots comparables. Les traits d'union tombent (« vas-y », « envoie-le ») : ce sont
 * des liaisons d'écriture, pas des mots. Les apostrophes aussi (« c'est », « j'approuve »).
 */
function words(text: string): string[] {
  return stripAccents(text.toLowerCase())
    .replace(/['’\-]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * L'INTENTION D'UNE RÉPONSE COURTE, et seulement d'une réponse courte.
 *
 * Au-delà de huit mots, une phrase n'est plus une confirmation nue : elle raconte quelque chose,
 * et ce quelque chose mérite d'être lu par le modèle, pas résumé en « oui » par une liste de mots.
 */
export function classifyReply(text: string): ReplyIntent {
  const raw = (text ?? "").trim();
  if (!raw) return "OTHER";
  // Une QUESTION n'est jamais un accord — « je confirme ? » demande, il n'approuve pas.
  if (raw.includes("?")) return "OTHER";

  const w = words(raw);
  if (w.length === 0 || w.length > 8) return "OTHER";

  if (w.some((t) => REJECT.has(t))) return "REJECT";
  // Il FAUT au moins un mot d'accord : une phrase faite uniquement de mots-outils ne confirme rien.
  if (!w.some((t) => CONFIRM.has(t))) return "OTHER";
  // …et AUCUN mot porteur de sens en dehors du vocabulaire d'accord : un nom, un destinataire ou
  // une nouvelle consigne transforme la réponse en instruction, pas en approbation.
  if (!w.every((t) => CONFIRM.has(t) || FILLERS.has(t))) return "OTHER";
  return "CONFIRM";
}

/** Raccourci de lecture — la question qu'on se pose vraiment à l'appel. */
export function isSendConfirmation(text: string): boolean {
  return classifyReply(text) === "CONFIRM";
}
