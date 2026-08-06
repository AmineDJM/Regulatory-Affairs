"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, MessageSquare, ArrowRight, SkipForward } from "lucide-react";
import type { EntityType } from "@prisma/client";
import { advanceWorkflow } from "@/lib/actions/workflow-actions";
import type { WorkflowView } from "@/lib/queries/workflow";
import { SCOPE_LABELS, POWER_LABELS } from "@/lib/workflow/types";
import { ROLE_LABELS, EXPENSE_ORDER_STATUS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const STATUS_TONE: Record<string, { label: string; tone: "success" | "danger" | "warning" | "neutral" }> = {
  IN_PROGRESS: { label: "En cours", tone: "warning" },
  APPROVED: { label: "Approuvé", tone: "success" },
  REJECTED: { label: "Refusé", tone: "danger" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
};

function rolesText(roles: string[]): string {
  return roles.map((r) => ROLE_LABELS[r] ?? r).join(", ");
}

/**
 * Panneau générique piloté par la **définition de workflow** configurée (Administration).
 * Affiche la frise dynamique, l'action disponible pour le spectateur à l'étape courante,
 * l'issue (montant accordé / ordre de dépense) et l'historique. Remplace les anciens
 * panneaux de décision spécifiques de Sponsoring / Congrès / Événements.
 */
export function WorkflowPanel({ entityType, entityId, view }: { entityType: EntityType; entityId: string; view: WorkflowView }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<null | "approve" | "reject" | "comment" | "skip">(null);

  const a = view.action;
  const [assignee, setAssignee] = React.useState("");
  const [amount, setAmount] = React.useState(a?.suggestedAmount != null ? String(a.suggestedAmount) : "");
  const [category, setCategory] = React.useState("");
  const [note, setNote] = React.useState("");
  /** Pièces jointes à l'avis (devis comparatif, note, courrier) — toutes les issues, y compris
   *  un simple commentaire : c'est souvent là qu'on veut déposer un document. */
  const [files, setFiles] = React.useState<File[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setMode(null); setNote(""); setAssignee(""); setCategory(""); setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = (action: "APPROVE" | "REJECT" | "COMMENT" | "SKIP") => {
    const fd = new FormData();
    fd.set("entityType", entityType);
    fd.set("entityId", entityId);
    fd.set("action", action);
    if (note) fd.set("note", note);
    for (const f of files) fd.append("files", f);
    if (action === "APPROVE") {
      if (assignee) fd.set("assigneeId", assignee);
      if (amount) fd.set("amount", amount);
      if (category) fd.set("budgetCategoryId", category);
    }
    // Avis défavorable sur une étape intermédiaire : la désignation reste requise et le
    // chef de produit peut, DE MANIÈRE OPTIONNELLE, joindre un montant révisé (ex. « montant
    // revu à la hausse »). Ignoré sur un refus définitif (dernière étape).
    if (action === "REJECT") {
      if (assignee) fd.set("assigneeId", assignee);
      if (!actionIsLast && amount) fd.set("amount", amount);
    }
    start(async () => {
      setErr(null);
      const r = await advanceWorkflow(fd);
      if (!r.ok) { setErr(r.error ?? "Action impossible."); return; }
      resetForm();
      router.refresh();
    });
  };

  const st = STATUS_TONE[view.status] ?? STATUS_TONE.IN_PROGRESS;
  // Sur une étape intermédiaire, « Refuser » = AVIS DÉFAVORABLE : le circuit continue.
  const lastSlug = view.steps[view.steps.length - 1]?.slug;
  const actionIsLast = a?.slug === lastSlug;
  const needsAssign = !!a?.powers.includes("ASSIGN");
  const needsAmount = !!a && (a.requireAmount || a.powers.includes("SET_AMOUNT"));
  const needsCategory = !!a && (a.requireCategory || a.powers.includes("SET_CATEGORY"));
  const canApprove = !!a?.powers.includes("APPROVE");
  const canReject = !!a?.powers.includes("REJECT");
  const canComment = !!a?.powers.includes("COMMENT");
  // Sauter l'étape : possible sur une étape INTERMÉDIAIRE non terminale et qui ne désigne
  // pas le responsable de la suite (sinon plus personne en charge). Toujours tracé + noté.
  const canSkip = !!a && !actionIsLast && !needsAssign;

  const approveDisabled =
    pending ||
    (needsAssign && !assignee) ||
    (!!a?.requireAmount && !(Number(amount) > 0)) ||
    (!!a?.requireCategory && !category) ||
    (!!a?.requireNote && !note.trim());

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{view.definitionName}</p>
        <Badge tone={st.tone} dot={false}>{st.label}</Badge>
      </div>

      {/* Frise dynamique dérivée de la définition */}
      <ol className="space-y-3">
        {view.steps.map((s, i) => {
          const tone =
            s.state === "done" ? "bg-success text-success-foreground"
              : s.state === "current" ? "bg-warning text-warning-foreground"
                : s.state === "rejected" ? "bg-destructive text-destructive-foreground"
                  : "bg-secondary text-muted-foreground";
          const actor = s.actorScope === "ROLE" ? rolesText(s.actorRoles) || "—" : SCOPE_LABELS[s.actorScope];
          return (
            <li key={s.slug} className="flex gap-3">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${tone}`}>
                {s.state === "rejected" ? "✗" : s.state === "done" ? "✓" : i + 1}
              </div>
              <div className="min-w-0 flex-1 border-b border-border pb-3 last:border-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-medium">{s.title}</p>
                  {/* Détails techniques du circuit (qui/pouvoirs/description) : Super Admin uniquement. */}
                  {view.isSuperAdmin && (
                    <>
                      <span className="text-xs text-muted-foreground">· {actor}</span>
                      {s.assignRole && <Badge tone="neutral" dot={false}>désigne : {ROLE_LABELS[s.assignRole] ?? s.assignRole}</Badge>}
                      {s.confidential && <Badge tone="warning" dot={false}>confidentiel</Badge>}
                    </>
                  )}
                </div>
                {view.isSuperAdmin && s.description && <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>}
                {view.isSuperAdmin && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.powers.map((p) => <span key={p} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{POWER_LABELS[p]}</span>)}
                    {s.emitExpenseOrder && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">→ dépense</span>}
                  </div>
                )}

                {/* Action disponible à l'étape courante */}
                {a && a.slug === s.slug && (
                  <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-3">
                    {!mode ? (
                      <div className="flex flex-wrap gap-2">
                        {canApprove && <Button size="sm" variant="success" onClick={() => setMode("approve")}><Check className="h-4 w-4" /> Approuver</Button>}
                        {canReject && <Button size="sm" variant="destructive" onClick={() => setMode("reject")}><X className="h-4 w-4" /> {actionIsLast ? "Refuser" : "Avis défavorable"}</Button>}
                        {canSkip && <Button size="sm" variant="outline" onClick={() => setMode("skip")}><SkipForward className="h-4 w-4" /> Sauter l&apos;étape</Button>}
                        {canComment && <Button size="sm" variant="ghost" onClick={() => setMode("comment")}><MessageSquare className="h-4 w-4" /> Commenter</Button>}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {mode === "reject" && !actionIsLast && (
                          <p className="rounded bg-warning/10 px-2 py-1.5 text-xs text-warning">
                            Votre avis défavorable sera consigné mais n'est pas éliminatoire : le circuit continue vers l'étape suivante.
                          </p>
                        )}
                        {mode === "skip" && (
                          <p className="rounded bg-warning/10 px-2 py-1.5 text-xs text-warning">
                            L&apos;étape sera <strong>sautée</strong> : le circuit passe directement à la suivante. Le saut, son auteur et sa raison sont <strong>tracés</strong> (historique + journal d&apos;audit) et notifiés à l&apos;étape suivante.
                          </p>
                        )}
                        {needsAssign && (mode === "approve" || (mode === "reject" && !actionIsLast)) && (
                          <div className="space-y-1">
                            <Label>Personne désignée{a.assignRole ? ` (${ROLE_LABELS[a.assignRole] ?? a.assignRole})` : ""} <span className="text-destructive">*</span></Label>
                            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                              <option value="">— Sélectionner —</option>
                              {a.assigneeCandidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                            {a.assigneeCandidates.length === 0 && <p className="text-xs text-warning">Aucun compte disponible pour ce rôle.</p>}
                          </div>
                        )}
                        {/* Montant : sur APPROUVER (obligatoire ou non selon l'étape), ET de
                            manière OPTIONNELLE sur un AVIS DÉFAVORABLE intermédiaire — le chef de
                            produit peut y joindre un montant révisé (ex. « revu à la hausse »). */}
                        {needsAmount && (mode === "approve" || (mode === "reject" && !actionIsLast)) && (
                          <div className="space-y-1">
                            <Label>
                              Montant (DZD)
                              {mode === "approve" && a.requireAmount && <span className="text-destructive"> *</span>}
                              {mode === "reject" && <span className="font-normal text-muted-foreground"> — optionnel (montant révisé)</span>}
                            </Label>
                            <Input type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={mode === "reject" ? "Montant révisé (optionnel)" : "Montant"} />
                          </div>
                        )}
                        {mode === "approve" && needsCategory && (
                          <div className="space-y-1">
                            <Label>(Sous-)catégorie budgétaire{a.requireCategory && <span className="text-destructive"> *</span>}</Label>
                            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                              <option value="">— Choisir la (sous-)catégorie à imputer —</option>
                              {view.budgetCategories.map((c) => <option key={c.id} value={c.id}>{c.isSub ? " ↳ " : ""}{c.label}</option>)}
                            </Select>
                          </div>
                        )}
                        <Textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder={mode === "reject" ? (actionIsLast ? "Motif du refus (obligatoire)…" : "Motif de l'avis défavorable (obligatoire)…") : mode === "skip" ? "Raison du saut d'étape (obligatoire)…" : mode === "comment" ? "Votre commentaire…" : a.requireNote ? "Commentaire (obligatoire)…" : "Note (optionnel)…"}
                          className="min-h-[56px]"
                        />
                        {/* Pièce(s) jointe(s) à l'avis — disponibles à toutes les issues :
                            l'analyse s'appuie souvent sur un devis ou un courrier, et le faire
                            déposer « plus tard, dans les documents » revient à ne pas le lier
                            à la décision qu'il justifie. */}
                        <div className="space-y-1">
                          <Label className="font-normal text-muted-foreground">Pièce(s) jointe(s) à votre avis — optionnel</Label>
                          <input
                            ref={fileRef}
                            type="file"
                            multiple
                            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                            className="block w-full cursor-pointer rounded-lg border border-border bg-background text-xs file:mr-3 file:cursor-pointer file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-xs file:font-medium"
                          />
                          {files.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {files.length} fichier(s) : {files.map((f) => f.name).join(", ")}
                            </p>
                          )}
                        </div>
                        {err && <p className="text-xs text-destructive">{err}</p>}
                        <div className="flex gap-2">
                          {mode === "approve" && (
                            <Button size="sm" disabled={approveDisabled} onClick={() => submit("APPROVE")}>
                              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Confirmer
                            </Button>
                          )}
                          {mode === "reject" && (
                            <Button size="sm" variant="destructive" disabled={pending || !note.trim() || (!actionIsLast && needsAssign && !assignee)} onClick={() => submit("REJECT")}>
                              {pending && <Loader2 className="h-4 w-4 animate-spin" />} {actionIsLast ? "Refuser" : "Émettre l'avis défavorable"}
                            </Button>
                          )}
                          {mode === "skip" && (
                            <Button size="sm" variant="outline" disabled={pending || !note.trim()} onClick={() => submit("SKIP")}>
                              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />} Confirmer le saut
                            </Button>
                          )}
                          {mode === "comment" && (
                            <Button size="sm" disabled={pending || !note.trim()} onClick={() => submit("COMMENT")}>
                              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Publier
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => { resetForm(); setErr(null); }}>Annuler</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {a === null && view.status === "IN_PROGRESS" && (
        <p className="text-sm text-muted-foreground">
          {view.assigneeName ? `En attente de ${view.assigneeName} ou du rôle en charge de l'étape courante.` : "En attente de l'acteur en charge de l'étape courante."}
        </p>
      )}

      {/* Issue */}
      {view.outcome && (view.outcome.grantedAmount != null || view.outcome.expenseOrder) && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
          {view.outcome.grantedAmount != null && <p>Montant accordé : <span className="font-semibold">{formatCurrency(view.outcome.grantedAmount)}</span></p>}
          {view.outcome.expenseOrder ? (
            <p className="mt-1 flex flex-wrap items-center gap-2">
              Ordre de dépense <span className="font-mono text-xs">{view.outcome.expenseOrder.reference}</span>
              <StatusBadge map={EXPENSE_ORDER_STATUS} value={view.outcome.expenseOrder.status} dot={false} />
              <span>{formatCurrency(view.outcome.expenseOrder.amount)}</span>
              <Link href="/finances/ordres-de-depense" className="text-primary hover:underline">Voir</Link>
            </p>
          ) : view.status === "APPROVED" ? (
            <p className="mt-1 text-xs text-muted-foreground">En cours de traitement (information médicale / Finances).</p>
          ) : null}
        </div>
      )}

      {/* Historique — visible des spectateurs privilégiés (Super Admin, Direction /
          Directeur des opérations, National Sales, chef de produit désigné). L'avis et le
          montant des étapes confidentielles restent masqués pour les autres (déjà caviardés
          côté requête), qui ne voient pas ce bloc du tout. */}
      {view.canViewHistory && view.events.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historique</p>
          <ul className="space-y-1.5">
            {view.events.map((e, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{e.actorName ?? "—"}</span> · {e.stepTitle} ·{" "}
                {e.action === "APPROVE" ? "approuvé" : e.action === "REJECT" ? "refusé" : e.action === "OPINION_AGAINST" ? "avis défavorable" : e.action === "SKIP" ? "étape sautée" : e.action === "AUTO_SKIP" ? "étape franchie automatiquement" : e.action === "AUTO_APPROVE_REQUESTER" ? "auto-accord (demandeur habilité)" : "commenté"}
                {e.amount != null ? ` · ${formatCurrency(e.amount)}` : ""}
                {e.note ? ` — ${e.note}` : ""} <span className="opacity-70">({formatDateTime(e.createdAt)})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
