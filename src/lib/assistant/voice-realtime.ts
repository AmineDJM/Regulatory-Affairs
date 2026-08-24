import type { CurrentUser } from "@/lib/session";
import { accessibleModules } from "@/lib/rbac";
import { buildChiefOfStaffContext } from "@/lib/assistant";
import { POWER_TOOLS } from "@/lib/assistant/power-tools";
import { personalContext, getThreadMessages, ensurePrimaryThread } from "@/lib/assistant-memory";

/**
 * VOIX TEMPS RÉEL — la couche SERVEUR de la conversation speech-to-speech.
 *
 * Le navigateur parle DIRECTEMENT à l'API Realtime d'OpenAI en WebRTC (média sans détour par
 * notre backend) ; notre serveur, lui, garde trois responsabilités que rien ne délègue :
 *   1. l'AUTORISATION — qui a le droit d'ouvrir une session vocale (siège exécutif + module
 *      CHIEF_OF_STAFF), vérifiée ICI, jamais côté client ;
 *   2. la CLÉ — `OPENAI_API_KEY` ne quitte jamais le serveur : le client ne reçoit qu'un
 *      SECRET ÉPHÉMÈRE (quelques minutes) créé via l'endpoint officiel de l'API ;
 *   3. les OUTILS — chaque appel d'outil déclenché par le modèle vocal revient sur notre
 *      backend authentifié, où `executePowerTool` re-vérifie le droit : le modèle propose,
 *      le serveur dispose. MÊMES outils, MÊMES permissions, MÊME conversation que le texte.
 *
 * Le modèle vocal est le SYSTÈME NERVEUX conversationnel — pas le cerveau : les analyses
 * profondes, les écritures et les livrables passent par `delegate_to_chief_of_staff`, qui
 * appelle l'orchestrateur texte existant (mêmes cartes de confirmation, même audit).
 */

/** Le modèle Realtime — surclassable par variable d'environnement, jamais codé en dur ailleurs. */
export const REALTIME_VOICE_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";

/** L'URL d'échange SDP (WebRTC) de l'API Realtime — le client la reçoit du serveur. */
export const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

/** Les voix proposées ; « marin » par défaut (posée, exécutive). Liste blanche stricte. */
export const REALTIME_VOICES = ["marin", "cedar", "alloy", "ash", "coral", "echo", "sage", "shimmer", "verse"] as const;

export function realtimeVoiceConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Qui peut OUVRIR une session vocale temps réel : le siège exécutif (PDG + Super Admin) avec le
 * module CHIEF_OF_STAFF — la même porte que la page /chief-of-staff. La dictée (transcription
 * simple) reste ouverte plus largement ; l'appel temps réel est l'interface exécutive.
 */
export function canUseRealtimeVoice(user: CurrentUser): boolean {
  if (user.impersonatedBy) return false; // « Vue exacte » : l'assistant est désactivé
  if (user.role !== "SUPER_ADMIN" && user.role !== "DIRECTION") return false;
  return accessibleModules(user).includes("CHIEF_OF_STAFF");
}

// ─────────────────────────── Outils exposés à la session ───────────────────────────

/**
 * Les OUTILS DIRECTS de la session vocale — les fast paths : lectures instantanées que le
 * modèle appelle sans détour (« masse salariale ? », « quel âge a Khaled ? », « où est le
 * paiement ? »). Sous-ensemble CHOISI du registre : le budget de contexte temps réel se paie
 * en latence, on n'y verse pas les ~60 outils — le reste passe par la délégation.
 * Chaque nom DOIT exister dans POWER_TOOLS (un test le fige) ; le droit est re-vérifié par
 * `executePowerTool` à CHAQUE appel, la liste envoyée au modèle n'est qu'une suggestion.
 */
export const VOICE_FAST_TOOL_NAMES: readonly string[] = [
  "search_everything",
  "inspect_record",
  "employee_360",
  "read_payroll",
  "read_hr_overview",
  "read_budget",
  "read_finances",
  "finance_totals",
  "read_calendar",
  "read_stock",
  "search_drive",
  "read_document",
  "find_documents",
  "product_360",
  "supplier_360",
  "company_state",
  "ceo_attention",
  "executive_alerts",
  "list_pending_decisions",
  "search_knowledge_corpus",
  "time_travel",
  "plan_reminder",
  "list_commitments",
  "list_decisions",
  "remember",
  "recall_conversation",
] as const;

/** Le format d'outil attendu par la session Realtime (function calling). */
export interface RealtimeToolDef {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** L'outil de DÉLÉGATION : tout ce qui n'est pas un fast path passe par l'orchestrateur. */
export const DELEGATE_TOOL_NAME = "delegate_to_chief_of_staff";

const DELEGATE_TOOL: RealtimeToolDef = {
  type: "function",
  name: DELEGATE_TOOL_NAME,
  description:
    "DÉLÈGUE au moteur complet du Chief of Staff (l'orchestrateur texte) : toute ACTION (créer une tâche, relancer " +
    "quelqu'un, trancher un paiement, modifier un salaire, envoyer un message… — les cartes de confirmation s'affichent " +
    "à l'écran, RIEN ne s'exécute sans clic), toute ANALYSE PROFONDE (organisation, simulation, étude), tout LIVRABLE " +
    "(rapport Word, Excel, présentation), et toute demande qui sort des outils rapides. Formuler `request` comme la " +
    "demande complète de l'utilisateur, avec le contexte utile (« relance Nadia sur le paiement ORD-2026-014 »). " +
    "Pendant le travail, continuer la conversation ; ne JAMAIS dire qu'une action est faite — dire qu'elle est proposée à l'écran.",
  parameters: {
    type: "object",
    properties: {
      request: { type: "string", description: "La demande complète, en français, avec le contexte (références, noms)." },
    },
    required: ["request"],
  },
};

/**
 * Adaptateur PowerTool → outil Realtime : LE MÊME outil sert le texte et la voix — on ne
 * duplique ni la définition ni le garde. Seuls les outils ouverts à CE compte sont annoncés.
 */
export function realtimeToolsFor(user: CurrentUser): RealtimeToolDef[] {
  const wanted = new Set(VOICE_FAST_TOOL_NAMES);
  const direct = POWER_TOOLS
    .filter((t) => wanted.has(t.def.name) && t.allowed(user))
    .map((t) => ({
      type: "function" as const,
      name: t.def.name,
      description: t.def.description,
      parameters: t.def.input_schema as unknown as Record<string, unknown>,
    }));
  return [...direct, DELEGATE_TOOL];
}

// ─────────────────────────── Instructions de session ───────────────────────────

/** Les consignes PROPRES à la voix — le ton d'un appel, pas d'une page. */
const VOICE_ADDENDUM = `
CONSIGNES VOCALES — tu es EN LIGNE, à l'oral, avec ton interlocuteur :
- Réponds IMMÉDIATEMENT et BRIÈVEMENT : la réponse d'abord, 5 à 20 secondes de parole pour une
  question normale. Pas de listes récitées, pas de tableau lu à voix haute : résume à l'oral
  (« Il y en a trois ; le plus gros est Hikma, 14,8 millions, bloqué depuis six jours ») — le
  détail s'AFFICHE à l'écran via les outils, tu n'as pas à le dicter.
- Ne raconte JAMAIS tes appels d'outils (« je cherche dans la base… ») : si la lecture est
  rapide, réponds simplement ; si un travail de fond démarre (délégation), dis-le en une phrase
  naturelle et CONTINUE la conversation — la session ne se fige pas.
- Ne dis JAMAIS qu'une action est faite tant que l'outil ne l'a pas confirmé. Une action passe
  par une carte de confirmation À L'ÉCRAN : dis « je te la propose à l'écran », jamais « c'est fait ».
- Si l'utilisateur t'interrompt : tais-toi et suis la nouvelle consigne, sans re-dérouler.
- Garde les références conversationnelles (« il », « elle », « ce paiement », « l'autre ») — la
  conversation est CONTINUE, y compris ce qui s'est dit en mode texte avant l'appel.
- Ne salue pas à chaque tour, ne te présente pas : la conversation est déjà engagée.
- Tu n'es PAS un assistant textuel : tu es l'interface VOCALE de My Chief of Staff — tu entends
  et tu parles. Français par défaut ; comprends l'arabe et l'anglais mêlés au français.
- Un MONTANT dans une action se répète clairement avant confirmation (« 14 millions 800 mille
  dinars »). Un nom ambigu se lève en une question courte (« Nesrine B. ou Nesrine K. ? ») —
  seulement si le doute est réel.
- « Donne-moi juste la réponse » (ou tout signe d'impatience) : raccourcis IMMÉDIATEMENT — le
  chiffre ou le fait, une phrase, rien d'autre, et garde ce registre pour la suite de l'appel.
- CAPACITÉ ≠ EXÉCUTION : tu PEUX suggérer une suite utile (« je peux aussi te préparer le
  comparatif en Excel ») — UNE suggestion, courte, puis tu ATTENDS « fais-le ». Tu ne lances
  jamais une analyse lourde, un livrable, un rappel ou une action de ta propre initiative.
- « Qu'est-ce que je rate ? » / « où en est la boîte ? » : ceo_attention ou company_state en
  lecture directe ; si le PDG demande une VRAIE investigation, délègue — à sa demande, jamais avant.
- « Où en était ce dossier au… ? » : l'outil time_travel reconstruit l'état PASSÉ depuis le
  journal d'audit — lecture seule, dis ce que le journal montre et ce qu'il ne capture pas.
- Ton : professionnel, calme, naturel — jamais robotique, jamais surjoué.`;

const ymdhm = (iso: string): string => iso.slice(0, 16).replace("T", " ");

/**
 * Les INSTRUCTIONS complètes de la session vocale : identité + contexte commun (la MÊME
 * fonction que le texte, en variante compacte), contexte personnel et mémoire (les mêmes
 * qu'en texte), les derniers échanges du fil (BORNÉS — jamais tout l'historique), et les
 * consignes vocales. Le reste du passé se retrouve par recall_conversation.
 *
 * `screenContext` (optionnel) : D'OÙ l'appel démarre — la fiche ou la page que l'utilisateur
 * regarde (« Appeler » depuis un paiement, un contrat…). Route + référence, JAMAIS une capture
 * d'écran : c'est ce qui rend « où ça bloque ? » résoluble dès la première seconde.
 */
export async function buildVoiceInstructions(
  user: CurrentUser,
  threadId: string | null,
  screenContext?: string | null,
): Promise<string> {
  const parts: string[] = [buildChiefOfStaffContext(user, { voice: true })];

  const personal = await personalContext(user.id).catch(() => null);
  if (personal) parts.push(`\nCONTEXTE PERSONNEL\n${personal}`);

  if (threadId) {
    const recent = await getThreadMessages(user.id, threadId, 16).catch(() => null);
    if (recent && recent.length > 0) {
      const lines = recent.map((m) =>
        `${m.role === "user" ? "PDG" : "Toi"} (${ymdhm(m.createdAt)}) : ${m.content.replace(/\s+/g, " ").slice(0, 280)}`,
      );
      parts.push(
        `\nCONVERSATION RÉCENTE (le même fil continue — résoudre « il », « ce paiement »… avec ceci) :\n${lines.join("\n")}`,
      );
    }
  }

  const screen = typeof screenContext === "string" ? screenContext.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  if (screen) {
    parts.push(
      `\nCONTEXTE D'ÉCRAN (au moment de l'appel) : ${screen}\n« ça », « ce dossier », « cette fiche » s'y réfèrent, sauf indication contraire.`,
    );
  }

  parts.push(VOICE_ADDENDUM);
  return parts.join("\n");
}

// ─────────────────────────── Création du secret éphémère ───────────────────────────

export interface VoiceSessionGrant {
  ok: true;
  /** Secret ÉPHÉMÈRE (ek_…) — le seul credential que le navigateur voit. */
  clientSecret: string;
  expiresAt: number | null;
  model: string;
  callUrl: string;
  voice: string;
  threadId: string | null;
}
export interface VoiceSessionRefusal { ok: false; error: string; reasonCode: string; status: number }

/**
 * Crée le secret éphémère via l'endpoint officiel `/v1/realtime/client_secrets` — la session
 * (modèle, instructions, outils, transcription, détection de tour) est configurée ICI, côté
 * serveur : le client ne peut ni élargir les outils ni réécrire les instructions.
 */
export async function createVoiceSessionGrant(
  user: CurrentUser,
  opts: { threadId?: string | null; voice?: string | null; screenContext?: string | null } = {},
): Promise<VoiceSessionGrant | VoiceSessionRefusal> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, error: "Le mode vocal temps réel n'est pas configuré (clé OPENAI_API_KEY absente).", reasonCode: "OPENAI_KEY_MISSING", status: 503 };

  // Le fil : celui demandé (s'il appartient au demandeur, getThreadMessages le re-vérifie),
  // sinon LE FIL PRINCIPAL — l'appel vocal continue la conversation, il n'en ouvre pas une autre.
  let threadId = typeof opts.threadId === "string" && opts.threadId ? opts.threadId : null;
  if (!threadId) threadId = await ensurePrimaryThread(user.id).catch(() => null);

  const voice = (REALTIME_VOICES as readonly string[]).includes(opts.voice ?? "") ? (opts.voice as string) : REALTIME_VOICES[0];
  const instructions = await buildVoiceInstructions(user, threadId, opts.screenContext ?? null);
  const tools = realtimeToolsFor(user);

  const body = {
    expires_after: { anchor: "created_at", seconds: 600 },
    session: {
      type: "realtime",
      model: REALTIME_VOICE_MODEL,
      instructions,
      tools,
      tool_choice: "auto",
      audio: {
        input: {
          // Transcription PARALLÈLE de ce que dit l'utilisateur — l'UI et l'historique en vivent.
          transcription: { model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe" },
          // Détection de tour SÉMANTIQUE : l'API gère silences, hésitations (« euh… attends »)
          // et interruptions — on ne recrée pas un VAD fragile côté client.
          turn_detection: { type: "semantic_vad", create_response: true, interrupt_response: true },
        },
        output: { voice },
      },
    },
  };

  const t0 = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[voice] voice_session_error", { reasonCode: `OPENAI_${res.status}`, httpStatus: res.status, model: REALTIME_VOICE_MODEL, userId: user.id, detail: detail.slice(0, 500) });
      return {
        ok: false,
        error: "Le mode vocal temps réel est momentanément indisponible.",
        reasonCode: `OPENAI_${res.status}`,
        status: 502,
      };
    }
    const data = (await res.json()) as { value?: string; expires_at?: number };
    if (!data.value) {
      console.error("[voice] voice_session_error", { reasonCode: "NO_CLIENT_SECRET", userId: user.id });
      return { ok: false, error: "Le mode vocal temps réel est momentanément indisponible.", reasonCode: "NO_CLIENT_SECRET", status: 502 };
    }
    console.info("[voice] voice_session_created", {
      userId: user.id, model: REALTIME_VOICE_MODEL, voice, threadId,
      tools: tools.length, latencyMs: Date.now() - t0,
    });
    return {
      ok: true,
      clientSecret: data.value,
      expiresAt: data.expires_at ?? null,
      model: REALTIME_VOICE_MODEL,
      callUrl: REALTIME_CALLS_URL,
      voice,
      threadId,
    };
  } catch (err) {
    console.error("[voice] voice_session_error", { reasonCode: "NETWORK", userId: user.id, err: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: "Le mode vocal temps réel est momentanément indisponible (réseau).", reasonCode: "NETWORK", status: 502 };
  }
}

/** Un résultat d'outil renvoyé à la session : borné — le contexte temps réel se paie en latence. */
export function capToolOutput(out: string, max = 8_000): string {
  return out.length <= max ? out : `${out.slice(0, max)}… (tronqué pour la session vocale — le détail complet est à l'écran)`;
}
