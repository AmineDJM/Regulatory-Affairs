"use client";

import * as React from "react";
import { MoreHorizontal, Users } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { ParticipantsPanel } from "./participants-panel";

/**
 * LE MENU DU DOSSIER — « ⋯ », en tête, à côté du statut.
 *
 * Les participants vivaient dans une carte, quatre blocs plus bas : un réglage qu'on change
 * trois fois dans la vie d'un dossier occupait autant de place que le parcours qu'on lit
 * chaque jour. Ils sont maintenant derrière les trois points, là où l'on cherche les réglages
 * d'une fiche — et la colonne principale ne montre plus que le dossier lui-même.
 *
 * Le menu se ferme au clic ailleurs et à Échap : un panneau ouvert qui reste ouvert derrière
 * la page suivante est un défaut qu'on ne voit qu'une fois qu'il gêne.
 */
export function DossierMenu({
  productId, participants, allUsers, coreIds, canEdit,
}: {
  productId: string;
  participants: { id: string; name: string }[];
  allUsers: { id: string; name: string }[];
  coreIds: string[];
  canEdit: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [sheet, setSheet] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Réglages du dossier"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-60 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); setSheet(true); }}
            className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
          >
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">Participants du dossier</span>
              <span className="block text-xs text-muted-foreground">
                {participants.length === 0 ? "Personne pour l'instant" : `${participants.length} personne${participants.length > 1 ? "s" : ""}`}
                {canEdit ? "" : " · lecture seule"}
              </span>
            </span>
          </button>
        </div>
      )}

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Participants du dossier"
        description="Plusieurs personnes travaillent le même dossier : les ajouter ici leur en ouvre l'accès. Le responsable et l'assistante y sont toujours, et ne s'en retirent pas d'ici."
      >
        <ParticipantsPanel
          productId={productId}
          participants={participants}
          allUsers={allUsers}
          coreIds={coreIds}
          canEdit={canEdit}
        />
      </Sheet>
    </div>
  );
}
