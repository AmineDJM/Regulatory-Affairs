"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X, MessageSquareWarning, Loader2 } from "lucide-react";
import { decideValidation } from "@/lib/actions/validation-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function ValidationDecision({ stepId }: { stepId: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<null | "REJECTED" | "CHANGES_REQUESTED">(null);
  const [reason, setReason] = React.useState("");
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);

  const submit = (decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED") => {
    setErr(null);
    const fd = new FormData();
    fd.set("stepId", stepId);
    fd.set("decision", decision);
    if (decision !== "APPROVED") fd.set("reason", reason.trim());
    start(async () => {
      const r = await decideValidation(fd);
      if (!r.ok) { setErr(r.error ?? "Erreur."); return; }
      setMode(null); setReason("");
      router.refresh();
    });
  };

  if (mode) {
    return (
      <div className="space-y-2">
        <Textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={mode === "REJECTED" ? "Motif du refus (obligatoire)…" : "Précisez la modification demandée (obligatoire)…"}
          className="min-h-[60px]"
        />
        {err && <p className="text-xs text-destructive">{err}</p>}
        <div className="flex gap-2">
          <Button size="sm" variant={mode === "REJECTED" ? "destructive" : "primary"} disabled={pending || !reason.trim()} onClick={() => submit(mode)}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setMode(null); setErr(null); }}>Annuler</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="success" disabled={pending} onClick={() => submit("APPROVED")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Valider
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setMode("CHANGES_REQUESTED")}>
          <MessageSquareWarning className="h-4 w-4" /> Modification
        </Button>
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => setMode("REJECTED")}>
          <X className="h-4 w-4" /> Refuser
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
