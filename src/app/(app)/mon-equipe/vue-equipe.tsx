"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { InfoBulle } from "@/components/ui/info-bulle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { LigneEquipe } from "@/lib/queries/my-team-overview";
import { Avatar, PastilleAlerte, statutDuJour } from "./equipe-commun";

type Filtre = "TOUS" | "DIRECTS" | "ALERTES";

/**
 * L'ÉQUIPE — un tableau, une ligne par personne, DANS L'ORDRE DE L'ARBRE (un chef, puis ses gens) : le décalage du nom
 * dit le rang. Au téléphone, le tableau reste un tableau : il défile dans son cadre, le nom collé à gauche.
 */
export function VueEquipe({ lignes, onOuvrir }: { lignes: LigneEquipe[]; onOuvrir: (employeeId: string) => void }) {
  const [filtre, setFiltre] = React.useState<Filtre>("TOUS");
  const visibles = lignes.filter((l) => (filtre === "DIRECTS" ? l.direct : filtre === "ALERTES" ? l.alertes.length > 0 : true));

  return (
    <section className="surface min-w-0 rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          L&apos;équipe <span className="text-muted-foreground">({visibles.length})</span>
          <InfoBulle align="left">Activité sur 30 jours : visites réalisées et couverture du panel pour le terrain, tâches terminées pour les autres métiers. Un clic sur une ligne ouvre la personne.</InfoBulle>
        </h2>
        <select
          value={filtre} onChange={(e) => setFiltre(e.target.value as Filtre)} aria-label="Filtrer l'équipe"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="TOUS">Tout le monde</option>
          <option value="DIRECTS">En direct</option>
          <option value="ALERTES">Avec une alerte</option>
        </select>
      </div>
      <Table className="min-w-[52rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky left-0 z-10 bg-card">Personne</TableHead>
            <TableHead>Aujourd&apos;hui</TableHead>
            <TableHead>Activité (30 j)</TableHead>
            <TableHead>Tâches</TableHead>
            <TableHead>Congés</TableHead>
            <TableHead>Alertes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibles.length === 0 && (
            <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Personne ne correspond à ce filtre.</TableCell></TableRow>
          )}
          {visibles.map((l) => {
            const statut = statutDuJour(l);
            return (
              <TableRow key={l.employeeId} className="group cursor-pointer" onClick={() => onOuvrir(l.employeeId)}>
                <TableCell className="sticky left-0 z-10 max-w-[13rem] bg-card group-hover:bg-secondary sm:max-w-none">
                  <div className="flex items-center gap-2.5" style={{ paddingLeft: `${Math.min(l.depth - 1, 4) * 14}px` }}>
                    <Avatar nom={l.nom} absent={l.aujourdhui.genre !== "PRESENT"} />
                    <div className="min-w-0">
                      <button
                        type="button" onClick={(e) => { e.stopPropagation(); onOuvrir(l.employeeId); }}
                        className="block max-w-full truncate text-left font-medium hover:text-primary hover:underline"
                      >
                        {l.nom}
                      </button>
                      <p className="truncate text-xs text-muted-foreground">
                        {[l.poste, l.rattachement].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge tone={statut.tone} className="whitespace-nowrap">{statut.texte}</Badge></TableCell>
                <TableCell>
                  {l.activite?.type === "VISITES" ? (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary" aria-hidden>
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(l.activite.couverture ?? 0, 100)}%` }} />
                      </span>
                      <span className="text-xs tabular-nums">
                        {l.activite.visites} visites{l.activite.couverture !== null ? ` · ${l.activite.couverture} %` : ""}
                      </span>
                    </div>
                  ) : l.activite?.type === "TACHES" ? (
                    <span className="whitespace-nowrap text-xs tabular-nums">{l.activite.faites} tâche(s) terminée(s)</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {l.userId ? (
                    <>
                      {l.taches.ouvertes}
                      {l.taches.enRetard > 0 && <span className="text-xs text-destructive"> ({l.taches.enRetard} en retard)</span>}
                    </>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className={cn("whitespace-nowrap tabular-nums", l.solde > 30 && "text-warning")}>{l.solde} j</TableCell>
                <TableCell><PastilleAlerte a={l.alertes[0]} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
