"use client";

import * as React from "react";
import { CalendarClock, Loader2, Pencil } from "lucide-react";
import { modifierDateBesoinPromo } from "@/lib/actions/promo-material-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/shared/use-action";
import { etatDuBesoin } from "@/lib/promo-material/date-besoin";
import { cn, formatDate } from "@/lib/utils";

/**
 * « BESOIN POUR LE … » (Direction, 10/2026) — la date que le demandeur a posée, en tête de la demande. Orange quand il reste
 * moins de 15 jours (ou qu'elle est dépassée) et que le matériel n'est pas livré. Le demandeur la modifie ou la retire d'ici.
 */
export function DateBesoin({ id, neededBy, livre, peutModifier }: { id: string; neededBy: string | null; livre: boolean; peutModifier: boolean }) {
  const { saving, err, run } = useAction();
  const [edition, setEdition] = React.useState(false);
  const etat = etatDuBesoin(neededBy, livre);
  if (!etat && !peutModifier) return null;

  if (edition) {
    return (
      <form
        action={(fd) => { fd.set("id", id); void run(() => modifierDateBesoinPromo(fd), () => setEdition(false)); }}
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
        <label htmlFor="besoin-date" className="text-muted-foreground">Besoin pour le</label>
        <Input id="besoin-date" name="neededBy" type="date" defaultValue={neededBy ? neededBy.slice(0, 10) : ""} min={new Date().toISOString().slice(0, 10)} className="h-9 w-44" />
        <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEdition(false)}>Annuler</Button>
        {err && <span className="text-xs text-destructive">{err}</span>}
        <span className="basis-full text-xs text-muted-foreground">Laissez vide pour retirer la date.</span>
      </form>
    );
  }

  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", etat?.alerte ? "font-medium text-warning" : "text-muted-foreground")}>
      <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
      {etat && neededBy
        ? <span>Besoin pour le {formatDate(neededBy)} <span className="font-normal">· {livre ? "livré" : etat.echeance}</span></span>
        : <span>Aucune date de besoin</span>}
      {peutModifier && (
        <button type="button" onClick={() => setEdition(true)} className="inline-flex min-h-9 items-center gap-1 text-xs font-normal text-primary hover:underline sm:min-h-0">
          <Pencil className="h-3 w-3" aria-hidden /> {etat ? "Modifier" : "Ajouter"}
        </button>
      )}
    </p>
  );
}
