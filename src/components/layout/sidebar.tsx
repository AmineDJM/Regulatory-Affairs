"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/labels";
import { groupIntoPoles, itemsOfGroup, poleOfPath, type NavPoleKey } from "@/lib/navigation";

interface SidebarProps {
  items: NavItem[];
  messagingUnread?: number;
  /** Notifications non lues par module → badge sur l'entrée de menu concernée. */
  moduleBadges?: Record<string, number>;
}

/** Les groupes historiques encadrent les pôles : le personnel au-dessus, le système en bas. */
const FLAT_GROUPS: NavItem["group"][] = ["Pilotage", "Transverse", "Système"];

/** Préférence LOCALE d'ouverture des pôles (par navigateur, donc par personne). */
const OPEN_POLES_KEY = "amd-open-poles";

/** Nombre de notifications non lues d'une entrée (module + ses onglets fusionnés). */
function badgeFor(item: NavItem, badges: Record<string, number>): number {
  const mods = item.tabs ? [...new Set([item.module, ...item.tabs.map((t) => t.module)])] : [item.module];
  return mods.reduce((a, m) => a + (badges[m] ?? 0), 0);
}

/** Pastille de compteur statique (badge de menu). */
function NavBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent px-1.5 text-[0.6875rem] font-semibold text-sidebar">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Badge de non-lus de la messagerie : valeur initiale serveur, puis temps réel via l'évènement global. */
function MessagesNavBadge({ initial }: { initial: number }) {
  const [count, setCount] = React.useState(initial);
  React.useEffect(() => {
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ total: number }>).detail;
      if (detail && typeof detail.total === "number") setCount(detail.total);
    };
    window.addEventListener("amd:messaging-unread", onEvent);
    return () => window.removeEventListener("amd:messaging-unread", onEvent);
  }, []);
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent px-1.5 text-[0.6875rem] font-semibold text-sidebar">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Sidebar({ items, messagingUnread = 0, moduleBadges = {} }: SidebarProps) {
  const pathname = usePathname();

  // Les entrées reçues sont DÉJÀ filtrées par le RBAC côté serveur : ranger n'ouvre aucun droit.
  const poles = React.useMemo(() => groupIntoPoles(items), [items]);
  const pilotage = React.useMemo(() => itemsOfGroup(items, "Pilotage"), [items]);
  const transverse = React.useMemo(() => itemsOfGroup(items, "Transverse"), [items]);
  const systeme = React.useMemo(() => itemsOfGroup(items, "Système"), [items]);

  // Ouverture : par défaut selon la règle des 5, puis la préférence de la personne l'emporte.
  // Chargée APRÈS montage — sinon le serveur et le client rendraient deux arbres différents.
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [restored, setRestored] = React.useState(false);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OPEN_POLES_KEY);
      if (raw) setOpen(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* préférence illisible → règle par défaut */
    }
    setRestored(true);
  }, []);

  // Le pôle de la page courante s'ouvre tout seul : arriver par un lien de notification sans
  // voir où l'on se trouve dans le menu, c'est perdre son repère à chaque notification.
  const activePole = React.useMemo(() => poleOfPath(poles, pathname), [poles, pathname]);

  const isOpen = (key: NavPoleKey, defaultOpen: boolean): boolean => {
    if (activePole === key) return true;
    return open[key] ?? defaultOpen;
  };

  const toggle = (key: NavPoleKey, next: boolean) => {
    const merged = { ...open, [key]: next };
    setOpen(merged);
    try { window.localStorage.setItem(OPEN_POLES_KEY, JSON.stringify(merged)); } catch { /* refusé : sans mémoire */ }
  };

  const renderItem = (item: NavItem, nested = false) => {
    const paths = [item.href, ...(item.match ?? [])];
    const active = paths.some((p) => pathname === p || pathname.startsWith(p + "/"));
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={cn(
            "flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-colors",
            nested ? "pl-9 pr-3" : "px-3",
            active ? "bg-white/10 text-white" : "text-sidebar-muted hover:bg-white/5 hover:text-white",
          )}
        >
          <Icon name={item.icon} className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.label}</span>
          {item.href === "/messages"
            ? <MessagesNavBadge initial={messagingUnread} />
            : (() => { const b = badgeFor(item, moduleBadges); return b > 0 ? <NavBadge count={b} /> : null; })()}
        </Link>
      </li>
    );
  };

  const renderFlat = (group: NavItem["group"], groupItems: NavItem[]) => (
    groupItems.length === 0 ? null : (
      <div key={group}>
        <p className="px-3 pb-1.5 text-[0.625rem] font-semibold uppercase tracking-wider text-sidebar-muted">{group}</p>
        <ul className="space-y-0.5">{groupItems.map((i) => renderItem(i))}</ul>
      </div>
    )
  );

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent text-sm font-bold text-sidebar">
          A
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">AMD Internal OS</p>
          <p className="text-[0.6875rem] text-sidebar-muted">Adventum Pharma</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {renderFlat("Pilotage", pilotage)}

        {poles.length > 0 && (
          <div>
            <p className="px-3 pb-1.5 text-[0.625rem] font-semibold uppercase tracking-wider text-sidebar-muted">
              Pôles
            </p>
            <ul className="space-y-1">
              {poles.map((pole) => {
                const opened = isOpen(pole.key, pole.defaultOpen);
                const anyActive = pole.children.some((c) => [c.href, ...(c.match ?? [])]
                  .some((p) => pathname === p || pathname.startsWith(p + "/")));
                const badge = pole.children.reduce((a, c) => a + badgeFor(c, moduleBadges), 0);
                return (
                  <li key={pole.key}>
                    <button
                      type="button"
                      onClick={() => toggle(pole.key, !opened)}
                      aria-expanded={opened}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                        anyActive ? "text-white" : "text-sidebar-muted hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon name={pole.icon} className="h-4 w-4 shrink-0" />
                      <span className="truncate">{pole.label}</span>
                      {badge > 0 && !opened && <NavBadge count={badge} />}
                      <Icon
                        name="ChevronDown"
                        className={cn("ml-auto h-3.5 w-3.5 shrink-0 transition-transform", opened ? "" : "-rotate-90")}
                      />
                    </button>
                    {/* Rendu inconditionnel avant restauration de la préférence : le premier
                        rendu client doit être identique à celui du serveur. */}
                    {(opened || !restored) && (
                      <ul className={cn("mt-0.5 space-y-0.5", !opened && !restored ? "hidden" : "")}>
                        {pole.children.map((c) => renderItem(c, true))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {renderFlat("Transverse", transverse)}
        {renderFlat("Système", systeme)}
      </nav>

      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-[0.6875rem] text-sidebar-muted">
          © {new Date().getFullYear()} Adventum — v0.1
        </p>
      </div>
    </aside>
  );
}
