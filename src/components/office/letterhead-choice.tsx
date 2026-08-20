"use client";

import * as React from "react";
import { FileStack, FileMinus2 } from "lucide-react";
import { letterheadsFor } from "@/lib/office/letterhead";
import type { OfficeKind } from "@/lib/office-templates";
import type { LetterheadOption } from "@/lib/queries/letterheads";
import { Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * VIERGE, OU SUR PAPIER EN-TÊTE — le choix qu'on fait AVANT d'écrire.
 *
 * Le geste que cet écran remplace : créer un document vide, aller chercher le dernier courrier
 * officiel dans un dossier, l'ouvrir, effacer le corps du texte, enregistrer sous. Ce qui laisse
 * dans le nouveau document la date, le destinataire et parfois le numéro de l'ancien.
 *
 * Le choix est explicite dans les deux sens : « Vierge » est un choix, pas un défaut subi. On
 * n'impose pas l'en-tête, parce qu'un tableau de travail interne n'a rien à faire sur le papier
 * officiel de la société.
 *
 * Sans en-tête disponible pour ce type de document, le bloc disparaît entièrement : proposer un
 * menu vide, c'est laisser croire qu'on a mal cherché.
 */
export function LetterheadChoice({
  kind, letterheads, companyId, value, onChange, disabled,
}: {
  kind: OfficeKind;
  letterheads: LetterheadOption[];
  companyId: string | null;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const usable = React.useMemo(() => letterheadsFor(letterheads, kind, companyId), [letterheads, kind, companyId]);

  // Changer de type de document invalide le choix : un en-tête Word ne s'ouvre pas dans un
  // tableur, et laisser l'ancien identifiant en place produirait un refus à l'enregistrement.
  React.useEffect(() => {
    if (value && !usable.some((l) => l.id === value)) onChange(null);
  }, [usable, value, onChange]);

  if (usable.length === 0) return null;

  const on = value !== null;

  return (
    <div className="space-y-2">
      <Label>Papier en-tête</Label>
      <div className="grid grid-cols-2 gap-2">
        <ChoiceTile
          active={!on} disabled={disabled} icon={FileMinus2}
          label="Vierge" hint="Note, tableau de travail"
          onClick={() => onChange(null)}
        />
        <ChoiceTile
          active={on} disabled={disabled} icon={FileStack}
          label="Avec en-tête" hint="Courrier officiel"
          onClick={() => onChange(usable[0].id)}
        />
      </div>
      {on && (
        <Select
          value={value ?? ""} disabled={disabled}
          onChange={(e) => onChange(e.target.value || null)}
          aria-label="Choix du papier en-tête"
        >
          {usable.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}{l.companyLabel ? ` — ${l.companyLabel}` : " — commun au groupe"}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

function ChoiceTile({
  active, disabled, icon: IconCmp, label, hint, onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ElementType;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition",
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-secondary",
        disabled && "opacity-60",
      )}
    >
      <IconCmp className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block truncate text-[0.6875rem] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
