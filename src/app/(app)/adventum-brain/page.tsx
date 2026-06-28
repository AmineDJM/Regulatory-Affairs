import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getRisks } from "@/lib/adventum/risks";
import { suggestRelationObjects } from "@/lib/adventum/relations";
import { getRiskThresholds } from "@/lib/adventum/risk-settings";
import { prisma } from "@/lib/prisma";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { BRAIN_TABS } from "@/lib/labels";
import { BrainCockpit } from "./brain-cockpit";
import { RiskThresholdsForm } from "./risk-thresholds-form";

export const dynamic = "force-dynamic";

const BLOCK_CATS = ["CONGRESS", "SPONSORING", "REGULATORY", "FINANCE", "VALIDATION", "DIRECTIVES"];

export default async function AdventumBrainPage() {
  const user = await requireModule("ADVENTUM_BRAIN"); // Super Admin uniquement (module non accordé aux autres rôles)

  const [risks, suggestions, recentSignals, thresholds] = await Promise.all([
    getRisks(),
    suggestRelationObjects(),
    prisma.fieldReport.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
    getRiskThresholds(),
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

  return (
    <div className="space-y-4">
      <ModuleTabs tabs={BRAIN_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />
      <BrainCockpit risks={risks} kpis={kpis} feed={feed} suggestions={suggestions} />
      <RiskThresholdsForm initial={thresholds} />
    </div>
  );
}
