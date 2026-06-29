"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, AlertCircle, Play, Pause, CheckCircle2, Archive, Users, Trash2, Pencil, Check, X } from "lucide-react";
import { updateDossierStatus, archiveDossier, postDossierMessage, assignDossier, deleteDossierMessage, editDossierMessage } from "@/lib/actions/dossier-actions";
import { Button } from "@/components/ui/button";
import { Textarea, Select, Label } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/types";

interface UserLite { id: string; name: string }

/**
 * Bulle d'un message du fil « Suivi & discussion » : affichage, et — pour l'auteur,
 * le responsable/créateur ou le Super Admin/Direction — modification en ligne et
 * suppression.
 */
export function DossierMessageItem({
  id, body, author, createdAt, mine, canManage,
}: { id: string; body: string; author: string; createdAt: string; mine: boolean; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(body);
  const [busy, setBusy] = React.useState(false);

  async function save() {
    if (!draft.trim()) return;
    setBusy(true);
    const fd = new FormData(); fd.set("id", id); fd.set("body", draft);
    await editDossierMessage(fd);
    setBusy(false); setEditing(false); router.refresh();
  }
  async function remove() {
    if (!window.confirm("Supprimer ce message ?")) return;
    setBusy(true);
    const fd = new FormData(); fd.set("id", id);
    await deleteDossierMessage(fd);
    setBusy(false); router.refresh();
  }

  return (
    <div className={`group max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
      {editing ? (
        <div className="space-y-1.5">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy}
            className="min-h-[56px] bg-background text-foreground" />
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => { setEditing(false); setDraft(body); }} disabled={busy}
              className="rounded p-1 text-muted-foreground hover:bg-background/40" title="Annuler"><X className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={save} disabled={busy || !draft.trim()}
              className="rounded p-1 text-success hover:bg-background/40" title="Enregistrer">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap">{body}</p>
      )}
      <p className={`mt-1 flex items-center gap-1.5 text-[11px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
        <span>{author} · {createdAt}</span>
        {canManage && !editing && (
          <span className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button type="button" onClick={() => { setDraft(body); setEditing(true); }} title="Modifier"
              className={`rounded p-0.5 ${mine ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={remove} disabled={busy} title="Supprimer"
              className={`rounded p-0.5 ${mine ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-muted-foreground hover:text-destructive"}`}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </span>
        )}
      </p>
    </div>
  );
}

function useAction() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const run = async (fn: () => Promise<ActionResult>, onOk?: () => void) => {
    setSaving(true); setErr(null);
    const r = await fn();
    setSaving(false);
    if (r.ok) { onOk?.(); router.refresh(); } else setErr(r.error ?? "Action impossible.");
  };
  return { saving, err, run };
}

const Err = ({ msg }: { msg: string | null }) =>
  msg ? <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" /> {msg}</div> : null;

export function DossierStatusControls({ id, status, canManage }: { id: string; status: string; canManage: boolean }) {
  const { saving, err, run } = useAction();
  if (!canManage) return <p className="text-xs text-muted-foreground">Le créateur ou le responsable pilote l'avancement.</p>;
  const set = (s: string) => { const fd = new FormData(); fd.set("id", id); fd.set("status", s); return updateDossierStatus(fd); };
  const archive = () => { const fd = new FormData(); fd.set("id", id); return archiveDossier(fd); };
  const archived = status === "ARCHIVED";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== "IN_PROGRESS" && !archived && (
          <Button size="sm" variant="outline" disabled={saving} onClick={() => run(() => set("IN_PROGRESS"))}><Play className="h-4 w-4" /> En cours</Button>
        )}
        {status !== "ON_HOLD" && !archived && (
          <Button size="sm" variant="outline" disabled={saving} onClick={() => run(() => set("ON_HOLD"))}><Pause className="h-4 w-4" /> En attente</Button>
        )}
        {status !== "DONE" && !archived && (
          <Button size="sm" variant="outline" disabled={saving} onClick={() => run(() => set("DONE"))}><CheckCircle2 className="h-4 w-4" /> Abouti</Button>
        )}
        {!archived && (
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => run(archive)}><Archive className="h-4 w-4" /> Archiver</Button>
        )}
        {saving && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
      </div>
      <Err msg={err} />
    </div>
  );
}

export function DossierAssign({
  id, users, currentAssignee, currentParticipants,
}: {
  id: string;
  users: UserLite[];
  currentAssignee: string | null;
  currentParticipants: string[];
}) {
  const { saving, err, run } = useAction();
  const [parts, setParts] = React.useState<Set<string>>(new Set(currentParticipants));
  const toggle = (uid: string) => setParts((s) => { const n = new Set(s); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });

  return (
    <details className="rounded-lg border border-border">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium"><Users className="h-4 w-4 text-primary" /> Responsable & participants</summary>
      <form
        action={(fd) => { fd.set("id", id); parts.forEach((p) => fd.append("participantIds", p)); run(() => assignDossier(fd)); }}
        className="space-y-3 border-t border-border p-3"
      >
        <div className="space-y-1">
          <Label htmlFor="assignedToId">Responsable principal</Label>
          <Select id="assignedToId" name="assignedToId" defaultValue={currentAssignee ?? ""}>
            <option value="">— Aucun —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Participants</Label>
          <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary/50">
                <input type="checkbox" checked={parts.has(u.id)} onChange={() => toggle(u.id)} className="h-4 w-4 rounded border-input" />
                {u.name}
              </label>
            ))}
          </div>
        </div>
        <Err msg={err} />
        <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer</Button>
      </form>
    </details>
  );
}

export function DossierMessageForm({ id }: { id: string }) {
  const { saving, err, run } = useAction();
  const ref = React.useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={(fd) => { fd.set("id", id); run(() => postDossierMessage(fd), () => ref.current?.reset()); }}
      className="space-y-2"
    >
      <Textarea name="body" required placeholder="Un point d'avancement, une question, un lien…" className="min-h-[70px]" />
      <Err msg={err} />
      <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer</Button>
    </form>
  );
}
