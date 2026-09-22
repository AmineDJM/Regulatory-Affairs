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

/**
 * SOUMETTRE — le circuit DÉPEND DE QUI SOUMET, et le formulaire n'a rien à en dire.
 *
 * Personne n'approuve la demande qu'il émet lui-même : `parcoursAdPro` lit le RANG du demandeur
 * et pose la demande sur la bonne étape. Ce panneau ne portait plus que deux réglages qui ne
 * changeaient rien — le référent Direction Marketing, retiré des nouvelles demandes par décision
 * de la Direction (22/09/2026), et le choix « passer d'abord par l'arbitrage », dont l'effet
 * serveur avait déjà disparu quand Direction Marketing est devenue l'étape qui TRANCHE toute
 * demande Ad & Pro (§118.138). Un réglage sans effet est un mensonge fait à qui le règle.
 */
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
        configurées. Le parcours dépend de QUI soumet : un délégué passe par son superviseur
        national, le National Sales par la Direction des opérations, tout autre demandeur va
        directement chez Direction Marketing, qui tranche. Les étapes situées au niveau ou en
        dessous de votre rang sont franchies automatiquement.
      </p>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Button size="sm" onClick={submit} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Soumettre pour prise en charge
      </Button>
    </div>
  );
}
