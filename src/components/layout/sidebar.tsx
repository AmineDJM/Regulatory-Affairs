"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/labels";

interface SidebarProps {
  items: NavItem[];
}

const GROUP_ORDER: NavItem["group"][] = ["Pilotage", "Pôles", "Transverse", "Système"];

export function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();

  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: items.filter((i) => i.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent text-sm font-bold text-sidebar">
          A
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">AMD Internal OS</p>
          <p className="text-[11px] text-sidebar-muted">Adventum Pharma</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {groups.map(({ group, items: groupItems }) => (
          <div key={group}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
              {group}
            </p>
            <ul className="space-y-0.5">
              {groupItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-white/10 text-white"
                          : "text-sidebar-muted hover:bg-white/5 hover:text-white",
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
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-[11px] text-sidebar-muted">
          © {new Date().getFullYear()} Adventum — v0.1
        </p>
      </div>
    </aside>
  );
}
