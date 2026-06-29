"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Video, ExternalLink, Link2, Loader2, Check, Pencil } from "lucide-react";
import { setMeetingLink } from "@/lib/actions/meeting-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Rejoindre une réunion via son **lien** (Google Meet, Teams, Zoom… ou lien d'appel).
 * Remplace l'embed Jitsi : on affiche un grand bouton « Rejoindre ». L'organisateur peut
 * coller / modifier le lien. (Le code Jitsi reste présent, simplement masqué ici.)
 */
export function MeetJoin({ meetingId, meetLink, canManage }: { meetingId: string; meetLink: string | null; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(meetLink ?? "");
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null);
    const fd = new FormData(); fd.set("id", meetingId); fd.set("meetLink", value);
    const r = await setMeetingLink(fd);
    setSaving(false);
    if (r.ok) { setEditing(false); router.refresh(); } else setErr(r.error ?? "Erreur.");
  }

  // Saisie / modification du lien.
  const editor = (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={value} onChange={(e) => setValue(e.target.value)} type="url" placeholder="https://meet.google.com/xxx-xxxx-xxx" className="flex-1" />
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer
        </Button>
        {meetLink && <Button type="button" variant="outline" onClick={() => { setEditing(false); setValue(meetLink); }}>Annuler</Button>}
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
    </div>
  );

  if (!meetLink) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-secondary/30 px-6 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Video className="h-6 w-6 text-primary" /></div>
        {canManage ? (
          <>
            <p className="max-w-sm text-sm text-muted-foreground">Ajoutez le lien de la réunion (Google Meet, Teams, Zoom…) pour que tout le monde puisse rejoindre.</p>
            <div className="w-full max-w-md">{editor}</div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">En attente du lien de réunion de l'organisateur.</p>
        )}
      </div>
    );
  }

  if (editing) {
    return <div className="rounded-xl border border-border bg-card p-4">{editor}</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-secondary/30 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"><Video className="h-7 w-7 text-primary" /></div>
      <a href={meetLink} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
        <ExternalLink className="h-4 w-4" /> Rejoindre la réunion
      </a>
      <p className="max-w-full truncate text-xs text-muted-foreground"><Link2 className="mr-1 inline h-3 w-3" />{meetLink}</p>
      {canManage && (
        <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Pencil className="h-3 w-3" /> Modifier le lien
        </button>
      )}
    </div>
  );
}
