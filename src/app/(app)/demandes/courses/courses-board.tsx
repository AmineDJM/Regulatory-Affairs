"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, MapPin, Clock, Paperclip, Phone, XCircle } from "lucide-react";
import { createMission, updateMission } from "@/lib/actions/admin-request-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DRIVER_MISSION_STATUS } from "@/lib/labels";
import { formatAlgiers } from "@/lib/calendar-tz";

/** Échéance « date et heure max » affichée à l'heure d'Alger. */
const deadlineLabel = (iso: string) =>
  formatAlgiers(new Date(iso), { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export interface CourseStopDTO { id: string; location: string; task: string | null; done: boolean }
export interface CourseDTO {
  id: string;
  title: string;
  status: string;
  assignee: string | null;
  deadline: string | null;
  contactName: string | null;
  contactPhone: string | null;
  instructions: string | null;
  startLocation: string | null;
  destination: string | null;
  address: string | null;
  createdAt: string;
  request: { id: string; reference: string } | null;
  stops: CourseStopDTO[];
  attachments: { id: string; name: string; sizeBytes: number | null }[];
}
export interface UserOpt { id: string; name: string }

const letter = (i: number) => String.fromCharCode(65 + (i % 26));

export function CoursesBoard({ courses, drivers, others }: { courses: CourseDTO[]; drivers: UserOpt[]; others: UserOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Points de passage du formulaire (au moins un point).
  const [stops, setStops] = React.useState<{ key: number }[]>([{ key: 0 }]);
  const nextKey = React.useRef(1);

  const active = courses.filter((c) => c.status !== "DONE" && c.status !== "CANCELLED");
  const finished = courses.filter((c) => c.status === "DONE" || c.status === "CANCELLED");

  function resetForm() {
    setStops([{ key: 0 }]);
    nextKey.current = 1;
    setError(null);
  }

  async function cancelCourse(c: CourseDTO) {
    if (!window.confirm(`Annuler la course « ${c.title} » ?`)) return;
    const fd = new FormData();
    fd.set("id", c.id);
    fd.set("status", "CANCELLED");
    await updateMission(fd);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Courses en cours ({active.length})</h2>
        <Button size="sm" onClick={() => { resetForm(); setOpen(true); }}><Plus className="h-4 w-4" /> Nouvelle course</Button>
      </div>

      {active.length === 0 ? (
        <EmptyState icon="Car" title="Aucune course en cours" description="Créez une course : elle arrive instantanément dans l'espace du chauffeur." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((c) => (
            <div key={c.id} className="surface space-y-2.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{c.assignee ? `Assignée à ${c.assignee}` : "Non assignée"}</p>
                </div>
                <StatusBadge map={DRIVER_MISSION_STATUS} value={c.status} dot={false} />
              </div>

              {c.deadline && (
                <p className={`flex items-center gap-1.5 text-xs ${new Date(c.deadline) < new Date() ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                  <Clock className="h-3.5 w-3.5" /> Avant le {deadlineLabel(c.deadline)}
                </p>
              )}

              {c.stops.length > 0 ? (
                <ol className="space-y-1.5">
                  {c.stops.map((s, i) => (
                    <li key={s.id} className={`flex items-start gap-2 text-sm ${s.done ? "text-muted-foreground line-through" : ""}`}>
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold ${s.done ? "bg-success/15 text-success" : "bg-secondary text-foreground"}`}>{letter(i)}</span>
                      <span><span className="font-medium">{s.location}</span>{s.task ? <span className="text-muted-foreground"> — {s.task}</span> : null}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                (c.destination || c.address) && (
                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {[c.destination, c.address].filter(Boolean).join(" · ")}</p>
                )
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{c.stops.filter((s) => s.done).length}/{c.stops.length || "—"} points faits</span>
                {c.attachments.length > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> {c.attachments.length} pièce·s</span>}
                {c.contactPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {c.contactName ? `${c.contactName} — ` : ""}{c.contactPhone}</span>}
                {c.request && <Link href={`/demandes/${c.request.id}`} className="text-primary hover:underline">Demande {c.request.reference}</Link>}
              </div>

              <div className="flex justify-end">
                <button onClick={() => cancelCourse(c)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <XCircle className="h-3.5 w-3.5" /> Annuler la course
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {finished.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Terminées / annulées</h2>
          <div className="surface divide-y divide-border">
            {finished.slice(0, 30).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate font-medium">{c.title}<span className="ml-2 text-xs font-normal text-muted-foreground">{c.assignee ?? ""}</span></span>
                <StatusBadge map={DRIVER_MISSION_STATUS} value={c.status} dot={false} />
              </div>
            ))}
          </div>
        </section>
      )}

      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="Nouvelle course" description="Le chauffeur voit la course en direct dans son espace, point par point." width="lg">
        <form
          action={async (fd) => {
            setBusy(true); setError(null);
            const r = await createMission(fd);
            setBusy(false);
            if (r.ok) { setOpen(false); router.refresh(); } else setError(r.error ?? "Échec.");
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="course-title">Objet de la course <span className="text-destructive">*</span></Label>
              <Input id="course-title" name="title" required placeholder="Ex. Dépôt dossier ANPP + récupération chèque" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-assignee">Chauffeur / coordinateur</Label>
              <Select id="course-assignee" name="assignedToId" defaultValue={drivers[0]?.id ?? ""}>
                <option value="">— À assigner plus tard</option>
                {drivers.length > 0 && (
                  <optgroup label="Chauffeurs & coordinateurs">
                    {drivers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </optgroup>
                )}
                {others.length > 0 && (
                  <optgroup label="Autres collaborateurs">
                    {others.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </optgroup>
                )}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-deadline">Date et heure max</Label>
              <Input id="course-deadline" name="deadline" type="datetime-local" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Points de passage (dans l&apos;ordre)</Label>
            <div className="space-y-2">
              {stops.map((s, i) => (
                <div key={s.key} className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
                  <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">{letter(i)}</span>
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <Input name="stopLocation" placeholder={`Lieu du point ${letter(i)} (ex. PCH Alger)`} required aria-label={`Lieu du point ${letter(i)}`} />
                    <Input name="stopTask" placeholder="Quoi faire (ex. déposer le dossier au bureau 12)" aria-label={`Consigne du point ${letter(i)}`} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setStops((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== s.key) : prev))}
                    disabled={stops.length <= 1}
                    title="Retirer ce point"
                    className="mt-1.5 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setStops((prev) => [...prev, { key: nextKey.current++ }])}>
              <Plus className="h-4 w-4" /> Ajouter un point
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="course-contact">Contact sur place</Label>
              <Input id="course-contact" name="contactName" placeholder="Nom" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-phone">Téléphone</Label>
              <Input id="course-phone" name="contactPhone" placeholder="05…" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="course-instructions">Instructions générales</Label>
              <Textarea id="course-instructions" name="instructions" placeholder="Tout ce que le chauffeur doit savoir (badge, horaires, consignes…)" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="course-files">Pièces jointes</Label>
              <input id="course-files" name="files" type="file" multiple className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary/70" />
              <p className="text-xs text-muted-foreground">Bon de commande, dossier à déposer, plan d&apos;accès… Le chauffeur les ouvre depuis son espace.</p>
            </div>
          </div>

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Annuler</Button>
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Envoyer la course</Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
