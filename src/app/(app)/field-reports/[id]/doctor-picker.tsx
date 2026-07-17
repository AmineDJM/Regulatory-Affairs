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
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {nameById.get(id) ?? id}
            {!disabled && (
              <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} className="rounded-full hover:bg-primary/20" aria-label="Retirer">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="flex items-center gap-1.5">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <Select value="" onChange={(e) => { if (e.target.value) onChange([...value, e.target.value]); }} disabled={available.length === 0}>
            <option value="">{available.length ? "+ Ajouter un médecin…" : "Tous les médecins sont sélectionnés"}</option>
            {available.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>
      )}
    </div>
  );
}
