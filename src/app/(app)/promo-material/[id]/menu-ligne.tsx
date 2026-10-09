"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";

/**
 * « ⋯ » D'UNE LIGNE DE TABLEAU — les gestes secondaires d'un article, d'un devis ou d'un BC (maquette validée, 10/2026).
 * Chaque entrée est un lien (PDF, Word, Excel) ou un geste ; choisir referme le menu. Le menu ne décide d'aucun droit :
 * il ne reçoit que les entrées que le serveur a permises.
 */
export interface EntreeMenu {
  libelle: string;
  /** Un lien (fichier émis, document) — ouvert dans un nouvel onglet sauf `telecharger`. */
  href?: string;
  telecharger?: boolean;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function MenuLigne({ entrees, label = "Autres actions" }: { entrees: EntreeMenu[]; label?: string }) {
  const [ouvert, setOuvert] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!ouvert) return;
    const ailleurs = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false); };
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

  if (entrees.length === 0) return null;
  const item = "flex min-h-9 w-full items-center rounded-md px-2.5 text-left text-sm hover:bg-secondary disabled:opacity-50 sm:min-h-8";
  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button" onClick={() => setOuvert((o) => !o)} aria-haspopup="menu" aria-expanded={ouvert} aria-label={label}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:h-7 sm:w-7"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {ouvert && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 flex w-56 max-w-[calc(100vw-2rem)] flex-col gap-0.5 rounded-lg border border-border bg-background p-1.5 shadow-lg">
          {entrees.map((e) => e.href ? (
            <a
              key={e.libelle} role="menuitem" href={e.href} className={item}
              {...(e.telecharger ? {} : { target: "_blank", rel: "noreferrer" })}
              onClick={() => setOuvert(false)}
            >
              {e.libelle}
            </a>
          ) : (
            <button
              key={e.libelle} role="menuitem" type="button" disabled={e.disabled}
              className={`${item} ${e.danger ? "text-destructive" : ""}`}
              onClick={() => { setOuvert(false); e.onClick?.(); }}
            >
              {e.libelle}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Le signal d'un geste de « Ce qu'il reste à faire » vers le tableau qui le porte (ouvrir la bonne ligne, le bon formulaire). */
export const EVENEMENT_GESTE = "promo:geste";
export interface DetailGeste { cle: string; quoteId?: string }

export function emettreGeste(d: DetailGeste): void {
  window.dispatchEvent(new CustomEvent<DetailGeste>(EVENEMENT_GESTE, { detail: d }));
}

export function useGeste(ecoute: (d: DetailGeste) => void): void {
  const ref = React.useRef(ecoute);
  ref.current = ecoute;
  React.useEffect(() => {
    const f = (e: Event) => ref.current((e as CustomEvent<DetailGeste>).detail);
    window.addEventListener(EVENEMENT_GESTE, f);
    return () => window.removeEventListener(EVENEMENT_GESTE, f);
  }, []);
}
