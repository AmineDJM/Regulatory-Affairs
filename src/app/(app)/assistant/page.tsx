import { requireModule } from "@/lib/session";
import { aiConfigured } from "@/lib/ai";
import { PageHeader } from "@/components/shared/page-header";
import { AssistantChat } from "./assistant-chat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const user = await requireModule("WORKSPACE");
  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-4">
      <PageHeader
        title="Assistant IA"
        description="Votre copilote interne : il comprend l'application et vos données, répond à vos questions et prépare vos actions (toujours confirmées par vous)."
      />
      <AssistantChat userName={user.name} configured={aiConfigured()} />
    </div>
  );
}
