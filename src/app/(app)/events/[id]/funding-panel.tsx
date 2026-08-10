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
  /** La Direction peut CHOISIR de demander un avis produit avant de trancher (elle n'y est pas tenue). */
  canChooseAnalysis?: boolean;
}

/**
 * Financement d'un événement : tant qu'il n'est pas soumis, un bouton l'envoie dans le
 * circuit de prise en charge. Une fois soumis, le circuit est piloté par le moteur de
 * workflow configurable (WorkflowPanel).
 */
export function EventFundingPanel({ eventId, requestSubmitted, canSubmit, workflow, pmCandidates, canChooseAnalysis = false }: Props) {
  if (!requestSubmitted) {
    if (!canSubmit) return <p className="text-sm text-muted-foreground">Cet événement n'est pas soumis à un circuit de prise en charge (financement).</p>;
    return <SubmitButton id={eventId} pmCandidates={pmCandidates ?? []} canChooseAnalysis={canChooseAnalysis} />;
  }
  if (!workflow) return <p className="text-sm text-muted-foreground">Circuit indisponible.</p>;
  return <WorkflowPanel entityType="EVENT" entityId={eventId} view={workflow} />;
}

/**
 * SOUMETTRE — le circuit DÉPEND DE QUI SOUMET.
 *
 * Personne n'approuve la demande qu'il émet lui-même : un délégué part du National Sales,
 * le National Sales désigne directement le chef de produit, un chef de produit va droit à la
 * Direction. La Direction, elle, a le CHOIX — trancher tout de suite, ou demander d'abord un
 * avis produit. Ce choix lui appartient : on ne le lui impose pas, on ne le lui retire pas.
 */
function SubmitButton({
  id, pmCandidates, canChooseAnalysis,
}: { id: string; pmCandidates: PmOpt[]; canChooseAnalysis: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  const [productManagerId, setProductManagerId] = React.useState("");
  const [viaProductManager, setViaProductManager] = React.useState(false);
  const hasPmCandidates = pmCandidates.length > 0;
  // La Direction ne voit le sélecteur de chef de produit que si elle a demandé cet avis ;
  // le National Sales, lui, DOIT désigner — c'est son étape.
  const showPmPicker = hasPmCandidates && (!canChooseAnalysis || viaProductManager);
  const pmRequired = hasPmCandidates && (canChooseAnalysis ? viaProductManager : true);

  const submit = () =>
    start(async () => {
      setErr(null);
      if (pmRequired && !productManagerId) { setErr("Désignez le chef de produit qui analysera la demande."); return; }
      const fd = new FormData();
      fd.set("id", id);
      if (canChooseAnalysis) fd.set("viaProductManager", viaProductManager ? "1" : "0");
      if (showPmPicker && productManagerId) fd.set("productManagerId", productManagerId);
      const r = await submitEventForApproval(fd);
      if (!r.ok) { setErr(r.error ?? "Erreur."); return; }
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Soumettez cet événement au circuit de prise en charge : il suit ensuite les étapes
        configurées (par défaut : National Sales → chef de produit → Direction → information médicale).
        Les étapes situées au niveau ou en dessous de votre rang sont franchies automatiquement.
      </p>
      {canChooseAnalysis && (
        <div className="space-y-1.5 rounded-lg border border-border bg-secondary/40 p-3">
          <Label>Circuit</Label>
          <Select value={viaProductManager ? "1" : "0"} onChange={(e) => setViaProductManager(e.target.value === "1")}>
            <option value="0">Décision directe (Direction)</option>
            <option value="1">Passer d&apos;abord par l&apos;analyse d&apos;un chef de produit</option>
          </Select>
          <p className="text-xs text-muted-foreground">
            Vous pouvez trancher immédiatement, ou demander l&apos;avis d&apos;un chef de produit avant de décider.
          </p>
        </div>
      )}
      {showPmPicker && (
        <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Label>Chef de produit (analyse) <span className="text-destructive">*</span></Label>
          <p className="text-xs text-muted-foreground">
            {canChooseAnalysis
              ? "Le chef de produit instruira la demande, puis elle vous reviendra pour décision."
              : "Vous soumettez la demande : désignez le chef de produit qui l'analysera — l'étape préliminaire est franchie automatiquement."}
          </p>
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
