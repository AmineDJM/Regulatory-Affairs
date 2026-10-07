"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoBulle } from "@/components/ui/info-bulle";
import { cn, daysUntil, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { TeamPending } from "@/lib/queries/my-team";
import type { ApercuEquipe, EvenementEquipe } from "@/lib/queries/my-team-overview";
import { DecisionConge } from "./decision-conge";
import { GENRE, POINT_TON, jourCourt, prenom } from "./equipe-commun";

const KIND_LABEL: Record<TeamPending["kind"], string> = {
  LEAVE: "Congé",
  PURCHASE: "Achat",
  TRAINING: "Formation",
  RECRUITMENT: "Recrutement",
  TOUR_PLAN: "Plan de tournée",
};

/** Ce que dit l'échéance d'une ligne — un `Record` : une nature ajoutée sans sa phrase ne compile pas. */
const ECHEANCE: Record<TeamPending["kind"], string> = {
  LEAVE: "départ le ",
  PURCHASE: "le ",
  TRAINING: "le ",
  RECRUITMENT: "prise de poste souhaitée le ",
  TOUR_PLAN: "le ",
};

const periode = (debut: string, fin: string) => (debut === fin ? `le ${jourCourt(debut)}` : `du ${jourCourt(debut)} au ${jourCourt(fin)}`);
/** Une échéance de la file — un jour écrit à minuit UTC, lu en UTC (§118.196, M21). */
const dateLisible = (iso: string) => formatDate(iso, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const GENRE_MOT:Record<EvenementEquipe["genre"], string> = { CONGE: "congé", MISSION: "mission", FORMATION: "formation" };
const SURVEILLER_MONTRES = 8;

/**
 * VUE D'ENSEMBLE — seulement ce qui appelle un geste : quatre tuiles, la file « À décider », ce qu'il faut
 * surveiller, et la semaine. Un nom, partout, ouvre le panneau de la personne.
 */
export function VueEnsemble({ apercu, pending, plusAncienJours, onOuvrir }: {
  apercu: ApercuEquipe;
  pending: TeamPending[];
  /** Âge de la plus ancienne décision en attente, en jours — calculé au serveur. */
  plusAncienJours: number | null;
  onOuvrir: (employeeId: string) => void;
}) {
  const [toutVoir, setToutVoir] = React.useState(false);
  const nomDe = React.useMemo(() => new Map(apercu.lignes.map((l) => [l.employeeId, l.nom])), [apercu.lignes]);
  const semaine = apercu.semaine.map((j) => j.jour);
  const lundi = semaine[0];
  const jeudi = semaine[semaine.length - 1];

  // ABSENTS CETTE SEMAINE — congés accordés, missions, formations qui touchent un jour ouvré de la semaine.
  const absencesSemaine = apercu.evenements.filter((e) => !e.enAttente && e.debut <= jeudi && e.fin >= lundi);
  const absents = new Map<string, EvenementEquipe["genre"]>();
  for (const e of absencesSemaine) if (!absents.has(e.employeeId)) absents.set(e.employeeId, e.genre);

  const alertes = apercu.lignes.flatMap((l) => l.alertes).sort((a, b) => a.rang - b.rang || (nomDe.get(a.employeeId) ?? "").localeCompare(nomDe.get(b.employeeId) ?? "", "fr"));
  const alertesRh = alertes.filter((a) => a.genre === "CONTRAT" || a.genre === "ESSAI" || a.genre === "SOLDE");
  const parGenre = (g: string) => alertesRh.filter((a) => a.genre === g).length;
  const sortesRh = [
    parGenre("CONTRAT") ? `${parGenre("CONTRAT")} contrat(s)` : null,
    parGenre("ESSAI") ? `${parGenre("ESSAI")} essai(s)` : null,
    parGenre("SOLDE") ? `${parGenre("SOLDE")} solde(s)` : null,
  ].filter(Boolean).join(" · ");

  const ouvertes = apercu.lignes.reduce((s, l) => s + l.taches.ouvertes, 0);
  const enRetard = apercu.lignes.reduce((s, l) => s + l.taches.enRetard, 0);
  const cov = apercu.couverture;
  const delta = cov && cov.moisPrecedent !== null ? cov.mois - cov.moisPrecedent : null;
  const alertesMontrees = toutVoir ? alertes : alertes.slice(0, SURVEILLER_MONTRES);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tuile label="À décider" valeur={pending.length} ton={pending.length > 0 ? "warning" : undefined}
          detail={plusAncienJours !== null ? `le plus ancien : ${plusAncienJours} j` : "rien en attente"} />
        <Tuile label="Absents cette semaine" valeur={absents.size}
          detail={absents.size === 0 ? "toute l'équipe est là"
            : [...absents].slice(0, 3).map(([id, g]) => `${prenom(nomDe.get(id) ?? "—")} (${GENRE_MOT[g]})`).join(", ") + (absents.size > 3 ? ` +${absents.size - 3}` : "")} />
        {cov ? (
          <Tuile label="Couverture visites" valeur={`${cov.mois} %`} ton={cov.mois >= cov.objectif ? "success" : "warning"}
            detail={`seuil ${cov.objectif} %${delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta} pts vs mois dernier` : ""}`}
            info="Praticiens distincts vus ce mois sur le panel de l'équipe terrain — la définition du cockpit SFE. Le seuil est celui qui déclenche l'alerte de couverture de fin de mois." />
        ) : (
          <Tuile label="Tâches en retard" valeur={enRetard} ton={enRetard > 0 ? "danger" : undefined} detail={`sur ${ouvertes} ouverte(s)`} />
        )}
        <Tuile label="Alertes RH" valeur={alertesRh.length} ton={alertesRh.some((a) => a.ton === "danger") ? "danger" : alertesRh.length > 0 ? "warning" : undefined}
          detail={sortesRh || "rien à signaler"}
          info="Fin de contrat à 60 j ou moins, fin de période d'essai à 30 j ou moins, solde de congés au-delà de 30 j." />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="surface min-w-0 rounded-xl p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            À décider <span className="text-muted-foreground">({pending.length})</span>
            <InfoBulle align="left">La plus ancienne en tête : c&apos;est elle qui fait attendre quelqu&apos;un depuis le plus longtemps. Un congé se décide ici ; le reste s&apos;ouvre sur sa page.</InfoBulle>
          </h2>
          {pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Rien ne vous attend.</p>
          ) : (
            <div className="divide-y divide-border">
              {pending.map((p) => <LigneADecider key={p.id} p={p} onOuvrir={onOuvrir} />)}
            </div>
          )}
        </section>

        <section className="surface min-w-0 rounded-xl p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            À surveiller <span className="text-muted-foreground">({alertes.length})</span>
            <InfoBulle align="left">Contrat (rouge à 15 j ou moins), période d&apos;essai, solde de congés au-delà de 30 j, visites sans compte rendu sur 30 j, anniversaires de la semaine.</InfoBulle>
          </h2>
          {alertes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Rien à surveiller.</p>
          ) : (
            <ul className="divide-y divide-border">
              {alertesMontrees.map((a, i) => (
                <li key={`${a.employeeId}-${a.genre}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", POINT_TON[a.ton])} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{nomDe.get(a.employeeId) ?? "—"}</span>
                    <span className="text-muted-foreground"> — {a.texte}</span>
                  </span>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => onOuvrir(a.employeeId)}>Voir</Button>
                </li>
              ))}
            </ul>
          )}
          {alertes.length > SURVEILLER_MONTRES && (
            <button type="button" onClick={() => setToutVoir((v) => !v)} className="mt-2 text-xs font-medium text-primary hover:underline">
              {toutVoir ? "Réduire" : `Et ${alertes.length - SURVEILLER_MONTRES} autre(s) — tout voir`}
            </button>
          )}
        </section>
      </div>

      <section className="surface min-w-0 rounded-xl p-4">
        <h2 className="mb-3 text-sm font-semibold">Cette semaine</h2>
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <div className="grid min-w-[40rem] grid-cols-5 gap-2">
            {apercu.semaine.map((j) => {
              const evts = apercu.evenements.filter((e) => e.debut <= j.jour && j.jour <= e.fin);
              const annivs = apercu.anniversaires.filter((a) => a.jour === j.jour);
              const estAujourdhui = j.jour === apercu.aujourdhui;
              return (
                <div key={j.jour} className={cn("min-h-[6rem] rounded-lg border p-2", estAujourdhui ? "border-primary bg-primary/5" : "border-border")}>
                  <p className={cn("mb-1.5 text-xs font-semibold capitalize", estAujourdhui ? "text-primary" : "text-muted-foreground")}>
                    {new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${j.jour}T00:00:00Z`))}
                    {estAujourdhui && " · aujourd'hui"}
                  </p>
                  <div className="flex flex-col gap-1">
                    {evts.map((e, i) => (
                      <button
                        key={`${e.employeeId}-${e.genre}-${i}`} type="button" onClick={() => onOuvrir(e.employeeId)}
                        title={`${nomDe.get(e.employeeId) ?? ""} — ${GENRE[e.genre].label}${e.libelle ? ` · ${e.libelle}` : ""}${e.enAttente ? " (en attente)" : ""}`}
                        className={cn("truncate rounded-md border px-1.5 py-0.5 text-left text-xs", GENRE[e.genre].puce, e.enAttente && "border-dashed opacity-70")}
                      >
                        {prenom(nomDe.get(e.employeeId) ?? "—")}{e.genre === "MISSION" && e.libelle ? ` · ${e.libelle}` : ""}
                      </button>
                    ))}
                    {annivs.map((a) => (
                      <button key={`anniv-${a.employeeId}`} type="button" onClick={() => onOuvrir(a.employeeId)}
                        className={cn("truncate rounded-md border px-1.5 py-0.5 text-left text-xs", GENRE.ANNIVERSAIRE.puce)}>
                        {prenom(nomDe.get(a.employeeId) ?? "—")} · anniversaire
                      </button>
                    ))}
                    {evts.length === 0 && annivs.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function Tuile({ label, valeur, detail, ton, info }: {
  label: string; valeur: React.ReactNode; detail: string; ton?: "warning" | "danger" | "success"; info?: string;
}) {
  return (
    <div className="surface min-w-0 rounded-xl p-3 sm:p-4">
      <p className="flex items-center justify-between gap-1 text-xs font-medium text-muted-foreground">
        {label}
        {info && <InfoBulle>{info}</InfoBulle>}
      </p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums",
        ton === "warning" && "text-warning", ton === "danger" && "text-destructive", ton === "success" && "text-success")}>
        {valeur}
      </p>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

/** Une décision en attente — « nature · qui · objet », et le geste. */
function LigneADecider({ p, onOuvrir }: { p: TeamPending; onOuvrir: (employeeId: string) => void }) {
  const jours = p.deadline ? daysUntil(p.deadline) : null;
  const imminent = jours !== null && jours <= 3;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-sm">
      <Badge tone="neutral" dot={false}>{KIND_LABEL[p.kind]}</Badge>
      {p.employeeId ? (
        <button type="button" onClick={() => onOuvrir(p.employeeId as string)} className="min-w-0 font-medium hover:text-primary hover:underline [overflow-wrap:anywhere]">{p.who}</button>
      ) : (
        <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{p.who}</span>
      )}
      <span className="line-clamp-2 min-w-0 basis-full text-muted-foreground sm:line-clamp-1 sm:grow sm:basis-0">
        {p.title}{p.detail ? ` · ${p.detail}` : ""}
      </span>
      {p.amount != null && <span className="font-semibold tabular-nums">{formatCurrency(p.amount)}</span>}
      <span className="basis-full text-xs text-muted-foreground">
        demandé le {formatDateTime(p.createdAt)}
        {p.deadline && (
          <span className={cn(imminent && "font-medium text-warning")}> · {ECHEANCE[p.kind]}{dateLisible(p.deadline)}</span>
        )}
      </span>
      {/* UN CONGÉ SE DÉCIDE ICI (Direction, 06/10) ; le reste, sur sa page — un lien n'est offert que si la page s'ouvre (§118.83). */}
      {p.conge ? (
        <DecisionConge conge={p.conge} />
      ) : p.href ? (
        <Link href={p.href} className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-lg border border-border px-3 py-1 text-sm font-medium hover:bg-secondary sm:min-h-0 sm:w-auto sm:px-2.5 sm:text-xs">
          Ouvrir <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      ) : p.sansLien ? (
        <span className="basis-full text-xs text-muted-foreground">{p.sansLien}</span>
      ) : null}
      {/* M19 — QUI MANQUERA EN MÊME TEMPS dans la même équipe : la question qu'on se pose avant de signer. */}
      {p.chevauchements.length > 0 && (
        <p className="basis-full text-xs text-warning">
          Chevauche : {p.chevauchements.slice(0, 3).map((c) => `${c.nom} (${periode(c.debut, c.fin)}${c.enAttente ? ", en attente" : ""})`).join(", ")}
          {p.chevauchements.length > 3 ? ` et ${p.chevauchements.length - 3} autre(s)` : ""}
        </p>
      )}
    </div>
  );
}
