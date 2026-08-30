import { AlertTriangle, Check, CircleDashed, Clock, X } from "lucide-react";
import type { BusinessStory } from "@/lib/queries/story";
import { formatDate } from "@/lib/utils";

/**
 * LA TIMELINE DU MARCHÉ — la MÊME reconstitution que celle qu'Adam raconte (`storyMarche`),
 * rendue dans la fiche. Une seule fabrique de frise : si l'écran et Adam divergeaient, l'un
 * des deux mentirait.
 *
 * L'ordre suit le CIRCUIT (publication → soumission → attribution → contrat → BC → clôture),
 * pas la date — et les TROUS (`manque`) s'affichent comme des jalons à part entière : une
 * facture jamais émise est précisément ce qu'on cherche en relisant une affaire.
 */
export function MarketTimeline({ story }: { story: BusinessStory }) {
  const enfants = new Map<string, BusinessStory["events"]>();
  const racines: BusinessStory["events"] = [];
  for (const e of story.events) {
    if (e.parent) {
      const list = enfants.get(e.parent) ?? [];
      list.push(e);
      enfants.set(e.parent, list);
    } else {
      racines.push(e);
    }
  }

  return (
    <div className="space-y-0">
      <ol className="relative ml-2 space-y-1 border-l border-border pl-5">
        {racines.map((e) => (
          <li key={e.id} className="relative py-1.5">
            <EventDot etat={e.etat} />
            <EventLine event={e} />
            {(enfants.get(e.id) ?? []).length > 0 && (
              <ol className="mt-1 space-y-1 border-l border-border/60 pl-4">
                {enfants.get(e.id)!.map((c) => (
                  <li key={c.id} className="relative py-0.5">
                    <EventLine event={c} compact />
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
      {story.limites.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Limites de la reconstitution : {story.limites.join(" · ")}
        </p>
      )}
    </div>
  );
}

function EventDot({ etat }: { etat: string }) {
  const cls =
    etat === "fait" ? "bg-success text-success-foreground"
      : etat === "echec" ? "bg-destructive text-destructive-foreground"
        : etat === "manque" ? "bg-warning text-warning-foreground"
          : "bg-secondary text-muted-foreground";
  return (
    <span aria-hidden className={`absolute -left-[27px] top-2 grid h-4 w-4 place-items-center rounded-full ${cls}`}>
      {etat === "fait" ? <Check className="h-2.5 w-2.5" /> : etat === "echec" ? <X className="h-2.5 w-2.5" /> : etat === "manque" ? <AlertTriangle className="h-2.5 w-2.5" /> : etat === "a-venir" ? <Clock className="h-2.5 w-2.5" /> : <CircleDashed className="h-2.5 w-2.5" />}
    </span>
  );
}

function EventLine({ event: e, compact }: { event: BusinessStory["events"][number]; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${compact ? "text-xs" : "text-sm"}`}>
      <span className={e.etat === "manque" ? "font-medium text-warning" : e.etat === "echec" ? "text-destructive" : "font-medium"}>
        {e.titre}
      </span>
      {e.date && <span className="text-xs tabular-nums text-muted-foreground">{formatDate(e.date)}</span>}
      {e.retardJours != null && e.retardJours > 0 && (
        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[0.6875rem] text-destructive">+{e.retardJours} j de retard</span>
      )}
      {e.detail && <span className="text-xs text-muted-foreground">{e.detail}</span>}
      {(e.metriques ?? []).slice(0, 3).map((m) => (
        <span key={m.label} className="rounded bg-secondary px-1.5 py-0.5 text-[0.6875rem] tabular-nums text-muted-foreground">
          {m.valeur} {m.label}
        </span>
      ))}
    </div>
  );
}
