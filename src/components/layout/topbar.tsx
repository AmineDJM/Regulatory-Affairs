"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search, X } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { UserMenu } from "@/components/layout/user-menu";
import { MessagesIndicator } from "@/components/layout/messages-indicator";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/labels";

interface TopbarProps {
  navItems: NavItem[];
  user: { name: string; email: string; role: string };
  unreadCount: number;
  canMessage: boolean;
  messagingUnread: number;
}

export function Topbar({ navItems, user, unreadCount, canMessage, messagingUnread }: TopbarProps) {
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

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 animate-slide-in bg-sidebar text-sidebar-foreground">
            <div className="flex h-16 items-center justify-between px-5">
              <span className="text-sm font-semibold">AMD Internal OS</span>
              <button onClick={() => setDrawerOpen(false)} className="p-1 text-sidebar-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-0.5 px-3 py-2">
              {navItems.map((item) => {
                const paths = [item.href, ...(item.match ?? [])];
                const active = paths.some((p) => pathname === p || pathname.startsWith(p + "/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
                      active ? "bg-white/10 text-white" : "text-sidebar-muted hover:bg-white/5",
                    )}
                  >
                    <Icon name={item.icon} className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
