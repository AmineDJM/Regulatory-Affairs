/**
 * CE QU'UN COURRIEL VEUT DIRE — la lecture d'Adam, déterministe et bornée.
 *
 * Adam lit TOUT ce qui arrive. Passer chaque message au modèle coûterait cher, serait lent, et
 * transformerait chaque infolettre en souvenir durable du PDG — exactement ce qu'il ne faut pas.
 * Cette couche est donc HEURISTIQUE et PURE : elle repère ce qui a une forme reconnaissable
 * (une question, une échéance, un engagement, une pièce promise), classe l'importance, et laisse
 * l'analyse fine du modèle pour les messages qui la méritent — ou pour le moment où le PDG pose
 * une question.
 *
 * Distinguer quatre choses, et ne jamais les confondre (c'est la règle §52 du mandat) :
 *   • la donnée brute chez Google (le message) ;
 *   • les métadonnées indexées (qui, quand, quel fil) ;
 *   • l'extraction sémantique (ce fichier) ;
 *   • la mémoire exécutive durable — qui, elle, ne retient QUE ce qui compte.
 *
 * Module PUR — aucun réseau, aucune base : la lecture se teste phrase par phrase.
 */

export type EmailImportance = "HIGH" | "MEDIUM" | "LOW";

export interface ExtractedCommitment {
  /** Ce qui est promis, tel qu'écrit. */
  text: string;
  /** Qui promet : « sender » (l'expéditeur s'engage) ou « us » (on nous demande / on a promis). */
  by: "sender" | "us";
}

export interface ExtractedDeadline {
  text: string;
  /** Date ISO quand elle est explicite et sans ambiguïté ; sinon null (on n'invente pas). */
  date: string | null;
}

export interface EmailIntelligence {
  importance: EmailImportance;
  internalExternal: "INTERNAL" | "EXTERNAL";
  topics: string[];
  questions: string[];
  requestedActions: string[];
  commitments: ExtractedCommitment[];
  deadlines: ExtractedDeadline[];
  /** Références repérées dans le texte (REG-…, PAY-…, CRR-…) — reliées à l'ERP en aval. */
  references: string[];
  /** Le message annonce-t-il une pièce jointe (« ci-joint ») ? Utile quand elle manque. */
  mentionsAttachment: boolean;
  /** Formulations de manipulation repérées — remontées, jamais obéies. */
  injectionFlags: string[];
  /** Ce qui a permis de classer — l'assistant doit pouvoir dire POURQUOI il a remonté un message. */
  reasons: string[];
}

const fold = (s: string): string =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Découpe en phrases — grossier mais suffisant, et surtout prévisible. */
function sentences(text: string): string[] {
  return (text ?? "")
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && s.length <= 400);
}

/** Les lignes de citation (« > … ») appartiennent au message PRÉCÉDENT : on ne les relit pas. */
export function stripQuotedReply(body: string): string {
  const lines = (body ?? "").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith(">")) continue;
    // « Le 12 mars 2026 à 09:14, X a écrit : » / « On Mar 12, 2026, X wrote: » / « -----Original Message-----»
    if (/^-{2,}\s*(message d'origine|original message)/i.test(t)) break;
    if (/^(le .+ a [ée]crit\s*:|on .+ wrote:)$/i.test(t)) break;
    if (/^de\s*:\s.+@/i.test(t) && out.length > 3) break;
    out.push(line);
  }
  return out.join("\n").trim();
}

const QUESTION_RE = /\?\s*$/;
const ACTION_PATTERNS = [
  /\b(pouvez[- ]vous|peux[- ]tu|pourriez[- ]vous|merci de|priere de|pri[eè]re de|veuillez|il faudrait|besoin de|nous avons besoin|j'ai besoin)\b/,
  /\b(can you|could you|please (send|provide|confirm|share)|we need|i need)\b/,
];
const COMMITMENT_SENDER = [
  /\b(je vous (envoie|enverrai|transmets|transmettrai)|nous (vous )?(enverrons|transmettrons)|je m'en occupe|je reviens vers vous|i will send|i'll get back|we will send)\b/,
];
const COMMITMENT_US = [
  /\b(vous (nous )?avez promis|comme convenu|vous deviez|tu devais|you promised|as agreed)\b/,
];
const URGENT = /\b(urgent|urgence|asap|au plus vite|imm[ée]diat|d[eè]s que possible|relance|rappel|deadline|echeance|[ée]ch[ée]ance|bloqu|blocking|critique)\b/;
const ATTACHMENT_MENTION = /\b(ci[- ]joint|ci[- ]joints?|en pi[eè]ce jointe|veuillez trouver|please find attached|attached)\b/;

/** Références ERP citées en clair — le lien avec le reste de l'OS commence ici. */
const REFERENCE_RE = /\b((?:REG|PAY|CRR|FIN|DIM|SPO|EVT|BC|FA|AO)-\d{4}-\d{1,4}|REG-\d{2,6})\b/gi;

/** Mois français → index, pour les échéances écrites en toutes lettres. */
const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

/**
 * Une date EXPLICITE, ou rien.
 *
 * « la semaine prochaine » n'est pas une date : la transformer en échéance ferait relancer
 * quelqu'un un jour arbitraire, au nom du PDG. On ne garde que ce qui est écrit noir sur blanc.
 */
export function parseExplicitDate(raw: string, now = new Date()): string | null {
  const q = fold(raw);
  const iso = q.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = q.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
  if (dmy) return `${dmy[3]}-${String(Number(dmy[2])).padStart(2, "0")}-${String(Number(dmy[1])).padStart(2, "0")}`;
  const spelled = q.match(/\b(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(20\d{2}))?\b/);
  if (spelled) {
    const day = Number(spelled[1]);
    const month = MONTHS[spelled[2]];
    const year = spelled[3] ? Number(spelled[3]) : now.getFullYear();
    if (day >= 1 && day <= 31 && month) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

export interface AnalyzeInput {
  subject: string;
  body: string;
  fromAddress: string;
  /** Les domaines considérés comme INTERNES (l'entreprise et ses entités). */
  internalDomains?: string[];
  /** L'expéditeur est-il un compte ERP connu ? (résolu en amont) */
  senderIsKnownUser?: boolean;
  hasAttachments?: boolean;
  injectionFlags?: string[];
  now?: Date;
}

/**
 * Lit un message et rend sa projection sémantique.
 *
 * L'importance n'est PAS une note de contenu : c'est une réponse à « le PDG doit-il le savoir
 * maintenant ? ». Une demande explicite, une échéance, un engagement ou une relance comptent ;
 * une infolettre bien écrite, non.
 */
export function analyzeEmail(input: AnalyzeInput): EmailIntelligence {
  const now = input.now ?? new Date();
  const body = stripQuotedReply(input.body ?? "");
  const subject = input.subject ?? "";
  const all = `${subject}\n${body}`;
  const foldedAll = fold(all);
  const domain = (input.fromAddress.split("@")[1] ?? "").toLowerCase();
  const internal = Boolean(input.senderIsKnownUser) || (input.internalDomains ?? []).includes(domain);

  const lines = sentences(body);
  const questions = lines.filter((s) => QUESTION_RE.test(s)).slice(0, 8);
  const requestedActions = lines
    .filter((s) => ACTION_PATTERNS.some((re) => re.test(fold(s))))
    .slice(0, 8);

  const commitments: ExtractedCommitment[] = [];
  for (const s of lines) {
    const f = fold(s);
    if (COMMITMENT_SENDER.some((re) => re.test(f))) commitments.push({ text: s, by: "sender" });
    else if (COMMITMENT_US.some((re) => re.test(f))) commitments.push({ text: s, by: "us" });
    if (commitments.length >= 6) break;
  }

  const deadlines: ExtractedDeadline[] = [];
  for (const s of lines) {
    const date = parseExplicitDate(s, now);
    if (date) deadlines.push({ text: s, date });
    else if (/\b(avant|d'ici|au plus tard|deadline|echeance|[ée]ch[ée]ance)\b/.test(fold(s))) {
      deadlines.push({ text: s, date: null });
    }
    if (deadlines.length >= 5) break;
  }

  const references = [...new Set((all.match(REFERENCE_RE) ?? []).map((r) => r.toUpperCase()))].slice(0, 10);
  const mentionsAttachment = ATTACHMENT_MENTION.test(foldedAll);

  const reasons: string[] = [];
  if (questions.length) reasons.push(`${questions.length} question(s) posée(s)`);
  if (requestedActions.length) reasons.push(`${requestedActions.length} demande(s) explicite(s)`);
  if (deadlines.length) reasons.push("une échéance est mentionnée");
  if (commitments.length) reasons.push("un engagement est pris ou rappelé");
  if (URGENT.test(foldedAll)) reasons.push("formulation d'urgence ou de relance");
  if (references.length) reasons.push(`référence(s) ERP citée(s) : ${references.join(", ")}`);
  if (mentionsAttachment && input.hasAttachments === false) reasons.push("une pièce jointe est annoncée mais absente");
  if (input.injectionFlags?.length) reasons.push("formulations de manipulation détectées");

  // L'importance suit les raisons, pas l'inverse : elle doit toujours pouvoir s'expliquer.
  let importance: EmailImportance = "LOW";
  const strong = questions.length > 0 || requestedActions.length > 0 || deadlines.length > 0 || commitments.length > 0;
  if (strong) importance = "MEDIUM";
  if (strong && (URGENT.test(foldedAll) || references.length > 0 || internal)) importance = "HIGH";
  if ((input.injectionFlags?.length ?? 0) > 0) importance = "HIGH";

  const topics = [...new Set([
    ...references,
    ...(subject ? [subject.replace(/^(re|fwd|tr)\s*:\s*/i, "").trim()].filter(Boolean) : []),
  ])].slice(0, 6);

  return {
    importance,
    internalExternal: internal ? "INTERNAL" : "EXTERNAL",
    topics,
    questions,
    requestedActions,
    commitments,
    deadlines,
    references,
    mentionsAttachment,
    injectionFlags: input.injectionFlags ?? [],
    reasons,
  };
}

/**
 * Le message mérite-t-il de DÉRANGER le PDG ?
 *
 * Séparé de l'importance à dessein : un message important n'est pas forcément une interruption.
 * On remonte ce qui est bloquant, engageant, ou attendu — et rien d'autre. Un assistant qui
 * notifie tout se fait couper le son, et c'est alors la vraie alerte qu'on rate.
 */
export function deservesAttention(intel: EmailIntelligence, opts: { awaitedInMission?: boolean } = {}): boolean {
  if (opts.awaitedInMission) return true;
  if (intel.injectionFlags.length > 0) return true;
  if (intel.importance !== "HIGH") return false;
  return intel.questions.length > 0 || intel.requestedActions.length > 0 || intel.deadlines.length > 0;
}
