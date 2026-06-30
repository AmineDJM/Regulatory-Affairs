"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { preliminaryDecision, submitProductAnalysis, finalDecision, updateGrantedBudget } from "@/lib/actions/congress-request-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";

type PM = { id: string; name: string };
type Action = (fd: FormData) => Promise<{ ok: boolean; error?: string }>;

function useRun() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  const run = (fd: FormData, action: Action, onOk?: () => void) =>
    start(async () => {
      setErr(null);
      const r = await action(fd);
      if (!r.ok) { setErr(r.error ?? "Erreur."); return; }
      onOk?.();
      router.refresh();
    });
  return { pending, err, run };
}

function base(type: string, id: string, extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("type", type); fd.set("id", id);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

/** Validation préliminaire (Direction) : valider + assigner un chef de produit, ou refuser. */
export function PreliminaryDecision({ type, id, productManagers }: { type: string; id: string; productManagers: PM[] }) {
  const { pending, err, run } = useRun();
  const [mode, setMode] = React.useState<null | "approve" | "reject">(null);
  const [pm, setPm] = React.useState("");
  const [note, setNote] = React.useState("");

  if (!mode) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Validation préliminaire de la Direction.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="success" onClick={() => setMode("approve")}><Check className="h-4 w-4" /> Valider (préliminaire)</Button>
          <Button size="sm" variant="destructive" onClick={() => setMode("reject")}><X className="h-4 w-4" /> Refuser</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {mode === "approve" ? (
        <>
          <Label>Chef de produit en charge de l'analyse</Label>
          <Select value={pm} onChange={(e) => setPm(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {productManagers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          {productManagers.length === 0 && <p className="text-xs text-warning">Aucun compte « Chef de produit » disponible. Créez-en un dans l'administration.</p>}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optionnel)…" className="min-h-[56px]" />
        </>
      ) : (
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motif du refus (obligatoire)…" className="min-h-[56px]" />
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant={mode === "reject" ? "destructive" : "primary"} disabled={pending || (mode === "approve" && !pm) || (mode === "reject" && !note.trim())}
          onClick={() => run(base(type, id, { decision: mode === "approve" ? "APPROVE" : "REJECT", productManagerId: pm, note }), preliminaryDecision, () => setMode(null))}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setMode(null); setNote(""); }}>Annuler</Button>
      </div>
    </div>
  );
}

/** Analyse du chef de produit : Approuver (budget facultatif) ou Refuser. */
export function ProductAnalysis({ type, id }: { type: string; id: string }) {
  const { pending, err, run } = useRun();
  const [mode, setMode] = React.useState<null | "approve" | "reject">(null);
  const [budget, setBudget] = React.useState("");
  const [notes, setNotes] = React.useState("");

  if (!mode) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Analyse du chef de produit : approuvez (en proposant éventuellement un budget) ou refusez la demande.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="success" onClick={() => setMode("approve")}><Check className="h-4 w-4" /> Approuver</Button>
          <Button size="sm" variant="destructive" onClick={() => setMode("reject")}><X className="h-4 w-4" /> Refuser</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {mode === "approve" ? (
        <>
          <Label>Budget proposé (DZD) <span className="text-xs font-normal text-muted-foreground">— facultatif</span></Label>
          <Input type="number" step="any" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget après analyse (optionnel)" />
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Analyse / justification…" className="min-h-[64px]" />
        </>
      ) : (
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Motif du refus (obligatoire)…" className="min-h-[64px]" />
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant={mode === "reject" ? "destructive" : "primary"} disabled={pending || (mode === "reject" && !notes.trim())}
          onClick={() => run(base(type, id, { decision: mode === "approve" ? "APPROVE" : "REJECT", productManagerBudget: budget, productManagerNotes: notes }), submitProductAnalysis, () => setMode(null))}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} {mode === "reject" ? "Refuser" : "Soumettre"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setMode(null); setNotes(""); setBudget(""); }}>Annuler</Button>
      </div>
    </div>
  );
}

/** La Direction modifie le montant accordé même après validation définitive. */
export function EditGrantedBudget({ type, id, current }: { type: string; id: string; current: number | null }) {
  const { pending, err, run } = useRun();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState(current != null ? String(current) : "");
  if (!open) {
    return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Modifier le budget accordé</Button>;
  }
  return (
    <div className="space-y-2">
      <Label>Nouveau montant accordé (DZD)</Label>
      <Input type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <p className="text-xs text-muted-foreground">Répercuté sur la déclaration d'information médicale et l'ordre de dépense (s'ils ne sont pas déjà réglés).</p>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !(Number(amount) > 0)} onClick={() => run(base(type, id, { finalAmount: amount }), updateGrantedBudget, () => setOpen(false))}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
      </div>
    </div>
  );
}

/** Validation définitive (Direction) → ordre de dépense. Le **montant accordé** est
 *  obligatoire (prérempli avec la proposition du chef de produit, modifiable). */
export function FinalDecision({ type, id, suggestedAmount }: { type: string; id: string; suggestedAmount?: number | null }) {
  const { pending, err, run } = useRun();
  const [mode, setMode] = React.useState<null | "approve" | "reject">(null);
  const [note, setNote] = React.useState("");
  const [amount, setAmount] = React.useState(suggestedAmount != null ? String(suggestedAmount) : "");

  if (!mode) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Validation définitive après analyse du chef de produit. La validation émet un ordre de dépense vers l'espace comptable.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="success" onClick={() => setMode("approve")}><Check className="h-4 w-4" /> Valider définitivement</Button>
          <Button size="sm" variant="destructive" onClick={() => setMode("reject")}><X className="h-4 w-4" /> Refuser</Button>
        </div>
      </div>
    );
  }
  const amountValid = Number(amount) > 0;
  return (
    <div className="space-y-2">
      {mode === "approve" && (
        <>
          <Label>Montant accordé (DZD) <span className="text-destructive">*</span></Label>
          <Input type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Montant validé par la Direction" />
          <p className="text-xs text-muted-foreground">Ce montant fait foi pour la déclaration d'information médicale puis l'ordre de dépense.</p>
        </>
      )}
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "reject" ? "Motif du refus (obligatoire)…" : "Note (optionnel)…"} className="min-h-[56px]" />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant={mode === "reject" ? "destructive" : "primary"} disabled={pending || (mode === "reject" && !note.trim()) || (mode === "approve" && !amountValid)}
          onClick={() => run(base(type, id, { decision: mode === "approve" ? "APPROVE" : "REJECT", note, finalAmount: amount }), finalDecision, () => setMode(null))}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setMode(null); setNote(""); }}>Annuler</Button>
      </div>
    </div>
  );
}
