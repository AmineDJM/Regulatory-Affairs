"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X, MessageSquareWarning, Loader2 } from "lucide-react";
import { decideValidation } from "@/lib/actions/validation-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

type Decision = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

const CFG: Record<Decision, { label: string; variant: "success" | "primary" | "destructive"; ph: string; motif: boolean }> = {
  APPROVED: { label: "Valider", variant: "success", ph: "Commentaire (optionnel)…", motif: false },
  CHANGES_REQUESTED: { label: "Renvoyer pour correction", variant: "primary", ph: "Ce qu'il faut corriger (obligatoire)…", motif: true },
  REJECTED: { label: "Refuser", variant: "destructive", ph: "Motif du refus (obligatoire)…", motif: true },
};

/**
 * Décision d'une étape de validation : Valider / Renvoyer pour correction / Refuser (audit 360°,
 * R08). Le MOTIF est exigé pour renvoyer ou refuser — sans lui, le demandeur ne sait pas quoi
 * corriger ; l'action le revérifie, l'écran ne fait qu'éviter l'aller-retour. Une demande renvoyée
 * n'est plus close : son demandeur la corrige et la resoumet, et elle revient à cette étape.
 */
export function ValidationDecision({ stepId }: { stepId: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<null | Decision>(null);
  const [reason, setReason] = React.useState("");
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);

  const open = (d: Decision) => { setReason(""); setErr(null); setMode(d); };

  const confirm = () => {
    if (!mode) return;
    setErr(null);
    const fd = new FormData();
    fd.set("stepId", stepId);
    fd.set("decision", mode);
    fd.set("reason", reason.trim()); // optionnel pour valider, EXIGÉ pour renvoyer ou refuser
    start(async () => {
      const r = await decideValidation(fd);
      if (!r.ok) { setErr(r.error ?? "Erreur."); return; }
      setMode(null); setReason("");
      router.refresh();
    });
  };

  if (mode) {
    const cfg = CFG[mode];
    return (
      <div className="space-y-2">
        <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={cfg.ph} className="min-h-[60px]" />
        {err && <p className="text-xs text-destructive">{err}</p>}
        <div className="flex gap-2">
          <Button size="sm" variant={cfg.variant} disabled={pending || (cfg.motif && !reason.trim())} onClick={confirm}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} {cfg.label}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setMode(null); setReason(""); setErr(null); }}>Annuler</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="success" disabled={pending} onClick={() => open("APPROVED")}>
          <Check className="h-4 w-4" /> Valider
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => open("CHANGES_REQUESTED")}>
          <MessageSquareWarning className="h-4 w-4" /> Renvoyer pour correction
        </Button>
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => open("REJECTED")}>
          <X className="h-4 w-4" /> Refuser
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
