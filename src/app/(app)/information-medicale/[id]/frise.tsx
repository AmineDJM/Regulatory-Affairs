import { Check } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { Etape } from "@/lib/medical-info/parcours";

/**
 * LA FRISE DES ÉTAPES — où en est le dossier, d'un regard. Horizontale ; au téléphone, elle défile
 * latéralement plutôt que de s'empiler (l'ordre est l'information).
 */
export function Frise({ etapes }: { etapes: Etape[] }) {
  return (
    <ol className="flex overflow-x-auto [-webkit-overflow-scrolling:touch]" aria-label="Étapes du dossier">
      {etapes.map((e, i) => {
        const sousTitre = [e.detail, e.date ? formatDate(e.date.toISOString()) : null].filter(Boolean).join(" · ");
        return (
          <li
            key={e.cle}
            aria-current={e.etat === "ICI" ? "step" : undefined}
            className={cn(
              "relative min-w-[7.5rem] flex-1 border-t-4 px-2 pb-1 pt-2",
              e.etat === "FAIT" && "border-success",
              e.etat === "ICI" && "border-primary bg-primary/5",
              e.etat === "A_VENIR" && "border-border",
              e.etat === "SANS_OBJET" && "border-dashed border-border",
              i > 0 && "ml-1",
            )}
          >
            <p
              className={cn(
                "flex items-center gap-1 text-sm",
                e.etat === "ICI" ? "font-semibold text-foreground" : e.etat === "FAIT" ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {e.etat === "FAIT" && <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />}
              <span className="truncate">{e.libelle}</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">{sousTitre || " "}</p>
          </li>
        );
      })}
    </ol>
  );
}
