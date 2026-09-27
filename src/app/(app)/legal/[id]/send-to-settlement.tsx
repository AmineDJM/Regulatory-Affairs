"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendLegalInvoiceToSettlement } from "@/lib/actions/legal-actions";
import { formatCurrency } from "@/lib/utils";

/**
 * ENVOYER LA FACTURE AU RÈGLEMENT — un clic, une confirmation, et le circuit fait le reste :
 * le centre de paiement autorise TOUT paiement, quel que soit son montant (décision de la
 * Direction, 09/2026), puis Règlements à effectuer. Le bouton disparaît une fois la facture
 * partie — l'état du règlement prend sa place dans la chaîne.
 *
 * « Dès 50 000 DZD » était écrit ici, et c'était FAUX depuis que le centre voit tout : la phrase
 * qu'une personne lit AVANT de cliquer promettait qu'une petite facture partirait directement aux
 * Finances. Elle ne le fait pas, et la personne attendait un règlement qui attendait, lui, le
 * centre (§118.148).
 */
export function SendToSettlementButton({ id, amount }: { id: string; amount: number | null }) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const run = async () => {
    setBusy(true); setErr(null);
    const f = new FormData();
    f.set("id", id);
    const r = await sendLegalInvoiceToSettlement(f);
    setBusy(false);
    if (r.ok) router.refresh(); else setErr(r.error ?? "L'envoi a échoué.");
  };

  return (
    <div className="space-y-2">
      {err && (
        <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {err}
        </p>
      )}
      {!confirm ? (
        <Button size="sm" variant="primary" onClick={() => setConfirm(true)}>
          <Send className="h-4 w-4" /> Envoyer au règlement
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Envoyer {amount != null ? formatCurrency(amount) : "cette facture"} au règlement ? Le centre de paiement l&apos;autorisera avant que les Finances ne la règlent.
          </span>
          <Button size="sm" onClick={run} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Confirmer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={busy}>Annuler</Button>
        </div>
      )}
    </div>
  );
}
