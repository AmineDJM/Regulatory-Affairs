"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Trash2, FileText, Download, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { HR_DOCUMENT_CATEGORY, HR_REQUEST_TYPE, HR_REQUEST_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { processHrRequest, deleteEmployeeDocument } from "@/lib/actions/hr-document-actions";
import type { HrDocumentDTO, HrRequestDTO } from "@/lib/queries/hr-documents";

const REQ_TO_CAT: Record<string, string> = {
  WORK_CERTIFICATE: "WORK_CERTIFICATE",
  CNAS_CERTIFICATE: "CNAS_CERTIFICATE",
  SALARY_STATEMENT: "SALARY_STATEMENT",
  DOMICILIATION: "DOMICILIATION",
  LEAVE_CERTIFICATE: "OTHER",
  OTHER: "OTHER",
};

export function HrDossier({ employeeId, documents, requests }: { employeeId: string; documents: HrDocumentDTO[]; requests: HrRequestDTO[] }) {
  const router = useRouter();
  const [category, setCategory] = React.useState("PAYSLIP");
  const [period, setPeriod] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const upload = async (file: File, opts: { category: string; period?: string; requestId?: string }) => {
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("file", file); fd.set("employeeId", employeeId); fd.set("category", opts.category);
    if (opts.period) fd.set("period", opts.period);
    if (opts.requestId) fd.set("requestId", opts.requestId);
    try {
      const res = await fetch("/api/rh/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Échec de l'envoi.");
      else router.refresh();
    } catch { setErr("Échec de l'envoi."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      {/* Téléversement d'un document */}
      <div className="rounded-xl border border-border p-3">
        <p className="mb-2 text-sm font-medium">Déposer un document RH</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2"><Label>Catégorie</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(HR_DOCUMENT_CATEGORY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Période</Label><Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-01" /></div>
          <div className="flex items-end">
            <Button className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Choisir
            </Button>
          </div>
        </div>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, { category, period: period || undefined }); e.target.value = ""; }} />
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      </div>

      {/* Documents */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents ({documents.length})</p>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun document déposé.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-2.5 px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{HR_DOCUMENT_CATEGORY[d.category]}{d.period ? ` · ${d.period}` : ""} · {formatDate(d.createdAt)}</p>
                </div>
                <a href={`/api/rh/document/${d.id}?dl=1`} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Télécharger"><Download className="h-4 w-4" /></a>
                <button
                  onClick={() => { if (window.confirm("Supprimer ce document ?")) { const fd = new FormData(); fd.set("id", d.id); deleteEmployeeDocument(fd).then(() => router.refresh()); } }}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Supprimer"
                ><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Demandes */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Demandes d'attestation ({requests.length})</p>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune demande.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => <RequestRow key={r.id} req={r} employeeId={employeeId} onFulfil={upload} busy={busy} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function RequestRow({ req, onFulfil, busy }: { req: HrRequestDTO; employeeId: string; onFulfil: (file: File, opts: { category: string; requestId: string }) => void; busy: boolean }) {
  const router = useRouter();
  const [status, setStatus] = React.useState(req.status);
  const [note, setNote] = React.useState(req.hrNote ?? "");
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const save = async () => {
    setSaving(true);
    const fd = new FormData(); fd.set("id", req.id); fd.set("status", status); fd.set("hrNote", note);
    await processHrRequest(fd);
    setSaving(false);
    router.refresh();
  };

  return (
    <li className="rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium">{HR_REQUEST_TYPE[req.type]}</span>
        <StatusBadge map={HR_REQUEST_STATUS} value={req.status} />
        {req.fulfilmentDocId && <a href={`/api/rh/document/${req.fulfilmentDocId}?dl=1`} className="text-xs text-primary hover:underline">Document joint</a>}
      </div>
      {req.details && <p className="mb-2 text-xs text-muted-foreground">Demande : {req.details}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="space-y-1.5"><Label>Statut</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {Object.entries(HR_REQUEST_STATUS).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Note RH</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note interne / message" /></div>
        <div className="flex items-end gap-1.5">
          <Button size="sm" variant="outline" disabled={saving} onClick={save}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer</Button>
        </div>
      </div>
      <div className="mt-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" /> Joindre le document & marquer prêt</Button>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFulfil(f, { category: REQ_TO_CAT[req.type] ?? "OTHER", requestId: req.id }); e.target.value = ""; }} />
      </div>
    </li>
  );
}
