import { requireModule } from "@/lib/session";
import { aiConfigured, sttConfigured } from "@/lib/ai";
import { featureEnabled, FEATURES } from "@/lib/features";
import { getDailyBrief } from "@/lib/daily-brief";
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
    // PLEIN ÉCRAN : l'assistant prend toute la hauteur disponible, comme une application de
    // discussion. Les marges du conteneur principal sont neutralisées pour que le rail des
    // conversations touche le bord — c'est ce qui fait la différence avec « une page ».
    //
    // `app-viewport-flush` s'arrête au RAS de la barre d'onglets (hauteurs mesurées, cf.
    // chrome-metrics.tsx). La hauteur était auparavant écrite en dur — le champ de saisie
    // se retrouvait derrière la barre sur téléphone.
    <div className="app-viewport-flush -mx-3 -mt-3 flex flex-col gap-3 px-2 pt-2 sm:-mx-4 sm:-mt-6 sm:px-3 sm:pt-4 lg:-mx-8 lg:px-6">
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
