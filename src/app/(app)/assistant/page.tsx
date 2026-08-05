import { requireModule } from "@/lib/session";
import { aiConfigured, sttConfigured } from "@/lib/ai";
import { featureEnabled, FEATURES } from "@/lib/features";
import { PageHeader } from "@/components/shared/page-header";
import { AssistantChat } from "./assistant-chat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const user = await requireModule("WORKSPACE");
  // Mémoire personnelle : indisponible en « Vue exacte » (la mémoire d'autrui ne s'ouvre jamais).
  const memoryEnabled = !user.impersonatedBy && (await featureEnabled(FEATURES.ASSISTANT_MEMORY.key, user.id));
  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-4">
      <PageHeader
        title="Assistant IA"
        description="Votre copilote interne : il comprend l'application et vos données, répond à vos questions et prépare vos actions (toujours confirmées par vous)."
      />
      <AssistantChat
        userName={user.name}
        configured={aiConfigured()}
        voiceConfigured={sttConfigured()}
        memoryEnabled={memoryEnabled}
      />
    </div>
  );
}
