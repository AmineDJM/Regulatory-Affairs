"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * « ⋯ » — LES GESTES SECONDAIRES D'UN ÉCRAN DE LA PROMOTION MÉDICALE (Direction, 07/10 : « un geste principal visible,
 * le reste dans ⋯ »). Le menu ne décide d'aucun droit : il range ce que l'écran lui passe, déjà filtré.
 *
 * Un clic ailleurs ou Échap le referme ; un clic sur une entrée aussi, sauf `fermerAuClic={false}` — pour une entrée
 * qui garde un état à montrer (une erreur, un chargement) après le clic.
 */
export function MenuPlus({
  children, label = "Autres actions", align = "right", vers = "bas", fermerAuClic = true, className,
}: {
  children: React.ReactNode;
  label?: string;
  /** De quel côté le menu s'aligne sur le bouton. */
  align?: "left" | "right";
  /** Vers le haut dans une barre collée au bas de l'écran. */
  vers?: "bas" | "haut";
  fermerAuClic?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const ailleurs = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", ailleurs);
    document.addEventListener("touchstart", ailleurs);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", ailleurs);
      document.removeEventListener("touchstart", ailleurs);
      document.removeEventListener("keydown", echap);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:h-8 sm:w-8"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          onClick={fermerAuClic ? () => setOpen(false) : undefined}
          className={cn(
            "absolute z-40 flex w-64 max-w-[calc(100vw-2rem)] flex-col items-stretch gap-0.5 rounded-lg border border-border bg-popover p-1 text-sm text-foreground shadow-lg",
            align === "right" ? "right-0" : "left-0",
            vers === "haut" ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

const CLASSE_ENTREE =
  "flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-secondary disabled:pointer-events-none disabled:opacity-50 sm:min-h-9 sm:py-1.5";

/**
 * Une entrée du menu : un bouton (`onClick`), un lien interne (`href`), ou un lien BRUT (`brut` : un téléchargement, une
 * page qui s'ouvre à part) — une route d'API ne se suit pas en navigation client.
 */
export function EntreeMenu({
  children, onClick, href, brut = false, nouvelOnglet = false, disabled = false, danger = false, title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  brut?: boolean;
  nouvelOnglet?: boolean;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  const classes = cn(CLASSE_ENTREE, danger && "text-destructive");
  if (href && brut) {
    return (
      <a role="menuitem" href={href} className={classes} title={title}
        {...(nouvelOnglet ? { target: "_blank", rel: "noreferrer" } : {})}>
        {children}
      </a>
    );
  }
  if (href) return <Link role="menuitem" href={href} className={classes} title={title}>{children}</Link>;
  return (
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled} className={classes} title={title}>
      {children}
    </button>
  );
}
