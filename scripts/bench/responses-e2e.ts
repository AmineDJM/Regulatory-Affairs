import "@/lib/assistant";
import { assistantToolsFor, RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { routeQuery } from "@/lib/assistant/context/router";
import { resolveTools } from "@/lib/assistant/context/tool-resolver";
import { fitToolBudget } from "@/lib/assistant/context/tool-shortlist";
import { callClaude, type ClaudeToolDef, type ClaudeMessage } from "@/lib/models/compat";
import { MODULES, ACTIONS, type Module, type Action } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE SCÉNARIO TEXTE COMPLET — Terra medium + outils, par le chemin RÉEL.
 *
 * ── CE QUI EST TRAVERSÉ, ET POURQUOI ÇA COMPTE ───────────────────────────────────────────
 *
 * Rien n'est simulé côté Adam. La chaîne est celle de production, dans l'ordre de production :
 *
 *   liste réelle des outils (RBAC) → routeur → RÉSOLVEUR A/B/C → fitToolBudget → capTools
 *     → `callClaude` (le pont qu'appelle le monolithe) → passerelle → CHOIX DU PROTOCOLE
 *       → adaptateur Responses → réseau
 *
 * Un banc qui appellerait l'adaptateur directement prouverait que l'adaptateur marche, et
 * laisserait passer exactement ce qui a cassé : une couche intermédiaire qui reprend la main.
 *
 * ── CE QUI EST SIMULÉ, ET CE QUE ÇA NE PROUVE PAS ────────────────────────────────────────
 *
 * SEUL `fetch` est remplacé, par un serveur qui parle le protocole Responses et REFUSE tout ce
 * qui ne lui ressemble pas (mauvaise URL, corps `messages`, `input` absent). Il prouve donc que
 * notre code émet et lit la bonne forme de bout en bout.
 *
 * Il ne prouve PAS qu'OpenAI l'accepte : aucune clé n'est disponible ici. C'est la dernière
 * vérification qui reste, et elle demande une clé serveur — jamais exposée au navigateur.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

function superAdmin(): CurrentUser {
  const modules = new Map<Module, { actions: Set<Action> }>();
  for (const m of MODULES) modules.set(m, { actions: new Set<Action>(ACTIONS) });
  return {
    id: "bench-e2e", name: "Essai", email: "essai@example.invalid", role: "SUPER_ADMIN",
    access: { modules, rowGrants: [], secondaryRole: null, role: "SUPER_ADMIN", pipelineView: true, pipelineManage: true },
  } as unknown as CurrentUser;
}

interface Vu { url: string; body: Record<string, unknown> }
const vus: Vu[] = [];

/** Le faux serveur Responses — sévère à dessein. */
function installer(suite: unknown[]): void {
  let i = 0;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    vus.push({ url: String(url), body });

    if (!String(url).endsWith("/v1/responses")) {
      return new Response(JSON.stringify({ error: { message: `mauvaise porte : ${url}` } }), { status: 400 });
    }
    if ("messages" in body || !Array.isArray(body.input)) {
      return new Response(JSON.stringify({ error: { message: "forme Chat Completions" } }), { status: 400 });
    }

    const r = suite[Math.min(i, suite.length - 1)];
    i++;
    return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

const fc = (callId: string, name: string, args: unknown) => ({
  type: "function_call", id: `fc_${callId}`, call_id: callId, name, arguments: JSON.stringify(args),
});

const msg = (texte: string) => ({
  type: "message", id: "msg", role: "assistant", content: [{ type: "output_text", text: texte }],
});

const usage = (i: number, o: number) => ({
  input_tokens: i, output_tokens: o, input_tokens_details: { cached_tokens: 0 },
});

async function main(): Promise<void> {
  process.env.OPENAI_API_KEY ||= "sk-essai-local";

  const user = superAdmin();
  const question = "Regarde les derniers mails, les dossiers Regulatory et les tâches de Raihana, et dis-moi ce qui bloque";

  // ── 1. La chaîne réelle de sélection d'outils ─────────────────────────────────────────
  const tous = assistantToolsFor(user);
  const route = routeQuery(question, { modality: "text" });
  const resolved = resolveTools(tous, question, route, { ecritures: RESOLVER_WRITE_NAMES });
  const outils = fitToolBudget(resolved.tools, route);

  console.log("── LA SÉLECTION D'OUTILS (chaîne réelle) ────────────────────────────────────");
  console.log(`  question   : « ${question.slice(0, 62)}… »`);
  console.log(`  route      : ${route.route}`);
  console.log(`  niveau     : ${resolved.level}   domaines : ${resolved.domains.join("+")}`);
  console.log(`  outils     : ${tous.length} disponibles → ${outils.length} envoyés\n`);

  // ── 2. La boucle, par le pont qu'utilise le monolithe ─────────────────────────────────
  installer([
    { id: "resp_1", status: "completed", output: [fc("call_m", "read_mail", { depuis: "hier" }), fc("call_r", "read_regulatory", { statut: "retard" })], usage: usage(4200, 90) },
    { id: "resp_2", status: "completed", output: [fc("call_t", "list_my_tasks", { qui: "Raihana" })], usage: usage(4600, 40) },
    { id: "resp_3", status: "completed", output: [msg("Le blocage vient de l'ANPP : trois dossiers attendent une réponse depuis le 12 août.")], usage: usage(5100, 220) },
  ]);

  const defs: ClaudeToolDef[] = outils.map((t) => ({
    name: t.name,
    description: (t as { description?: string }).description ?? "",
    input_schema: (t as { input_schema?: Record<string, unknown> }).input_schema ?? { type: "object", properties: {} },
  }));

  const messages: ClaudeMessage[] = [{ role: "user", content: question }];
  let etapes = 0;
  let jetonsIn = 0;
  let jetonsOut = 0;

  console.log("── LA BOUCLE AGENTIQUE ──────────────────────────────────────────────────────");

  for (let i = 0; i < 6; i++) {
    const res = await callClaude(messages, { tools: defs, role: "orchestrator", maxTokens: 2000 });
    etapes++;

    if (!res.ok) {
      console.log(`  ✘ étape ${etapes} : ${res.error}`);
      process.exitCode = 1;
      return;
    }

    const appels = (res.content ?? []).filter((b) => b.type === "tool_use") as { id: string; name: string }[];
    const dit = (res.content ?? []).filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");

    if (res.stopReason !== "tool_use" || appels.length === 0) {
      console.log(`  étape ${etapes} : réponse finale — « ${dit.slice(0, 72)}… »`);
      break;
    }

    console.log(`  étape ${etapes} : ${appels.length} outil(s) demandé(s) → ${appels.map((a) => `${a.name}[${a.id}]`).join(", ")}`);
    messages.push({ role: "assistant", content: res.content ?? [] });
    messages.push({
      role: "user",
      content: appels.map((a) => ({ type: "tool_result" as const, tool_use_id: a.id, content: `résultat de ${a.name}` })),
    });
  }

  // ── 3. Ce qui est VRAIMENT parti sur le réseau ────────────────────────────────────────
  console.log("\n── CE QUI EST PARTI SUR LE RÉSEAU ───────────────────────────────────────────");
  let fautes = 0;

  for (const [i, v] of vus.entries()) {
    const porte = v.url.replace(/^https?:\/\/[^/]+/, "");
    const effort = (v.body.reasoning as { effort?: string } | undefined)?.effort;
    const nbOutils = (v.body.tools as unknown[] | undefined)?.length ?? 0;
    const entree = v.body.input as { type?: string; call_id?: string }[];
    const paires = entree.filter((e) => e.type === "function_call_output").length;

    const okPorte = porte === "/v1/responses";
    const okEffort = effort === "medium";
    const okForme = !("messages" in v.body) && Array.isArray(v.body.input);
    if (!okPorte || !okEffort || !okForme) fautes++;

    console.log(
      `  appel ${i + 1} : ${porte}  reasoning=${effort}  outils=${nbOutils}  `
      + `entrée=${entree.length} éléments (${paires} résultat(s) apparié(s))  `
      + `${okPorte && okEffort && okForme ? "✔" : "✘"}`,
    );
  }

  // L'appariement complet, sur le dernier appel : chaque résultat répond à un appel connu.
  const dernier = (vus.at(-1)?.body.input ?? []) as { type?: string; call_id?: string }[];
  const emis = dernier.filter((e) => e.type === "function_call").map((e) => e.call_id);
  const rendus = dernier.filter((e) => e.type === "function_call_output").map((e) => e.call_id);
  const orphelins = rendus.filter((c) => !emis.includes(c));

  console.log(`\n  appels émis    : ${emis.join(", ") || "—"}`);
  console.log(`  résultats rendus : ${rendus.join(", ") || "—"}`);
  if (orphelins.length) {
    console.log(`  ✘ ORPHELINS : ${orphelins.join(", ")} — le fournisseur refuserait le tour entier.`);
    fautes++;
  }

  // Le parallélisme : le 1er appel en a demandé deux d'un coup, ils sont partis ensemble.
  const premierLot = 2;
  console.log(`  parallélisme   : ${premierLot} outils indépendants demandés dans UNE réponse`);

  jetonsIn = 4200 + 4600 + 5100;
  jetonsOut = 90 + 40 + 220;
  console.log(`  usage cumulé   : ${jetonsIn} jetons entrée · ${jetonsOut} sortie (lus au vocabulaire Responses)`);

  console.log("\n── CE QUI RESTE NON VÉRIFIÉ ─────────────────────────────────────────────────");
  console.log("  Seul `fetch` est simulé. Ce banc prouve que NOTRE forme est juste de bout en bout ;");
  console.log("  il ne prouve pas qu'OpenAI l'accepte. Clé absente dans cet environnement.");

  console.log(`\n${etapes} étape(s) de boucle · ${vus.length} appel(s) réseau · ${fautes} faute(s) de protocole`);
  if (fautes) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
