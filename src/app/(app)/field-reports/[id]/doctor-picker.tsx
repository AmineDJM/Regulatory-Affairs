"use client";

import * as React from "react";
import { X, UserPlus } from "lucide-react";
import { Select } from "@/components/ui/input";

/** Sélection d'un OU plusieurs médecins de l'annuaire (chips + menu d'ajout). */
export function DoctorPicker({
  doctors, value, onChange, disabled,
}: {
  doctors: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const nameById = React.useMemo(() => new Map(doctors.map((d) => [d.id, d.name])), [doctors]);
  const available = doctors.filter((d) => !value.includes(d.id));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.length === 0 && <span className="text-xs text-muted-foreground">Aucun médecin sélectionné</span>}
        {value.map((id) => (
          <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-3 pr-1 text-sm font-medium text-primary sm:pl-2.5 sm:text-xs">
            <span className="min-w-0 truncate">{nameById.get(id) ?? id}</span>
            {!disabled && (
              <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} className="shrink-0 rounded-full p-2 hover:bg-primary/20 sm:p-1" aria-label="Retirer">
                <X className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="flex items-center gap-1.5">
          <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Select className="min-w-0 flex-1" value="" onChange={(e) => { if (e.target.value) onChange([...value, e.target.value]); }} disabled={available.length === 0}>
            <option value="">{available.length ? "+ Ajouter un médecin…" : "Tous les médecins sont sélectionnés"}</option>
            {available.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>
      )}
    </div>
  );
}
