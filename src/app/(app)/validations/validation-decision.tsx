"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X, MessageSquareWarning, Loader2 } from "lucide-react";
import { decideValidation } from "@/lib/actions/validation-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

type Decision = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

const CFG: Record<Decision, { label: string; variant: "success" | "primary" | "destructive"; ph: string }> = {
  APPROVED: { label: "Valider", variant: "success", ph: "Commentaire (optionnel)…" },
  CHANGES_REQUESTED: { label: "Demander une modification", variant: "primary", ph: "Précisez la modification demandée (optionnel)…" },
  REJECTED: { label: "Refuser", variant: "destructive", ph: "Motif du refus (optionnel)…" },
};

/**
 * Décision d'une étape de validation : Valider / Modification / Refuser. Dans les trois cas,
 * un **commentaire optionnel** peut être ajouté avant de confirmer (jamais obligatoire).
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
    fd.set("reason", reason.trim()); // commentaire OPTIONNEL
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
          <Button size="sm" variant={cfg.variant} disabled={pending} onClick={confirm}>
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
          <MessageSquareWarning className="h-4 w-4" /> Modification
        </Button>
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => open("REJECTED")}>
          <X className="h-4 w-4" /> Refuser
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
