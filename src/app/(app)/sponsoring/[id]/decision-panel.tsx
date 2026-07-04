"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Gavel, Loader2, AlertCircle } from "lucide-react";
import { sponsoringAppeal } from "@/lib/actions/sponsoring-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

/**
 * Appel du délégué après décision de la Direction. Le circuit de validation lui-même
 * est désormais piloté par le moteur de workflow configurable (WorkflowPanel) ; l'appel
 * reste une action propre au sponsoring qui ré-ouvre le circuit à l'analyse chef de produit.
 */
export function AppealPanel({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);

  const submit = () =>
    start(async () => {
      setErr(null);
      const fd = new FormData();
      fd.set("id", id);
      fd.set("reason", reason);
      const r = await sponsoringAppeal(fd);
      if (!r.ok) { setErr(r.error ?? "Action impossible."); return; }
      setOpen(false); setReason("");
      router.refresh();
    });

  if (!open) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Vous n'êtes pas d'accord avec la décision ? Vous pouvez faire appel : le dossier repart pour un nouvel examen du chef de produit.</p>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Gavel className="h-4 w-4" /> Faire appel</Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[70px]" placeholder="Expliquez pourquoi vous demandez un réexamen…" />
      {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !reason.trim()} onClick={submit}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} Envoyer l'appel</Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setErr(null); }}>Annuler</Button>
      </div>
    </div>
  );
}
