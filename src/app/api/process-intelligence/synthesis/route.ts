import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { askClaude, aiConfigured, aiModel } from "@/lib/ai";
import { aiFeatureEnabled, logAiUsage } from "@/lib/ai-settings";
import { getProcessOverview, getWorkloadAnalysis } from "@/lib/queries/process-intelligence";

export const dynamic = "force-dynamic";

const SYSTEM = `Tu es analyste des opérations d'Adventum Pharma (laboratoire algérien).
À partir de métriques internes (durées, blocages, charge), tu produis une synthèse
en français, concise et actionnable. Pour chaque point clé : cause probable, action
recommandée, responsable à relancer, niveau d'urgence. Sois factuel, n'invente aucune
donnée absente. Ce n'est pas de la surveillance : l'objectif est d'améliorer les
processus. Réponds en markdown court (titres ##, listes), 200 mots maximum.`;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !userCan(user, "PROCESS_INTELLIGENCE", "VIEW")) {
    return NextResponse.json({ configured: false, error: "Non autorisé." }, { status: 403 });
  }
  if (!aiConfigured()) {
    return NextResponse.json({ configured: false });
  }
  if (!(await aiFeatureEnabled("process_intel"))) {
    return NextResponse.json({ configured: true, error: "La synthèse IA est désactivée dans le Centre de contrôle IA." });
  }

  const scope = req.nextUrl.searchParams.get("scope") === "people" ? "people" : "overview";

  let prompt: string;
  if (scope === "people") {
    const w = await getWorkloadAnalysis();
    prompt = `Analyse de la charge de travail. Top chargés: ${JSON.stringify(w.topLoaded.map((r) => ({ nom: r.name, total: r.total, retards: r.overdueTasks, validations: r.pendingValidations })))}.
Top retards: ${JSON.stringify(w.topOverdue.map((r) => ({ nom: r.name, retards: r.overdueTasks })))}.
Tâches sans responsable: ${w.tasksWithoutOwner}. Charge par département: ${JSON.stringify(w.byDepartment)}.
Utilisateurs inactifs (>7j): ${JSON.stringify(w.inactive.map((i) => i.name))}.
Explique qui est surchargé, où la charge est mal répartie, qui bloque des workflows, quelles équipes manquent de suivi, et 3 actions recommandées.`;
  } else {
    const o = await getProcessOverview();
    prompt = `Synthèse des ralentissements de la société. Stats: ${JSON.stringify(o.stats)}.
Par module (count, âge moyen en jours, bloqués): ${JSON.stringify(o.byModule)}.
Étapes les plus lentes: ${JSON.stringify(o.bottleneckStages)}.
Top blocages: ${JSON.stringify(o.topBlockers.slice(0, 8).map((b) => ({ module: b.moduleName, objet: b.label, statut: b.statusLabel, age_jours: b.ageDays, responsable: b.ownerName })))}.
Validations en attente: ${o.pendingValidations.length}.
Donne « les principaux ralentissements de la société cette semaine » avec, pour chacun : cause probable, action recommandée, responsable à relancer, module, urgence.`;
  }

  const r = await askClaude(prompt, { system: SYSTEM, maxTokens: 900 });
  if (!r.ok) return NextResponse.json({ configured: r.configured, error: r.error });
  return NextResponse.json({ configured: true, text: r.text });
}
