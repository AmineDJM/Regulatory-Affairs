"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, CircleCheckBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { decideAdProOtherRequest, closeAdProOtherRequest } from "@/lib/actions/ad-pro-other-actions";

/**
 * TRANCHER UNE DEMANDE « AUTRE ».
 *
 * Le circuit est court par construction : valider ou refuser, avec un motif ; puis marquer
 * terminé une fois exécutée. On n'affiche que ce qui a un sens à cet instant — un bouton qui
 * apparaît puis échoue fait douter de tout le reste de l'écran.
 */
export function OtherDecisionPanel({
  id, status, canDecide, canClose,
}: { id: string; status: string; canDecide: boolean; canClose: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");

  const run = async (key: string, fn: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fields: Record<string, string>) => {
    setBusy(key); setErr(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    const r = await fn(fd);
    setBusy(null);
    if (!r.ok) { setErr(r.error ?? "L'opération a échoué."); return; }
    setNote("");
    router.refresh();
  };

  if (!canDecide && !canClose) return null;

  return (
    <div className="space-y-4">
      {canDecide && (
        <div className="surface space-y-2 p-4">
          <h3 className="text-sm font-semibold">Décision</h3>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motif (facultatif, mais utile à celui qui a demandé)" rows={3} />
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy !== null} onClick={() => run("ok", decideAdProOtherRequest, { id, approve: "1", note })}>
              {busy === "ok" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Valider
            </Button>
            <Button variant="outline" className="flex-1 text-destructive" disabled={busy !== null} onClick={() => run("no", decideAdProOtherRequest, { id, approve: "0", note })}>
              {busy === "no" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Refuser
            </Button>
          </div>
        </div>
      )}

      {canClose && (
        <div className="surface space-y-2 p-4">
          <h3 className="text-sm font-semibold">Suite</h3>
          <div className="flex gap-2">
            {status === "APPROVED" && (
              <Button variant="outline" className="flex-1" disabled={busy !== null} onClick={() => run("done", closeAdProOtherRequest, { id, cancel: "0" })}>
                {busy === "done" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheckBig className="h-4 w-4" />} Terminée
              </Button>
            )}
            <Button variant="outline" className="flex-1 text-destructive" disabled={busy !== null} onClick={() => run("cancel", closeAdProOtherRequest, { id, cancel: "1" })}>
              {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Annuler
            </Button>
          </div>
        </div>
      )}

      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}
