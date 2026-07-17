"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Trash2, FileText, Download, Paperclip, FolderArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { HR_DOCUMENT_CATEGORY, HR_REQUEST_TYPE, HR_REQUEST_STATUS } from "@/lib/labels";
import { formatDate, formatMonth } from "@/lib/utils";
import { processHrRequest, deleteEmployeeDocument, decideExpenseReport, deleteHrRequest } from "@/lib/actions/hr-document-actions";
import { HrRequestThread } from "@/components/shared/hr-request-thread";
import { MeetingControls } from "@/components/shared/hr-meeting-controls";
import type { HrDocumentDTO, HrRequestDTO } from "@/lib/queries/hr-documents";

const REQ_TO_CAT: Record<string, string> = {
  WORK_CERTIFICATE: "WORK_CERTIFICATE",
  CNAS_CERTIFICATE: "CNAS_CERTIFICATE",
  SALARY_STATEMENT: "SALARY_STATEMENT",
  DOMICILIATION: "DOMICILIATION",
  LEAVE_CERTIFICATE: "OTHER",
  OTHER: "OTHER",
};

export function HrDossier({ employeeId, documents, requests, currentUserId }: { employeeId: string; documents: HrDocumentDTO[]; requests: HrRequestDTO[]; currentUserId: string }) {
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
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Demandes RH ({requests.length})</p>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune demande.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => <RequestRow key={r.id} req={r} employeeId={employeeId} onFulfil={upload} busy={busy} currentUserId={currentUserId} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function RequestRow({ req, employeeId, onFulfil, busy, currentUserId }: { req: HrRequestDTO; employeeId: string; onFulfil: (file: File, opts: { category: string; requestId: string }) => void; busy: boolean; currentUserId: string }) {
  const router = useRouter();
  const [status, setStatus] = React.useState(req.status);
  const [note, setNote] = React.useState(req.hrNote ?? "");
  const [saving, setSaving] = React.useState(false);
  const [deciding, setDeciding] = React.useState<string | null>(null);
  const [decideErr, setDecideErr] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Décision note de frais : la note RH saisie est enregistrée avec la décision.
  const decide = async (decision: "APPROVE" | "APPROVE_NEXT" | "REJECT") => {
    setDeciding(decision); setDecideErr(null);
    const fd = new FormData();
    fd.set("id", req.id); fd.set("decision", decision);
    if (note) fd.set("hrNote", note);
    const r = await decideExpenseReport(fd);
    setDeciding(null);
    if (!r.ok) setDecideErr(r.error ?? "Échec."); else router.refresh();
  };

  const save = async () => {
    setSaving(true);
    const fd = new FormData(); fd.set("id", req.id); fd.set("status", status); fd.set("hrNote", note);
    await processHrRequest(fd);
    setSaving(false);
    router.refresh();
  };

  return (
    <li className="rounded-xl border border-border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{HR_REQUEST_TYPE[req.type]}</span>
        <StatusBadge map={HR_REQUEST_STATUS} value={req.status} />
        {req.fulfilmentDocId && <a href={`/api/rh/document/${req.fulfilmentDocId}?dl=1`} className="text-xs text-primary hover:underline">Document joint</a>}
        {req.archivedNodeId && (
          <a href={`/drive/${req.archivedNodeId}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline" title="Ouvrir l'archive dans le Drive">
            <FolderArchive className="h-3.5 w-3.5" /> Dossier traité
          </a>
        )}
        <button
          onClick={() => {
            if (!window.confirm("Supprimer UNIQUEMENT cette demande RH ? (la fiche employé n'est pas touchée)")) return;
            const fd = new FormData(); fd.set("id", req.id);
            deleteHrRequest(fd).then(() => router.refresh());
          }}
          title="Supprimer cette demande (la demande seule, pas l'employé)"
          className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {req.details && <p className="mb-2 text-xs text-muted-foreground">Demande : {req.details}</p>}

      {/* Congé / absence : période demandée + jours + débit du solde (congé annuel) */}
      {(req.periodStart || req.periodEnd) && (
        <p className="mb-2 text-xs">
          <span className="text-muted-foreground">Période : </span>
          <span className="font-medium">{req.periodStart ? formatDate(req.periodStart) : "?"}{req.periodEnd ? ` → ${formatDate(req.periodEnd)}` : ""}</span>
          {req.periodDays ? <span className="text-muted-foreground"> · {req.periodDays} j</span> : null}
          {req.type === "ANNUAL_LEAVE" && (req.balanceApplied
            ? <span className="ml-1 font-medium text-success">· solde débité</span>
            : <span className="ml-1 text-muted-foreground">· solde débité à l&apos;approbation</span>)}
        </p>
      )}

      {/* Note de frais : mois, accusé de réception des originaux, décision en un clic */}
      {req.type === "EXPENSE_REPORT" && (
        <div className="mb-2 space-y-2 rounded-lg border border-border bg-muted/20 p-2.5">
          <p className="text-xs">
            Mois concerné : <span className="font-medium">{formatMonth(req.expenseMonth)}</span>
            {req.approvedMonth && <> · Validée pour <span className="font-medium text-success">{formatMonth(req.approvedMonth)}</span></>}
          </p>
          <p className={`text-xs ${req.originalsAckAt ? "text-success" : "text-amber-700"}`}>
            {req.originalsAckAt
              ? `Originaux réceptionnés par le secrétariat${req.originalsAckByName ? ` (${req.originalsAckByName})` : ""} le ${formatDate(req.originalsAckAt)}.`
              : "Originaux non réceptionnés par le bureau du secrétariat pour l'instant."}
          </p>
          {req.status !== "REJECTED" && !req.approvedMonth && (
            <>
              {!req.originalsAckAt && (
                <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
                  Traitement verrouillé : en attente de l&apos;accusé de réception des originaux par le bureau du secrétariat.
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" disabled={deciding !== null || !req.originalsAckAt} onClick={() => decide("APPROVE")}>
                  {deciding === "APPROVE" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Valider ({formatMonth(req.expenseMonth)})
                </Button>
                <Button size="sm" variant="outline" disabled={deciding !== null || !req.originalsAckAt} onClick={() => decide("APPROVE_NEXT")}>
                  {deciding === "APPROVE_NEXT" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Valider pour le mois suivant
                </Button>
                <Button size="sm" variant="outline" disabled={deciding !== null || !req.originalsAckAt} onClick={() => { if (window.confirm("Refuser cette note de frais ?")) decide("REJECT"); }} className="text-destructive hover:bg-destructive/10">
                  {deciding === "REJECT" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Refuser
                </Button>
              </div>
            </>
          )}
          {decideErr && <p className="text-xs text-destructive">{decideErr}</p>}
        </div>
      )}

      {/* Entrevue RH : proposer / accepter une date */}
      {req.type === "HR_INTERVIEW" && req.status !== "REJECTED" && (
        <div className="mb-2">
          <MeetingControls
            requestId={req.id}
            meetingAt={req.meetingAt}
            proposedByMe={req.meetingProposedById === currentUserId}
            confirmed={Boolean(req.meetingConfirmedAt)}
            canPropose
            otherParty="l'employé"
          />
        </div>
      )}

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
      <HrRequestThread requestId={req.id} documents={req.documents} comments={req.comments} canManage currentUserId={currentUserId} path={`/rh/${employeeId}`} />
    </li>
  );
}
