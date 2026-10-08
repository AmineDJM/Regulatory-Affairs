"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ChevauchementDEquipe, TeamPending } from "@/lib/queries/my-team";
import type { ApercuEquipe } from "@/lib/queries/my-team-overview";
import { VueEnsemble } from "./vue-ensemble";
import { VueEquipe } from "./vue-equipe";
import { VueCalendrier } from "./vue-calendrier";
import { FichePersonne } from "./fiche-personne";
import { VueKpi } from "./vue-kpi";
import type { TableauKpi } from "@/lib/kpi/types";

export type VueMonEquipe = "ensemble" | "equipe" | "calendrier" | "kpi";

const ONGLETS: { vue: VueMonEquipe; label: string }[] = [
  { vue: "ensemble", label: "Vue d'ensemble" },
  { vue: "equipe", label: "L'équipe" },
  { vue: "calendrier", label: "Calendrier" },
  // KPI sans code (Direction, 08/10) : une ligne par personne, une colonne par KPI, le score pondéré, la revue.
  { vue: "kpi", label: "KPI" },
];

/**
 * L'ÉCRAN DE MON ÉQUIPE — trois onglets (`?vue=`), et UN panneau : un clic sur une personne, où qu'elle soit, l'ouvre
 * sur le côté sans quitter la vue.
 */
export function EquipeEcran({ vue, apercu, pending, plusAncienJours, chevauchements, chevauchementsNonMontres, kpi, ongletKpi }: {
  vue: VueMonEquipe;
  apercu: ApercuEquipe;
  pending: TeamPending[];
  plusAncienJours: number | null;
  chevauchements: ChevauchementDEquipe[];
  chevauchementsNonMontres: number;
  /** Le tableau des KPI — chargé seulement sur l'onglet « KPI ». */
  kpi?: TableauKpi | null;
  /** L'onglet « KPI » s'affiche à qui a le module « KPI & bilans ». */
  ongletKpi?: boolean;
}) {
  const [ouverte, setOuverte] = React.useState<string | null>(null);
  const ligne = ouverte ? apercu.lignes.find((l) => l.employeeId === ouverte) ?? null : null;
  const fermer = React.useCallback(() => setOuverte(null), []);
  const lienOnglet = (v: VueMonEquipe) =>
    v === "ensemble" ? "/mon-equipe" : v === "calendrier" && apercu.mois.cle !== apercu.aujourdhui.slice(0, 7) ? `/mon-equipe?vue=calendrier&mois=${apercu.mois.cle}` : `/mon-equipe?vue=${v}`;

  return (
    <div className="space-y-4">
      <nav className="no-scrollbar -mx-3 flex items-center gap-1 overflow-x-auto border-b border-border px-3 sm:mx-0 sm:px-0" aria-label="Vues de Mon équipe">
        {ONGLETS.filter((o) => o.vue !== "kpi" || ongletKpi).map((o) => (
          <Link
            key={o.vue} href={lienOnglet(o.vue)} aria-current={vue === o.vue ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors sm:py-2",
              vue === o.vue ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </Link>
        ))}
      </nav>

      {vue === "ensemble" && <VueEnsemble apercu={apercu} pending={pending} plusAncienJours={plusAncienJours} onOuvrir={setOuverte} />}
      {vue === "equipe" && <VueEquipe lignes={apercu.lignes} onOuvrir={setOuverte} />}
      {vue === "calendrier" && (
        <VueCalendrier apercu={apercu} chevauchements={chevauchements} chevauchementsNonMontres={chevauchementsNonMontres} onOuvrir={setOuverte} />
      )}
      {vue === "kpi" && kpi && <VueKpi kpi={kpi} />}

      <FichePersonne ligne={ligne} droits={apercu.droits} onClose={fermer} />
    </div>
  );
}
