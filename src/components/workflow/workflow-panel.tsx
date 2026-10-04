"use client";

import * as React from "react";
import Link from "next/link";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { Check, X, Loader2, MessageSquare, ArrowRight, SkipForward, Undo2, Send, Ban } from "lucide-react";
import type { EntityType } from "@prisma/client";
import { advanceWorkflow, resoumettreDemande, retirerDemandeAdPro } from "@/lib/actions/workflow-actions";
import type { WorkflowView } from "@/lib/queries/workflow";
import { SCOPE_LABELS, POWER_LABELS } from "@/lib/workflow/types";
import { ROLE_LABELS, EXPENSE_ORDER_STATUS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { BoutonDecisif } from "@/components/ui/bouton-decisif";

const STATUS_TONE: Record<string, { label: string; tone: "success" | "danger" | "warning" | "neutral" }> = {
  IN_PROGRESS: { label: "En cours", tone: "warning" },
  RETURNED: { label: "À corriger", tone: "warning" },
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
  // LE RAFRAÎCHISSEMENT EST SUIVI (§118.172) : tant que les données d'après n'ont pas remplacé
  // l'écran, ses gestes restent fermés — sinon un second clic agirait sur l'état d'avant.
  const { enCours, rafraichir } = useRafraichir();
  const [pendingAction, start] = React.useTransition();
  const pending = pendingAction || enCours;
  const [err, setErr] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<null | "approve" | "reject" | "comment" | "skip" | "return">(null);

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

  const submit = (action: "APPROVE" | "REJECT" | "COMMENT" | "SKIP" | "RETURN") => {
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
    // Direction Marketing peut, DE MANIÈRE OPTIONNELLE, joindre un montant révisé (ex. « montant
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
      rafraichir();
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
                    {s.powers.map((p) => <span key={p} className="rounded bg-secondary px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">{POWER_LABELS[p]}</span>)}
                    {s.emitExpenseOrder && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[0.625rem] font-medium text-primary">→ dépense</span>}
                  </div>
                )}

                {/* Action disponible à l'étape courante */}
                {a && a.slug === s.slug && (
                  <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-3">
                    {!mode ? (
                      <div className="flex flex-wrap gap-2">
                        {canApprove && <Button size="sm" variant="success" onClick={() => setMode("approve")}><Check className="h-4 w-4" /> Approuver</Button>}
                        {canReject && <Button size="sm" variant="destructive" onClick={() => setMode("reject")}><X className="h-4 w-4" /> {actionIsLast ? "Refuser" : "Avis défavorable"}</Button>}
                        {/* RENVOYER POUR CORRECTION (§118.186) — ouvert là où le refus l'est : la troisième
                            issue, entre laisser passer une demande fausse et la tuer. */}
                        {canReject && <Button size="sm" variant="outline" onClick={() => setMode("return")}><Undo2 className="h-4 w-4" /> Renvoyer pour correction</Button>}
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
                        {mode === "return" && (
                          <p className="rounded bg-warning/10 px-2 py-1.5 text-xs text-warning">
                            La demande retourne à son demandeur avec votre motif : il la corrige, puis la resoumet — elle reviendra à cette étape. Rien n&apos;est refusé.
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
                          placeholder={mode === "reject" ? (actionIsLast ? "Motif du refus (obligatoire)…" : "Motif de l'avis défavorable (obligatoire)…") : mode === "return" ? "Ce que le demandeur doit corriger (obligatoire)…" : mode === "skip" ? "Raison du saut d'étape (obligatoire)…" : mode === "comment" ? "Votre commentaire…" : a.requireNote ? "Commentaire (obligatoire)…" : "Note (optionnel)…"}
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
                            <BoutonDecisif size="sm" disabled={approveDisabled} onClick={() => submit("APPROVE")}>
                              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Confirmer
                            </BoutonDecisif>
                          )}
                          {mode === "reject" && (
                            <BoutonDecisif size="sm" variant="destructive" disabled={pending || !note.trim() || (!actionIsLast && needsAssign && !assignee)} onClick={() => submit("REJECT")}>
                              {pending && <Loader2 className="h-4 w-4 animate-spin" />} {actionIsLast ? "Refuser" : "Émettre l'avis défavorable"}
                            </BoutonDecisif>
                          )}
                          {mode === "return" && (
                            <BoutonDecisif size="sm" variant="outline" disabled={pending || !note.trim()} onClick={() => submit("RETURN")}>
                              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Renvoyer au demandeur
                            </BoutonDecisif>
                          )}
                          {mode === "skip" && (
                            <BoutonDecisif size="sm" variant="outline" disabled={pending || !note.trim()} onClick={() => submit("SKIP")}>
                              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />} Confirmer le saut
                            </BoutonDecisif>
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

      {/* LE MOTIF QUE LE DEMANDEUR DOIT LIRE (§118.186, R03) — un renvoi qui l'attend, ou le refus
          qui a clos sa demande. Hors de l'historique privilégié : il lui est adressé. */}
      {view.motif && (
        <div className={`rounded-lg border p-3 text-sm ${view.motif.nature === "RENVOI" ? "border-warning/40 bg-warning/10" : "border-destructive/30 bg-destructive/5"}`}>
          <p className="font-medium">
            {view.motif.nature === "RENVOI" ? "À corriger" : "Demande refusée"} — {view.motif.etape}
            {view.motif.auteur ? `, par ${view.motif.auteur}` : ""} <span className="font-normal text-muted-foreground">({formatDateTime(view.motif.le)})</span>
          </p>
          {view.motif.motif && <p className="mt-1 whitespace-pre-line">{view.motif.motif}</p>}
          {view.motif.nature === "RENVOI" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Corrigez la demande (« Modifier la demande »), puis resoumettez-la : elle reviendra à cette étape.
            </p>
          )}
        </div>
      )}
      {view.peutResoumettre && <ResubmitForm entityType={entityType} entityId={entityId} />}

      {a === null && view.status === "IN_PROGRESS" && (
        <p className="text-sm text-muted-foreground">
          {view.assigneeName ? `En attente de ${view.assigneeName} ou du rôle en charge de l'étape courante.` : "En attente de l'acteur en charge de l'étape courante."}
        </p>
      )}

      {/* Issue d'un SPONSORING sous la règle de la tenue : l'étape suivante est la préparation des
          postes, puis la clôture — pas « l'information médicale / les Finances » d'un accord global. */}
      {view.outcome?.tenue && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
          {view.outcome.tenue === "PRE_VALIDEE" ? (
            <p>Tenue pré-validée — les postes se préparent (devis, BC, factures), puis la validation finale range chaque poste dans un budget et clôture la demande.</p>
          ) : (
            <p>
              Validée et clôturée
              {view.outcome.grantedAmount != null && <> — montant accordé <span className="font-semibold">{formatCurrency(view.outcome.grantedAmount)}</span></>}.
              {" "}Les paiements suivent poste par poste.
            </p>
          )}
        </div>
      )}

      {/* Issue */}
      {view.outcome && !view.outcome.tenue && (view.outcome.grantedAmount != null || view.outcome.expenseOrder) && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
          {view.outcome.grantedAmount != null && <p>Montant accordé : <span className="font-semibold">{formatCurrency(view.outcome.grantedAmount)}</span></p>}
          {view.outcome.expenseOrder ? (
            <p className="mt-1 flex flex-wrap items-center gap-2">
              Ordre de dépense <span className="font-mono text-xs">{view.outcome.expenseOrder.reference}</span>
              <StatusBadge map={EXPENSE_ORDER_STATUS} value={view.outcome.expenseOrder.status} dot={false} />
              <span>{formatCurrency(view.outcome.expenseOrder.amount)}</span>
              <Link href="/finances/paiements-a-faire" className="text-primary hover:underline">Voir</Link>
            </p>
          ) : view.status === "APPROVED" ? (
            <p className="mt-1 text-xs text-muted-foreground">En cours de traitement (information médicale / Finances).</p>
          ) : null}
        </div>
      )}

      {view.peutRetirer && <WithdrawForm entityType={entityType} entityId={entityId} />}

      {/* Historique — visible des spectateurs privilégiés (Super Admin, Direction /
          Directeur des opérations, National Sales, Direction Marketing). L'avis et le
          montant des étapes confidentielles restent masqués pour les autres (déjà caviardés
          côté requête), qui ne voient pas ce bloc du tout. */}
      {view.canViewHistory && view.events.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historique</p>
          <ul className="space-y-1.5">
            {view.events.map((e, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{e.actorName ?? "—"}</span> · {e.stepTitle} ·{" "}
                {LIBELLE_ACTION[e.action] ?? "commenté"}
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

/** Les gestes de l'historique, dits en français — un code brut à l'écran ne se lit pas. */
const LIBELLE_ACTION: Record<string, string> = {
  CREATE: "a créé la demande",
  APPROVE: "approuvé",
  REJECT: "refusé",
  OPINION_AGAINST: "avis défavorable",
  SKIP: "étape sautée",
  AUTO_SKIP: "étape franchie automatiquement",
  AUTO_APPROVE_REQUESTER: "auto-accord (demandeur habilité)",
  COMMENT: "commenté",
  RETURN: "renvoyé pour correction",
  RESUBMIT: "corrigée et resoumise",
  REOPEN: "étape rouverte (montant relevé)",
  APPEAL: "appel — réexamen",
  CANCEL: "demande close",
};

/**
 * RESOUMETTRE après correction (§118.186). Une note facultative dit ce qui a été corrigé — elle part
 * avec la notification à l'étape qui reprend la demande.
 */
function ResubmitForm({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const { enCours, rafraichir } = useRafraichir();
  const [pendingAction, start] = React.useTransition();
  const pending = pendingAction || enCours;
  const [note, setNote] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const envoyer = () => start(async () => {
    setErr(null);
    const fd = new FormData();
    fd.set("entityType", entityType);
    fd.set("entityId", entityId);
    if (note.trim()) fd.set("note", note.trim());
    const r = await resoumettreDemande(fd);
    if (!r.ok) { setErr(r.error ?? "Resoumission impossible."); return; }
    setNote("");
    rafraichir();
  });
  return (
    <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
      <Label>Ce que vous avez corrigé — facultatif</Label>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. montant ramené à 300 000 DZD, devis joint…" className="min-h-[56px]" />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Button size="sm" disabled={pending} onClick={envoyer}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Resoumettre la demande
      </Button>
    </div>
  );
}

/** RETIRER une demande non tranchée (§118.186) — motif obligatoire, et la confirmation le dit. */
function WithdrawForm({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const { enCours, rafraichir } = useRafraichir();
  const [pendingAction, start] = React.useTransition();
  const pending = pendingAction || enCours;
  const [open, setOpen] = React.useState(false);
  const [motif, setMotif] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const retirer = () => start(async () => {
    setErr(null);
    const fd = new FormData();
    fd.set("entityType", entityType);
    fd.set("entityId", entityId);
    fd.set("motif", motif.trim());
    const r = await retirerDemandeAdPro(fd);
    if (!r.ok) { setErr(r.error ?? "Retrait impossible."); return; }
    setOpen(false);
    rafraichir();
  });
  if (!open) {
    return (
      <div className="border-t border-border pt-3">
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Ban className="h-4 w-4" /> Retirer la demande</Button>
      </div>
    );
  }
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">La demande sera close et son circuit arrêté. Le motif reste à l&apos;historique.</p>
      <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Pourquoi retirer la demande (obligatoire)…" className="min-h-[56px]" />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        <BoutonDecisif size="sm" variant="destructive" disabled={pending || !motif.trim()} onClick={retirer}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Retirer
        </BoutonDecisif>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setErr(null); }}>Annuler</Button>
      </div>
    </div>
  );
}
