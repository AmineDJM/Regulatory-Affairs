"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { EVENT_TYPE, EVENT_SCOPE, EVENT_FORMAT, EVENT_STATUS } from "@/lib/labels";
import { createEvent, updateEvent, deleteEvent } from "@/lib/actions/event-actions";
import type { EventDetail } from "@/lib/queries/events";

type Result = { ok: boolean; error?: string; id?: string };
const d10 = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

function W({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={full ? "col-span-2 space-y-1.5" : "space-y-1.5"}><Label>{label}</Label>{children}</div>;
}

function EventFields({ e, responsibles }: { e?: EventDetail; responsibles: { id: string; name: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <W full label="Nom de l'événement"><Input name="name" defaultValue={e?.name} required placeholder="Ex. Symposium Cardiologie 2027" /></W>
      <W label="Type"><Select name="type" defaultValue={e?.type ?? "CONGRESS"}>{Object.entries(EVENT_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></W>
      <W label="Portée"><Select name="scope" defaultValue={e?.scope ?? "NATIONAL"}>{Object.entries(EVENT_SCOPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></W>
      <W label="Format"><Select name="format" defaultValue={e?.format ?? "PRESENTIAL"}>{Object.entries(EVENT_FORMAT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></W>
      <W label="Statut"><Select name="status" defaultValue={e?.status ?? "DRAFT"}>{Object.entries(EVENT_STATUS).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}</Select></W>
      <W label="Début"><Input type="date" name="startDate" defaultValue={d10(e?.startDate ?? null)} /></W>
      <W label="Fin"><Input type="date" name="endDate" defaultValue={d10(e?.endDate ?? null)} /></W>
      <W label="Lieu / salle"><Input name="location" defaultValue={e?.location ?? ""} /></W>
      <W label="Ville"><Input name="city" defaultValue={e?.city ?? ""} /></W>
      <W label="Pays"><Input name="country" defaultValue={e?.country ?? ""} /></W>
      <W label="Spécialité"><Input name="specialty" defaultValue={e?.specialty ?? ""} /></W>
      <W label="Capacité max."><Input type="number" name="capacity" defaultValue={e?.capacity ?? ""} /></W>
      <W label="Budget estimé (DZD)"><Input type="number" step="any" name="estimatedBudget" defaultValue={e?.estimatedBudget ?? ""} /></W>
      <W full label="Produits concernés"><Input name="products" defaultValue={e?.products ?? ""} /></W>
      <W full label="Lien Meet / Zoom / Teams (webinar/hybride)"><Input name="meetingLink" defaultValue={e?.meetingLink ?? ""} placeholder="https://meet.google.com/…" /></W>
      <W label="Responsable interne"><Select name="responsibleId" defaultValue={e?.responsibleId ?? ""}><option value="">—</option>{responsibles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></W>
      <W full label="Description"><Textarea name="description" defaultValue={e?.description ?? ""} rows={3} /></W>
    </div>
  );
}

export function CreateEventButton({ responsibles }: { responsibles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <>
      <Button size="sm" onClick={() => { setErr(null); setOpen(true); }}><Plus className="h-4 w-4" /> Nouvel événement</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nouvel événement" width="lg">
        <form action={async (fd) => { setSaving(true); setErr(null); const r: Result = await createEvent(fd); setSaving(false); if (r.ok && r.id) router.push(`/events/${r.id}`); else setErr(r.error ?? "Erreur."); }} className="space-y-4">
          <EventFields responsibles={responsibles} />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Créer</Button></div>
        </form>
      </Sheet>
    </>
  );
}

export function EditEventButton({ event, responsibles, canDelete }: { event: EventDetail; responsibles: { id: string; name: string }[]; canDelete: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setErr(null); setOpen(true); }}><Pencil className="h-4 w-4" /> Modifier</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Modifier l'événement" width="lg">
        <form action={async (fd) => { fd.set("id", event.id); setSaving(true); setErr(null); const r: Result = await updateEvent(fd); setSaving(false); if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error ?? "Erreur."); }} className="space-y-4">
          <EventFields e={event} responsibles={responsibles} />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex items-center justify-between">
            {canDelete ? <Button type="button" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm("Supprimer cet événement et ses inscriptions ?")) { const fd = new FormData(); fd.set("id", event.id); deleteEvent(fd).then((r) => { if (r.ok) router.push("/events"); }); } }}><Trash2 className="h-4 w-4" /> Supprimer</Button> : <span />}
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button></div>
          </div>
        </form>
      </Sheet>
    </>
  );
}
