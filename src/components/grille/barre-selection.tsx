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
 *
 * ── ELLE VIT SOUS LE TABLEAU, JAMAIS AU-DESSUS (§118.172) ───────────────────────────────────
 *
 * Posée au-dessus, elle apparaissait au PREMIER clic d'un double-clic et poussait le tableau vers
 * le bas : le second clic tombait sur la ligne du DESSUS, et c'est elle qui s'ouvrait en édition.
 * Trouvé par le banc navigateur des annuaires — la cellule demandée ne s'ouvrait jamais, celle de
 * la ligne voisine si. Elle se pose donc dans le `DockSelection`, APRÈS le tableau et dans le flux :
 * ce qui apparaît là ne déplace ni ne recouvre rien de ce qu'on est en train de viser. (Collée au
 * bas de l'écran, elle recouvrait la dernière ligne visible — le même vol de clic, par l'autre
 * côté ; voir `DockSelection`.)
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
      className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-card px-2.5 py-2 text-sm shadow-sm"
      role="toolbar"
      aria-label="Actions sur la sélection"
    >
      <span className="font-medium tabular-nums">
        {nombre} cellule{nombre > 1 ? "s" : ""} sélectionnée{nombre > 1 ? "s" : ""}
      </span>

      {peutColorer && (
        <span className="flex flex-wrap items-center gap-1.5 sm:gap-1" aria-label="Couleur de fond">
          {COULEURS_CELLULE.map((c) => (
            <button
              key={c.cle}
              type="button"
              disabled={busy}
              onClick={() => onCouleur(c.cle)}
              title={c.label}
              aria-label={`Colorer en ${c.label.toLowerCase()}`}
              className={cn(
                "h-8 w-8 rounded-full border border-black/10 transition hover:scale-110 disabled:opacity-50 sm:h-6 sm:w-6",
                CLASSES_COULEUR[c.cle].pastille,
              )}
            />
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={onEffacer}
            className="ml-1 inline-flex items-center gap-1 rounded-md border border-input px-2 py-2 text-xs hover:bg-secondary disabled:opacity-50 sm:py-1"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden /> Effacer la couleur
          </button>
        </span>
      )}

      <button
        type="button"
        onClick={() => { void onCopier().then((ok) => setCopie(ok ? "ok" : "err")); }}
        className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-2 text-xs hover:bg-secondary sm:py-1"
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
        className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground sm:py-1"
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

/**
 * LE DOCK — là où vit tout ce qui APPARAÎT pendant qu'on travaille dans un tableau (sélection,
 * message, erreur) : SOUS le tableau, DANS le flux (§118.172).
 *
 * Il y a deux façons de voler le second clic d'un double-clic, et le banc navigateur des annuaires
 * a trouvé les deux — la seconde dans la première version de ce dock :
 *   — posé AU-DESSUS du tableau, ce qui apparaît au premier clic POUSSE le tableau vers le bas :
 *     le second clic tombe sur la ligne du dessus, et c'est elle qui s'ouvre en édition ;
 *   — collé au bas de l'ÉCRAN (`sticky`), il RECOUVRE la dernière ligne visible au moment où il
 *     apparaît : le second clic tombe sur la barre, rien ne s'ouvre, et la personne conclut que la
 *     cellule ne marche pas. Pire, une édition ouverte là se retrouve SOUS la barre, invisible.
 * Sous le tableau et dans le flux, il ne peut ni pousser ce qu'on vise — tout ce qu'on vise est
 * au-dessus de lui — ni le recouvrir — il n'est au-dessus de rien. C'est la place qu'avait la barre
 * avant ce lot, retournée : visible dans les mêmes cas, sans aucun des deux défauts.
 */
export function DockSelection({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2 empty:hidden">{children}</div>;
}
