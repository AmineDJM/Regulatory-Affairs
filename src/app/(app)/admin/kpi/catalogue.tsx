"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { InfoBulle } from "@/components/ui/info-bulle";
import { GestionKpi } from "@/components/kpi/gestion-kpi";
import { KpiCreateur } from "@/components/kpi/kpi-createur";

/** Le catalogue (Super Admin) : les définitions, leurs affectations par rôle et leurs poids, et « Nouveau KPI ». */
export function CatalogueKpi({ roles }: { roles: { cle: string; libelle: string }[] }) {
  const [creer, setCreer] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          Modèles par rôle
          <InfoBulle align="left">Un KPI affecté à un rôle s&apos;applique à toutes les personnes de ce rôle, avec son poids. Une affectation d&apos;équipe (un manager) ou de personne l&apos;emporte sur le modèle. Modifier un KPI crée une version : les revues signées gardent la leur.</InfoBulle>
        </p>
        <Button size="sm" onClick={() => setCreer(true)}><Plus className="h-3.5 w-3.5" /> Nouveau KPI</Button>
      </div>
      <GestionKpi key={version} roles={roles} />
      <Sheet open={creer} onClose={() => setCreer(false)} title="Nouveau KPI" width="xl">
        {creer && <KpiCreateur personnes={[]} roles={roles} onAjoute={() => setVersion((v) => v + 1)} />}
      </Sheet>
    </div>
  );
}
