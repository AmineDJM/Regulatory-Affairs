import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "previsions", label: "Prévisions", href: "/planning", editorOnly: false },
  { key: "catalogue", label: "Catalogue (BU & produits)", href: "/planning/catalogue", editorOnly: true },
  { key: "parametres", label: "Paramètres", href: "/planning/parametres", editorOnly: true },
];

/** Onglets du module Prévisions & Force de vente. Catalogue/Paramètres réservés aux éditeurs. */
export function PlanningTabs({ active, canEdit }: { active: string; canEdit: boolean }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {TABS.filter((t) => !t.editorOnly || canEdit).map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            active === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
