"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteMyValidationRequest } from "@/lib/actions/validation-actions";
import { Button } from "@/components/ui/button";

/**
 * RETIRER SA DEMANDE — tant que personne ne s'est prononcé.
 *
 * Le bouton reste VISIBLE quand le retrait n'est plus possible, mais désactivé et expliqué : le
 * faire disparaître aurait laissé chercher « où est passé le bouton ? », alors que la vraie
 * réponse est « quelqu'un a déjà répondu, et sa réponse ne s'efface pas ».
 */
export function WithdrawRequestButton({ id, reference, canWithdraw }: {
  id: string; reference: string; canWithdraw: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  if (!canWithdraw) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title="Un validateur s'est déjà prononcé : l'accord ou le refus d'un tiers ne s'efface pas."
      >
        Retrait impossible — déjà tranchée
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        className="text-destructive"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm(`Retirer la demande ${reference} ? Elle disparaîtra de la file de vos validateurs.`)) return;
          setBusy(true); setErr(null);
          const fd = new FormData();
          fd.set("id", id);
          const r = await deleteMyValidationRequest(fd);
          setBusy(false);
          if (r.ok) router.push("/validations");
          else setErr(r.error ?? "Retrait impossible.");
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Retirer ma demande
      </Button>
      {err && <p role="alert" className="max-w-xs text-right text-xs text-destructive">{err}</p>}
    </div>
  );
}
