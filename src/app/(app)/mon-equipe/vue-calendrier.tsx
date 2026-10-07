"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { InfoBulle } from "@/components/ui/info-bulle";
import { cn } from "@/lib/utils";
import type { ChevauchementDEquipe } from "@/lib/queries/my-team";
import type { ApercuEquipe, EvenementEquipe } from "@/lib/queries/my-team-overview";
import { GENRE, jourCourt } from "./equipe-commun";

const PRIORITE: Record<EvenementEquipe["genre"], number> = { CONGE: 0, MISSION: 1, FORMATION: 2 };
const INITIALE = ["D", "L", "M", "M", "J", "V", "S"];

/**
 * LE CALENDRIER DU MOIS — une ligne par personne, une colonne par jour. Vendredi et samedi sont grisés ; une colonne
 * dont l'en-tête est teinté compte au moins deux absents. Au téléphone, il défile dans son cadre, le nom collé à gauche.
 */
export function VueCalendrier({ apercu, chevauchements, chevauchementsNonMontres, onOuvrir }: {
  apercu: ApercuEquipe;
  chevauchements: ChevauchementDEquipe[];
  chevauchementsNonMontres: number;
  onOuvrir: (employeeId: string) => void;
}) {
  const { mois, lignes, evenements, anniversaires, aujourdhui } = apercu;
  // L'événement qui colore une case : congé d'abord, puis mission, puis formation.
  const caseDe = React.useMemo(() => {
    const jours = mois.jours.map((j) => j.jour);
    // Ce qui est acquis passe avant ce qui est en attente ; à égalité, l'ordre de `PRIORITE`.
    const poids = (e: EvenementEquipe) => Number(e.enAttente) * 10 + PRIORITE[e.genre];
    const m = new Map<string, EvenementEquipe>();
    for (const e of evenements) {
      for (const j of jours) if (e.debut <= j && j <= e.fin) {
        const cle = `${e.employeeId}|${j}`;
        const deja = m.get(cle);
        if (!deja || poids(e) < poids(deja)) m.set(cle, e);
      }
    }
    return m;
  }, [evenements, mois.jours]);

  const absentsDuJour = (j: string) => new Set(evenements.filter((e) => !e.enAttente && e.debut <= j && j <= e.fin).map((e) => e.employeeId)).size;
  const annivDe = new Set(anniversaires.map((a) => `${a.employeeId}|${a.jour}`));

  return (
    <div className="space-y-4">
      <section className="surface min-w-0 rounded-xl">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-1">
            <Link href={`/mon-equipe?vue=calendrier&mois=${mois.precedent}`} aria-label="Mois précédent" className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <h2 className="min-w-[9rem] text-center text-sm font-semibold capitalize">{mois.libelle}</h2>
            <Link href={`/mon-equipe?vue=calendrier&mois=${mois.suivant}`} aria-label="Mois suivant" className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <InfoBulle>
            Congés accordés en couleur pleine, en attente en pâle. Le type de congé n&apos;est pas affiché : un encadrant voit qui manque, pas pourquoi.
            Missions : congrès et événements auxquels la personne est assignée. Formations : participations et demandes accordées.
          </InfoBulle>
        </div>
        <div className="relative w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[60rem] border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[10rem] border-b border-border bg-card px-3 py-2 text-left font-semibold text-muted-foreground">Personne</th>
                {mois.jours.map((j) => {
                  const n = absentsDuJour(j.jour);
                  return (
                    <th
                      key={j.jour} title={n >= 2 ? `${n} absents` : undefined}
                      className={cn(
                        "w-7 min-w-[1.75rem] border-b border-border px-0 py-1.5 text-center font-medium",
                        j.weekend ? "bg-muted/60 text-muted-foreground/70" : "text-muted-foreground",
                        n >= 2 && "bg-warning/20 text-warning",
                        j.jour === aujourdhui && "text-primary ring-1 ring-inset ring-primary",
                      )}
                    >
                      <span className="block text-[10px] leading-none">{INITIALE[j.dow]}</span>
                      <span className="block tabular-nums">{j.num}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.employeeId} className="group">
                  <td className="sticky left-0 z-10 max-w-[10rem] border-b border-border bg-card px-3 py-1.5 group-hover:bg-secondary">
                    <button type="button" onClick={() => onOuvrir(l.employeeId)} className="block max-w-full truncate text-left text-sm font-medium hover:text-primary hover:underline">
                      {l.nom}
                    </button>
                  </td>
                  {mois.jours.map((j) => {
                    const e = caseDe.get(`${l.employeeId}|${j.jour}`);
                    const anniv = annivDe.has(`${l.employeeId}|${j.jour}`);
                    return (
                      <td
                        key={j.jour}
                        title={e ? `${GENRE[e.genre].label}${e.libelle ? ` · ${e.libelle}` : ""}${e.enAttente ? " (en attente)" : ""} — ${jourCourt(e.debut)} → ${jourCourt(e.fin)}` : anniv ? "Anniversaire" : undefined}
                        className={cn("h-8 border-b border-border p-0.5", j.weekend && "bg-muted/60")}
                      >
                        {e ? (
                          <button type="button" onClick={() => onOuvrir(l.employeeId)} aria-label={`${l.nom} — ${GENRE[e.genre].label}`}
                            className={cn("block h-full w-full rounded-sm", GENRE[e.genre].cellule, e.enAttente && "opacity-40")} />
                        ) : anniv ? (
                          <span className="mx-auto block h-2 w-2 rounded-full bg-success" aria-label="Anniversaire" />
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {(["CONGE", "MISSION", "FORMATION"] as const).map((g) => (
            <span key={g} className="inline-flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded-sm", GENRE[g].cellule)} />{GENRE[g].label}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded-sm opacity-40", GENRE.CONGE.cellule)} />En attente</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />Anniversaire</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-warning/20 ring-1 ring-warning/40" />2 absents ou plus</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-muted" />Week-end</span>
        </div>
      </section>

      {/* M19 — LES JOURS OÙ UNE ÉQUIPE MANQUE DE DEUX PERSONNES À LA FOIS, sur les 30 prochains jours. Ce qui dépasse la
          coupe est COMPTÉ, jamais tu (§118.60). */}
      {chevauchements.length > 0 && (
        <section className="surface min-w-0 rounded-xl p-4">
          <h2 className="mb-3 text-sm font-semibold">
            Absences qui se chevauchent — 30 prochains jours <span className="text-muted-foreground">({chevauchements.length + chevauchementsNonMontres})</span>
          </h2>
          <ul className="divide-y divide-border text-sm">
            {chevauchements.map((c) => (
              <li key={`${c.groupe ?? "moi"}-${c.debut}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="font-medium">{c.debut === c.fin ? jourCourt(c.debut) : `${jourCourt(c.debut)} → ${jourCourt(c.fin)}`}</span>
                <span className="text-xs text-muted-foreground">{c.equipe}</span>
                <span className="min-w-0 basis-full text-muted-foreground sm:grow sm:basis-0">
                  {c.personnes.map((p) => `${p.nom}${p.enAttente ? " (en attente)" : ""}`).join(", ")}
                </span>
              </li>
            ))}
          </ul>
          {chevauchementsNonMontres > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Et {chevauchementsNonMontres} autre(s) période(s) dans les 30 prochains jours.</p>
          )}
        </section>
      )}
    </div>
  );
}
