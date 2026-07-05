"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search, X } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { UserMenu } from "@/components/layout/user-menu";
import { MessagesIndicator } from "@/components/layout/messages-indicator";
import { CompanySwitcher } from "@/components/layout/company-switcher";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/labels";

interface TopbarProps {
  navItems: NavItem[];
  user: { name: string; email: string; role: string };
  unreadCount: number;
  canMessage: boolean;
  messagingUnread: number;
  adoption?: { score: number; tone: string; label: string } | null;
  companies: { id: string; name: string; shortName: string | null; color: string | null }[];
  companyScope: string | null;
}

// Couleur de la pastille du score d'adoption selon le palier atteint.
const ADOPTION_TONE: Record<string, string> = {
  success: "bg-success text-success-foreground",
  info: "bg-primary text-primary-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-destructive text-destructive-foreground",
  neutral: "bg-muted text-muted-foreground",
};

export function Topbar({ navItems, user, unreadCount, canMessage, messagingUnread, adoption, companies, companyScope }: TopbarProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => setDrawerOpen(false), [pathname]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur lg:px-6">
        <button
          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary lg:hidden"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("amd:open-palette"))}
          className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground shadow-sm hover:bg-secondary/40"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Rechercher partout…</span>
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] sm:block">⌘K</kbd>
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <CompanySwitcher companies={companies} scope={companyScope} />
          {adoption && (
            <div
              title={`Mon score d'adoption : ${adoption.score}/100${adoption.label ? ` — ${adoption.label}` : ""}`}
              className={cn(
                "flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums shadow-sm ring-1 ring-black/5",
                ADOPTION_TONE[adoption.tone] ?? ADOPTION_TONE.neutral,
              )}
              aria-label={`Score d'adoption ${adoption.score} sur 100`}
            >
              {adoption.score}
            </div>
          )}
          {canMessage && <MessagesIndicator initial={messagingUnread} />}
          <Link
            href="/notifications"
            className="relative rounded-lg p-2 text-muted-foreground hover:bg-secondary"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <UserMenu name={user.name} email={user.email} role={user.role} />
        </div>
      </header>

      {/* Tiroir mobile — défilable, groupé, gère l'encoche/barres (safe-area). */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-[min(85vw,18rem)] flex-col bg-sidebar text-sidebar-foreground [padding-left:env(safe-area-inset-left)]">
            <div className="flex h-16 shrink-0 items-center justify-between px-5">
              <span className="text-sm font-semibold">AMD Internal OS</span>
              <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-sidebar-muted hover:bg-white/5" aria-label="Fermer le menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-1">
              {GROUP_ORDER.map((group) => {
                const groupItems = navItems.filter((i) => i.group === group);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group}>
                    <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">{group}</p>
                    <ul className="space-y-0.5">
                      {groupItems.map((item) => {
                        const paths = [item.href, ...(item.match ?? [])];
                        const active = paths.some((p) => pathname === p || pathname.startsWith(p + "/"));
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className={cn(
                                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium",
                                active ? "bg-white/10 text-white" : "text-sidebar-muted hover:bg-white/5",
                              )}
                            >
                              <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

const GROUP_ORDER: NavItem["group"][] = ["Pilotage", "Pôles", "Transverse", "Système"];
