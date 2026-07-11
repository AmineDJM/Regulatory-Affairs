"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { updateReservePoint, approveReservePoint, deleteReserveCycle } from "@/lib/regulatory/intelligence/reserves/actions";

interface Point { id: string; ordinal: number; category: string; verbatim: string; proposedResponse: string | null; finalResponse: string | null; status: string }
interface Cycle { id: string; cycle: number; letterFilename: string; ocrConfidence: number | null; ocrNeedsReview: boolean; status: string; points: Point[] }

/**
 * Réserves ANPP (G9) — dépôt de la lettre (OCR réel), points décomposés (verbatim), réponse
 * proposée puis approuvée. Le texte des réserves est conservé mot à mot (aucune reformulation).
 */
export function ReservesPanel({ dossierId, cycles, canManage }: { dossierId: string; cycles: Cycle[]; canManage: boolean }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function upload(file: File) {
    setBusy("upload"); setError(null);
    const fd = new FormData(); fd.set("dossierId", dossierId); fd.append("file", file, file.name);
    try {
      const r = await fetch("/api/regulatory/intelligence/reserves/upload", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Échec.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Échec du dépôt."); }
    setBusy(null);
  }

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key); setError(null);
    const r = await fn();
    setBusy(null);
    if (r.ok) router.refresh(); else setError(r.error ?? "Échec.");
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div>
          <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => inputRef.current?.click()}>
            {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} Déposer une lettre de réserves (PDF/scan)
          </Button>
          <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <p className="mt-1 text-xs text-muted-foreground">La lettre est océrisée (OCR réel) et décomposée en points ; le texte est conservé <strong>mot à mot</strong>.</p>
        </div>
      )}
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {cycles.map((c) => (
        <div key={c.id} className="rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Cycle {c.cycle} — {c.letterFilename}</span>
            {c.ocrConfidence != null && <span className="text-xs text-muted-foreground">OCR {c.ocrConfidence}%</span>}
            {c.ocrNeedsReview && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600">revue OCR requise</span>}
            <span className="text-xs text-muted-foreground">{c.points.length} point·s · {c.points.filter((p) => p.status === "APPROVED").length} approuvé·s</span>
            {canManage && <button type="button" disabled={busy !== null} onClick={() => run(`del-${c.id}`, () => { const fd = new FormData(); fd.set("cycleId", c.id); return deleteReserveCycle(fd); })} className="ml-auto inline-flex items-center gap-1 text-xs text-destructive hover:underline"><Trash2 className="h-3 w-3" /> Supprimer</button>}
          </div>
          <div className="mt-2 space-y-2">
            {c.points.map((p) => (
              <div key={p.id} className="rounded-lg border border-border/60 p-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-medium">#{p.ordinal}</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{p.category}</span>
                  {p.status === "APPROVED" ? <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">Approuvé</span> : p.status === "DRAFTED" ? <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600">Brouillon</span> : <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">Ouvert</span>}
                </div>
                <p className="mt-1 text-xs italic text-muted-foreground">« {p.verbatim} »</p>
                {canManage ? (
                  <form action={p.status === "APPROVED" ? undefined : (fd) => run(`save-${p.id}`, () => { fd.set("pointId", p.id); return updateReservePoint(fd); })} className="mt-1.5 space-y-1.5">
                    <Textarea name="proposedResponse" rows={2} defaultValue={p.finalResponse ?? p.proposedResponse ?? ""} placeholder="Réponse proposée…" disabled={p.status === "APPROVED"} className="text-sm" />
                    {p.status !== "APPROVED" && (
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" variant="outline" disabled={busy !== null}>Enregistrer</Button>
                        <button type="button" disabled={busy !== null} onClick={() => run(`app-${p.id}`, () => { const fd = new FormData(); fd.set("pointId", p.id); return approveReservePoint(fd); })} className="inline-flex items-center gap-1 rounded-md border border-success/40 px-2 py-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Approuver la réponse</button>
                      </div>
                    )}
                  </form>
                ) : (
                  p.finalResponse && <p className="mt-1 text-xs">{p.finalResponse}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {cycles.length === 0 && <p className="text-sm text-muted-foreground">Aucune lettre de réserves. Déposez la lettre reçue de l'ANPP pour la décomposer et y répondre.</p>}
    </div>
  );
}
