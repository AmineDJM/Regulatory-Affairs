"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Pencil, Trash2, Check, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";

export interface CommentItem {
  id: string;
  author: string;
  authorId?: string | null;
  body: string;
  createdAt: string;
  editedAt?: string | null;
}

type ModAction = (formData: FormData) => Promise<{ ok: boolean; error?: string }>;

interface CommentThreadProps {
  comments: CommentItem[];
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  hiddenFields: Record<string, string>;
  /** Utilisateur courant (pour autoriser l'édition/suppression de ses propres commentaires). */
  currentUserId?: string;
  /** Modérateur (admin / responsable de l'objet) : peut éditer/supprimer n'importe quel commentaire. */
  canModerate?: boolean;
  /** Actions de modération (si non fournies, l'édition/suppression est désactivée). */
  updateAction?: ModAction;
  deleteAction?: ModAction;
  /** Chemin à revalider après modération. */
  path?: string;
}

export function CommentThread({
  comments, action, hiddenFields, currentUserId, canModerate = false, updateAction, deleteAction, path,
}: CommentThreadProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const canManage = (c: CommentItem) => Boolean((updateAction || deleteAction) && (canModerate || (c.authorId && c.authorId === currentUserId)));

  async function save(id: string, body: string) {
    if (!updateAction || !body.trim()) { setEditing(null); return; }
    setBusy(id);
    const fd = new FormData(); fd.set("id", id); fd.set("body", body); if (path) fd.set("path", path);
    await updateAction(fd);
    setBusy(null); setEditing(null); router.refresh();
  }
  async function remove(id: string) {
    if (!deleteAction || !window.confirm("Supprimer ce commentaire ?")) return;
    setBusy(id);
    const fd = new FormData(); fd.set("id", id); if (path) fd.set("path", path);
    await deleteAction(fd);
    setBusy(null); router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {comments.length === 0 && <p className="text-sm text-muted-foreground">Aucun commentaire pour le moment.</p>}
        {comments.map((c) => (
          <li key={c.id} className="group flex gap-2.5">
            <Avatar name={c.author} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{c.author}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                {c.editedAt && <span className="text-[0.6875rem] italic text-muted-foreground">(modifié)</span>}
                {canManage(c) && editing !== c.id && (
                  <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    {updateAction && (
                      <button type="button" onClick={() => setEditing(c.id)} title="Modifier" className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {deleteAction && (
                      <button type="button" onClick={() => remove(c.id)} disabled={busy === c.id} title="Supprimer" className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </span>
                )}
              </div>
              {editing === c.id ? (
                <EditRow initial={c.body} busy={busy === c.id} onCancel={() => setEditing(null)} onSave={(v) => save(c.id, v)} />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-foreground/90">{c.body}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <form
        ref={formRef}
        action={async (fd) => {
          setPending(true);
          await action(fd);
          setPending(false);
          formRef.current?.reset();
        }}
        className="flex items-end gap-2"
      >
        {Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Textarea name="body" required placeholder="Ajouter un commentaire…" className="min-h-[40px] flex-1" />
        <Button type="submit" size="icon" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

function EditRow({ initial, busy, onSave, onCancel }: { initial: string; busy: boolean; onSave: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = React.useState(initial);
  return (
    <div className="mt-1 space-y-1.5">
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} className="min-h-[40px]" autoFocus />
      <div className="flex gap-1.5">
        <Button type="button" size="sm" onClick={() => onSave(value)} disabled={busy || !value.trim()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Enregistrer
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}><X className="h-3.5 w-3.5" /> Annuler</Button>
      </div>
    </div>
  );
}
