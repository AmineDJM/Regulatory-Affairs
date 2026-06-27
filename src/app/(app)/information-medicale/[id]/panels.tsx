"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Upload, Trash2, ShieldCheck, AlertCircle, FileText, BadgeCheck } from "lucide-react";
import {
  requestDocument, cancelDocRequest, fulfillDocRequest, validateDeclaration, recordAuthorityDeclaration,
} from "@/lib/actions/medical-info-actions";
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

// ───────────── Pharmacien : validation finale → ordre de dépense ─────────────

export function ValidateButton({ id, hasPending, amount }: { id: string; hasPending: boolean; amount: number | null }) {
  const { saving, err, run } = useAction();
  const [confirm, setConfirm] = React.useState(false);
  return (
    <div className="space-y-2">
      {hasPending && <p className="text-xs text-warning">Des pièces sont encore en attente de dépôt. Vous pouvez tout de même valider si vous l'estimez complet.</p>}
      <p className="text-xs text-muted-foreground">
        {amount && amount > 0
          ? `La validation déclenche l'ordre de dépense (${amount.toLocaleString("fr-FR")} DZD) vers le comptable.`
          : "Aucun budget associé : la validation clôt simplement la déclaration."}
      </p>
      <Err msg={err} />
      {!confirm ? (
        <Button onClick={() => setConfirm(true)} disabled={saving}><BadgeCheck className="h-4 w-4" /> Valider la déclaration</Button>
      ) : (
        <div className="flex gap-2">
          <Button onClick={() => { const fd = new FormData(); fd.set("id", id); run(() => validateDeclaration(fd)); }} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Confirmer la validation
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)} disabled={saving}>Annuler</Button>
        </div>
      )}
    </div>
  );
}

export const DocIcon = FileText;
