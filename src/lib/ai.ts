/**
 * Couche IA partagée (Anthropic / Claude) — **serveur uniquement**.
 *
 * La clé n'est jamais exposée au client : tous les appels passent par des routes
 * serveur ou des server actions qui importent ce module. Sans `ANTHROPIC_API_KEY`,
 * les fonctions renvoient `{ configured: false }` et l'UI affiche un état
 * « IA non configurée » plutôt que de planter — la clé se pose sur Render.
 *
 * Réutilisé par : Process Intelligence (synthèse), Rapports vocaux (analyse), Chatbot.
 */

export interface AiTextResult {
  ok: boolean;
  configured: boolean;
  text?: string;
  error?: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function aiModel(): string {
  return process.env.AI_MODEL ?? DEFAULT_MODEL;
}

interface AskOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

interface AnthropicBlock {
  type: string;
  text?: string;
}

/** Appel texte simple à Claude. Renvoie le texte concaténé des blocs de réponse. */
export async function askClaude(prompt: string, opts: AskOptions = {}): Promise<AiTextResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, configured: false, error: "Clé ANTHROPIC_API_KEY non configurée." };

  const base = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
  const model = opts.model ?? aiModel();

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.3,
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[ai] anthropic error", res.status, body.slice(0, 300));
      return { ok: false, configured: true, error: `Erreur IA (HTTP ${res.status}).` };
    }
    const data = (await res.json()) as { content?: AnthropicBlock[] };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n")
      .trim();
    return { ok: true, configured: true, text };
  } catch (err) {
    console.error("[ai] call failed", err);
    return { ok: false, configured: true, error: "Appel à l'IA impossible (réseau)." };
  }
}
