import "@/lib/assistant";
import { assistantToolsFor, RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { routeQuery } from "@/lib/assistant/context/router";
import { resolveTools, LEVEL_CAP, type RequestLevel } from "@/lib/assistant/context/tool-resolver";
import { fitToolBudget } from "@/lib/assistant/context/tool-shortlist";
import { MAX_TOOLS_PER_CALL } from "@/lib/models/openai";
import { MODULES, ACTIONS, type Module, type Action } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BANC DU RÉSOLVEUR — combien d'outils partent VRAIMENT, par type de demande.
 *
 * Le compte d'outils envoyés était, jusqu'à l'incident HTTP 400, une chose que personne ne
 * mesurait : ni test, ni journal, ni écran. Il a fallu une erreur en production pour apprendre
 * qu'on en envoyait 161. Ce banc existe pour que ce chiffre soit connu AVANT.
 *
 * Il se lit d'une ligne : `npx tsx scripts/bench/tool-resolver-bench.ts`. Aucune base, aucun
 * réseau, aucune clé — le résolveur est pur, et c'est ce qui rend la mesure reproductible.
 *
 * LES CIBLES sont celles fixées à la conception :
 *
 *   salutation   0 outil        — rien à faire, rien à décrire
 *   A            3 à 15         — une opération connue
 *   B            10 à 30        — plusieurs opérations connues
 *   C            15 à 40        — il faut découvrir quoi faire
 *
 * Elles sont VÉRIFIÉES ici et par `tool-resolver.test.ts`. Un banc qui affiche sans juger
 * laisse la dérive s'installer entre deux lectures.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

function superAdmin(): CurrentUser {
  const modules = new Map<Module, { actions: Set<Action> }>();
  for (const m of MODULES) modules.set(m, { actions: new Set<Action>(ACTIONS) });
  return {
    id: "bench", name: "Banc", email: "banc@example.invalid", role: "SUPER_ADMIN",
    access: { modules, rowGrants: [], secondaryRole: null, role: "SUPER_ADMIN", pipelineView: true, pipelineManage: true },
  } as unknown as CurrentUser;
}

/** Les demandes du banc, avec le niveau attendu ÉCRIT D'AVANCE. */
const CAS: { q: string; attendu: RequestLevel }[] = [
  // ── Rien à faire ────────────────────────────────────────────────────────────────────────
  { q: "Hello", attendu: "AUCUN" },
  { q: "Bonjour", attendu: "AUCUN" },
  { q: "merci !", attendu: "AUCUN" },
  { q: "ok parfait", attendu: "AUCUN" },
  { q: "Bonjour Adam", attendu: "AUCUN" },

  // ── A : une opération, connue d'avance ──────────────────────────────────────────────────
  { q: "Quel est le statut du dossier Pembrolizumab ?", attendu: "A" },
  { q: "Qui est le responsable du dossier Nivolumab ?", attendu: "A" },
  { q: "Combien de dossiers Regulatory sont en cours ?", attendu: "A" },
  { q: "Quel est le budget restant sur les moyens généraux ?", attendu: "A" },
  { q: "Mon prochain rendez-vous ?", attendu: "A" },
  { q: "L'email de Nadia Cherifi ?", attendu: "A" },
  { q: "Liste des congés en attente", attendu: "A" },

  // ── B : plusieurs opérations, plan connu ────────────────────────────────────────────────
  { q: "Envoie le dossier Regulatory à Amine et crée une tâche pour Khaled", attendu: "B" },
  { q: "Que dit le contrat de distribution sur le préavis de résiliation ?", attendu: "B" },
  { q: "Prépare un mail à l'ANPP et mets une relance dans l'agenda vendredi", attendu: "B" },
  { q: "Trouve le bon de commande Medilab et rattache-le au dossier legal", attendu: "B" },

  // ── C : il faut découvrir quoi faire ────────────────────────────────────────────────────
  { q: "Analyse pourquoi Regulatory prend du retard", attendu: "C" },
  { q: "Fais le tour de la situation des dossiers en cours", attendu: "C" },
  { q: "Pourquoi le budget réglementaire a-t-il dérapé ce trimestre ?", attendu: "C" },
  { q: "Audite l'ensemble des demandes bloquées et propose les actions", attendu: "C" },
];

/** Les bornes de la mission, verbatim. `0` pour une salutation. */
const CIBLE: Record<RequestLevel, [number, number]> = {
  AUCUN: [0, 0], A: [3, 15], B: [10, 30], C: [15, 40],
};

function main(): void {
  const tous = assistantToolsFor(superAdmin());
  console.log(`Liste complète : ${tous.length} outils · plafond API ${MAX_TOOLS_PER_CALL}\n`);
  console.log("niv  outils  cible     domaines                        demande");
  console.log("─".repeat(104));

  const parNiveau = new Map<RequestLevel, number[]>();
  let hors = 0;
  let niveauFaux = 0;

  for (const cas of CAS) {
    const route = routeQuery(cas.q, { modality: "text" });
    const r = resolveTools(tous, cas.q, route, { ecritures: RESOLVER_WRITE_NAMES });
    // Ce que le modèle recevrait vraiment : le résolveur, puis les garde-fous.
    const apresGarde = fitToolBudget(r.tools, route);
    const n = apresGarde.length;

    const [min, max] = CIBLE[r.level];
    const dans = n >= min && n <= max;
    if (!dans) hors++;
    if (r.level !== cas.attendu) niveauFaux++;
    parNiveau.set(r.level, [...(parNiveau.get(r.level) ?? []), n]);

    console.log(
      `${r.level.padEnd(5)}${String(n).padStart(4)}  ${`${min}–${max}`.padStart(7)}  `
      + `${(r.domains.join("+") || "—").padEnd(30)}  ${cas.q.slice(0, 44)}`
      + `${dans ? "" : "  ⚠HORS CIBLE"}${r.level === cas.attendu ? "" : `  ⚠niveau attendu ${cas.attendu}`}`,
    );
  }

  console.log("\n── par niveau ──");
  for (const niv of ["AUCUN", "A", "B", "C"] as RequestLevel[]) {
    const xs = parNiveau.get(niv);
    if (!xs?.length) continue;
    const [min, max] = CIBLE[niv];
    console.log(
      `  ${niv.padEnd(5)} n=${String(xs.length).padStart(2)}  `
      + `min ${String(Math.min(...xs)).padStart(3)}  max ${String(Math.max(...xs)).padStart(3)}  `
      + `moyenne ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1).padStart(5)}  `
      + `cible ${min}–${max}  plafond ${LEVEL_CAP[niv]}`,
    );
  }

  const tousLesN = [...parNiveau.values()].flat();
  console.log("\n── d'ensemble ──");
  console.log(`  ${CAS.length} demandes · min ${Math.min(...tousLesN)} · max ${Math.max(...tousLesN)} `
    + `· moyenne ${(tousLesN.reduce((a, b) => a + b, 0) / tousLesN.length).toFixed(1)}`);
  console.log(`  avant résolveur, chaque demande partait avec ${tous.length} outils.`);
  console.log(`  ${hors} hors cible · ${niveauFaux} niveau inattendu`);

  if (hors || niveauFaux) process.exitCode = 1;
}

main();
