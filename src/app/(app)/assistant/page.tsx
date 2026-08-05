import { requireModule } from "@/lib/session";
import { aiConfigured, sttConfigured } from "@/lib/ai";
import { featureEnabled, FEATURES } from "@/lib/features";
import { getDailyBrief } from "@/lib/daily-brief";
import { PageHeader } from "@/components/shared/page-header";
import { MorningBrief } from "@/components/shared/morning-brief";
import { AssistantChat } from "./assistant-chat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const user = await requireModule("WORKSPACE");
  // Mémoire personnelle et point du matin : indisponibles en « Vue exacte » — la mémoire
  // d'une personne ne s'ouvre à personne d'autre, pas même à un administrateur.
  const [memoryEnabled, proactive] = await Promise.all([
    user.impersonatedBy ? Promise.resolve(false) : featureEnabled(FEATURES.ASSISTANT_MEMORY.key, user.id),
    user.impersonatedBy ? Promise.resolve(false) : featureEnabled(FEATURES.ASSISTANT_PROACTIVE.key, user.id),
  ]);
  const brief = proactive ? await getDailyBrief(user).catch(() => null) : null;
  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-4">
      <PageHeader
        title="Assistant IA"
        description="Votre copilote interne : il comprend l'application et vos données, répond à vos questions et prépare vos actions (toujours confirmées par vous)."
      />
      {brief?.text && <MorningBrief initial={brief.text} />}
      <AssistantChat
        userName={user.name}
        configured={aiConfigured()}
        voiceConfigured={sttConfigured()}
        memoryEnabled={memoryEnabled}
      />
    </div>
  );
}
