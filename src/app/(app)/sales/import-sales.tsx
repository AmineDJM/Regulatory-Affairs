"use client";

import * as React from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Upload, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { importSales } from "@/lib/actions/sales-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/types";

const SAMPLE = `date,product,dci,dosage,form,client,institution,isPch,quantity,unitPrice
2026-06-01,Adventor 20mg,Atorvastatine,20mg,Comprimé,PCH,PCH Alger,true,1200,340
2026-06-03,Cardiprox 5mg,Ramipril,5mg,Comprimé,Pharmacie El Hayat,,false,500,180`;

export function ImportSalesButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useFormState<ActionResult | undefined, FormData>(importSales, undefined);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (state?.ok) {
      setPending(false);
      router.refresh();
      setTimeout(() => setOpen(false), 800);
    } else if (state?.error) {
      setPending(false);
    }
  }, [state, router]);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Importer (CSV)
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Importer des ventes" description="Collez vos données CSV. La première ligne est l'en-tête.">
        <form action={(fd) => { setPending(true); formAction(fd); }} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Colonnes&nbsp;: <code>date, product, dci, dosage, form, client, institution, isPch, quantity, unitPrice</code>
          </p>
          <Textarea name="csv" defaultValue={SAMPLE} className="min-h-[220px] font-mono text-xs" />
          {state?.error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {state.error}
            </div>
          )}
          {state?.ok && (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Import réussi.
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Fermer</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Importer
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
