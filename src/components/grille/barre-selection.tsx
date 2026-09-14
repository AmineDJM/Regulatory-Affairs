"use client";

import * as React from "react";
import { Copy, Eraser, Loader2, X, Check } from "lucide-react";
import { COULEURS_CELLULE, type CouleurCellule } from "@/lib/grille/couleurs";
import { CLASSES_COULEUR } from "./palette";
import { cn } from "@/lib/utils";

/**
 * LA BARRE DE SÉLECTION — ce qu'on fait des cellules qu'on vient de prendre.
 *
 * Elle n'apparaît QUE lorsqu'il y a une sélection : une palette toujours visible se clique à
 * vide, et une barre d'outils permanente finit par ne plus être lue. Les gestes sont ceux d'un
 * tableur : colorer (une pastille par couleur de la palette fermée), effacer la couleur, copier
 * en TSV, désélectionner. Le compte est dit en toutes lettres — « 12 cellules » — parce qu'une
 * couleur posée sur trois lignes de trop se voit moins qu'un chiffre faux.
 */
export function BarreSelection({
  nombre, peutColorer, busy, onCouleur, onEffacer, onCopier, onFermer, message,
}: {
  nombre: number;
  /** Faux = lecture seule : on copie, on ne colore pas. */
  peutColorer: boolean;
  busy: boolean;
  onCouleur: (couleur: CouleurCellule) => void;
  onEffacer: () => void;
  onCopier: () => Promise<boolean>;
  onFermer: () => void;
  message?: { ok: boolean; text: string } | null;
}) {
  const [copie, setCopie] = React.useState<"idle" | "ok" | "err">("idle");
  React.useEffect(() => {
    if (copie === "idle") return;
    const t = setTimeout(() => setCopie("idle"), 1800);
    return () => clearTimeout(t);
  }, [copie]);

  if (nombre <= 0) return null;

  return (
    <div
      data-testid="barre-selection"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-2.5 py-2 text-sm"
      role="toolbar"
      aria-label="Actions sur la sélection"
    >
      <span className="font-medium tabular-nums">
        {nombre} cellule{nombre > 1 ? "s" : ""} sélectionnée{nombre > 1 ? "s" : ""}
      </span>

      {peutColorer && (
        <span className="flex items-center gap-1" aria-label="Couleur de fond">
          {COULEURS_CELLULE.map((c) => (
            <button
              key={c.cle}
              type="button"
              disabled={busy}
              onClick={() => onCouleur(c.cle)}
              title={c.label}
              aria-label={`Colorer en ${c.label.toLowerCase()}`}
              className={cn(
                "h-6 w-6 rounded-full border border-black/10 transition hover:scale-110 disabled:opacity-50",
                CLASSES_COULEUR[c.cle].pastille,
              )}
            />
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={onEffacer}
            className="ml-1 inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden /> Effacer la couleur
          </button>
        </span>
      )}

      <button
        type="button"
        onClick={() => { void onCopier().then((ok) => setCopie(ok ? "ok" : "err")); }}
        className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-secondary"
      >
        {copie === "ok" ? <Check className="h-3.5 w-3.5 text-success" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        {copie === "ok" ? "Copié" : copie === "err" ? "Copie refusée par le navigateur" : "Copier"}
      </button>

      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
      {message && (
        <span className={cn("text-xs", message.ok ? "text-success" : "text-destructive")}>{message.text}</span>
      )}

      <button
        type="button"
        onClick={onFermer}
        className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" aria-hidden /> Désélectionner
      </button>
    </div>
  );
}

/** La classe de fond d'une cellule colorée, ou rien. */
export function classeCouleurCellule(couleur: string | undefined): string {
  if (!couleur) return "";
  return (CLASSES_COULEUR as Record<string, { cellule: string } | undefined>)[couleur]?.cellule ?? "";
}
