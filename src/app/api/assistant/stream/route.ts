import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { aiModel } from "@/lib/ai";
import { aiFeatureEnabled, logAiUsage } from "@/lib/ai-settings";
import { featureEnabled, FEATURES } from "@/lib/features";
import { personalContext } from "@/lib/assistant-memory";
import { runAssistantStream, type ChatTurn, type AssistantStreamEvent } from "@/lib/assistant";
import { rememberExchange } from "@/lib/actions/assistant-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// La boucle agent peut enchaîner plusieurs appels au modèle : on laisse de la marge.
export const maxDuration = 300;

/**
 * ASSISTANT EN FLUX — la réponse s'écrit sous les yeux au lieu de tomber d'un bloc.
 *
 * Le navigateur ouvre ce flux (Server-Sent Events) et reçoit, dans l'ordre réel des
 * événements : les étapes de lecture (« je consulte vos validations… »), puis le texte mot à
 * mot, puis le résultat complet (proposition d'action à confirmer, fil de conversation).
 *
 * Les garanties de l'assistant sont inchangées : identité issue de la SESSION (jamais du
 * client), assistant désactivé en « Vue exacte », toute action d'écriture interceptée et
 * soumise à confirmation.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "VIEW")) return new Response("Non autorisé.", { status: 403 });

  let body: { history?: ChatTurn[]; threadId?: string | null };
  try { body = (await req.json()) as typeof body; } catch { return new Response("Requête invalide.", { status: 400 }); }
  const history = Array.isArray(body.history) ? body.history : [];
  const threadId = typeof body.threadId === "string" ? body.threadId : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (e: AssistantStreamEvent) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`)); } catch { closed = true; }
      };

      try {
        // CLOISONNEMENT : en « Vue exacte », l'assistant est désactivé — sa mémoire est
        // strictement personnelle et ne s'ouvre à personne, pas même à un administrateur.
        if (user.impersonatedBy) {
          send({ type: "done", result: { configured: true, ok: false, reply: "", trace: [], error: "L'assistant est désactivé en « Vue exacte » : sa mémoire est strictement personnelle." } });
          return;
        }
        if (!(await aiFeatureEnabled("assistant"))) {
          send({ type: "done", result: { configured: true, ok: false, reply: "", trace: [], error: "L'assistant IA est actuellement désactivé par l'administrateur." } });
          return;
        }

        const memoryOn = await featureEnabled(FEATURES.ASSISTANT_MEMORY.key, user.id);
        const personal = memoryOn ? await personalContext(user.id).catch(() => null) : null;

        const t0 = Date.now();
        const result = await runAssistantStream(user, history, send, { personalContext: personal });
        await logAiUsage({
          feature: "assistant", userId: user.id, model: aiModel(),
          ok: result.ok, latencyMs: Date.now() - t0, errorCode: result.ok ? null : result.error ?? "error",
        });

        // Mémorisation du fil (helpers scopés par userId) — jamais bloquante.
        if (memoryOn && result.ok && result.reply) {
          const lastUser = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
          result.threadId = await rememberExchange(user.id, threadId, lastUser, result.reply);
        }
        send({ type: "done", result });
      } catch (err) {
        console.error("[assistant] stream route failed", err);
        send({ type: "done", result: { configured: true, ok: false, reply: "", trace: [], error: "L'assistant a rencontré un problème. Réessayez dans un instant." } });
      } finally {
        closed = true;
        try { controller.close(); } catch { /* déjà fermé */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Empêche la mise en tampon par un proxy : sans cela, le flux arrive… d'un bloc.
      "X-Accel-Buffering": "no",
    },
  });
}
