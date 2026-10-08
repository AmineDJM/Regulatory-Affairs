import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/rbac";
import { VENTES_PCH_TABS } from "@/lib/labels";
import { visibleTabs } from "@/lib/nav-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { Badge } from "@/components/ui/badge";
import { InfoBulle } from "@/components/ui/info-bulle";
import { moisCourt } from "@/lib/ventes-pch/calculs";
import type { FraicheurSource } from "@/lib/ventes-pch/requetes";

/**
 * L'EN-TÊTE DE « VENTES PCH » — le titre et les onglets (Synthèse, Contrats, Territoires, Non servi, Importer,
 * Historique). Chaque page vérifie ses droits côté serveur avant de le rendre.
 */
export async function EnteteVentesPch({ user, children }: { user: SessionUser; children?: ReactNode }) {
  const tabs = await visibleTabs(user, VENTES_PCH_TABS);
  return (
    <div className="space-y-3">
      <PageHeader title="Ventes PCH">{children}</PageHeader>
      <ModuleTabs tabs={tabs} />
    </div>
  );
}

/** LA FRAÎCHEUR DES DONNÉES — le dernier fichier reçu par source ; un mois manquant se voit. */
export function BandeauFraicheur({ sources }: { sources: FraicheurSource[] }) {
  if (!sources.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {sources.map((s) => (
        <Badge key={s.source} tone={!s.dernier ? "neutral" : s.manquants.length ? "warning" : "success"} title={s.manquants.length ? `Manquant : ${s.manquants.map(moisCourt).join(", ")}` : undefined}>
          {s.source === "RECEPTIONS" ? "Réceptions" : s.source} : {s.dernier ? moisCourt(s.dernier) : "aucun fichier"}
          {s.manquants.length > 0 && ` · ${s.manquants.length} mois manquant${s.manquants.length > 1 ? "s" : ""}`}
        </Badge>
      ))}
      <InfoBulle>Dernier mois reçu par source (chaque direction régionale, les réceptions de la PCH centrale). Orange : un ou plusieurs mois manquent depuis le premier fichier de la source — le détail s&apos;affiche au survol.</InfoBulle>
    </div>
  );
}
