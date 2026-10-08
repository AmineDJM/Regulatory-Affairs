"use client";

import * as React from "react";
import { definirWilayaPivotKam } from "@/lib/actions/sales-planning-actions";
import { ALGERIA_WILAYAS } from "@/lib/labels";
import { InfoBulle } from "@/components/ui/info-bulle";

/**
 * LA WILAYA PIVOT D'UN KAM (Direction, 08/10) — un menu déroulant sur sa ligne, parmi les 58 wilayas.
 * Une visite dans cette wilaya = IN, en dehors = OUT (segmentation). Vide = on lit encore la ville pivot du territoire.
 */
type Action = (fd: FormData) => Promise<{ ok: boolean; error?: string }>;

export function WilayaPivotKam({ buId, repId, nom, valeur, busy, run }: {
  buId: string; repId: string; nom: string; valeur: string | null; busy: boolean;
  run: (a: Action, fd: FormData, refresh?: boolean) => Promise<boolean>;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <label htmlFor={`wp-${repId}`} className="font-medium text-foreground">Wilaya pivot</label>
      <select
        id={`wp-${repId}`}
        key={valeur ?? ""}
        defaultValue={valeur ?? ""}
        disabled={busy}
        aria-label={`Wilaya pivot de ${nom}`}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground disabled:opacity-60"
        onChange={(e) => {
          const fd = new FormData();
          fd.set("businessUnitId", buId);
          fd.set("repId", repId);
          fd.set("wilayaPivot", e.target.value);
          void run(definirWilayaPivotKam, fd, true);
        }}
      >
        <option value="">— Aucune —</option>
        {ALGERIA_WILAYAS.map((w) => <option key={w} value={w}>{w}</option>)}
      </select>
      <InfoBulle>Dans la wilaya pivot du KAM, une visite compte « In » ; en dehors, « Out ». Sert à la segmentation des praticiens.</InfoBulle>
    </span>
  );
}
