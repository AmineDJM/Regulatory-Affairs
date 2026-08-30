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
import { LeaveEditButton } from "./leave-edit";

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
function DecisionRow({ leave, canManage }: { leave: PendingLeave; canManage: boolean }) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<"APPROVED" | "REJECTED" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    if (decision === "REJECTED" && !window.confirm("Refuser cette demande de congé ? Le circuit s'arrête ici.")) return;
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
      <TableCell label="Employé" className="font-medium">
        {leave.employee}
        {leave.sheet && leave.sheet.length > 0 && (
          <details className="mt-1 font-normal">
            <summary className="cursor-pointer text-[0.6875rem] text-primary hover:underline">
              Fiche de la demande
            </summary>
            <dl className="mt-1.5 space-y-0.5 rounded-md border border-border bg-secondary/40 p-2 text-[0.6875rem]">
              {leave.sheet.map((l) => (
                <div key={l.label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{l.label}</dt>
                  <dd className="text-right font-medium">{l.value}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </TableCell>
      <TableCell label="Type">{LEAVE_TYPE[leave.type] ?? leave.type}</TableCell>
      <TableCell label="Période">{formatDate(leave.startDate)} → {formatDate(leave.endDate)}</TableCell>
      <TableCell label="Jours" className="text-right">{leave.days}</TableCell>
      <TableCell label="Motif" className="max-w-[220px]">
        <span className="text-muted-foreground">{leave.reason || "—"}</span>
        {leave.previousNote && (
          <p className="mt-1 flex items-start gap-1 text-[0.6875rem] text-muted-foreground">
            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{leave.previousStageLabel} : {leave.previousNote}</span>
          </p>
        )}
      </TableCell>
      <TableCell label="Étape">
        <Badge tone="warning" dot={false}>{STAGE_SHORT[leave.stage]}</Badge>
      </TableCell>
      <TableCell label="Décision">
        <div className="flex flex-col items-stretch gap-1.5 md:items-end">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (facultative, transmise à l'étape suivante)"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs md:w-56"
          />
          <div className="flex items-center gap-1.5 md:justify-end">
            <button
              type="button" disabled={busy !== null} onClick={() => decide("APPROVED")}
              className={cn("inline-flex items-center gap-1 rounded-md border border-success/30 px-2 py-1 text-xs font-medium text-success hover:bg-success/10 disabled:opacity-50")}
            >
              {busy === "APPROVED" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approuver
            </button>
            <button
              type="button" disabled={busy !== null} onClick={() => decide("REJECTED")}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              {busy === "REJECTED" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Refuser
            </button>
            {canManage && (
              <LeaveEditButton leave={{
                id: leave.id, employee: leave.employee, type: leave.type,
                startDate: leave.startDate, endDate: leave.endDate, days: leave.days,
                reason: leave.reason, status: "PENDING", decisionNote: null,
              }} />
            )}
          </div>
          {error && <p className="text-[0.6875rem] text-destructive md:text-right">{error}</p>}
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
  leaves, emptyHint, canManage = false,
}: { leaves: PendingLeave[]; emptyHint?: string; canManage?: boolean }) {
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
          {leaves.map((l) => <DecisionRow key={l.id} leave={l} canManage={canManage} />)}
        </TableBody>
      </Table>
    </div>
  );
}
