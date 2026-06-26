"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
 */
export function ModuleTabs({ tabs }: { tabs: ModuleTab[] }) {
  const pathname = usePathname();
  const visible = tabs.filter((t) => t.show !== false);
  if (visible.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {visible.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "border-b-2 px-3.5 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
