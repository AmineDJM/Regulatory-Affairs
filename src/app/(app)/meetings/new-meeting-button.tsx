"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, Check, Video, Mic } from "lucide-react";
import { createMeeting } from "@/lib/actions/meeting-actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

interface UserOption { id: string; name: string; title?: string | null }

export function NewMeetingButton({ users }: { users: UserOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [video, setVideo] = React.useState(true);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [q, setQ] = React.useState("");

  const filtered = q
    ? users.filter((u) => `${u.name} ${u.title ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : users;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <>
      <Button type="button" onClick={() => { setErr(null); setOpen(true); }}>
        <CalendarPlus className="h-4 w-4" /> Nouvelle réunion
      </Button>
      <Sheet open={open} onClose={() => !saving && setOpen(false)} title="Nouvelle réunion" width="lg">
        <form
          action={async (fd) => {
            setSaving(true); setErr(null);
            fd.set("withVideo", video ? "true" : "false");
            picked.forEach((id) => fd.append("participantIds", id));
            const r = await createMeeting(undefined, fd);
            setSaving(false);
            if (r.ok && r.id) { setOpen(false); router.push(`/meetings/${r.id}`); }
            else setErr(r.error ?? "Erreur.");
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" placeholder="Ex. Point hebdo équipe médicale" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Objet (optionnel)</Label>
            <Textarea id="description" name="description" rows={2} placeholder="Ordre du jour, contexte…" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="scheduledAt">Date / heure (optionnel)</Label>
              <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setVideo(true)}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${video ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-secondary"}`}>
                  <Video className="h-4 w-4" /> Vidéo
                </button>
                <button type="button" onClick={() => setVideo(false)}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${!video ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-secondary"}`}>
                  <Mic className="h-4 w-4" /> Audio
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Participants {picked.size > 0 && <span className="text-muted-foreground">({picked.size})</span>}</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un collègue…" />
            <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
              {filtered.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Aucun collègue.</p>}
              {filtered.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary">
                  <input type="checkbox" checked={picked.has(u.id)} onChange={() => toggle(u.id)} className="h-4 w-4" />
                  <span className="font-medium">{u.name}</span>
                  {u.title && <span className="text-xs text-muted-foreground">· {u.title}</span>}
                </label>
              ))}
            </div>
          </div>

          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Créer la réunion
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
