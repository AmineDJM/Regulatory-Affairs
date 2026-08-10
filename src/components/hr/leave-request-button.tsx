"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertCircle, CalendarRange, Stethoscope, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Select, Textarea, Label, Input } from "@/components/ui/input";
import { LEAVE_TYPE } from "@/lib/labels";
import { requestLeave } from "@/lib/actions/hr-actions";

/**
 * DEMANDER UN CONGÉ — **un seul formulaire**, partagé par « Mon espace » et « Mon dossier RH ».
 *
 * Les deux écrans proposaient jusqu'ici deux formulaires différents, qui n'écrivaient même pas
 * au même endroit : selon la porte empruntée, la demande apparaissait ici mais pas là. Un seul
 * composant, une seule action serveur, une seule demande — et elle se voit des deux côtés.
 */
export function LeaveRequestButton({ label = "Demander un congé" }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [type, setType] = React.useState("ANNUAL");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");

  const days = React.useMemo(() => {
    if (!start || !end) return 0;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return Number.isNaN(ms) || ms < 0 ? 0 : Math.floor(ms / 86_400_000) + 1;
  }, [start, end]);

  const onSubmit = async (fd: FormData) => {
    setSaving(true); setErr(null);
    const r = await requestLeave(undefined, fd);
    setSaving(false);
    if (r.ok) {
      setOpen(false); setStart(""); setEnd(""); setType("ANNUAL");
      router.refresh();
    } else setErr(r.error ?? "Une erreur est survenue.");
  };

  return (
    <>
      <Button size="sm" onClick={() => { setErr(null); setOpen(true); }}>
        <Plus className="h-4 w-4" /> {label}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Demande de congé / absence"
        description="Une seule demande, visible dans « Mon espace » comme dans « Mon dossier RH »."
        width="md"
      >
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type <span className="text-destructive">*</span></Label>
            <Select name="type" value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(LEAVE_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <CalendarRange className="h-4 w-4 text-primary" /> Période
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Début <span className="text-destructive">*</span></Label>
                <Input type="date" name="startDate" value={start} onChange={(e) => setStart(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Fin <span className="text-destructive">*</span></Label>
                <Input type="date" name="endDate" value={end} onChange={(e) => setEnd(e.target.value)} required />
              </div>
            </div>
            {days > 0 && (
              <p className="text-xs text-muted-foreground">
                Durée : <strong>{days} jour(s)</strong>
                {type === "ANNUAL"
                  ? " — déduits de votre solde une fois le circuit terminé."
                  : type === "UNPAID"
                    ? " — sans solde (n'entame pas votre solde de congés)."
                    : "."}
              </p>
            )}
            <input type="hidden" name="days" value={days || ""} />
          </div>

          {type === "SICK" && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Stethoscope className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Joignez le <strong>certificat médical / arrêt de travail</strong> ci-dessous.</span>
            </p>
          )}

          <div className="space-y-1.5">
            <Label>Motif / précisions</Label>
            <Textarea name="reason" rows={3} placeholder="Ex. congé annuel — départ familial, retour le lundi." />
          </div>

          <div className="space-y-1.5">
            <Label>Justificatifs (optionnel)</Label>
            <input
              type="file" name="files" multiple
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <p className="text-xs text-muted-foreground">Certificat médical, formulaire signé, justificatif d&apos;événement familial…</p>
          </div>

          <p className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
            <Route className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Votre demande suivra le circuit <strong>responsable (N+1) → ressources humaines → direction générale</strong>.
              Vous serez prévenu à chaque étape. Un refus, à n&apos;importe quelle marche, arrête le circuit.
            </span>
          </p>

          {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer la demande</Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
