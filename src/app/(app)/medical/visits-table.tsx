"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Pencil, Loader2 } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { deleteVisit, updateVisit } from "@/lib/actions/medical-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { VISIT_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export interface VisitRow {
  id: string;
  date: string;
  doctor: string;
  doctorId: string | null;
  delegate: string;
  delegateId: string | null;
  region: string;
  objective: string;
  presentedProducts: string;
  status: string;
}

type Opt = { value: string; label: string };
type Result = { ok: boolean; error?: string };

function DeleteVisitButton({ id, doctor }: { id: string; doctor: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <button
      disabled={pending}
      title="Supprimer la visite"
      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      onClick={(e) => {
        e.stopPropagation();
        if (!window.confirm(`Supprimer la visite chez ${doctor} ?`)) return;
        const fd = new FormData(); fd.set("id", id);
        start(async () => { const r = await deleteVisit(fd); if (!r.ok) alert(r.error); router.refresh(); });
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}

export function VisitsTable({ rows, canEdit = false, canDelete = false, doctors = [], delegates = [], isManager = false }: {
  rows: VisitRow[]; canEdit?: boolean; canDelete?: boolean; doctors?: Opt[]; delegates?: Opt[]; isManager?: boolean;
}) {
  const [edit, setEdit] = React.useState<VisitRow | null>(null);
  const columns: Column<VisitRow>[] = [
    { key: "date", header: "Date", sortable: true, accessor: (r) => r.date, render: (r) => formatDate(r.date) },
    { key: "doctor", header: "Médecin", sortable: true, accessor: (r) => r.doctor, render: (r) => <span className="font-medium">{r.doctor}</span> },
    { key: "delegate", header: "Délégué", sortable: true, accessor: (r) => r.delegate },
    { key: "region", header: "Région", accessor: (r) => r.region },
    { key: "objective", header: "Objectif", accessor: (r) => r.objective },
    { key: "presentedProducts", header: "Produits", accessor: (r) => r.presentedProducts },
    { key: "status", header: "Statut", sortable: true, accessor: (r) => VISIT_STATUS[r.status]?.label ?? r.status,
      render: (r) => <StatusBadge map={VISIT_STATUS} value={r.status} /> },
  ];
  if (canEdit || canDelete) {
    columns.push({
      key: "actions", header: "", align: "right", accessor: () => "",
      render: (r) => (
        <div className="flex items-center justify-end gap-0.5">
          {canEdit && (
            <button title="Modifier la visite" onClick={() => setEdit(r)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button>
          )}
          {canDelete && <DeleteVisitButton id={r.id} doctor={r.doctor} />}
        </div>
      ),
    });
  }
  return (
    <>
      <DataTable rows={rows} columns={columns} filename="visites" searchPlaceholder="Rechercher médecin, région…" emptyTitle="Aucune visite planifiée" />
      {edit && <EditVisitSheet row={edit} doctors={doctors} delegates={delegates} isManager={isManager} onClose={() => setEdit(null)} />}
    </>
  );
}

function EditVisitSheet({ row, doctors, delegates, isManager, onClose }: { row: VisitRow; doctors: Opt[]; delegates: Opt[]; isManager: boolean; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const submit = async (fd: FormData) => {
    fd.set("id", row.id);
    setBusy(true); setErr(null);
    const res: Result = await updateVisit(fd);
    setBusy(false);
    if (res.ok) { onClose(); router.refresh(); } else setErr(res.error ?? "Erreur.");
  };
  return (
    <Sheet open onClose={onClose} title="Modifier la visite" width="md">
      <form action={submit} className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Date</Label><Input type="date" name="date" defaultValue={row.date.slice(0, 10)} /></div>
        <div className="space-y-1.5"><Label>Statut</Label>
          <Select name="status" defaultValue={row.status}>
            {Object.entries(VISIT_STATUS).map(([v, o]) => <option key={v} value={v}>{typeof o === "string" ? o : o.label}</option>)}
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5"><Label>Médecin</Label>
          <Select name="doctorId" defaultValue={row.doctorId ?? ""}>
            <option value="">—</option>
            {doctors.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </Select>
        </div>
        {isManager && (
          <div className="col-span-2 space-y-1.5"><Label>Délégué</Label>
            <Select name="delegateId" defaultValue={row.delegateId ?? ""}>
              <option value="">—</option>
              {delegates.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </Select>
          </div>
        )}
        <div className="space-y-1.5"><Label>Région</Label><Input name="region" defaultValue={row.region} /></div>
        <div className="space-y-1.5"><Label>Objectif</Label><Input name="objective" defaultValue={row.objective} /></div>
        <div className="col-span-2 space-y-1.5"><Label>Produits à présenter</Label><Input name="presentedProducts" defaultValue={row.presentedProducts} /></div>
        {err && <p className="col-span-2 text-sm text-destructive">{err}</p>}
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Sheet>
  );
}
