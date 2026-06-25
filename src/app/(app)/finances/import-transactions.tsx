"use client";

import * as React from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Upload, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { importTransactions } from "@/lib/actions/finance-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/types";

const SAMPLE = `date,direction,category,label,amount,method,account,counterparty
2026-06-01,IN,RECETTE,Vente PCH juin,1250000,BANK_TRANSFER,Banque,PCH Alger
2026-06-03,OUT,LOYER,Loyer bureau juin,90000,BANK_TRANSFER,Banque,Propriétaire
2026-06-04,OUT,VOYAGE,Mission Oran,35000,CASH,Caisse,Délégué`;

export function ImportTransactionsButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useFormState<ActionResult | undefined, FormData>(importTransactions, undefined);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (state?.ok) {
      setPending(false);
      router.refresh();
      setTimeout(() => setOpen(false), 700);
    } else if (state?.error) setPending(false);
  }, [state, router]);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Upload className="h-4 w-4" /> Importer CSV</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Importer des écritures" description="Collez vos données CSV (1ʳᵉ ligne = en-tête).">
        <form action={(fd) => { setPending(true); formAction(fd); }} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Colonnes&nbsp;: <code>date, direction (IN/OUT), category, label, amount, method, account, counterparty</code>
          </p>
          <Textarea name="csv" defaultValue={SAMPLE} className="min-h-[220px] font-mono text-xs" />
          {state?.error && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {state.error}</div>}
          {state?.ok && <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Import réussi.</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Fermer</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Importer</Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
