"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/process-intelligence", label: "Lenteurs & blocages", icon: Radar },
  { href: "/process-intelligence/people", label: "People & Workload", icon: Users },
];

export function PiTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1.5 border-b border-border">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
