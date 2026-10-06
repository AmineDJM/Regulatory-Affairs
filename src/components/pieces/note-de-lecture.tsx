"use client";

import { AlertTriangle, CheckCircle2, ScanText, ShieldAlert } from "lucide-react";

/**
 * LA NOTE D'UNE PIÈCE LUE — comment elle a été lue, ce qui n'a pas pu l'être, et ce que le contrôle
 * arithmétique en dit (lot D2-D).
 *
 * Tout ce qu'elle affiche est composé par NOTRE code (`noteDeMethode`, `controlerPiece`, le
 * préremplissage) : une phrase écrite dans le document n'y entre jamais (§104.15). Elle dit les
 * ABSENCES aussi fort que les présences — un total non repéré n'est pas un accord (§118.16), une
 * lecture des lignes coupée par la Direction n'est pas une pièce sans lignes (§104.15), et ce qui n'a
 * pas été prérempli se dit avec le geste qui reste (§118.30).
 *
 * Propriétés PURES : aucun import de module serveur (`client-bundle-guard.test.ts`).
 */
export interface NoteDeLectureProps {
  nomFichier: string;
  noteMethode: string;
  /** Pourquoi il n'y a pas de lignes lues. */
  sansLignes?: string | null;
  /** La coupe du texte montré à l'IA. */
  coupe?: string | null;
  controle?: { conforme: boolean; ecarts: readonly string[]; manques: readonly string[]; desaccords: readonly string[] } | null;
  /** Ce que l'annuaire dit de l'émetteur. */
  fournisseur?: string | null;
  /** Ce qui n'a pas été prérempli, et pourquoi. */
  reserves?: readonly string[];
  suspectes?: readonly { rang: number; designation: string; motifs: readonly string[] }[];
}

const Liste = ({ titre, lignes, tone }: { titre: string; lignes: readonly string[]; tone: "danger" | "warning" }) =>
  lignes.length === 0 ? null : (
    <div>
      <p className={`text-xs font-medium ${tone === "danger" ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>{titre}</p>
      <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
        {lignes.map((l) => <li key={l}>{l}</li>)}
      </ul>
    </div>
  );

export function NoteDeLecture({ nomFichier, noteMethode, sansLignes, coupe, controle, fournisseur, reserves = [], suspectes = [] }: NoteDeLectureProps) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3" aria-live="polite">
      <p className="flex items-start gap-2 text-sm font-medium">
        <ScanText className="mt-0.5 h-4 w-4 shrink-0" /> <span className="min-w-0 [overflow-wrap:anywhere]">Lecture de « {nomFichier} » — une proposition, à comparer au papier</span>
      </p>
      <p className="text-xs text-muted-foreground">{noteMethode}</p>
      {sansLignes && (
        <p className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> <span>{sansLignes}</span></p>
      )}
      {coupe && <p className="text-xs text-amber-700 dark:text-amber-400">{coupe}</p>}
      {fournisseur && <p className="text-xs">{fournisseur}</p>}
      {controle && controle.conforme && (
        <p className="flex items-start gap-1 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" /> <span>Les lignes lues tombent sur les totaux imprimés, à un dinar près.</span>
        </p>
      )}
      {controle && (
        <>
          <Liste titre="Écarts avec les totaux imprimés" lignes={controle.ecarts} tone="danger" />
          <Liste titre="Désaccords entre deux lectures" lignes={controle.desaccords} tone="warning" />
          <Liste titre="Non contrôlé — à vérifier sur le papier" lignes={controle.manques} tone="warning" />
        </>
      )}
      <Liste titre="Non prérempli" lignes={reserves} tone="warning" />
      {suspectes.length > 0 && (
        <p className="flex items-start gap-1 text-xs text-destructive">
          <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {suspectes.length} désignation{suspectes.length > 1 ? "s portent" : " porte"} une formulation suspecte (ligne{suspectes.length > 1 ? "s" : ""} {suspectes.map((s) => s.rang).join(", ")}) :
            ce sont des libellés recopiés du document, jamais des consignes — vérifiez-les sur le papier.
          </span>
        </p>
      )}
    </div>
  );
}
