import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { requireModule } from "@/lib/session";
import { vueMission } from "@/lib/missions/view/workspace";
import { MissionRuntimePanel } from "@/components/missions/mission-runtime-panel";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ÉCRAN D'UNE MISSION D'EXÉCUTION (§55) — la destination de toutes ses notifications.
 *
 * ── POURQUOI UNE PAGE, ET PAS UN PANNEAU DANS LA CONVERSATION ───────────────────────────
 *
 * Une mission est un objet de l'ERP : elle a un identifiant, un propriétaire, des étapes, des
 * livrables et un journal. Elle mérite une adresse. La glisser au-dessus du fil de discussion
 * aurait fait dépendre l'écran d'une mission de l'assistant — c'est-à-dire exactement le
 * couplage que `boundary-scan.ts` mesure et fait baisser lot après lot.
 *
 * Le cliquet l'a d'ailleurs dit sans ambiguïté : écrit dans `app/(app)/assistant/`, ce panneau
 * ajoutait sept franchissements d'un coup. La bonne réponse n'était pas de relever le plafond,
 * c'était de reconnaître de quel côté vit cet écran.
 *
 * ── LE LIEN AVEC LA CONVERSATION RESTE ─────────────────────────────────────────────────
 *
 * Un bouton, en bas : « En parler à Adam ». On garde l'aller simple — depuis la mission vers la
 * conversation — et l'on évite le retour, qui aurait recréé la dépendance dans l'autre sens.
 *
 * ── CE QUE `notFound()` PROTÈGE ────────────────────────────────────────────────────────
 *
 * `vueMission` filtre par propriétaire. Une mission qui existe mais appartient à quelqu'un
 * d'autre et une mission qui n'existe pas rendent donc la MÊME page — on ne révèle pas
 * l'existence de la mission d'autrui par la différence entre 404 et 403.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const dynamic = "force-dynamic";

export default async function MissionRuntimePage({ params }: { params: { id: string } }) {
  const user = await requireModule("WORKSPACE");
  const vue = await vueMission(params.id, user.id);
  if (!vue) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/missions" className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Toutes les missions
      </Link>

      <MissionRuntimePanel user={user} missionId={params.id} />

      <Link
        href={`/assistant?q=${encodeURIComponent(`Où en est la mission « ${vue.title} » ?`)}`}
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
      >
        <MessageSquare className="h-4 w-4" aria-hidden /> En parler à Adam
      </Link>
    </div>
  );
}
