"use client";

import * as React from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Landmark, Loader2, AlertCircle, Trash2, Pencil } from "lucide-react";
import { setTreasuryOpeningBalance, deleteTreasuryAccount } from "@/lib/actions/finance-actions";
import type { ActionResult } from "@/lib/actions/types";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { TextField, TextAreaField } from "@/components/shared/form-fields";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface OpeningBalance {
  id: string;
  name: string;
  openingBalance: number;
  openingDate: string;
  notes: string;
}

export function OpeningBalancesButton({ items, openingTotal }: { items: OpeningBalance[]; openingTotal: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<OpeningBalance | null>(null);
  const [state, formAction] = useFormState<ActionResult | undefined, FormData>(setTreasuryOpeningBalance, undefined);
  const [submitting, setSubmitting] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.ok) {
      setSubmitting(false);
      setEditing(null);
      formRef.current?.reset();
      router.refresh();
    } else if (state?.error) {
      setSubmitting(false);
    }
  }, [state, router]);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Landmark className="h-4 w-4" /> Soldes d'ouverture
      </Button>

      <Sheet
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title="Soldes d'ouverture de trésorerie"
        description="Initialisez le solde de chaque compte (Banque, Caisse…). Le solde courant = solde d'ouverture + flux réglés."
        width="md"
      >
        <div className="space-y-5">
          {items.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Comptes initialisés</span>
                <span className="text-muted-foreground">Total : <strong className="text-foreground">{formatCurrency(openingTotal)}</strong></span>
              </div>
              <div className="divide-y rounded-lg border">
                {items.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">Au {formatDate(a.openingDate)}{a.notes ? ` — ${a.notes}` : ""}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`font-semibold ${a.openingBalance >= 0 ? "text-foreground" : "text-destructive"}`}>{formatCurrency(a.openingBalance)}</span>
                      <button type="button" onClick={() => setEditing(a)} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Modifier">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <form action={async (fd) => { await deleteTreasuryAccount(fd); router.refresh(); }}>
                        <input type="hidden" name="id" value={a.id} />
                        <button type="submit" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive" aria-label="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form
            ref={formRef}
            key={editing?.id ?? "new"}
            action={(fd) => { setSubmitting(true); formAction(fd); }}
            className="space-y-4 border-t pt-4"
          >
            <p className="text-sm font-medium">{editing ? `Modifier « ${editing.name} »` : "Ajouter / mettre à jour un compte"}</p>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Compte" name="name" required defaultValue={editing?.name} placeholder="Banque, Caisse…" className="col-span-2" />
              <TextField label="Solde d'ouverture (DZD)" name="openingBalance" type="number" defaultValue={editing ? String(editing.openingBalance) : undefined} placeholder="0" />
              <TextField label="Date d'ouverture" name="openingDate" type="date" defaultValue={editing ? editing.openingDate.slice(0, 10) : new Date().toISOString().slice(0, 10)} />
            </div>
            <TextAreaField label="Notes" name="notes" defaultValue={editing?.notes} placeholder="Ex. relevé bancaire au 30/06/2026" />

            {state?.error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> {state.error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {editing && <Button type="button" variant="outline" onClick={() => setEditing(null)}>Annuler</Button>}
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </form>
        </div>
      </Sheet>
    </>
  );
}
