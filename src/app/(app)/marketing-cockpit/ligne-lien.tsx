"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/** Une ligne de tableau qui OUVRE une fiche — au clic comme au clavier (Entrée). */
export function LigneLien({ href, label, children, className }: { href: string; label: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <tr
      tabIndex={0}
      aria-label={label}
      onClick={() => router.push(href)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(href); }}
      className={cn("group cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-secondary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", className)}
    >
      {children}
    </tr>
  );
}
