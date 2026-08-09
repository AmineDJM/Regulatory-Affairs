"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, CheckCircle2, XCircle, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitAttachmentValidation } from "@/lib/actions/admin-request-actions";

/**
 * VALIDATION PAR PIÈCE JOINTE — chaque pièce d'une demande peut partir en validation à n'importe
 * quel moment, vers une ou plusieurs personnes, indépendamment des autres pièces. La décision se
 * prend au bureau central (/validations) où les validateurs retrouvent toutes leurs validations ;
 * ICI on voit l'état de chaque pièce et on soumet. Être validateur d'une pièce ouvre l'accès à
 * toute la demande (le contexte fait partie du jugement).
 */

interface StepView { validator: string; status: string }
interface ValidationView { id: string; reference: string; documentId: string; status: string; createdAt: string; steps: StepView[] }

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "En attente", cls: "bg-amber-500/10 text-amber-600" },
  APPROVED: { label: "Validée", cls: "bg-success/10 text-success" },
  REJECTED: { label: "Refusée", cls: "bg-destructive/10 text-destructive" },
  CHANGES_REQUESTED: { label: "À modifier", cls: "bg-sky-500/10 text-sky-600" },
};

export function AttachmentValidationBlock({ requestId, documents, validations, users, canSubmit }: {
  requestId: string;
  documents: { id: string; name: string }[];
  validations: ValidationView[];
  users: { id: string; name: string }[];
  canSubmit: boolean;
}) {
  const router = useRouter();
  const [openFor, setOpenFor] = React.useState<string | null>(null);
  const [chosen, setChosen] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (documents.length === 0) return null;
  const byDoc = new Map<string, ValidationView[]>();
  for (const v of validations) byDoc.set(v.documentId, [...(byDoc.get(v.documentId) ?? []), v]);
  if (!canSubmit && validations.length === 0) return null;

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const submit = async (documentId: string) => {
    if (busy || chosen.length === 0) return;
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("requestId", requestId);
    fd.set("documentId", documentId);
    for (const id of chosen) fd.append("validatorIds", id);
    if (note.trim()) fd.set("note", note.trim());
    const r = await submitAttachmentValidation(fd);
    setBusy(false);
    if (r.ok) { setOpenFor(null); setChosen([]); setNote(""); router.refresh(); }
    else setError(r.error ?? "Échec.");
  };

  return (
    <div className="space-y-2 rounded-xl border border-border/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> Validation des pièces jointes — chaque pièce se soumet à part, à une ou plusieurs personnes
      </p>
      {error && <p className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{error}</p>}

      <ul className="space-y-1.5">
        {documents.map((d) => {
          const vals = byDoc.get(d.id) ?? [];
          const current = vals.find((v) => v.status === "PENDING") ?? vals[0];
          const isOpen = openFor === d.id;
          return (
            <li key={d.id} className="rounded-lg border border-border/50 p-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                {current ? (
                  <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_BADGES[current.status]?.cls ?? "bg-muted text-muted-foreground"}`}>
                    {STATUS_BADGES[current.status]?.label ?? current.status}
                  </span>
                ) : (
                  <span className="text-muted-foreground">jamais soumise</span>
                )}
                {canSubmit && !vals.some((v) => v.status === "PENDING") && (
                  <Button type="button" size="sm" variant="outline" onClick={() => { setOpenFor(isOpen ? null : d.id); setChosen([]); setNote(""); }}>
                    <Send className="h-3.5 w-3.5" /> Soumettre à validation
                  </Button>
                )}
              </div>

              {current && current.steps.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {current.steps.map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">
                      {s.status === "APPROVED" ? <CheckCircle2 className="h-3 w-3 text-success" /> : s.status === "REJECTED" ? <XCircle className="h-3 w-3 text-destructive" /> : <Clock className="h-3 w-3" />}
                      {s.validator}
                    </span>
                  ))}
                  <span className="text-[0.6875rem] text-muted-foreground">({current.reference})</span>
                </div>
              )}

              {isOpen && (
                <div className="mt-2 space-y-2 rounded-lg bg-muted/40 p-2">
                  <p className="text-[0.6875rem] text-muted-foreground">Validateur·s — tous saisis EN MÊME TEMPS, chacun décide au bureau des validations :</p>
                  <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                    {users.map((u) => (
                      <button key={u.id} type="button" onClick={() => toggle(u.id)}
                        className={`rounded-full border px-2 py-0.5 text-xs ${chosen.includes(u.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                        {u.name}
                      </button>
                    ))}
                  </div>
                  <input
                    value={note} onChange={(e) => setNote(e.target.value)} placeholder="Précision pour les validateurs (facultatif)…"
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/60"
                  />
                  <Button type="button" size="sm" onClick={() => submit(d.id)} disabled={busy || chosen.length === 0}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Envoyer ({chosen.length})
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
