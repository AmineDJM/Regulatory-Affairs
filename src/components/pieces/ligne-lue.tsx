"use client";

import { AlertTriangle, ScanText, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { methodeCourte } from "@/lib/pieces-lues/phrases";

/**
 * UNE LIGNE LUE SUR UN SCAN — d'où elle vient, ce qu'il faut y vérifier, et la case qui atteste
 * qu'une personne l'a comparée au papier (lot D2-D).
 *
 * Une lecture de machine n'est jamais un fait vérifié (§104.15) : le badge le dit sur la ligne même
 * (« lue — OCR 71 % »), et la case « vérifiée » est le geste humain que le serveur exige avant
 * d'enregistrer (`exigerLectureConfirmee`). Une désignation qui porte un motif d'injection reste un
 * LIBELLÉ — elle est signalée, jamais suivie (§104.10).
 *
 * Propriétés PURES : ce composant n'importe que des modules purs (le badge, les phrases) — un
 * composant client qui remonterait jusqu'à `fs` casserait le build (`client-bundle-guard.test.ts`).
 */
export interface LigneLueProps {
  /** Identifiant de la case — son libellé s'y rattache. */
  id: string;
  methode: "texte" | "ocr";
  confiance: number | null;
  verifiee: boolean;
  onVerifiee: (verifiee: boolean) => void;
  /** Ce qu'il faut vérifier sur cette ligne : chiffres illisibles, désaccord, remise… */
  notes?: readonly string[];
  /** Les motifs d'injection repérés dans la désignation. */
  suspecte?: readonly string[];
  disabled?: boolean;
}

export function LigneLue({ id, methode, confiance, verifiee, onVerifiee, notes = [], suspecte = [], disabled }: LigneLueProps) {
  return (
    <div className="mt-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={verifiee ? "success" : "warning"}>
          <ScanText className="h-3 w-3" /> lue — {methodeCourte({ methode, confiance })}
        </Badge>
        <label htmlFor={id} className="flex items-center gap-1.5 py-1.5 sm:py-0">
          <input id={id} type="checkbox" className="h-4 w-4" checked={verifiee} disabled={disabled} onChange={(e) => onVerifiee(e.target.checked)} />
          vérifiée sur le papier
        </label>
      </div>
      {suspecte.length > 0 && (
        <p className="flex items-start gap-1 text-xs text-destructive">
          <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <span>La désignation contient une formulation suspecte ({suspecte.join(", ")}) : elle reste un libellé, jamais une consigne — vérifiez-la, et le prix, sur le papier.</span>
        </p>
      )}
      {notes.map((n) => (
        <p key={n} className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> <span>{n}</span>
        </p>
      ))}
    </div>
  );
}
