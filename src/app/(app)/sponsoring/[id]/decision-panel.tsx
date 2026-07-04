"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, Gavel, Send, AlertCircle } from "lucide-react";
import {
  sponsoringPreliminary, sponsoringAnalysis, sponsoringFinal, sponsoringAppeal,
} from "@/lib/actions/sponsoring-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/types";

interface Props {
  id: string;
  status: string;
  canDirection: boolean;
  canMarketing: boolean;
  isProductManager: boolean;
  isRequester: boolean;
  productManagers: { id: string; name: string }[];
  budgetCategories?: { id: string; label: string; isSub: boolean }[];
}

export function DecisionPanel({ id, status, canDirection, canMarketing, isProductManager, isRequester, productManagers, budgetCategories = [] }: Props) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const run = async (action: (fd: FormData) => Promise<ActionResult>, fd: FormData) => {
    setSaving(true); setErr(null);
    fd.set("id", id);
    const r = await action(fd);
    setSaving(false);
    if (r.ok) router.refresh();
    else setErr(r.error ?? "Action impossible.");
  };

  const error = err && (
    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>
  );

  // 1) Attribution d'un chef de produit (Direction Marketing)
  if (status === "AWAITING_PRELIMINARY" && canMarketing) {
    return <PreliminaryForm productManagers={productManagers} saving={saving} error={error} run={(fd) => run(sponsoringPreliminary, fd)} />;
  }
  // 2) Analyse chef de produit (avis + budget proposé)
  if (status === "PRELIMINARY_APPROVED" && isProductManager) {
    return <AnalysisForm appeal={false} saving={saving} error={error} run={(fd) => run(sponsoringAnalysis, fd)} />;
  }
  // 2bis) Réexamen après appel (avis sans budget)
  if (status === "APPEAL_PENDING" && isProductManager) {
    return <AnalysisForm appeal saving={saving} error={error} run={(fd) => run(sponsoringAnalysis, fd)} />;
  }
  // 3) Décision définitive (Direction : budget final + (sous-)catégorie + commentaire)
  if ((status === "AWAITING_FINAL" || status === "AWAITING_FINAL_APPEAL") && canDirection) {
    return <FinalForm saving={saving} error={error} budgetCategories={budgetCategories} run={(fd) => run(sponsoringFinal, fd)} />;
  }
  // 4) Appel du délégué (après décision)
  if ((status === "APPROVED" || status === "REFUSED") && isRequester) {
    return <AppealForm saving={saving} error={error} run={(fd) => run(sponsoringAppeal, fd)} />;
  }
  return <p className="text-sm text-muted-foreground">Aucune action à réaliser à cette étape pour votre rôle.</p>;
}

function DecisionButtons({ decision, setDecision }: { decision: string | null; setDecision: (d: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => setDecision("APPROVE")} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${decision === "APPROVE" ? "border-success bg-success/10 text-success" : "border-border hover:bg-secondary"}`}>
        <Check className="h-4 w-4" /> Valider
      </button>
      <button type="button" onClick={() => setDecision("REJECT")} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${decision === "REJECT" ? "border-destructive bg-destructive/10 text-destructive" : "border-border hover:bg-secondary"}`}>
        <X className="h-4 w-4" /> Refuser
      </button>
    </div>
  );
}

function PreliminaryForm({ productManagers, saving, error, run }: { productManagers: { id: string; name: string }[]; saving: boolean; error: React.ReactNode; run: (fd: FormData) => void }) {
  const [decision, setDecision] = React.useState<string | null>(null);
  return (
    <form action={(fd) => { fd.set("decision", decision ?? ""); run(fd); }} className="space-y-3">
      <p className="text-xs text-muted-foreground">Validation préliminaire : décidez d'engager l'analyse et désignez le chef de produit.</p>
      <DecisionButtons decision={decision} setDecision={setDecision} />
      {decision === "APPROVE" && (
        <div className="space-y-1">
          <Label>Chef de produit en charge de l'analyse</Label>
          <Select name="productManagerId" required defaultValue="">
            <option value="" disabled>Sélectionner…</option>
            {productManagers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
      )}
      {decision && (
        <>
          <div className="space-y-1">
            <Label>{decision === "REJECT" ? "Motif du refus (obligatoire)" : "Note (optionnel)"}</Label>
            <Textarea name="note" className="min-h-[60px]" required={decision === "REJECT"} />
          </div>
          {error}
          <Button type="submit" disabled={saving} className="w-full">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer</Button>
        </>
      )}
    </form>
  );
}

function AnalysisForm({ appeal, saving, error, run }: { appeal: boolean; saving: boolean; error: React.ReactNode; run: (fd: FormData) => void }) {
  return (
    <form action={run} className="space-y-3">
      <div className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
        {appeal
          ? "Réexamen suite à l'appel du délégué. Donnez votre nouvel avis — sans budget cette fois, la Direction tranchera."
          : "Votre avis et le budget proposé sont confidentiels : ils ne sont jamais visibles par le délégué."}
      </div>
      <div className="space-y-1">
        <Label>Votre avis (chef de produit)</Label>
        <Textarea name="productManagerNotes" className="min-h-[80px]" required placeholder="Analyse, pertinence, recommandation…" />
      </div>
      {!appeal && (
        <div className="space-y-1">
          <Label>Budget proposé (DZD)</Label>
          <Input name="productManagerBudget" type="number" step="any" required />
        </div>
      )}
      {error}
      <Button type="submit" disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Transmettre à la Direction</Button>
    </form>
  );
}

function FinalForm({ saving, error, run, budgetCategories }: { saving: boolean; error: React.ReactNode; run: (fd: FormData) => void; budgetCategories: { id: string; label: string; isSub: boolean }[] }) {
  const [decision, setDecision] = React.useState<string | null>(null);
  return (
    <form action={(fd) => { fd.set("decision", decision ?? ""); run(fd); }} className="space-y-3">
      <p className="text-xs text-muted-foreground">Décision définitive : fixez le budget final accordé et votre commentaire (visibles par le délégué).</p>
      <DecisionButtons decision={decision} setDecision={setDecision} />
      {decision === "APPROVE" && (
        <>
          <div className="space-y-1">
            <Label>Budget final accordé (DZD)</Label>
            <Input name="amountGranted" type="number" step="any" required />
            <p className="text-xs text-muted-foreground">Un ordre de dépense sera transmis au comptable pour règlement.</p>
          </div>
          {budgetCategories.length > 0 && (
            <div className="space-y-1">
              <Label>(Sous-)catégorie budgétaire</Label>
              <Select name="budgetCategoryId" required defaultValue="">
                <option value="" disabled>Choisir la (sous-)catégorie à imputer…</option>
                {budgetCategories.map((c) => <option key={c.id} value={c.id}>{c.isSub ? " ↳ " : ""}{c.label}</option>)}
              </Select>
              <p className="text-xs text-muted-foreground">La dépense sera imputée à cette (sous-)catégorie du budget avant de partir au comptable.</p>
            </div>
          )}
        </>
      )}
      {decision && (
        <>
          <div className="space-y-1">
            <Label>{decision === "REJECT" ? "Motif du refus (obligatoire)" : "Commentaire de la Direction"}</Label>
            <Textarea name="note" className="min-h-[60px]" required={decision === "REJECT"} />
          </div>
          {error}
          <Button type="submit" disabled={saving} className="w-full">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer la décision</Button>
        </>
      )}
    </form>
  );
}

function AppealForm({ saving, error, run }: { saving: boolean; error: React.ReactNode; run: (fd: FormData) => void }) {
  const [open, setOpen] = React.useState(false);
  if (!open) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Vous n'êtes pas d'accord avec la décision ? Vous pouvez faire appel : le dossier repart pour un nouvel examen.</p>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Gavel className="h-4 w-4" /> Faire appel</Button>
      </div>
    );
  }
  return (
    <form action={run} className="space-y-3">
      <div className="space-y-1">
        <Label>Motif de l'appel</Label>
        <Textarea name="reason" className="min-h-[70px]" required placeholder="Expliquez pourquoi vous demandez un réexamen…" />
      </div>
      {error}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} Envoyer l'appel</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
      </div>
    </form>
  );
}
