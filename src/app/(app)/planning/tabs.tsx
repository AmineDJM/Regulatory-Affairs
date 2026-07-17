import Link from "next/link";
import { cn } from "@/lib/utils";

export interface PlanningTabsProps {
  active: string;
  /** Direction / Manager promo médicale / Super Admin : configure tout. */
  canConfigure: boolean;
  /** Superviseur national : voit Pilotage + Affectations de son équipe. */
  isSupervisor?: boolean;
}

const TABS: { key: string; label: string; href: string; show: (p: PlanningTabsProps) => boolean }[] = [
  { key: "previsions", label: "Prévisions", href: "/planning", show: (p) => p.canConfigure },
  { key: "affectations", label: "Affectations", href: "/planning/affectations", show: (p) => p.canConfigure || !!p.isSupervisor },
  { key: "pilotage", label: "Pilotage", href: "/planning/pilotage", show: () => true },
  { key: "equipes", label: "Équipes & KAM", href: "/planning/equipes", show: (p) => p.canConfigure },
  { key: "catalogue", label: "Catalogue", href: "/planning/catalogue", show: (p) => p.canConfigure },
  { key: "parametres", label: "Paramètres", href: "/planning/parametres", show: (p) => p.canConfigure },
];

/** Onglets du module Prévisions & Force de vente, filtrés selon la profondeur d'accès. */
export function PlanningTabs(props: PlanningTabsProps) {
  const { active } = props;
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {TABS.filter((t) => t.show(props)).map((t) => (
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
