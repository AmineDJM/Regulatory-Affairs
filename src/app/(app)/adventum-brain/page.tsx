import { requireModule } from "@/lib/session";
import { getRisks } from "@/lib/adventum/risks";
import { suggestRelationObjects } from "@/lib/adventum/relations";
import { prisma } from "@/lib/prisma";
import { BrainCockpit } from "./brain-cockpit";

export const dynamic = "force-dynamic";

const BLOCK_CATS = ["CONGRESS", "SPONSORING", "REGULATORY", "FINANCE", "VALIDATION", "DIRECTIVES"];

export default async function AdventumBrainPage() {
  await requireModule("ADVENTUM_BRAIN"); // Super Admin uniquement (module non accordé aux autres rôles)

  const [risks, suggestions, recentSignals] = await Promise.all([
    getRisks(),
    suggestRelationObjects(),
    prisma.fieldReport.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
  ]);

  const kpis = {
    critical: risks.filter((r) => r.level === "critical").length,
    blocks: risks.filter((r) => BLOCK_CATS.includes(r.category)).length,
    proposedActions: risks.reduce((s, r) => s + r.actions.filter((a) => a.payload).length, 0),
    decisions: risks.filter((r) => r.level === "critical" || r.level === "high").length,
    fieldSignals: recentSignals,
  };

  // Fil d'intelligence : les mêmes signaux, classés du plus récent au plus ancien.
  const feed = [...risks].sort((a, b) => (b.at > a.at ? 1 : -1)).slice(0, 25);

  return <BrainCockpit risks={risks} kpis={kpis} feed={feed} suggestions={suggestions} />;
}
