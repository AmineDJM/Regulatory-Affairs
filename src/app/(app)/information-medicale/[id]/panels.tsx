"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Upload, Trash2, ShieldCheck, AlertCircle, FileText, BadgeCheck, Lock, HandCoins, PackageCheck } from "lucide-react";
import {
  requestDocument, cancelDocRequest, fulfillDocRequest, validateDeclaration, validateDeclarationByDirection, recordAuthorityDeclaration,
  requestMedicalInfoBv, deliverMedicalInfoBv, skipMedicalInfoBv,
} from "@/lib/actions/medical-info-actions";
import { bvMessage, bvStageLabel, type BvStage } from "@/lib/medical-info/bv";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/labels";
import type { ActionResult } from "@/lib/actions/types";

interface UserOpt { id: string; name: string; role: string }

const Err = ({ msg }: { msg: string | null }) =>
  msg ? <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" /> {msg}</div> : null;

function useAction() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const run = async (fn: () => Promise<ActionResult>, onOk?: () => void) => {
    setSaving(true); setErr(null);
    const r = await fn();
    setSaving(false);
    if (r.ok) { onOk?.(); router.refresh(); } else setErr(r.error ?? "Action impossible.");
  };
  return { saving, err, run };
}

// ───────────── Pharmacien : demander une pièce ─────────────

export function RequestDocForm({ declarationId, users }: { declarationId: string; users: UserOpt[] }) {
  const { saving, err, run } = useAction();
  const formRef = React.useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={(fd) => { fd.set("declarationId", declarationId); run(() => requestDocument(fd), () => formRef.current?.reset()); }}
      className="space-y-3"
    >
      <div className="space-y-1">
        <Label>Pièce demandée</Label>
        <Input name="label" required placeholder="Ex. convention signée, programme, facture pro forma…" />
      </div>
      <div className="space-y-1">
        <Label>Demandée à</Label>
        <Select name="targetUserId" required defaultValue="">
          <option value="" disabled>Sélectionner une personne…</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {ROLE_LABELS[u.role] ?? u.role}</option>)}
        </Select>
      </div>
      <Err msg={err} />
      <Button type="submit" disabled={saving} size="sm">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Demander la pièce</Button>
    </form>
  );
}

export function CancelRequestButton({ id }: { id: string }) {
  const { saving, run } = useAction();
  return (
    <button
      type="button"
      onClick={() => { const fd = new FormData(); fd.set("id", id); run(() => cancelDocRequest(fd)); }}
      disabled={saving}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
      title="Annuler la demande"
    >
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}

// ───────────── Personne sollicitée : déposer la pièce ─────────────

export function FulfillForm({ requestId }: { requestId: string }) {
  const { saving, err, run } = useAction();
  return (
    <form
      action={(fd) => { fd.set("requestId", requestId); run(() => fulfillDocRequest(undefined, fd)); }}
      className="mt-2 space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3"
    >
      <p className="text-xs font-medium text-primary">Cette pièce vous est demandée — déposez-la ici.</p>
      <Input name="file" type="file" required className="text-sm" />
      <Input name="note" placeholder="Note (optionnel)" className="text-sm" />
      <Err msg={err} />
      <Button type="submit" disabled={saving} size="sm">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Déposer</Button>
    </form>
  );
}

// ───────────── Le BON DE VERSEMENT — l'étape qui précède la déclaration ─────────────

/**
 * LA CARTE DU BON DE VERSEMENT — un seul état à la fois, et le geste de CELUI QUI REGARDE.
 *
 * Trois personnes passent ici et n'y font pas la même chose : le PRIM demande (ou déclare qu'il
 * n'y a rien à verser), le centre de paiement tranche ailleurs, les Finances remettent le bon.
 * L'écran montre donc l'état à tous, et le bouton à un seul — un bouton qu'on ne peut pas
 * actionner apprend seulement qu'on n'a pas le droit.
 */
export function BvCard({ id, stage, amount, deliveredAt, deliveredBy, skipReason, canRequest, canDeliver, canSkip, requestHref }: {
  id: string;
  stage: BvStage;
  amount: number | null;
  deliveredAt: string | null;
  deliveredBy: string | null;
  skipReason: string | null;
  canRequest: boolean;
  canDeliver: boolean;
  canSkip: boolean;
  requestHref: string | null;
}) {
  const { saving, err, run } = useAction();
  const [skipping, setSkipping] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <HandCoins className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-medium">{bvStageLabel(stage)}</span>
        {amount != null && amount > 0 && (
          <span className="text-muted-foreground">· {amount.toLocaleString("fr-FR")} DZD</span>
        )}
        {requestHref && (
          <a href={requestHref} className="text-primary hover:underline">Voir le dossier de paiement</a>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{bvMessage(stage)}</p>

      {stage === "REMIS" && deliveredAt && (
        <p className="text-xs text-muted-foreground">
          Remis le {new Date(deliveredAt).toLocaleDateString("fr-FR")}{deliveredBy ? ` par ${deliveredBy}` : ""}.
        </p>
      )}
      {stage === "SANS_BV" && skipReason && (
        <p className="text-xs text-muted-foreground">Motif : {skipReason}</p>
      )}

      {/* LE PRIM DEMANDE — montant, note, et autant de pièces qu'il faut. */}
      {canRequest && (
        <form
          ref={formRef}
          className="space-y-2 border-t border-border pt-3"
          action={(fd) => { fd.set("id", id); run(() => requestMedicalInfoBv(undefined, fd), () => formRef.current?.reset()); }}
        >
          <div className="space-y-1">
            <Label htmlFor="bv-amount">Montant du bon de versement (DZD)</Label>
            <Input id="bv-amount" name="amount" type="number" step="0.01" min="0" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bv-payee">Bénéficiaire</Label>
            <Input id="bv-payee" name="payee" defaultValue="Autorités sanitaires" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bv-due">Échéance demandée</Label>
            <Input id="bv-due" name="dueDate" type="date" />
            <p className="text-xs text-muted-foreground">Le centre de paiement arbitre : il voit la file entière.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bv-note">Note</Label>
            <Textarea id="bv-note" name="note" rows={2} placeholder="Ce que couvre ce versement, la référence de l'avis…" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bv-files">Pièces jointes</Label>
            <Input id="bv-files" name="files" type="file" multiple className="text-sm" />
          </div>
          <Err msg={err} />
          <Button type="submit" disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Demander le bon de versement
          </Button>
        </form>
      )}

      {/* LES FINANCES REMETTENT — c'est CE geste qui ouvre la déclaration, pas le règlement. */}
      {canDeliver && (
        <form className="space-y-2 border-t border-border pt-3" action={(fd) => { fd.set("id", id); run(() => deliverMedicalInfoBv(fd)); }}>
          <p className="text-xs text-muted-foreground">
            Le versement est réglé. En confirmant la remise du bon au bureau du PRIM, vous lui ouvrez
            la déclaration aux autorités.
          </p>
          <Input name="note" placeholder="Remis à… / en main propre / par coursier (facultatif)" className="text-sm" />
          <Err msg={err} />
          <Button type="submit" disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Bon remis au bureau du PRIM
          </Button>
        </form>
      )}

      {/* LA PORTE DE SORTIE — tracée et motivée. Sans elle, un dossier sans taxe resterait bloqué. */}
      {canSkip && (
        <div className="border-t border-border pt-3">
          {!skipping ? (
            <button type="button" onClick={() => setSkipping(true)} className="text-xs text-muted-foreground underline hover:text-foreground">
              Ce dossier n&apos;appelle aucun versement
            </button>
          ) : (
            <form className="space-y-2" action={(fd) => { fd.set("id", id); run(() => skipMedicalInfoBv(fd), () => setSkipping(false)); }}>
              <Label htmlFor="bv-skip">Pourquoi ce dossier n&apos;appelle aucun versement</Label>
              <Textarea id="bv-skip" name="reason" rows={2} required placeholder="Ex. : événement exonéré, taxe déjà acquittée sur le dossier X…" />
              <p className="text-xs text-muted-foreground">Le motif est versé au journal : c&apos;est ce que lira l&apos;audit.</p>
              <Err msg={err} />
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setSkipping(false)}>Annuler</Button>
                <Button type="submit" size="sm" variant="outline" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Déclarer sans versement
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/** La déclaration aux autorités, FERMÉE tant que le bon n'est pas entre les mains du PRIM. */
export function AuthorityLocked({ stage }: { stage: BvStage }) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{bvMessage(stage)}</span>
    </div>
  );
}

// ───────────── Pharmacien : déclaration aux autorités ─────────────

export function AuthorityForm({ id, authorityRef, authorityNotes }: { id: string; authorityRef: string | null; authorityNotes: string | null }) {
  const { saving, err, run } = useAction();
  return (
    <form action={(fd) => { fd.set("id", id); run(() => recordAuthorityDeclaration(fd)); }} className="space-y-3">
      <div className="space-y-1">
        <Label>Référence / récépissé de déclaration</Label>
        <Input name="authorityRef" defaultValue={authorityRef ?? ""} placeholder="N° de déclaration aux autorités" />
      </div>
      <div className="space-y-1">
        <Label>Notes de déclaration</Label>
        <Textarea name="authorityNotes" defaultValue={authorityNotes ?? ""} className="min-h-[60px]" placeholder="Autorité destinataire, date, observations…" />
      </div>
      <Err msg={err} />
      <Button type="submit" disabled={saving} size="sm" variant="outline">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Enregistrer la déclaration</Button>
    </form>
  );
}

// ───────────── Pharmacien : validation → transmission à la Direction ─────────────

export function ValidateButton({ id, hasPending }: { id: string; hasPending: boolean; amount?: number | null }) {
  const { saving, err, run } = useAction();
  const [confirm, setConfirm] = React.useState(false);
  return (
    <div className="space-y-2">
      {hasPending && <p className="text-xs text-warning">Des pièces sont encore en attente de dépôt. Vous pouvez tout de même valider si vous l'estimez complet.</p>}
      <p className="text-xs text-muted-foreground">
        Votre validation transmet la déclaration à la <strong>Direction</strong>, qui donnera la validation finale (pour le comptable).
      </p>
      <Err msg={err} />
      {!confirm ? (
        <Button onClick={() => setConfirm(true)} disabled={saving}><BadgeCheck className="h-4 w-4" /> Valider et transmettre à la Direction</Button>
      ) : (
        <div className="flex gap-2">
          <Button onClick={() => { const fd = new FormData(); fd.set("id", id); run(() => validateDeclaration(fd)); }} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Confirmer
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)} disabled={saving}>Annuler</Button>
        </div>
      )}
    </div>
  );
}

// ───────────── Direction : validation finale → ordre de dépense (comptable) ─────────────

export function DirectionValidateButton({ id, amount }: { id: string; amount: number | null }) {
  const { saving, err, run } = useAction();
  const [confirm, setConfirm] = React.useState(false);
  const [comment, setComment] = React.useState("");
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {amount && amount > 0
          ? `Votre validation déclenche l'ordre de dépense (${amount.toLocaleString("fr-FR")} DZD) vers le comptable.`
          : "Aucun budget associé : la validation clôt simplement la déclaration."}
      </p>
      <div className="space-y-1">
        <Label>Commentaire (facultatif)</Label>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-[56px]" placeholder="Observation de la Direction à destination du comptable / des parties prenantes…" />
      </div>
      <Err msg={err} />
      {!confirm ? (
        <Button onClick={() => setConfirm(true)} disabled={saving}><BadgeCheck className="h-4 w-4" /> Valider pour le comptable</Button>
      ) : (
        <div className="flex gap-2">
          <Button onClick={() => { const fd = new FormData(); fd.set("id", id); if (comment.trim()) fd.set("comment", comment); run(() => validateDeclarationByDirection(fd)); }} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Confirmer la validation
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)} disabled={saving}>Annuler</Button>
        </div>
      )}
    </div>
  );
}

export const DocIcon = FileText;
