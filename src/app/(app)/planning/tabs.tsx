import Link from "next/link";
import { cn } from "@/lib/utils";

export interface PlanningTabsProps {
  active: string;
  /** Direction / Manager promo médicale / Super Admin : configure tout. */
  canConfigure: boolean;
  /** Superviseur d'une BU : voit Pilotage + Affectations de ses KAM. */
  isSupervisor?: boolean;
  /**
   * Cette personne gère-t-elle le référentiel des spécialités (`peutGererSpecialites`, §118.209) ?
   * OBLIGATOIRE : un appelant qui l'oublierait cacherait l'onglet à la Direction Marketing, qui n'a de
   * la Force de vente que la lecture — le typecheck nomme chaque page.
   */
  specialites: boolean;
}

/**
 * L'ORDRE DES ONGLETS EST L'ORDRE DU MONTAGE — et il commence par ce dont tout le reste dépend.
 *
 * « Équipes & KAM » et « Catalogue » ont fusionné dans **Business Units** : une BU EST une équipe
 * (un superviseur, des KAM) ET une franchise (un terrain, des produits). Les tenir séparés
 * obligeait à quatre allers-retours pour monter une force de vente, et laissait deux objets se
 * disputer la même réalité.
 *
 * Vient ensuite ce qu'on fait AVEC : prévoir par produit, affecter par KAM, piloter le réalisé.
 */
const TABS: { key: string; label: string; href: string; show: (p: PlanningTabsProps) => boolean }[] = [
  { key: "business-units", label: "Business Units", href: "/planning/business-units", show: (p) => p.canConfigure },
  { key: "previsions", label: "Prévisions", href: "/planning", show: (p) => p.canConfigure },
  { key: "affectations", label: "Affectations", href: "/planning/affectations", show: (p) => p.canConfigure || !!p.isSupervisor },
  { key: "pilotage", label: "Pilotage", href: "/planning/pilotage", show: () => true },
  // LES MESSAGES DE LA DIRECTION MARKETING — exigés sur chaque rapport terrain. L'onglet est
  // visible dès qu'on configure : le référentiel VIDE fait refuser tous les rapports, donc le
  // cacher à celui qui peut le remplir serait la pire façon de le protéger (§118.50).
  { key: "messages", label: "Messages", href: "/planning/messages", show: (p) => p.canConfigure },
  // LE RÉFÉRENTIEL DES SPÉCIALITÉS (§118.209) — le MÊME écran qu'Annuaires › Spécialités. Il ne suit
  // PAS `canConfigure` : la Direction Marketing le gère sans configurer la force de vente.
  { key: "specialites", label: "Spécialités", href: "/planning/specialites", show: (p) => p.specialites },
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
