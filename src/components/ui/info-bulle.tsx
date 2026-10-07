"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * L'EXPLICATION À LA DEMANDE — un « ⓘ » qui ouvre deux ou trois lignes, et rien à l'écran tant qu'on ne le demande pas
 * (Direction, 07/10 : « chaque bouton ou rubrique a un texte d'infos, c'est beaucoup trop »). L'écran dit OÙ l'on en est
 * et QUOI faire ; le POURQUOI et le COMMENT vivent ici.
 *
 * Un clic (ou un appui au doigt) ouvre ; un clic ailleurs ou Échap referme.
 */
export function InfoBulle({ children, label = "Plus d'informations", className, align = "right" }: {
  children: React.ReactNode;
  label?: string;
  className?: string;
  /** De quel côté la bulle s'ouvre par rapport au bouton. */
  align?: "left" | "right";
}) {
  const [ouvert, setOuvert] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!ouvert) return;
    const ailleurs = (e: MouseEvent | TouchEvent) => { if (!ref.current?.contains(e.target as Node)) setOuvert(false); };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    document.addEventListener("mousedown", ailleurs);
    document.addEventListener("touchstart", ailleurs);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", ailleurs);
      document.removeEventListener("touchstart", ailleurs);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  return (
    <span ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert} aria-label={label}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground sm:h-6 sm:w-6"
      >
        <Info className="h-4 w-4" />
      </button>
      {ouvert && (
        <span
          role="note"
          className={cn(
            "absolute top-full z-30 mt-1 block w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-foreground shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}
