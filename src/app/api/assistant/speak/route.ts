import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { synthesizeSpeech, ttsConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * LA VOIX DE L'ASSISTANT — synthétise UNE phrase (MP3) pour le mode conversation vocale.
 *
 * Le client découpe la réponse en phrases et les demande ICI au fil de l'eau : la voix démarre
 * dès la première phrase, sans attendre la fin de la génération. Le texte vient de la réponse de
 * l'assistant (déjà produite côté serveur) — cette route ne fait que le vocaliser, elle ne
 * décide rien. Textes courts uniquement (bornés côté serveur), identité issue de la session.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "VIEW")) return new Response("Non autorisé.", { status: 403 });
  if (!ttsConfigured()) return Response.json({ error: "Synthèse vocale non configurée (clé OPENAI_API_KEY absente)." }, { status: 503 });

  let body: { text?: string };
  try { body = (await req.json()) as typeof body; } catch { return new Response("Requête invalide.", { status: 400 }); }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return new Response("Texte vide.", { status: 400 });

  const r = await synthesizeSpeech(text);
  if (!r.ok || !r.audio) return Response.json({ error: r.error ?? "Synthèse impossible." }, { status: 502 });
  return new Response(new Uint8Array(r.audio), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
