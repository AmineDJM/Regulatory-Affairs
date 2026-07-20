"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { submitEventForApproval } from "@/lib/actions/event-actions";
import { WorkflowPanel } from "@/components/workflow/workflow-panel";
import type { WorkflowView } from "@/lib/queries/workflow";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";

interface PmOpt { id: string; name: string }

interface Props {
  eventId: string;
  requestSubmitted: boolean; // l'événement est-il déjà entré dans le circuit ?
  canSubmit: boolean;
  workflow: WorkflowView | null;
  /** Candidats chef de produit (fournis au National Sales qui désigne à la soumission). */
  pmCandidates?: PmOpt[];
}

/**
 * Financement d'un événement : tant qu'il n'est pas soumis, un bouton l'envoie dans le
 * circuit de prise en charge. Une fois soumis, le circuit est piloté par le moteur de
 * workflow configurable (WorkflowPanel).
 */
export function EventFundingPanel({ eventId, requestSubmitted, canSubmit, workflow, pmCandidates }: Props) {
  if (!requestSubmitted) {
    if (!canSubmit) return <p className="text-sm text-muted-foreground">Cet événement n'est pas soumis à un circuit de prise en charge (financement).</p>;
    return <SubmitButton id={eventId} pmCandidates={pmCandidates ?? []} />;
  }
  if (!workflow) return <p className="text-sm text-muted-foreground">Circuit indisponible.</p>;
  return <WorkflowPanel entityType="EVENT" entityId={eventId} view={workflow} />;
}

function SubmitButton({ id, pmCandidates }: { id: string; pmCandidates: PmOpt[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  const [productManagerId, setProductManagerId] = React.useState("");
  const showPmPicker = pmCandidates.length > 0; // National Sales soumettant lui-même

  const submit = () =>
    start(async () => {
      setErr(null);
      if (showPmPicker && !productManagerId) { setErr("Désignez le chef de produit qui analysera la demande."); return; }
      const fd = new FormData();
      fd.set("id", id);
      if (showPmPicker) fd.set("productManagerId", productManagerId);
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
      {showPmPicker && (
        <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Label>Chef de produit (analyse) <span className="text-destructive">*</span></Label>
          <p className="text-xs text-muted-foreground">Vous soumettez la demande : désignez le chef de produit qui l'analysera — l'étape préliminaire est franchie automatiquement.</p>
          <Select value={productManagerId} onChange={(e) => setProductManagerId(e.target.value)}>
            <option value="">— Sélectionner le chef de produit —</option>
            {pmCandidates.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </div>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Button size="sm" onClick={submit} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Soumettre pour prise en charge
      </Button>
    </div>
  );
}
