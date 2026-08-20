"use client";

import * as React from "react";
import { Loader2, X, Check } from "lucide-react";
import { cancelLeave } from "@/lib/actions/hr-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LEAVE_TYPE, LEAVE_STATUS } from "@/lib/labels";
import { LEAVE_STAGE_LABELS, type LeaveStage } from "@/lib/leave-workflow";
import { formatDate, cn } from "@/lib/utils";
import { StandInButton, StandInBadge } from "@/components/hr/stand-in-panel";
import type { StandInStatus } from "@/lib/hr/stand-in";

export interface LeaveItem {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  /** Marche courante du circuit N+1 → RH → DG. */
  stage: LeaveStage;
  /** Marches déjà franchies, dans l'ordre — pour montrer OÙ en est la demande. */
  passed: { label: string; note: string | null }[];
  /** L'intérimaire désigné pour ce congé, et où en est sa validation par les RH. */
  standInId: string | null;
  standInName: string | null;
  standInStatus: StandInStatus | null;
  standInModules: string[];
  standInNote: string | null;
}

function CancelButton({ id }: { id: string }) {
  const [saving, setSaving] = React.useState(false);
  return (
    <form action={async (fd) => { setSaving(true); await cancelLeave(fd); setSaving(false); }} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Annuler
      </button>
    </form>
  );
}

/** Les trois marches, dessinées : ce qui est signé, ce qu'on attend, ce qui reste. */
const STEPS: { stage: LeaveStage; short: string }[] = [
  { stage: "MANAGER", short: "N+1" },
  { stage: "HR", short: "RH" },
  { stage: "DG", short: "DG" },
];

function StageTrail({ leave }: { leave: LeaveItem }) {
  if (leave.status !== "PENDING") {
    return <span className="text-xs text-muted-foreground">{leave.passed.length > 0 ? `${leave.passed.length} validation(s)` : "—"}</span>;
  }
  const currentIdx = STEPS.findIndex((s) => s.stage === leave.stage);
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => {
        const done = currentIdx < 0 || i < currentIdx;
        const current = i === currentIdx;
        return (
          <span
            key={s.stage}
            title={LEAVE_STAGE_LABELS[s.stage]}
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-medium",
              done && "border-success/30 bg-success/10 text-success",
              current && "border-warning/40 bg-warning/10 text-warning-foreground",
              !done && !current && "border-border text-muted-foreground",
            )}
          >
            {done && <Check className="h-3 w-3" />} {s.short}
          </span>
        );
      })}
    </div>
  );
}

/**
 * MES DEMANDES DE CONGÉ — la même liste dans « Mon espace » et « Mon dossier RH ».
 *
 * Elle montre l'avancement réel du circuit : savoir qu'une demande est « en attente » sans
 * savoir DE QUI, c'est ne rien savoir — et c'est ce qui déclenche les relances au hasard.
 */
export function MyLeaves({ leaves, people = [], modules = [], moduleLabels = {} }: {
  leaves: LeaveItem[];
  /** Collègues désignables comme intérimaire. Vide = la colonne reste en lecture. */
  people?: { id: string; name: string }[];
  /** Modules délégables (déjà filtrés par `isDelegatable`). */
  modules?: { value: string; label: string }[];
  moduleLabels?: Record<string, string>;
}) {
  if (leaves.length === 0) {
    return <EmptyState icon="Plane" title="Aucune demande de congé" description="Vos demandes apparaîtront ici, avec l'étape où elles en sont." />;
  }
  return (
    <div className="surface overflow-hidden">
      <Table mobileCards>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Période</TableHead>
            <TableHead className="text-right">Jours</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Circuit</TableHead>
            <TableHead>Intérimaire</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaves.map((l) => (
            <TableRow key={l.id}>
              <TableCell label="Type" className="font-medium">{LEAVE_TYPE[l.type] ?? l.type}</TableCell>
              <TableCell label="Période">{formatDate(l.startDate)} → {formatDate(l.endDate)}</TableCell>
              <TableCell label="Jours" className="text-right">{l.days}</TableCell>
              <TableCell label="Statut">
                <StatusBadge map={LEAVE_STATUS} value={l.status} />
                {l.status === "PENDING" && (
                  <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{LEAVE_STAGE_LABELS[l.stage]}</p>
                )}
              </TableCell>
              <TableCell label="Circuit">
                <StageTrail leave={l} />
                {l.passed.filter((p) => p.note).map((p, i) => (
                  <p key={i} className="mt-0.5 text-[0.6875rem] text-muted-foreground">{p.label} : {p.note}</p>
                ))}
              </TableCell>
              {/* L'INTÉRIMAIRE se désigne tant que le congé n'est pas passé : c'est souvent en
                  voyant la demande accordée qu'on pense à faire tenir sa place. */}
              <TableCell label="Intérimaire">
                <div className="flex flex-col items-start gap-1.5">
                  <StandInBadge state={l} moduleLabels={moduleLabels} />
                  {people.length > 0 && l.status !== "REJECTED" && l.status !== "CANCELLED" && (
                    <StandInButton leaveId={l.id} state={l} people={people} modules={modules} />
                  )}
                </div>
              </TableCell>
              <TableCell label="Action" className="text-right">
                {l.status === "PENDING" ? <CancelButton id={l.id} /> : <span className="text-muted-foreground">—</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
