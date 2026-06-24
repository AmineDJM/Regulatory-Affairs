"use client";

import * as React from "react";
import { Check, X, Loader2, Banknote } from "lucide-react";
import { decideSponsoring } from "@/lib/actions/sponsoring-actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";

export function DecisionPanel({ id }: { id: string }) {
  const [decision, setDecision] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  return (
    <form
      action={async (fd) => {
        setSaving(true);
        await decideSponsoring(fd);
        setSaving(false);
        setDecision(null);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={decision ?? ""} />

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setDecision("ACCEPTED")}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
            decision === "ACCEPTED" ? "border-success bg-success/10 text-success" : "border-border hover:bg-secondary"
          }`}
        >
          <Check className="h-4 w-4" /> Accepter
        </button>
        <button
          type="button"
          onClick={() => setDecision("REFUSED")}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
            decision === "REFUSED" ? "border-destructive bg-destructive/10 text-destructive" : "border-border hover:bg-secondary"
          }`}
        >
          <X className="h-4 w-4" /> Refuser
        </button>
        <button
          type="button"
          onClick={() => setDecision("PAID")}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
            decision === "PAID" ? "border-success bg-success/10 text-success" : "border-border hover:bg-secondary"
          }`}
        >
          <Banknote className="h-4 w-4" /> Payé
        </button>
      </div>

      {(decision === "ACCEPTED" || decision === "PAID") && (
        <div className="space-y-1">
          <Label htmlFor="amountGranted">Montant accordé (DZD)</Label>
          <Input id="amountGranted" name="amountGranted" type="number" step="any" required />
        </div>
      )}

      {decision && (
        <>
          <div className="space-y-1">
            <Label htmlFor="finalDecision">Note de décision</Label>
            <Textarea id="finalDecision" name="finalDecision" placeholder="Justification…" className="min-h-[60px]" />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmer la décision
          </Button>
        </>
      )}
    </form>
  );
}
