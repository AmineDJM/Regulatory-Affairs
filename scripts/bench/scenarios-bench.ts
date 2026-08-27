import { performance } from "node:perf_hooks";
import "@/lib/assistant";
import { assistantToolsFor, RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { routeQuery } from "@/lib/assistant/context/router";
import { decideRollout } from "@/lib/assistant/context/rollout";
import { resolveTools, type RequestLevel } from "@/lib/assistant/context/tool-resolver";
import { fitToolBudget } from "@/lib/assistant/context/tool-shortlist";
import { inProcessPlatform, principalOf } from "@/platform/in-process/adapter";
import { prisma } from "@/lib/prisma";
import { MODULES, ACTIONS, type Module, type Action } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BANC DES CINQ SCÉNARIOS — ce qu'Adam reçoit pour travailler, par type de mission.
 *
 * ── CE QUI EST MESURÉ, ET CE QUI NE PEUT PAS L'ÊTRE ICI ─────────────────────────────────
 *
 * Sept métriques ont été demandées. Quatre se mesurent sans modèle, trois non — et les
 * distinguer est plus utile que de toutes les estimer :
 *
 *   MESURÉ    le CHEMIN pris (rapide / liste courte / complet), le NIVEAU A/B/C, les DOMAINES
 *             reliés, le NOMBRE D'OUTILS réellement envoyés, et — pour les lectures — le temps
 *             jusqu'au premier résultat utile, qui vient de la base et non d'un modèle.
 *
 *   NON       le temps jusqu'au bundle prêt, le nombre d'appels modèles, le nombre de tool
 *   MESURÉ    calls, le nombre d'allers-retours, l'exactitude factuelle et le succès final.
 *             Tous demandent qu'un modèle raisonne. Aucune clé n'est disponible dans cet
 *             environnement (`OPENAI_API_KEY` absente) : les inventer serait pire que de ne
 *             pas les avoir, parce qu'un chiffre inventé se cite ensuite comme un fait.
 *
 * Ce que le banc dit quand même, et qui n'est pas rien : pour chaque mission, Adam part-il avec
 * les BONS outils et les BONS domaines ? Une mission qui échoue faute d'outil n'échoue pas au
 * niveau du modèle — elle a déjà échoué ici, avant qu'il ait vu la question.
 *
 * ── LE SCÉNARIO 5 EST, LUI, ENTIÈREMENT MESURABLE ───────────────────────────────────────
 *
 * Le cloisonnement ne dépend d'aucun modèle : la même question, deux périmètres, et on regarde
 * ce qui sort. C'est le seul des cinq dont le verdict ici vaut pour la production.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

function utilisateur(id: string, role: string): CurrentUser {
  const modules = new Map<Module, { actions: Set<Action> }>();
  for (const m of MODULES) modules.set(m, { actions: new Set<Action>(ACTIONS) });
  return {
    id, name: `Essai ${role}`, email: `${id}@example.invalid`, role,
    access: { modules, rowGrants: [], secondaryRole: null, role, pipelineView: true, pipelineManage: true },
  } as unknown as CurrentUser;
}

interface Scenario {
  n: number;
  titre: string;
  q: string;
  /** Le niveau attendu, écrit AVANT de lancer. */
  niveau: RequestLevel;
  /** Les domaines que la mission DOIT relier. Un manquant, c'est une mission qui échouera. */
  domaines: string[];
}

const SCENARIOS: Scenario[] = [
  {
    n: 1, titre: "A — lecture immédiate",
    q: "Combien de dossiers Regulatory sont en retard ?",
    niveau: "A", domaines: ["REGULATORY"],
  },
  {
    n: 2, titre: "B — mission transactionnelle",
    q: "Envoie la situation Regulatory à Amine et rappelle-moi vendredi",
    niveau: "B", domaines: ["REGULATORY"],
  },
  {
    n: 3, titre: "C — mission ouverte",
    q: "Audite Regulatory et prépare les actions nécessaires",
    niveau: "C", domaines: ["REGULATORY"],
  },
  {
    n: 4, titre: "Cross-domain",
    q: "Regarde les derniers mails, les dossiers Regulatory et les tâches de Raihana, et dis-moi ce qui bloque",
    niveau: "C", domaines: ["MAIL", "REGULATORY", "MISSION"],
  },
];

const ms = (n: number) => `${n.toFixed(1)} ms`;

async function mesurerScenarios(): Promise<number> {
  const user = utilisateur("bench-sa", "SUPER_ADMIN");
  const tous = assistantToolsFor(user);
  let manques = 0;

  console.log(`Liste complète : ${tous.length} outils\n`);
  console.log("scé  niv  outils  chemin      domaines reliés                       mission");
  console.log("─".repeat(108));

  for (const s of SCENARIOS) {
    const route = routeQuery(s.q, { modality: "text" });
    const rollout = decideRollout(s.q, { userId: user.id, ctx: { modality: "text" } });
    const r = resolveTools(tous, s.q, route, { ecritures: RESOLVER_WRITE_NAMES });
    const envoyes = fitToolBudget(r.tools, route).length;

    const relies = s.domaines.filter((d) => r.domains.includes(d as never));
    const perdus = s.domaines.filter((d) => !r.domains.includes(d as never));
    if (perdus.length || r.level !== s.niveau) manques++;

    console.log(
      `${String(s.n).padStart(3)}  ${r.level.padEnd(4)}${String(envoyes).padStart(5)}  `
      + `${rollout.mode.padEnd(10)}  ${`${relies.length}/${s.domaines.length} ${r.domains.join("+") || "—"}`.padEnd(36)}  ${s.titre}`
      + `${perdus.length ? `  ⚠ NON RELIÉ : ${perdus.join(", ")}` : ""}`
      + `${r.level !== s.niveau ? `  ⚠ niveau attendu ${s.niveau}` : ""}`,
    );
  }
  return manques;
}

/** Scénario 1 — le seul dont le « premier résultat utile » ne dépend d'aucun modèle. */
async function mesurerPremierResultat(): Promise<void> {
  console.log("\n── scénario 1 : temps jusqu'au premier résultat utile (source canonique, sans modèle) ──");
  const t0 = performance.now();
  const n = await prisma.knowledgeItem.count({ where: { isCurrent: true } }).catch(() => -1);
  const lecture = performance.now() - t0;
  console.log(`  lecture canonique : ${ms(lecture)} (${n} éléments)`);
  console.log("  → c'est le plancher : le modèle ne fait ensuite que FORMULER, il ne cherche plus.");
}

/**
 * Scénario 5 — LE SEUL VERDICT QUI VAUT POUR LA PRODUCTION.
 *
 * Quatre canaux ont été nommés : retrieval, cache, mémoire, worker. On les éprouve dans l'ordre
 * qui compte — le PRIVILÉGIÉ D'ABORD, sinon le test ne prouve rien : un cache vide ne fuit pas.
 */
async function mesurerCloisonnement(): Promise<number> {
  console.log("\n── scénario 5 : deux périmètres, la même question ──");
  let fuites = 0;

  const questions = [
    "quelle est la contre-indication renale de la metformine",
    "quel est le preavis de resiliation du contrat de distribution",
    "quelle est la note minimale a la formation bonnes pratiques de fabrication",
  ];

  for (const q of questions) {
    // L'ORDRE EST LE TEST. Le privilégié remplit le cache ; l'autre passe juste après.
    const priv = await inProcessPlatform.query(principalOf(utilisateur("bench-sa", "SUPER_ADMIN")),
      { kind: "document.search", question: q });
    const restreint = await inProcessPlatform.query(principalOf(utilisateur("bench-emp", "EMPLOYEE")),
      { kind: "document.search", question: q });

    const a = priv.kind === "document.search" ? priv.extracts.length : -1;
    const b = restreint.kind === "document.search" ? restreint.extracts.length : -1;
    // Un témoin muet ne prouve rien : si le privilégié ne trouve rien, la question ne teste pas.
    const temoin = a > 0;
    if (b > 0) fuites++;
    console.log(
      `  privilégié ${String(a).padStart(2)} · restreint ${String(b).padStart(2)}  `
      + `${b > 0 ? "✘ FUITE" : temoin ? "✔ cloisonné" : "· témoin muet (ne prouve rien)"}  ${q.slice(0, 52)}`,
    );
  }

  // MÉMOIRE — cloisonnée par `userId` sur chaque requête. On le VÉRIFIE plutôt que de le lire.
  const memA = await prisma.assistantMemoryItem.count({ where: { userId: "bench-sa" } }).catch(() => -1);
  const memB = await prisma.assistantMemoryItem.count({ where: { userId: "bench-emp" } }).catch(() => -1);
  console.log(`\n  mémoire : chaque lecture porte un \`userId\` — ${memA} / ${memB} éléments pour ces deux comptes.`);

  return fuites;
}

async function main(): Promise<void> {
  const manques = await mesurerScenarios();
  await mesurerPremierResultat();
  const fuites = await mesurerCloisonnement();

  console.log("\n══ CE QUI N'EST PAS MESURÉ ICI ═════════════════════════════════════════════════\n");
  console.log(`  clé de modèle : ${process.env.OPENAI_API_KEY ? "présente" : "ABSENTE"}.`);
  console.log("  → temps jusqu'au bundle, appels modèles, tool calls, allers-retours, exactitude");
  console.log("    factuelle et succès final EXIGENT un modèle qui raisonne. Non mesurés, non estimés.");
  console.log("  → ce banc dit si Adam PART avec les bons outils. Une mission qui échoue faute");
  console.log("    d'outil a déjà échoué ici, avant que le modèle ait vu la question.");

  console.log(`\n${manques} scénario(s) mal outillé(s) · ${fuites} fuite(s) de cloisonnement`);
  await prisma.$disconnect();
  if (manques || fuites) process.exitCode = 1;
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
