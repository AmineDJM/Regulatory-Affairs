"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, LayoutGrid, MessageSquare, Grid3x3, X, Search } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import type { NavItem } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { useTabBarHeight } from "@/components/layout/chrome-metrics";

/**
 * BARRE D'ONGLETS MOBILE — navigation principale sur téléphone (l'app installée depuis
 * « Ajouter à l'écran d'accueil » doit se comporter comme une vraie application).
 *
 * Cinq cibles au POUCE, toujours accessibles en bas de l'écran : Espace, Messages,
 * Assistant, et un bouton « Tout » qui ouvre la grille COMPLÈTE des modules autorisés.
 * Masquée à partir de `lg` (le desktop garde la barre latérale). Respecte la
 * `safe-area` iOS pour ne pas passer sous la barre d'accueil.
 */

/** Cibles fixes de la barre : on privilégie ce qu'on ouvre 20 fois par jour. */
const PRIMARY: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; match: string[] }[] = [
  { href: "/mon-travail", label: "Espace", icon: LayoutGrid, match: ["/mon-travail", "/mon-espace", "/dashboard", "/directives"] },
  { href: "/messages", label: "Messages", icon: MessageSquare, match: ["/messages"] },
  { href: "/assistant", label: "Assistant", icon: Sparkles, match: ["/assistant"] },
];

const isActive = (pathname: string, targets: string[]) =>
  targets.some((t) => pathname === t || pathname.startsWith(`${t}/`));

export function MobileTabBar({
  items, messagingUnread = 0, moduleBadges = {},
}: {
  items: NavItem[];
  messagingUnread?: number;
  moduleBadges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = React.useState(false);
  const [q, setQ] = React.useState("");
  // La hauteur RÉELLE de la barre est publiée pour les écrans pleine hauteur. Sur ordinateur
  // elle est `display: none` et vaut donc 0 — sans règle média supplémentaire à maintenir.
  const navRef = React.useRef<HTMLElement>(null);
  useTabBarHeight(navRef);

  // Le tiroir se referme à chaque navigation (comportement attendu d'une app mobile).
  React.useEffect(() => { setDrawer(false); setQ(""); }, [pathname]);

  // Verrouille le VRAI conteneur défilant. Verrouiller le `body` ne servait à rien : ce n'est
  // pas lui qui défile ici, et la page continuait donc de bouger derrière le tiroir.
  useScrollLock(drawer);

  const visible = items.filter((i) => PRIMARY.every((p) => p.href !== i.href));
  const filtered = q.trim()
    ? visible.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()))
    : visible;

  const grouped = filtered.reduce<Record<string, NavItem[]>>((acc, i) => {
    (acc[i.group] ??= []).push(i);
    return acc;
  }, {});

  return (
    <>
      {/* Tiroir « Tout » — grille complète des modules autorisés, avec recherche. */}
      {drawer && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background lg:hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un module…"
                className="w-full rounded-xl border border-border bg-secondary/40 py-2.5 pl-9 pr-3 text-base outline-none focus:border-primary/60"
              />
            </div>
            <button onClick={() => setDrawer(false)} aria-label="Fermer" className="rounded-xl p-2.5 text-muted-foreground hover:bg-secondary">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
            {Object.entries(grouped).map(([group, list]) => (
              <div key={group} className="mb-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {list.map((item) => {
                    const active = isActive(pathname, [item.href, ...(item.match ?? [])]);
                    const badge = moduleBadges[item.module] ?? 0;
                    return (
                      <Link
                        key={item.href} href={item.href}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3.5 text-center transition active:scale-95",
                          active ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                        )}
                      >
                        <Icon name={item.icon} className="h-6 w-6" />
                        <span className="text-[0.6875rem] font-medium leading-tight">{item.label}</span>
                        {badge > 0 && (
                          <span className="absolute right-1.5 top-1.5 min-w-[1.125rem] rounded-full bg-destructive px-1 text-[0.625rem] font-bold leading-[1.125rem] text-destructive-foreground">
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucun module ne correspond.</p>}
          </div>
        </div>
      )}

      {/* Barre d'onglets basse — toujours visible sur mobile.
          z-40 : SOUS les couches modales (z-50). Elle était à z-60 et recouvrait donc les
          feuilles et les tiroirs : le bouton de validation en bas d'un formulaire était
          visible mais intouchable, caché derrière la barre. */}
      <nav ref={navRef} className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="flex items-stretch">
          {PRIMARY.map((tab) => {
            const active = !drawer && isActive(pathname, tab.match);
            const TabIcon = tab.icon;
            const badge = tab.href === "/messages" ? messagingUnread : 0;
            return (
              <Link
                key={tab.href} href={tab.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 py-2 transition active:scale-95",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <TabIcon className="h-[1.375rem] w-[1.375rem]" />
                <span className="text-[0.625rem] font-medium">{tab.label}</span>
                {badge > 0 && (
                  <span className="absolute right-[22%] top-1 min-w-[1rem] rounded-full bg-destructive px-1 text-[0.5625rem] font-bold leading-4 text-destructive-foreground">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
                {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
          <button
            onClick={() => setDrawer((v) => !v)}
            aria-label="Tous les modules"
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 py-2 transition active:scale-95",
              drawer ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Grid3x3 className="h-[1.375rem] w-[1.375rem]" />
            <span className="text-[0.625rem] font-medium">Tout</span>
            {drawer && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" />}
          </button>
        </div>
      </nav>
    </>
  );
}
