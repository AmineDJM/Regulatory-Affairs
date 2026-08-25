import { requireUser } from "@/lib/session";
import { logAiUsage } from "@/lib/ai-settings";
import { canUseRealtimeVoice, REALTIME_VOICE_MODEL } from "@/lib/assistant/voice-realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * OBSERVABILITÉ DE LA VOIX — le client mesure (connexion, premier audio, barge-in, outils) et
 * dépose ici des ÉVÉNEMENTS STRUCTURÉS, sans aucun contenu audio ni transcription sensible :
 * des timings et des compteurs. La fin de session alimente AiUsageLog (le même registre que le
 * reste de l'IA), le détail vit dans les logs serveur.
 */
const EVENTS = new Set([
  "voice_session_connected", "voice_first_audio_out", "voice_interruption",
  "voice_reconnect", "voice_session_error", "voice_session_closed",
  // Politique de barge-in confirmé : bruit ignoré (la réponse continue) / vraie coupure (latence).
  "voice_false_barge_in_ignored", "voice_barge_in_confirmed",
  // Propriété de la réponse (fiabilité de restitution) : résultat restitué (latence job→voix),
  // complétion muette rattrapée, watchdog déclenché, échec terminal (persisté au fil).
  "voice_pending_turn_delivered", "voice_silent_completion",
  "voice_watchdog_recovered", "voice_delivery_failed",
  // Hygiène anti-fantôme : réponse auto au bruit annulée avant d'avoir parlé.
  "voice_phantom_response_cancelled",
]);

export async function POST(req: Request) {
  const user = await requireUser();
  if (!canUseRealtimeVoice(user)) return Response.json({ ok: false }, { status: 403 });

  let body: {
    event?: string; connectMs?: number; firstAudioMs?: number; sessionMs?: number;
    toolCalls?: number; toolErrors?: number; interruptions?: number; turns?: number;
    // Fiabilité de restitution (BUG « analyse muette ») et hygiène anti-fantôme — voir
    // call-provider.tsx : les DEUX SLO se calculent depuis ces compteurs.
    latencyMs?: number; count?: number;
    deliveriesReady?: number; deliveriesDone?: number; deliveryLatencyMs?: number;
    silentCompletions?: number; watchdogRecoveries?: number; deliveryFailures?: number;
    staleEventsIgnored?: number; phantomCancels?: number;
    falseBargeInsIgnored?: number; bargeInLatencyMs?: number;
    reasonCode?: string; detail?: string;
  };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false }, { status: 400 }); }
  const event = typeof body.event === "string" && EVENTS.has(body.event) ? body.event : "voice_event";

  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
  const payload = {
    userId: user.id, model: REALTIME_VOICE_MODEL,
    connectMs: num(body.connectMs), firstAudioMs: num(body.firstAudioMs), sessionMs: num(body.sessionMs),
    toolCalls: num(body.toolCalls), toolErrors: num(body.toolErrors),
    interruptions: num(body.interruptions), turns: num(body.turns),
    latencyMs: num(body.latencyMs), count: num(body.count),
    deliveriesReady: num(body.deliveriesReady), deliveriesDone: num(body.deliveriesDone),
    deliveryLatencyMs: num(body.deliveryLatencyMs), silentCompletions: num(body.silentCompletions),
    watchdogRecoveries: num(body.watchdogRecoveries), deliveryFailures: num(body.deliveryFailures),
    staleEventsIgnored: num(body.staleEventsIgnored), phantomCancels: num(body.phantomCancels),
    falseBargeInsIgnored: num(body.falseBargeInsIgnored), bargeInLatencyMs: num(body.bargeInLatencyMs),
    reasonCode: typeof body.reasonCode === "string" ? body.reasonCode.slice(0, 80) : undefined,
    detail: typeof body.detail === "string" ? body.detail.slice(0, 300) : undefined,
  };
  console.info(`[voice] ${event}`, payload);

  // La fin de session (ou son échec) rejoint le registre d'usage IA — coût et latences suivis
  // PAR UTILISATEUR, comme le texte. ttftMs = premier audio entendu (le « ressenti » vocal).
  if (event === "voice_session_closed" || event === "voice_session_error") {
    await logAiUsage({
      feature: "voice_realtime", provider: "openai", model: REALTIME_VOICE_MODEL, userId: user.id,
      ok: event === "voice_session_closed",
      latencyMs: payload.sessionMs, ttftMs: payload.firstAudioMs,
      turns: payload.turns, toolCalls: payload.toolCalls, toolErrors: payload.toolErrors,
      errorCode: event === "voice_session_error" ? (payload.reasonCode ?? "error") : null,
    });
  }
  return Response.json({ ok: true });
}
