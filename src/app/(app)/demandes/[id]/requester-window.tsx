"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Pencil, Trash2 } from "lucide-react";
import { editOwnRequest, deleteOwnRequest } from "@/lib/actions/admin-request-actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { optionsFromMap } from "@/components/shared/form-fields";
import { PRIORITY } from "@/lib/labels";

const WINDOW_MS = 15 * 60 * 1000;

export function RequesterWindow({
  requestId, createdAt, values,
}: {
  requestId: string;
  createdAt: string;
  values: { title: string; description: string | null; priority: string; deadline: string | null };
}) {
  const router = useRouter();
  const deadline = new Date(createdAt).getTime() + WINDOW_MS;
  const [remaining, setRemaining] = React.useState(() => deadline - Date.now());
  const [edit, setEdit] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setInterval(() => setRemaining(deadline - Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);

  if (remaining <= 0) return null;

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  async function run(action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData, after?: () => void) {
    setBusy(true); setErr(null);
    const r = await action(fd);
    setBusy(false);
    if (r.ok) { after?.(); router.refresh(); } else setErr(r.error ?? "Erreur.");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
      <Clock className="h-4 w-4 text-amber-600" />
      <span className="text-amber-800 dark:text-amber-300">
        Vous pouvez encore modifier ou supprimer cette demande pendant{" "}
        <strong>{mins}:{String(secs).padStart(2, "0")}</strong>.
      </span>
      <div className="ml-auto flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => { setErr(null); setEdit(true); }}>
          <Pencil className="h-3.5 w-3.5" /> Modifier
        </Button>
        <form
          action={(fd) => {
            if (!confirm("Supprimer définitivement cette demande ?")) return;
            fd.set("id", requestId);
            return run(deleteOwnRequest, fd, () => router.push("/demandes"));
          }}
        >
          <Button type="submit" variant="outline" size="sm" disabled={busy}>
            <Trash2 className="h-3.5 w-3.5" /> Supprimer
          </Button>
        </form>
      </div>
      {err && <p className="w-full text-xs text-destructive">{err}</p>}

      <Sheet open={edit} onClose={() => setEdit(false)} title="Modifier ma demande" description="Possible uniquement dans les 15 minutes suivant la création." width="md">
        <form action={(fd) => { fd.set("id", requestId); return run(editOwnRequest, fd, () => setEdit(false)); }} className="space-y-3">
          <div className="space-y-1">
            <Label>Objet</Label>
            <Input name="title" required defaultValue={values.title} />
          </div>
          <div className="space-y-1">
            <Label>Priorité</Label>
            <Select name="priority" defaultValue={values.priority}>{optionsFromMap(PRIORITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
          </div>
          <div className="space-y-1">
            <Label>Échéance</Label>
            <Input name="deadline" type="date" defaultValue={values.deadline ?? undefined} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea name="description" defaultValue={values.description ?? undefined} />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEdit(false)}>Annuler</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
