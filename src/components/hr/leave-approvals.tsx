"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, MessageSquare } from "lucide-react";
import { decideLeave } from "@/lib/actions/hr-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LEAVE_TYPE } from "@/lib/labels";
import { type LeaveStage } from "@/lib/leave-workflow";
import { formatDate, cn } from "@/lib/utils";
import { depuisLisible } from "@/lib/calendar-tz";
import { LeaveEditButton } from "./leave-edit";
import { BoutonDecisif } from "@/components/ui/bouton-decisif";

export interface PendingLeave {
  id: string;
  employeeId?: string;
  employee: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  stage: LeaveStage;
  previousNote?: string | null;
  previousStageLabel?: string | null;
  /** La fiche complète (nom, fonction, recrutement, direction, téléphone, intérim, reprise). */
  sheet?: { label: string; value: string }[];
  /** En intérim : le N+1 absent au nom de qui l'on signe (I18). */
  pourLeCompteDe?: string | null;
  /** Depuis quand la demande attend à sa marche (ISO — lot E2, 07-05). */
  depuis?: string | null;
}

const STAGE_SHORT: Record<LeaveStage, string> = {
  MANAGER: "Responsable (N+1)",
  HR: "Ressources humaines",
  DG: "Direction générale",
  DONE: "Terminé",
};

/**
 * DÉCIDER SUR UN CONGÉ — avec un mot, pas seulement un clic.
 *
 * Un refus sans motif oblige le salarié à venir demander pourquoi, et l'étape suivante à
 * deviner ce que la précédente pensait. Le champ « note » est donc dans la ligne, pas derrière
 * un écran de plus.
 */
function DecisionRow({ leave, canManage, maintenant }: { leave: PendingLeave; canManage: boolean; maintenant?: string }) {
  const router = useRouter();
  // DEPUIS QUAND ÇA ATTEND (07-05) — la période dit quand la personne part, pas depuis quand elle attend
  // une réponse. L'instant vient du serveur quand il le donne : le rendu et l'hydratation disent la même chose.
  const attente = depuisLisible(leave.depuis, maintenant ? new Date(maintenant) : undefined);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<"APPROVED" | "REJECTED" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    setBusy(decision); setError(null);
    const fd = new FormData();
    fd.set("id", leave.id);
    fd.set("decision", decision);
    if (note.trim()) fd.set("note", note.trim());
    const r = await decideLeave(fd);
    setBusy(null);
    if (r.ok) router.refresh();
    else setError(r.error ?? "Échec de la décision.");
  };

  return (
    <TableRow>
      {/* LA FICHE SOUS LES YEUX AU MOMENT DE SIGNER. Repliée par défaut — la liste reste
          lisible —, mais présente : la chercher ailleurs, c'était décrocher le téléphone à
          chacune des trois marches. */}
      {/* En carte (téléphone), le nom est le titre de la carte : pas d'intitulé « Employé ». */}
      <TableCell data-sans-etiquette className="font-medium">
        <div className="w-full min-w-0 [overflow-wrap:anywhere]">
          {leave.employee}
          {leave.sheet && leave.sheet.length > 0 && (
            <details className="mt-1 font-normal">
              <summary className="cursor-pointer py-1 text-xs text-primary hover:underline sm:py-0 sm:text-[0.6875rem]">
                Fiche de la demande
              </summary>
              <dl className="mt-1.5 space-y-0.5 rounded-md border border-border bg-secondary/40 p-2 text-[0.6875rem]">
                {leave.sheet.map((l) => (
                  <div key={l.label} className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">{l.label}</dt>
                    <dd className="min-w-0 text-right font-medium [overflow-wrap:anywhere]">{l.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </div>
      </TableCell>
      <TableCell label="Type">{LEAVE_TYPE[leave.type] ?? leave.type}</TableCell>
      <TableCell label="Période">
        <span>
          <span className="whitespace-nowrap">{formatDate(leave.startDate)} →</span>{" "}
          <span className="whitespace-nowrap">{formatDate(leave.endDate)}</span>
        </span>
      </TableCell>
      <TableCell label="Jours" className="text-right">{leave.days}</TableCell>
      {/* Le motif se lit en entier au téléphone : l'intitulé passe au-dessus, le texte en dessous. */}
      <TableCell label="Motif" className="max-sm:flex-col max-sm:gap-1 sm:max-w-[220px]">
        <div className="min-w-0 max-sm:!text-left">
          <span className="text-muted-foreground">{leave.reason || "—"}</span>
          {leave.previousNote && (
            <p className="mt-1 flex items-start gap-1 text-[0.6875rem] text-muted-foreground">
              <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="min-w-0">{leave.previousStageLabel} : {leave.previousNote}</span>
            </p>
          )}
        </div>
      </TableCell>
      <TableCell label="Étape">
        <div className="flex min-w-0 flex-col items-end gap-1 sm:items-start">
          <Badge tone="warning" dot={false}>{STAGE_SHORT[leave.stage]}</Badge>
          {leave.pourLeCompteDe && <Badge tone="info" dot={false}>Intérim pour {leave.pourLeCompteDe}</Badge>}
          {attente && <p className="text-[0.6875rem] text-muted-foreground">En attente {attente}</p>}
        </div>
      </TableCell>
      <TableCell data-sans-etiquette>
        <div className="flex w-full flex-col items-stretch gap-2 md:items-end md:gap-1.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Note de décision"
            placeholder="Note (facultative, transmise à l'étape suivante)"
            className="min-h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-base md:min-h-0 md:w-56 md:px-2 md:py-1 md:text-xs"
          />
          {/* Au pouce : Approuver et Refuser côte à côte, pleine largeur, 40 px de haut. */}
          <div className="grid grid-cols-2 items-center gap-2 md:flex md:justify-end md:gap-1.5">
            <BoutonDecisif brut
              type="button" disabled={busy !== null} onClick={() => decide("APPROVED")}
              className={cn("inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-success/30 px-3 py-1 text-sm font-medium text-success hover:bg-success/10 disabled:opacity-50 max-md:flex-1 md:min-h-0 md:px-2 md:text-xs")}
            >
              {busy === "APPROVED" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approuver
            </BoutonDecisif>
            <BoutonDecisif brut
              type="button" disabled={busy !== null} onClick={() => decide("REJECTED")}
              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-border px-3 py-1 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 max-md:flex-1 md:min-h-0 md:px-2 md:text-xs"
            >
              {busy === "REJECTED" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Refuser
            </BoutonDecisif>
            {canManage && (
              <LeaveEditButton leave={{
                id: leave.id, employee: leave.employee, type: leave.type,
                startDate: leave.startDate, endDate: leave.endDate, days: leave.days,
                reason: leave.reason, status: "PENDING", decisionNote: null,
              }} />
            )}
          </div>
          {error && <p className="text-xs text-destructive md:text-right md:text-[0.6875rem]">{error}</p>}
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * LA FILE DES CONGÉS À TRANCHER **PAR CETTE PERSONNE**.
 *
 * Le même composant sert au responsable d'équipe (depuis « Mon espace »), aux RH et à la
 * direction (depuis le module RH) : trois publics, une seule file — celle que le serveur a
 * déjà filtrée pour eux.
 */
export function LeaveApprovals({
  leaves, emptyHint, canManage = false, maintenant,
}: { leaves: PendingLeave[]; emptyHint?: string; canManage?: boolean; maintenant?: string }) {
  if (leaves.length === 0) {
    return (
      <EmptyState
        icon="CheckCheck"
        title="Aucune demande à trancher"
        description={emptyHint ?? "Les congés qui attendent VOTRE signature apparaîtront ici."}
      />
    );
  }
  return (
    <div className="surface overflow-hidden">
      <Table mobileCards>
        <TableHeader>
          <TableRow>
            <TableHead>Employé</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Période</TableHead>
            <TableHead className="text-right">Jours</TableHead>
            <TableHead>Motif</TableHead>
            <TableHead>Étape</TableHead>
            <TableHead className="text-right">Décision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaves.map((l) => <DecisionRow key={l.id} leave={l} canManage={canManage} maintenant={maintenant} />)}
        </TableBody>
      </Table>
    </div>
  );
}
