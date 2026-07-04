"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { submitEventForApproval } from "@/lib/actions/event-actions";
import { WorkflowPanel } from "@/components/workflow/workflow-panel";
import type { WorkflowView } from "@/lib/queries/workflow";
import { Button } from "@/components/ui/button";

interface Props {
  eventId: string;
  requestSubmitted: boolean; // l'événement est-il déjà entré dans le circuit ?
  canSubmit: boolean;
  workflow: WorkflowView | null;
}

/**
 * Financement d'un événement : tant qu'il n'est pas soumis, un bouton l'envoie dans le
 * circuit de prise en charge. Une fois soumis, le circuit est piloté par le moteur de
 * workflow configurable (WorkflowPanel).
 */
export function EventFundingPanel({ eventId, requestSubmitted, canSubmit, workflow }: Props) {
  if (!requestSubmitted) {
    if (!canSubmit) return <p className="text-sm text-muted-foreground">Cet événement n'est pas soumis à un circuit de prise en charge (financement).</p>;
    return <SubmitButton id={eventId} />;
  }
  if (!workflow) return <p className="text-sm text-muted-foreground">Circuit indisponible.</p>;
  return <WorkflowPanel entityType="EVENT" entityId={eventId} view={workflow} />;
}

function SubmitButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  const submit = () =>
    start(async () => {
      setErr(null);
      const fd = new FormData();
      fd.set("id", id);
      const r = await submitEventForApproval(fd);
      if (!r.ok) { setErr(r.error ?? "Erreur."); return; }
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Soumettez cet événement au circuit de prise en charge : il suit ensuite les étapes
        configurées (par défaut : National Sales → chef de produit → Direction → information médicale).
      </p>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Button size="sm" onClick={submit} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Soumettre pour prise en charge
      </Button>
    </div>
  );
}
