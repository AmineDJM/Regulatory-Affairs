import { Crown } from "lucide-react";
import { requireModule } from "@/lib/session";
import { aiConfigured, sttConfigured } from "@/lib/ai";
import { featureEnabled, FEATURES } from "@/lib/features";
import { getDailyBrief } from "@/lib/daily-brief";
import { ensurePrimaryThread } from "@/lib/assistant-memory";
import { MorningBrief } from "@/components/shared/morning-brief";
import { AssistantChat } from "../assistant/assistant-chat";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Chief of Staff — AMD Internal OS" };

/**
 * « MY CHIEF OF STAFF » — l'interface exécutive de pilotage, réservée au PDG et au Super Admin
 * (module CHIEF_OF_STAFF, réglé en Administration).
 *
 * Ce n'est PAS un deuxième chatbot : c'est le MÊME moteur que l'assistant — mémoire, actions
 * confirmées, dictée vocale, pièces jointes — mais servi à quelqu'un qui pilote l'entreprise.
 * Le mode exécutif (persona + outils de chef de cabinet) s'active PAR LE RÔLE, côté serveur, dans
 * le system prompt et le registre d'outils : cette page n'accorde rien, elle ouvre une porte.
 *
 * Les gestes propres au chef de cabinet : l'HISTOIRE COMPLÈTE d'un dossier par sa référence
 * (timeline, validateurs, pièces, chaîne devis→BC→facture→règlement), la FOUILLE et la LECTURE
 * des documents du Drive, le BILAN factuel d'une personne, les RAPPELS planifiés (« rappelle-moi
 * mardi », « tous les dimanches relance Regulatory ») et les DÉCISIONS du centre de paiement —
 * toujours derrière une carte de confirmation.
 */
export default async function ChiefOfStaffPage({
  searchParams,
}: {
  searchParams?: { q?: string; ref?: string };
}) {
  const user = await requireModule("CHIEF_OF_STAFF");
  const [memoryEnabled, proactive] = await Promise.all([
    user.impersonatedBy ? Promise.resolve(false) : featureEnabled(FEATURES.ASSISTANT_MEMORY.key, user.id),
    user.impersonatedBy ? Promise.resolve(false) : featureEnabled(FEATURES.ASSISTANT_PROACTIVE.key, user.id),
  ]);
  const brief = proactive ? await getDailyBrief(user).catch(() => null) : null;

  // LE FIL PRINCIPAL : une conversation CONTINUE par personne — elle s'ouvre d'office au lieu
  // de repartir de « chat n°47 ». Créée au premier passage, retrouvée ensuite.
  const primaryThreadId = memoryEnabled ? await ensurePrimaryThread(user.id).catch(() => null) : null;

  // ENTRÉE CONTEXTUELLE : « Demander au Chief of Staff » depuis une fiche arrive ici avec la
  // question (?q=…) ou la référence du dossier (?ref=…) — pré-remplie, jamais envoyée seule.
  const q = typeof searchParams?.q === "string" ? searchParams.q.slice(0, 500) : "";
  const ref = typeof searchParams?.ref === "string" ? searchParams.ref.slice(0, 120) : "";
  const initialPrompt = q || (ref ? `Donne-moi toute l'histoire de ${ref} : statut, validateurs, blocages, prochaine étape.` : null);

  return (
    <div className="app-viewport-flush -mx-3 -mt-3 flex flex-col gap-3 px-2 pt-2 sm:-mx-4 sm:-mt-6 sm:px-3 sm:pt-4 lg:-mx-8 lg:px-6">
      <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
        <Crown className="h-4 w-4 text-primary" />
        <span className="font-semibold text-foreground">My Chief of Staff</span>
        <span className="hidden sm:inline">
          — cherchez tout, lisez tout, agissez (sous confirmation) — au clavier ou à la voix.
        </span>
      </div>
      {brief?.text && <MorningBrief initial={brief.text} />}
      <AssistantChat
        userName={user.name}
        configured={aiConfigured()}
        voiceConfigured={sttConfigured()}
        memoryEnabled={memoryEnabled}
        executive
        initialPrompt={initialPrompt}
        initialThreadId={primaryThreadId}
      />
    </div>
  );
}
