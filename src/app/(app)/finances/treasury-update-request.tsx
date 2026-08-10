"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label } from "@/components/ui/input";
import { requestTreasuryUpdate } from "@/lib/actions/finance-actions";

/**
 * L'ADMINISTRATION DEMANDE l'actualisation des soldes de trésorerie.
 *
 * Les Finances les mettent à jour quand elles le veulent (bouton « Soldes d'ouverture ») ;
 * l'administrateur, lui, ne saisit pas à leur place — il le demande, et la demande arrive là où
 * elle sera traitée. Deux gestes distincts pour deux responsabilités distinctes.
 */
export function TreasuryUpdateRequestButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    const fd = new FormData();
    if (note.trim()) fd.set("note", note.trim());
    const r = await requestTreasuryUpdate(fd);
    setBusy(false);
    if (r.ok) {
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setNote(""); router.refresh(); }, 1200);
    } else setError(r.error ?? "Échec.");
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <RefreshCw className="h-4 w-4" /> Demander l&apos;actualisation des soldes
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Demander l'actualisation des soldes"
        description="Les responsables Finances sont prévenus et mettent à jour la trésorerie depuis « Soldes d'ouverture »."
        width="md"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="treasury-note">Précision (facultatif)</Label>
            <Input
              id="treasury-note" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Ex. avant le conseil de lundi — relevés bancaires au 10/08"
            />
          </div>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button onClick={submit} disabled={busy || done}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            {done ? "Demande envoyée" : "Envoyer la demande"}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
