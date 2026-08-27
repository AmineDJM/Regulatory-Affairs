import "@/lib/assistant";
import { assistantToolsFor, RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { routeQuery } from "@/lib/assistant/context/router";
import { resolveTools } from "@/lib/assistant/context/tool-resolver";
import { fitToolBudget } from "@/lib/assistant/context/tool-shortlist";
import { callModel, streamModel } from "@/lib/models/gateway";
import { bindingFor } from "@/lib/models/registry";
import { describeRequest } from "@/lib/models/capabilities";
import { textOf, toolCallsOf, type ModelToolDef, type ModelTurn } from "@/lib/models/contract";
import { MODULES, ACTIONS, type Module, type Action } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES SMOKE TESTS RÉELS — vrai réseau, vraie clé, aucun stub.
 *
 * ── POURQUOI CE SCRIPT EST HORS CI ───────────────────────────────────────────────────────
 *
 * Il consomme l'API. On ne fait pas payer une facture à chaque `git push`. Il se lance à la
 * main, après un changement de la couche modèle ou d'un identifiant de modèle :
 *
 *     OPENAI_API_KEY=sk-… npx tsx scripts/smoke/openai-live.ts
 *
 * ── CE QU'IL PROUVE, ET QUE RIEN D'AUTRE NE PROUVE ───────────────────────────────────────
 *
 * Les tests unitaires vérifient que nous n'envoyons jamais ce que la fiche interdit. C'est la
 * moitié qui a cassé, et elle est vérifiable sans réseau. L'autre moitié — « OpenAI accepte-t-il
 * réellement cette forme ? » — ne se vérifie qu'ici. Les confondre serait refaire l'erreur qui a
 * produit les deux HTTP 400 : croire vérifié ce qui n'a jamais été envoyé.
 *
 * ── LES CINQ ÉPREUVES ────────────────────────────────────────────────────────────────────
 *
 *   1. Terra medium, sans outil.
 *   2. Terra medium + un outil.
 *   3. Terra medium + plusieurs outils.
 *   4. Appel d'outil → `function_call_output` → réponse finale.
 *   5. Une vraie mission C d'Adam, avec le résolveur d'outils réel.
 *
 * ── CE QUI EST INTERDIT ICI ──────────────────────────────────────────────────────────────
 *
 * Aucune écriture métier : les outils de l'épreuve 5 sont DÉCRITS au modèle, jamais exécutés.
 * Un smoke test qui modifie l'ERP n'est plus un smoke test.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const OUTIL = (name: string, description: string): ModelToolDef => ({
  name,
  description,
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "ce qu'on cherche" } },
    required: [],
  },
});

let reussis = 0;
let echoues = 0;

function verdict(nom: string, ok: boolean, detail: string): void {
  if (ok) reussis++; else echoues++;
  console.log(`  ${ok ? "✔" : "✘"} ${nom} — ${detail}`);
}

/** L'usage, en une ligne — pour voir tout de suite si le budget de raisonnement suffit. */
const usageOf = (u: { inputTokens: number; outputTokens: number; ms: number; costUsd: number | null }) =>
  `${u.inputTokens}→${u.outputTokens} jetons · ${u.ms} ms · ${u.costUsd == null ? "coût inconnu" : `$${u.costUsd.toFixed(6)}`}`;

async function test1(): Promise<void> {
  const r = await callModel("orchestrator", [
    { role: "user", content: "Réponds en une phrase : quelle est la capitale de l'Algérie ?" },
  ], { maxOutputTokens: 4000 });

  verdict(
    "1. Terra medium, sans outil",
    r.ok && textOf(r.blocks).length > 0,
    r.ok ? `« ${textOf(r.blocks).slice(0, 60)} » · ${usageOf(r.usage)}` : `ÉCHEC : ${r.error}`,
  );
}

async function test2(): Promise<void> {
  const r = await callModel("orchestrator", [
    { role: "user", content: "Cherche les dossiers réglementaires en retard. Utilise l'outil." },
  ], {
    tools: [OUTIL("read_regulatory", "Lit les dossiers réglementaires et leur statut.")],
    maxOutputTokens: 4000,
  });

  const appels = toolCallsOf(r.blocks);
  verdict(
    "2. Terra medium + 1 outil",
    r.ok && appels.length >= 1,
    r.ok ? `${appels.length} appel(s) : ${appels.map((a) => a.name).join(", ")} · ${usageOf(r.usage)}` : `ÉCHEC : ${r.error}`,
  );
}

async function test3(): Promise<void> {
  const r = await callModel("orchestrator", [
    {
      role: "user",
      content:
        "Regarde les derniers mails, les dossiers réglementaires en retard et les tâches ouvertes. "
        + "Ce sont trois sources indépendantes : interroge-les.",
    },
  ], {
    tools: [
      OUTIL("read_mail", "Lit les derniers messages reçus."),
      OUTIL("read_regulatory", "Lit les dossiers réglementaires et leur statut."),
      OUTIL("read_tasks", "Lit les tâches ouvertes."),
    ],
    maxOutputTokens: 4000,
  });

  const appels = toolCallsOf(r.blocks);
  verdict(
    "3. Terra medium + plusieurs outils",
    r.ok && appels.length >= 1,
    r.ok
      ? `${appels.length} appel(s) dans UNE réponse : ${appels.map((a) => a.name).join(", ")}`
        + `${appels.length > 1 ? " → exécutables de front" : " (le modèle a choisi d'en appeler un seul)"} · ${usageOf(r.usage)}`
      : `ÉCHEC : ${r.error}`,
  );
}

async function test4(): Promise<void> {
  const tools = [OUTIL("read_regulatory", "Lit les dossiers réglementaires et leur statut.")];
  const turns: ModelTurn[] = [
    { role: "user", content: "Combien de dossiers réglementaires sont en retard ? Utilise l'outil puis réponds." },
  ];

  const premier = await callModel("orchestrator", turns, { tools, maxOutputTokens: 4000 });
  const appels = toolCallsOf(premier.blocks);
  if (!premier.ok || appels.length === 0) {
    verdict("4. appel d'outil → résultat → réponse finale", false,
      premier.ok ? "le modèle n'a appelé aucun outil : l'aller-retour n'a pas pu être éprouvé" : `ÉCHEC : ${premier.error}`);
    return;
  }

  turns.push({ role: "assistant", content: premier.blocks });
  turns.push({
    role: "user",
    content: appels.map((a) => ({
      type: "tool_result" as const,
      callId: a.id,
      content: JSON.stringify({ enRetard: 3, exemples: ["Pembrolizumab", "Nivolumab", "Isotrétinoïne"] }),
    })),
  });

  const second = await callModel("orchestrator", turns, { tools, maxOutputTokens: 4000 });
  const dit = textOf(second.blocks);
  verdict(
    "4. appel d'outil → function_call_output → réponse finale",
    second.ok && dit.length > 0,
    second.ok
      ? `call_id ${appels.map((a) => a.id).join(", ")} apparié · « ${dit.slice(0, 70)} » · ${usageOf(second.usage)}`
      : `ÉCHEC : ${second.error}`,
  );
}

function superAdmin(): CurrentUser {
  const modules = new Map<Module, { actions: Set<Action> }>();
  for (const m of MODULES) modules.set(m, { actions: new Set<Action>(ACTIONS) });
  return {
    id: "smoke-sa", name: "Smoke", email: "smoke@example.invalid", role: "SUPER_ADMIN",
    access: { modules, rowGrants: [], secondaryRole: null, role: "SUPER_ADMIN", pipelineView: true, pipelineManage: true },
  } as unknown as CurrentUser;
}

async function test5(): Promise<void> {
  const question =
    "Regarde les derniers mails, les dossiers Regulatory et les tâches de Raihana, et dis-moi ce qui bloque";
  const user = superAdmin();
  const tous = assistantToolsFor(user);
  const route = routeQuery(question, { modality: "text" });
  const resolved = resolveTools(tous, question, route, { ecritures: RESOLVER_WRITE_NAMES });
  const outils = fitToolBudget(resolved.tools, route);

  const defs: ModelToolDef[] = outils.map((t) => ({
    name: t.name,
    description: (t as { description?: string }).description ?? "",
    parameters: (t as { input_schema?: Record<string, unknown> }).input_schema ?? { type: "object", properties: {} },
  }));

  console.log(`     (résolveur : ${tous.length} outils → ${defs.length} envoyés · niveau ${resolved.level} · ${resolved.domains.join("+")})`);

  const r = await callModel("orchestrator", [{ role: "user", content: question }], {
    tools: defs,
    // LE BUDGET COUVRE AUSSI LE RAISONNEMENT : un plafond serré sur un Terra medium produit une
    // réponse vide, pas une réponse courte.
    maxOutputTokens: 8000,
  });

  const appels = toolCallsOf(r.blocks);
  verdict(
    "5. mission C réelle, avec le Tool Resolver",
    r.ok,
    r.ok
      ? `${defs.length} outils décrits · ${appels.length} appel(s) demandé(s)`
        + `${appels.length ? ` : ${appels.slice(0, 4).map((a) => a.name).join(", ")}` : ""} · ${usageOf(r.usage)}`
      : `ÉCHEC : ${r.error}`,
  );
}

async function testStream(): Promise<void> {
  let morceaux = 0;
  const r = await streamModel("orchestrator", [
    { role: "user", content: "Cite trois qualités d'un bon dossier réglementaire, en une phrase chacune." },
  ], { maxOutputTokens: 4000 }, () => { morceaux++; });

  verdict(
    "6. streaming (bonus)",
    r.ok && textOf(r.blocks).length > 0,
    r.ok ? `${morceaux} fragment(s) reçu(s) · ${usageOf(r.usage)}` : `ÉCHEC : ${r.error}`,
  );
}

async function main(): Promise<void> {
  if (!(process.env.OPENAI_API_KEY ?? "").trim()) {
    console.error(
      "OPENAI_API_KEY absente.\n\n"
      + "Ce script fait de VRAIS appels : sans clé, il ne prouverait rien. Le lancer sans clé et\n"
      + "annoncer « tout va bien » serait exactement l'erreur qui a produit les deux HTTP 400.\n\n"
      + "  OPENAI_API_KEY=sk-… npx tsx scripts/smoke/openai-live.ts",
    );
    process.exit(1);
  }

  const b = bindingFor("orchestrator");
  console.log("══ SMOKE OPENAI — VRAI RÉSEAU ══════════════════════════════════════════════\n");
  console.log(`  liaison : ${b.role} → ${b.model} · reasoning=${b.reasoning}`);
  console.log("  forme de l'appel (expurgée) :");
  console.log(`  ${JSON.stringify(describeRequest({
    model: b.model, protocol: "responses", reasoning: b.reasoning, toolCount: 0,
    params: { maxOutputTokens: 4000, store: false, textVerbosity: "medium" },
  }))}\n`);

  await test1();
  await test2();
  await test3();
  await test4();
  await test5();
  await testStream();

  console.log(`\n${reussis} réussi(s) · ${echoues} échec(s)`);
  if (echoues > 0) {
    console.log(
      "\nUn échec « unsupported parameter » signifie qu'il MANQUE une contrainte dans\n"
      + "src/lib/models/capabilities.ts. Ne le corrigez pas en retirant le champ à la volée :\n"
      + "la contrainte doit être connue AVANT le réseau, sinon la prochaine reviendra.",
    );
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
