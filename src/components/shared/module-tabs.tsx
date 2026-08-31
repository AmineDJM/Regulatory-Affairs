"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModuleTab {
  label: string;
  href: string;
  /** Onglet masqué si l'utilisateur n'a pas le droit (false). Par défaut visible. */
  show?: boolean;
}

/**
 * Barre d'onglets d'un module fusionné (ex. Finances · Espace comptable). Chaque
 * onglet reste sa propre route, gardée par son propre module ; on n'affiche que
 * les onglets autorisés. Si un seul onglet est accessible, aucune barre n'est rendue.
 *
 * `arrows` ajoute deux CHEVRONS qui mènent au sous-module précédent et suivant. Ils servent
 * quand les sous-modules se parcourent dans l'ordre — les Finances se lisent ainsi : on regarde
 * le tableau de bord, on passe aux paiements à faire, on finit dans la comptabilité. Aux
 * extrémités, le chevron est désactivé plutôt que masqué : un bouton qui disparaît déplace les
 * autres sous le curseur.
 */
export function ModuleTabs({ tabs, arrows = false }: { tabs: ModuleTab[]; arrows?: boolean }) {
  const pathname = usePathname();
  const visible = tabs.filter((t) => t.show !== false);
  if (visible.length <= 1) return null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const index = visible.findIndex((t) => isActive(t.href));
  const prev = index > 0 ? visible[index - 1] : null;
  const next = index >= 0 && index < visible.length - 1 ? visible[index + 1] : null;

  const arrowCls = "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border">
      {arrows && (
        prev ? (
          <Link href={prev.href} aria-label={`Sous-module précédent : ${prev.label}`} title={prev.label} className={cn(arrowCls, "hover:bg-secondary hover:text-foreground")}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span aria-hidden className={cn(arrowCls, "opacity-30")}><ChevronLeft className="h-4 w-4" /></span>
        )
      )}
      {visible.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "border-b-2 px-3.5 py-2 text-sm font-medium transition-colors",
            isActive(t.href)
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
      {arrows && (
        next ? (
          <Link href={next.href} aria-label={`Sous-module suivant : ${next.label}`} title={next.label} className={cn(arrowCls, "hover:bg-secondary hover:text-foreground")}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span aria-hidden className={cn(arrowCls, "opacity-30")}><ChevronRight className="h-4 w-4" /></span>
        )
      )}
    </div>
  );
}
