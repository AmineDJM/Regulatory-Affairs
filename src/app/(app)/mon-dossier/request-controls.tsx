"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Select, Textarea, Label } from "@/components/ui/input";
import { HR_REQUEST_TYPE } from "@/lib/labels";
import { requestHrDocument, deleteHrRequest } from "@/lib/actions/hr-document-actions";

export function NewRequestButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const onSubmit = async (fd: FormData) => {
    setSaving(true); setErr(null);
    const r = await requestHrDocument(fd);
    setSaving(false);
    if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error ?? "Une erreur est survenue.");
  };

  return (
    <>
      <Button size="sm" onClick={() => { setErr(null); setOpen(true); }}><Plus className="h-4 w-4" /> Nouvelle demande</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nouvelle demande RH" description="Attestation, titre de congé, ordre de mission, note de frais… Les RH la traiteront et déposeront le document ici." width="md">
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type de demande</Label>
            <Select name="type" defaultValue="WORK_CERTIFICATE">
              {Object.entries(HR_REQUEST_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Précisions (optionnel)</Label>
            <Textarea name="details" placeholder="Ex. dates de congé souhaitées, trajet et dates (mission), montant et motif (note de frais)…" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Pièces jointes (optionnel)</Label>
            <input type="file" name="files" multiple className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium" />
            <p className="text-xs text-muted-foreground">Ex. justificatif d'arrêt maladie, formulaire signé…</p>
          </div>
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

export function CancelRequestButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Annuler cette demande ?")) return;
        const fd = new FormData(); fd.set("id", id);
        start(async () => { await deleteHrRequest(fd); router.refresh(); });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Annuler
    </button>
  );
}
