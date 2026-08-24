import { requireUser } from "@/lib/session";
import { aiFeatureEnabled } from "@/lib/ai-settings";
import { canUseRealtimeVoice, createVoiceSessionGrant } from "@/lib/assistant/voice-realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * AMORÇAGE D'UN APPEL VOCAL — le navigateur demande ici un SECRET ÉPHÉMÈRE avant d'ouvrir sa
 * connexion WebRTC directe vers l'API Realtime. C'est LE point de contrôle : authentification,
 * siège exécutif + module CHIEF_OF_STAFF, assistant activé — puis le serveur configure la
 * session (modèle, instructions, outils) et ne rend au client que le secret court.
 * `OPENAI_API_KEY` ne transite JAMAIS par cette réponse.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!canUseRealtimeVoice(user)) {
    return Response.json({ error: "La conversation vocale est réservée à l'interface exécutive (My Chief of Staff).", reasonCode: "FORBIDDEN" }, { status: 403 });
  }
  if (!(await aiFeatureEnabled("assistant"))) {
    return Response.json({ error: "L'assistant IA est actuellement désactivé par l'administrateur.", reasonCode: "ASSISTANT_DISABLED" }, { status: 403 });
  }

  let body: { threadId?: string | null; voice?: string | null } = {};
  try { body = (await req.json()) as typeof body; } catch { /* corps vide accepté */ }

  const grant = await createVoiceSessionGrant(user, { threadId: body.threadId ?? null, voice: body.voice ?? null });
  if (!grant.ok) {
    return Response.json({ error: grant.error, reasonCode: grant.reasonCode }, { status: grant.status });
  }
  return Response.json({
    clientSecret: grant.clientSecret,
    expiresAt: grant.expiresAt,
    model: grant.model,
    callUrl: grant.callUrl,
    voice: grant.voice,
    threadId: grant.threadId,
  });
}
