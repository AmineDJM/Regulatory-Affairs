"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/drive-storage";
import { resolveDriveAccess, canViewDrive } from "@/lib/drive";
import { aiConfigured, aiModel, aiModelCheap, askClaudeCheap } from "@/lib/ai";
import { aiFeatureEnabled, logAiUsage } from "@/lib/ai-settings";
import { getUnreadDigest } from "@/lib/assistant-nudge";
import { executeIntentGuarded, cancelActionIntent } from "@/lib/assistant/action-intents";
import {
  executeBundle, referencesPrevious,
  type BundleItem, type BundleLevel, type BundleResult,
} from "@/lib/assistant/execution/bundle";
import { matchesConfirmText } from "@/lib/assistant/confirm";
import { featureEnabled, FEATURES } from "@/lib/features";
import {
  personalContext, createThread, appendExchange, listThreads, getThreadMessages,
  deleteThread as deleteThreadScoped, forgetEverything,
  distillationDue, countMessages, recentMessages, getMemory, saveMemory,
  type ThreadSummary, type StoredMessage,
} from "@/lib/assistant-memory";
import { getDailyBrief } from "@/lib/daily-brief";
import { extractAttachmentText, buildAttachmentContext, type AttachmentText } from "@/lib/assistant-files";
import type { AssistantAttachment, AssistantFileOption } from "@/lib/assistant-attachments";
import {
  runAssistant, performAction, payloadRequiresStrongConfirm, executeReadTool,
  type AssistantActionPayload, type AssistantResult, type ChatTurn, type ExecuteResult, type ProposedAction,
} from "@/lib/assistant";
import { composeWorkspace } from "@/lib/assistant/workspace/compose";
import { directIntent, intentArgs, intentPhrase } from "@/lib/assistant/workspace/direct-intents";
import type { WorkspaceComposition } from "@/lib/assistant/workspace/protocol";

const MAX_ATTACHMENTS = 6;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 Mo par pièce jointe

/**
 * Résout une pièce jointe en `{ name, buffer }` :
 *  • upload → décodage base64 (borné en taille) ;
 *  • drive  → lecture du blob de la version courante, APRÈS contrôle d'accès Drive.
 * Renvoie null si inaccessible/invalide (jamais d'exception).
 */
async function resolveAttachment(user: Awaited<ReturnType<typeof requireUser>>, a: AssistantAttachment): Promise<{ name: string; buffer: Buffer } | null> {
  try {
    if (a.kind === "upload") {
      if (!a.name || !a.dataB64) return null;
      const buffer = Buffer.from(a.dataB64, "base64");
      if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) return null;
      return { name: a.name, buffer };
    }
    // drive : le fichier doit être ACCESSIBLE au demandeur (aucun re-téléversement).
    if (!canViewDrive(await resolveDriveAccess(user, a.nodeId))) return null;
    const node = await prisma.driveNode.findUnique({ where: { id: a.nodeId }, select: { name: true, type: true } });
    if (!node || node.type !== "FILE") return null;
    const version = await prisma.fileVersion.findFirst({ where: { nodeId: a.nodeId }, orderBy: { version: "desc" }, select: { blobId: true } });
    if (!version) return null;
    const bytes = await getBlob(version.blobId);
    if (!bytes) return null;
    return { name: node.name, buffer: bytes };
  } catch (err) {
    console.error("[assistant] resolveAttachment failed", err);
    return null;
  }
}

/**
 * Injecte le contenu des pièces jointes dans le DERNIER message utilisateur : chaque fichier
 * est résolu (upload ou Drive) puis extrait en texte (Excel complet, PPTX, Word, PDF, CSV…).
 * Renvoie l'historique augmenté (l'original si rien d'exploitable).
 */
async function withAttachmentContext(user: Awaited<ReturnType<typeof requireUser>>, history: ChatTurn[], attachments: AssistantAttachment[]): Promise<ChatTurn[]> {
  const texts: AttachmentText[] = [];
  for (const a of attachments.slice(0, MAX_ATTACHMENTS)) {
    const resolved = await resolveAttachment(user, a);
    if (!resolved) { texts.push({ name: a.kind === "upload" ? a.name : "fichier", text: "", note: "Fichier inaccessible.", truncated: false }); continue; }
    texts.push(await extractAttachmentText(resolved.name, resolved.buffer));
  }
  const ctx = buildAttachmentContext(texts);
  if (!ctx) return history;
  // Rattache au dernier tour utilisateur (ou en crée un si l'historique n'en a pas).
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") {
      return history.map((t, j) => (j === i ? { ...t, content: `${t.content}\n\n${ctx}` } : t));
    }
  }
  return [...history, { role: "user", content: ctx }];
}

export interface NudgeResult {
  signature: string;
  suggestion: { summary: string; proposal?: ProposedAction } | null;
}

/**
 * DISTILLATION DE LA MÉMOIRE — la « grande mémoire » de l'assistant.
 *
 * Tous les ~12 messages, on relit les échanges RÉCENTS DE CETTE PERSONNE (helpers scopés) et
 * on réécrit une note durable : ses sujets, ses dossiers, ses habitudes, ses préférences de
 * formulation. Cette note est réinjectée au prochain tour via `personalContext`.
 * Appel économique et épisodique ; toute erreur est silencieuse (la mémoire est un confort,
 * jamais un point de rupture du chat).
 */
async function maybeDistillMemory(userId: string): Promise<void> {
  try {
    if (!aiConfigured()) return;
    if (!(await distillationDue(userId))) return;
    const [msgs, previous] = await Promise.all([recentMessages(userId, 60), getMemory(userId)]);
    if (msgs.length === 0) return;
    const transcript = msgs
      .map((m) => `${m.role === "user" ? "Personne" : "Assistant"} : ${m.content.slice(0, 800)}`)
      .join("\n");
    const res = await askClaudeCheap(
      `${previous ? `NOTE ACTUELLE (à mettre à jour, pas à jeter) :\n${previous}\n\n` : ""}` +
      `ÉCHANGES RÉCENTS :\n${transcript}\n\n` +
      `Rédige la note de mémoire à jour (12 lignes maximum, en français, sans Markdown).`,
      {
        system:
          "Tu tiens la mémoire durable d'un assistant interne, pour UNE seule personne. " +
          "Retiens ce qui reste vrai dans le temps : son périmètre, ses dossiers et produits suivis, " +
          "ses interlocuteurs habituels, ses préférences de travail et de formulation, ses échéances récurrentes. " +
          "Ignore le bavardage et tout ce qui est déjà périmé. Écris des phrases courtes et factuelles.",
        maxTokens: 500,
      },
    );
    if (!res.ok || !res.text) return;
    await saveMemory(userId, res.text, await countMessages(userId));
  } catch (e) {
    console.error("[assistant] distillation de la mémoire impossible (non bloquant)", e);
  }
}

/**
 * DÉCOUPAGE DE LA MÉMOIRE EN ÉPISODES — la seconde moitié de la mémoire, et la plus utile.
 *
 * ── CE QU'ELLE FAIT QUE LA DISTILLATION NE FAIT PAS ──────────────────────────────────────
 *
 * `maybeDistillMemory` tient UNE note par personne : ce qui reste vrai dans le temps. Elle
 * écrase la précédente à chaque passage, donc elle ne sait pas dire « en mars, on avait décidé
 * X, puis en juin on est revenu dessus ». L'épisode, lui, est daté, borné par deux messages, et
 * sa fidélité décroît avec l'âge sans jamais perdre un montant, une référence ni une correction.
 *
 * Les deux coexistent parce qu'elles répondent à deux questions différentes — « qui est cette
 * personne » et « que s'est-il passé, et quand ». Fusionner les deux redonnerait une note qui
 * grossit sans fin, c'est-à-dire le comportement qu'on cherche à éviter.
 *
 * Non bloquant, comme la distillation : la mémoire ne fait jamais échouer un tour réussi.
 */
async function maybeCutEpisode(userId: string, threadId: string): Promise<void> {
  try {
    const { noterEpisode, vieillirMemoire } = await import("@/platform/in-process/missions/memory");
    const r = await noterEpisode(userId, threadId);
    if (!r.episodeId) return;

    console.info(
      `[assistant] épisode ${r.episodeId} — ${r.tours} tours, `
      + `${r.jetonsAvant} → ${r.jetonsApres} jetons estimés`,
    );

    // ET, PUISQU'ON EST ICI, ON FAIT VIEILLIR LA MÉMOIRE DE CETTE PERSONNE.
    //
    // Le battement le fait aussi, mais par une file BORNÉE à dix comptes par passage, et
    // seulement tant que quelqu'un sollicite l'application. Or la personne dont la mémoire
    // grossit le plus vite est précisément celle qui parle le plus — et c'est elle qui paiera
    // le contexte le plus lourd au prochain tour. La compresser au moment où elle gagne un
    // souvenir, plutôt qu'en attendant un créneau, est le geste évident.
    //
    // Ce n'est PAS un coût par tour : on n'arrive ici qu'une fois par tranche d'épisode, et si
    // rien n'a vieilli la file est vide et aucun modèle n'est appelé.
    await vieillirMemoire(new Date(), { userId });
  } catch (e) {
    console.error("[assistant] découpage en épisode impossible (non bloquant)", e);
  }
}

/**
 * Mémorise un échange dans le fil de CETTE personne et renvoie l'identifiant du fil.
 *
 * Un fil inconnu — ou appartenant à quelqu'un d'autre — n'est jamais écrit : on en ouvre
 * simplement un nouveau. C'est la seule écriture de mémoire de l'assistant, partagée par
 * l'action serveur et la route de flux, pour que la règle de cloisonnement n'existe qu'en
 * un seul endroit.
 */
export async function rememberExchange(
  userId: string, threadId: string | null, userMessage: string, reply: string,
): Promise<string | null> {
  try {
    let tid = threadId;
    if (tid) {
      const ok = await appendExchange(userId, tid, userMessage, reply);
      if (!ok) tid = null; // fil inconnu ou n'appartenant pas au demandeur → on repart proprement
    }
    if (!tid) {
      tid = await createThread(userId, userMessage);
      await appendExchange(userId, tid, userMessage, reply);
    }
    await maybeDistillMemory(userId);
    await maybeCutEpisode(userId, tid);
    return tid;
  } catch (e) {
    console.error("[assistant] mémorisation impossible (non bloquant)", e);
    return threadId;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE GESTE DÉTERMINISTE — un clic, une lecture, ZÉRO appel au modèle (§23).
 *
 * ── CE QU'ON ARRÊTE DE PAYER ─────────────────────────────────────────────────────────────
 *
 * Un bouton de l'espace de travail écrivait une PHRASE : « Économie du produit PRD-014 ». Elle
 * repartait au modèle, qui devait comprendre l'intention, choisir l'outil et extraire
 * l'argument — pour aboutir à l'appel que le serveur connaissait DÉJÀ quand il a dessiné le
 * bouton. Un aller-retour complet, quelques milliers de jetons de schémas, une seconde et
 * demie d'attente, et un maillon de plus où l'intention peut dériver : pour rien.
 *
 * ── POURQUOI ÇA NE ROUVRE RIEN ───────────────────────────────────────────────────────────
 *
 * Le registre `DIRECT_INTENTS` ne contient QUE des lectures, et une capacité absente est
 * refusée avant d'atteindre quoi que ce soit. Les gestes qui MODIFIENT continuent d'écrire
 * leur phrase dans la conversation — donc de passer par la proposition, la carte de
 * confirmation, l'action canonique et l'audit. Le raccourci saute le RAISONNEMENT, pas les
 * gardes : identité de session, `allowed()` de la capacité, droits ERP, cloisonnement.
 *
 * La PHRASE affichée vient du registre, jamais du client — sans quoi un appel forgé écrirait
 * dans le fil une demande que personne n'a formulée.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function assistantDirectIntent(
  capability: string,
  args: Record<string, string>,
): Promise<{ ok: boolean; phrase: string; label: string; composition: WorkspaceComposition | null; reply: string }> {
  const vide = { ok: false, phrase: "", label: "", composition: null, reply: "" };
  const def = directIntent(capability);
  if (!def) return vide;

  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "VIEW")) return vide;

  const clean = intentArgs(def, args);
  if (Object.keys(clean).length === 0) return vide;

  const out = await executeReadTool(def.tool, clean, user).catch((e) => {
    console.error("[assistant] geste direct échoué", def.tool, e);
    return null;
  });
  if (out === null) return vide;

  const composition = composeWorkspace(def.tool, out);
  return {
    ok: true,
    phrase: intentPhrase(def, clean),
    label: def.label,
    composition,
    // SANS MODÈLE, ON NE COMMENTE PAS. Une phrase de synthèse écrite ici serait une opinion
    // du code sur des chiffres qu'il n'a pas lus. Quand il n'y a rien à montrer, on le dit.
    reply: composition ? "" : "Cette lecture n'a rien renvoyé d'affichable. Posez la question dans la conversation pour l'analyse.",
  };
}

/**
 * Tour de conversation : exécute la boucle agent côté serveur (clé jamais exposée).
 * Ne lève JAMAIS d'exception vers le client — toute erreur revient en résultat
 * structuré (fini le « Appel à l'assistant impossible »).
 */
export async function assistantChat(
  history: ChatTurn[],
  attachments?: AssistantAttachment[],
  threadId?: string | null,
): Promise<AssistantResult> {
  try {
    const user = await requireUser();
    // Tout employé a accès à l'assistant (espace de travail universel).
    if (!userCan(user, "WORKSPACE", "VIEW")) {
      return { configured: true, ok: false, reply: "", trace: [], error: "Non autorisé." };
    }
    // CLOISONNEMENT : en « Vue exacte » (un admin regarde l'app comme quelqu'un d'autre),
    // l'assistant est DÉSACTIVÉ. Sa mémoire est strictement personnelle : on n'ouvre jamais
    // celle d'un tiers, même à un administrateur.
    if (user.impersonatedBy) {
      return {
        configured: true, ok: false, reply: "", trace: [],
        error: "L'assistant est désactivé en « Vue exacte » : sa mémoire est strictement personnelle.",
      };
    }
    // Interrupteur du Centre de contrôle IA (Super Admin).
    if (!(await aiFeatureEnabled("assistant"))) {
      return { configured: true, ok: false, reply: "", trace: [], error: "L'assistant IA est actuellement désactivé par l'administrateur." };
    }
    let turns = Array.isArray(history) ? history : [];
    // Pièces jointes (téléversées OU référencées depuis le Drive) : leur contenu est extrait
    // côté serveur et injecté dans le message — l'assistant « lit » Excel/PPTX/Word/PDF, etc.
    if (Array.isArray(attachments) && attachments.length > 0) {
      turns = await withAttachmentContext(user, turns, attachments);
    }
    // Mémoire personnelle (derrière le drapeau de version) : identité, rattachement,
    // hiérarchie et ce que l'assistant a retenu de CETTE personne.
    const memoryOn = await featureEnabled(FEATURES.ASSISTANT_MEMORY.key, user.id);
    const personal = memoryOn ? await personalContext(user.id).catch(() => null) : null;

    const t0 = Date.now();
    const res = await runAssistant(user, turns, { personalContext: personal });
    await logAiUsage({
      feature: "assistant", userId: user.id, model: aiModel(),
      ok: res.ok, latencyMs: Date.now() - t0, errorCode: res.ok ? null : res.error ?? "error",
    });
    // Persistance du fil — uniquement pour SON propriétaire (helpers scopés par userId).
    if (memoryOn && res.ok && res.reply) {
      try {
        const lastUser = [...turns].reverse().find((t) => t.role === "user")?.content ?? "";
        res.threadId = await rememberExchange(user.id, threadId ?? null, lastUser, res.reply);
      } catch (e) {
        console.error("[assistant] mémorisation impossible (non bloquant)", e);
      }
    }
    return res;
  } catch (err) {
    console.error("[assistant] assistantChat failed", err);
    return { configured: true, ok: false, reply: "", trace: [], error: "L'assistant a rencontré un problème. Réessayez dans un instant." };
  }
}

/**
 * Exécute une action **après confirmation explicite** de l'utilisateur. L'identité
 * provient de la session (jamais du client) ; `performAction` ré-autorise et
 * journalise. On applique ensuite la revalidation des pages concernées. Ne lève
 * jamais : renvoie un résultat structuré.
 */
/**
 * Suggestion PROACTIVE de l'assistant flottant : analyse les messages internes NON
 * LUS et propose, le cas échéant, UNE action à confirmer. L'IA n'est appelée que si
 * le contenu non lu a changé (`prevSignature`) → coût maîtrisé. Gracieux sans clé.
 * Ne lève jamais.
 */
export async function assistantNudge(prevSignature: string): Promise<NudgeResult> {
  try {
    const user = await requireUser();
    const digest = await getUnreadDigest(user.id);
    if (digest.count === 0) return { signature: "0", suggestion: null };
    // Rien de nouveau depuis la dernière analyse → pas d'appel IA.
    if (digest.signature === prevSignature) return { signature: digest.signature, suggestion: null };
    if (!aiConfigured()) return { signature: digest.signature, suggestion: null };
    // Suggestions proactives désactivables indépendamment depuis le Centre de contrôle IA.
    if (!(await aiFeatureEnabled("nudge"))) return { signature: digest.signature, suggestion: null };

    const prompt =
      `Messages internes récents NON LUS reçus par l'utilisateur (analyse le contexte global : plusieurs messages peuvent être liés) :\n\n${digest.text}\n\n` +
      `S'il y a UNE action concrète et utile à proposer (créer une tâche, répondre à un collègue, créer une demande administrative, envoyer un e-mail…), prépare-la (un seul outil d'écriture). ` +
      `Sinon réponds EXACTEMENT « RAS ». Sois bref.`;
    // Suggestion proactive = enjeu faible, fort volume → palier ÉCO (le nudge ne fait que
    // PROPOSER ; toute action d'écriture reste interceptée et confirmée par l'humain).
    const t0 = Date.now();
    const res = await runAssistant(user, [{ role: "user", content: prompt }], { model: aiModelCheap(), origin: "nudge" });
    await logAiUsage({
      feature: "nudge", userId: user.id, model: aiModelCheap(),
      ok: res.ok, latencyMs: Date.now() - t0, errorCode: res.ok ? null : res.error ?? "error",
    });
    if (!res.configured || !res.ok) return { signature: digest.signature, suggestion: null };
    const reply = (res.reply ?? "").trim();
    if (!res.proposal && (reply.length === 0 || /^ras\b/i.test(reply))) return { signature: digest.signature, suggestion: null };
    return { signature: digest.signature, suggestion: { summary: reply || "J'ai repéré une action possible à partir de vos messages.", proposal: res.proposal } };
  } catch (err) {
    console.error("[assistant] assistantNudge failed", err);
    return { signature: "0", suggestion: null };
  }
}

export async function executeAssistantAction(payload: AssistantActionPayload, intentId?: string, confirmTyped?: string): Promise<ExecuteResult> {
  try {
    const user = await requireUser();

    // CHEMIN CANONIQUE : l'action vit sous son INTENT (machine d'état serveur). Réclamation
    // atomique — un retry / double-clic / reconnexion ne relance JAMAIS l'exécution : une
    // action déjà EXÉCUTÉE renvoie son reçu d'origine. Le payload exécuté est celui STOCKÉ à
    // la proposition (le serveur est l'autorité, pas le client).
    if (intentId) {
      // CONFIRMATION FORTE — vérifiée PAR LE SERVEUR : pour une action CRITIQUE, la valeur
      // ressaisie doit correspondre au confirmText STOCKÉ à la proposition. La carte arme son
      // bouton avec la même règle, mais l'autorité est ICI : appeler cette action serveur
      // directement (console, script) sans la bonne ressaisie n'exécute rien. Un intent déjà
      // EXÉCUTÉ reste idempotent : le reçu d'origine se renvoie sans nouvelle ressaisie.
      const meta = await prisma.assistantActionIntent.findFirst({
        where: { id: intentId, userId: user.id },
        select: { status: true, level: true, confirmText: true },
      });
      if (meta && meta.status !== "EXECUTED" && meta.level === "CRITICAL") {
        if (!meta.confirmText) {
          return { ok: false, error: "Cette carte CRITIQUE date d'avant le durcissement de la confirmation : redemandez la proposition à l'assistant, puis confirmez en ressaisissant la valeur demandée. Rien n'a été exécuté." };
        }
        if (!matchesConfirmText(confirmTyped ?? "", meta.confirmText)) {
          return { ok: false, error: `Confirmation renforcée : la valeur ressaisie ne correspond pas à « ${meta.confirmText} ». Rien n'a été exécuté.` };
        }
      }
      const guarded = await executeIntentGuarded(user, intentId, async (stored) => {
        const r = await performAction(user, stored as AssistantActionPayload);
        if (r.ok && r.revalidate) for (const path of r.revalidate) revalidatePath(path);
        return r;
      });
      if (guarded) return { ok: guarded.ok, message: guarded.message, link: guarded.link, error: guarded.error };
      // Intent introuvable (ou pas à ce compte) → chemin historique ci-dessous, sans reçu.
    }

    // CHEMIN SANS INTENT (historique) : une action CRITIQUE n'y passe JAMAIS — sans intent, le
    // serveur n'a aucun confirmText de référence à vérifier, donc il refuse au lieu de faire
    // confiance au client. Le niveau se recalcule depuis le payload lui-même.
    if (payloadRequiresStrongConfirm(payload)) {
      return { ok: false, error: "Action CRITIQUE sans carte canonique (proposition expirée ou introuvable) : redemandez la proposition à l'assistant, puis confirmez en ressaisissant la valeur demandée. Rien n'a été exécuté." };
    }

    const result = await performAction(user, payload);
    if (result.ok && result.revalidate) {
      for (const path of result.revalidate) revalidatePath(path);
    }
    return { ok: result.ok, message: result.message, link: result.link, error: result.error };
  } catch (err) {
    console.error("[assistant] executeAssistantAction failed", err);
    return { ok: false, error: "L'action n'a pas pu être exécutée. Réessayez dans un instant." };
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE MISSION = UNE CONFIRMATION — l'enchaînement passe côté SERVEUR.
 *
 * Avant, « tout confirmer » bouclait dans le navigateur : un appel par action, piloté par la
 * page. Un onglet fermé au milieu laissait la moitié du lot partie, sans que personne ne sache
 * laquelle. Ici, un seul appel exécute tout et rend UN compte rendu.
 *
 * CE QUI NE CHANGE PAS : chaque étape repasse par `executeIntentGuarded` (réclamation atomique,
 * reçu rejoué, jamais deux fois) puis `performAction` (RBAC ré-autorisé, arrêt d'urgence, audit).
 * Cette fonction ordonnance ; elle n'écrit rien elle-même.
 *
 * LES INTENTS SONT RELUS EN BASE, jamais reçus du client : niveau, payload et propriété du
 * compte viennent du serveur. Un client qui enverrait des identifiants d'un autre utilisateur
 * n'obtiendrait rien — `executeIntentGuarded` filtre déjà sur `userId`, et la relecture ici
 * refuse les inconnus avant même d'essayer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function executeAssistantBundle(intentIds: string[]): Promise<BundleResult> {
  const empty = (message: string): BundleResult =>
    ({ ok: false, executed: 0, failed: 0, held: 0, outcomes: [], message });

  try {
    const user = await requireUser();
    const ids = (Array.isArray(intentIds) ? intentIds : []).filter((v): v is string => typeof v === "string" && v.length > 0);
    if (!ids.length) return empty("Rien à exécuter.");
    // Un lot reste un lot : au-delà, c'est une mission de fond, pas une confirmation.
    if (ids.length > 20) return empty("Trop d'actions dans un seul lot — confirmez-les par groupes.");

    const stored = await prisma.assistantActionIntent.findMany({
      where: { id: { in: ids }, userId: user.id },
      select: { id: true, title: true, level: true, payload: true },
    });
    const byId = new Map(stored.map((i) => [i.id, i]));

    // L'ORDRE DU CLIENT FAIT FOI — c'est celui des cartes affichées, donc celui que le modèle a
    // proposé, donc celui qui porte le chaînage « $prev ». Le reclasser ici casserait la seule
    // information de dépendance dont on dispose.
    const items: BundleItem[] = ids.map((id) => {
      const found = byId.get(id);
      return {
        intentId: id,
        title: found?.title ?? "Action",
        level: (found?.level as BundleLevel | undefined) ?? "NORMAL",
        dependsOnPrevious: found ? referencesPrevious(found.payload) : false,
      };
    });

    const revalidated = new Set<string>();
    const result = await executeBundle(items, async (intentId) =>
      executeIntentGuarded(user, intentId, async (payload) => {
        const r = await performAction(user, payload as AssistantActionPayload);
        // La revalidation est CUMULÉE puis appliquée une fois : rafraîchir la même page à
        // chaque étape ferait payer le lot en latence pour rien.
        if (r.ok) for (const path of r.revalidate ?? []) revalidated.add(path);
        return r;
      }),
    );
    for (const path of revalidated) revalidatePath(path);

    console.info("[assistant] bundle_executed", {
      userId: user.id, total: items.length, executed: result.executed, failed: result.failed, held: result.held,
    });
    return result;
  } catch (err) {
    console.error("[assistant] executeAssistantBundle failed", err);
    // On ne peut pas savoir ici ce qui est parti : le dire est la seule réponse honnête.
    return empty("Le lot n'a pas pu être mené à son terme. Vérifiez l'état de chaque action avant de relancer.");
  }
}

/** Annule une action PROPOSÉE (état canonique → CANCELLED) — « jamais exécutée » restera vrai. */
export async function cancelAssistantAction(intentId: string): Promise<boolean> {
  try {
    const user = await requireUser();
    return await cancelActionIntent(user.id, intentId);
  } catch (err) {
    console.error("[assistant] cancelAssistantAction failed", err);
    return false;
  }
}

/**
 * Fichiers du Drive personnel proposés au « glisser » dans l'assistant (sélecteur) : on les
 * référence directement, SANS téléchargement + re-téléversement. Recherche optionnelle par nom.
 */
export async function listAssistantFiles(query?: string): Promise<AssistantFileOption[]> {
  try {
    const user = await requireUser();
    if (!userCan(user, "DRIVE", "VIEW")) return [];
    const q = (query ?? "").trim();
    const files = await prisma.driveNode.findMany({
      where: { ownerId: user.id, type: "FILE", isTrashed: false, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, name: true, mimeType: true, size: true },
    });
    return files;
  } catch (err) {
    console.error("[assistant] listAssistantFiles failed", err);
    return [];
  }
}


// ─────────────────────── Mémoire personnelle (fils de conversation) ───────────────────────

/** Mes conversations passées. Personne d'autre ne peut les lister. */
export async function myAssistantThreads(): Promise<ThreadSummary[]> {
  try {
    const user = await requireUser();
    if (user.impersonatedBy) return [];
    if (!(await featureEnabled(FEATURES.ASSISTANT_MEMORY.key, user.id))) return [];
    return await listThreads(user.id);
  } catch {
    return [];
  }
}

/** Les messages d'UNE de mes conversations (null si ce n'est pas la mienne). */
export async function myAssistantThread(threadId: string): Promise<StoredMessage[] | null> {
  try {
    const user = await requireUser();
    if (user.impersonatedBy) return null;
    return await getThreadMessages(user.id, threadId);
  } catch {
    return null;
  }
}

/** Supprime UNE de mes conversations. */
export async function deleteMyAssistantThread(threadId: string): Promise<ExecuteResult> {
  try {
    const user = await requireUser();
    if (user.impersonatedBy) return { ok: false, error: "Indisponible en « Vue exacte »." };
    const ok = await deleteThreadScoped(user.id, threadId);
    return ok ? { ok: true, message: "Conversation supprimée." } : { ok: false, error: "Conversation introuvable." };
  } catch {
    return { ok: false, error: "Suppression impossible." };
  }
}

/**
 * Régénère MON point du matin (bouton « Actualiser »). Le brief est écrit à partir de mes
 * seules données ; personne d'autre ne peut le demander ni le lire.
 */
export async function refreshMyBrief(): Promise<{ text: string | null }> {
  try {
    const user = await requireUser();
    if (user.impersonatedBy) return { text: null };
    if (!(await featureEnabled(FEATURES.ASSISTANT_PROACTIVE.key, user.id))) return { text: null };
    if (!(await aiFeatureEnabled("assistant"))) return { text: null };
    const res = await getDailyBrief(user, true);
    return { text: res.text };
  } catch (err) {
    console.error("[assistant] refreshMyBrief failed", err);
    return { text: null };
  }
}

/** Droit à l'oubli : efface TOUTE ma mémoire d'assistant (conversations + mémoire retenue). */
export async function forgetMyAssistantMemory(): Promise<ExecuteResult> {
  try {
    const user = await requireUser();
    if (user.impersonatedBy) return { ok: false, error: "Indisponible en « Vue exacte »." };
    await forgetEverything(user.id);
    return { ok: true, message: "Mémoire effacée." };
  } catch {
    return { ok: false, error: "Effacement impossible." };
  }
}
