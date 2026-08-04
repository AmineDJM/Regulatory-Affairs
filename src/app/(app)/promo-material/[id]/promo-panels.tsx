"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, BadgeCheck, Send, Bell, XCircle } from "lucide-react";
import {
  submitQuotes, chooseAgency, submitBcForFinance, remindFinance, validateBc, confirmBcSent,
  initiatePayment, confirmPayment, submitMaterial, directionReview, confirmConformity, startBat,
  submitFinalMaterial, recordInvoice, settle, cancelPromoMaterial,
} from "@/lib/actions/promo-material-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/actions/types";

export interface PromoFlags {
  isMarketing: boolean;
  isAssistant: boolean;
  isFinance: boolean;
  isMedicalInfo: boolean;
  isDirection: boolean;
}
interface Props {
  id: string;
  status: string;
  flags: PromoFlags;
  chosenAgency: string | null;
  bcReference: string | null;
  visaReference: string | null;
  authorityRef: string | null;
  amount: number | null;
  reminderCount: number;
}

const Err = ({ msg }: { msg: string | null }) =>
  msg ? <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" /> {msg}</div> : null;

function useRun() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const run = async (fn: () => Promise<ActionResult>) => {
    setSaving(true); setErr(null);
    const r = await fn();
    setSaving(false);
    if (r.ok) router.refresh(); else setErr(r.error ?? "Action impossible.");
  };
  return { saving, err, run };
}

/** Carte d'action de l'étape courante, gérée par l'acteur concerné. */
export function PromoActionPanel(props: Props) {
  const { id, status, flags } = props;
  const { saving, err, run } = useRun();
  const fd = (extra?: Record<string, string>) => { const f = new FormData(); f.set("id", id); if (extra) for (const [k, v] of Object.entries(extra)) f.set(k, v); return f; };

  // ── Cartes par statut ──
  const panels: React.ReactNode[] = [];

  if (status === "PROSPECTION_REQUESTED" && flags.isAssistant) {
    panels.push(
      <Step key="quotes" title="Devis des agences" hint="Déposez les devis reçus (ci-dessus), puis confirmez.">
        <Err msg={err} />
        <Button onClick={() => run(() => submitQuotes(fd()))} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Devis déposés</Button>
      </Step>,
    );
  }
  if (status === "QUOTES_UPLOADED" && flags.isMarketing) {
    panels.push(
      <StepForm key="choose" title="Choix de l'agence" hint="Choisissez l'agence/devis retenu, joignez si besoin une ou plusieurs pièces (devis retenu, comparatif, contrat…) et demandez la création du bon de commande."
        onSubmit={(form) => { form.set("id", id); run(() => chooseAgency(form)); }} saving={saving} err={err} submit="Valider l'agence & demander le BC">
        <Field name="chosenAgency" label="Agence retenue" required defaultValue={props.chosenAgency ?? ""} />
        <Field name="chosenAmount" label="Montant du devis (DZD)" type="number" />
        <FileField name="attachments" label="Pièces jointes (optionnel — une ou plusieurs)" />
        <Area name="comment" label="Commentaire (motif du choix)" />
      </StepForm>,
    );
  }
  if (status === "AGENCY_CHOSEN" && flags.isAssistant) {
    panels.push(
      <StepForm key="bc" title="Bon de commande" hint="Déposez le bon de commande (ci-dessus) et sollicitez la validation des finances."
        onSubmit={(form) => run(() => submitBcForFinance(fd({ bcReference: String(form.get("bcReference") || "") })))} saving={saving} err={err} submit="Transmettre aux finances">
        <Field name="bcReference" label="N° de bon de commande" />
      </StepForm>,
    );
  }
  if (status === "BC_FINANCE_REVIEW") {
    if (flags.isFinance) {
      panels.push(
        <Step key="vbc" title="Validation du bon de commande" hint="Vérifiez le BC déposé, puis validez (signez).">
          <Err msg={err} />
          <Button onClick={() => run(() => validateBc(fd()))} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Valider le bon de commande</Button>
        </Step>,
      );
    }
    if (flags.isAssistant || flags.isMarketing) {
      panels.push(
        <Step key="relance" title="Relancer les finances" hint={`Bon de commande en attente de validation.${props.reminderCount > 0 ? ` ${props.reminderCount} relance(s) envoyée(s).` : ""}`}>
          <Err msg={err} />
          <Button variant="outline" onClick={() => run(() => remindFinance(fd()))} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Relancer les finances</Button>
        </Step>,
      );
    }
  }
  if (status === "BC_VALIDATED" && flags.isAssistant) {
    panels.push(
      <Step key="sent" title="Transmission à l'agence" hint="Le BC est validé. Confirmez sa transmission à l'agence (contact hors plateforme).">
        <Err msg={err} />
        <Button onClick={() => run(() => confirmBcSent(fd()))} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} BC validé & transmis à l'agence</Button>
      </Step>,
    );
  }
  if (status === "BC_SENT" && flags.isMedicalInfo) {
    panels.push(
      <Step key="pay" title="Bordereau de paiement" hint="Initiez le bordereau de paiement → transmis aux finances.">
        <Err msg={err} />
        <Button onClick={() => run(() => initiatePayment(fd()))} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Initier le bordereau de paiement</Button>
      </Step>,
    );
  }
  if (status === "PAYMENT_INITIATED" && flags.isFinance) {
    panels.push(
      <StepForm key="cpay" title="Paiement" hint="Confirmez le paiement effectué (joignez la quittance ci-dessus)."
        onSubmit={(form) => run(() => confirmPayment(fd({ comment: String(form.get("comment") || "") })))} saving={saving} err={err} submit="Paiement effectué">
        <Area name="comment" label="Commentaire / quittance" />
      </StepForm>,
    );
  }
  if (status === "PAYMENT_DONE" && flags.isMarketing) {
    panels.push(
      <Step key="mat" title="Matériel réalisé" hint="Déposez le matériel réalisé par l'agence (ci-dessus), puis confirmez.">
        <Err msg={err} />
        <Button onClick={() => run(() => submitMaterial(fd()))} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Matériel réalisé déposé</Button>
      </Step>,
    );
  }
  if (status === "MATERIAL_PRODUCED" && flags.isDirection) {
    panels.push(
      <StepForm key="dir" title="Validation Direction" hint="Examinez le matériel réalisé."
        onSubmit={(form) => run(() => directionReview(fd({ comment: String(form.get("comment") || "") })))} saving={saving} err={err} submit="Valider (Direction)">
        <Area name="comment" label="Commentaire (facultatif)" />
      </StepForm>,
    );
  }
  if (status === "CONFORMITY_REVIEW" && flags.isMedicalInfo) {
    panels.push(
      <StepForm key="conf" title="Conformité & visa publicitaire" hint="Vérifiez la conformité, déposez aux autorités puis saisissez la référence + le visa publicitaire."
        onSubmit={(form) => run(() => confirmConformity(fd({ visaReference: String(form.get("visaReference") || ""), authorityRef: String(form.get("authorityRef") || "") })))} saving={saving} err={err} submit="Conformité OK — visa obtenu">
        <Field name="authorityRef" label="Référence de dépôt aux autorités" defaultValue={props.authorityRef ?? ""} />
        <Field name="visaReference" label="Visa publicitaire" defaultValue={props.visaReference ?? ""} />
      </StepForm>,
    );
  }
  if (status === "VISA_OBTAINED" && flags.isMarketing) {
    panels.push(
      <Step key="bat" title="BAT / impression" hint="Le visa publicitaire est obtenu. Lancez le BAT / l'impression.">
        <Err msg={err} />
        <Button onClick={() => run(() => startBat(fd()))} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Lancer le BAT / impression</Button>
      </Step>,
    );
  }
  if (status === "BAT_PRINTING" && flags.isMarketing) {
    panels.push(
      <Step key="final" title="Matériel final" hint="Déposez le matériel final imprimé (ci-dessus), puis confirmez.">
        <Err msg={err} />
        <Button onClick={() => run(() => submitFinalMaterial(fd()))} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Matériel final déposé</Button>
      </Step>,
    );
  }
  if (status === "FINAL_MATERIAL" && (flags.isAssistant || flags.isMarketing)) {
    panels.push(
      <Step key="inv" title="Facture de l'agence" hint="Enregistrez la facture finale + le bon de livraison (ci-dessus), puis transmettez aux finances.">
        <Err msg={err} />
        <Button onClick={() => run(() => recordInvoice(fd()))} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Facture reçue — transmettre aux finances</Button>
      </Step>,
    );
  }
  if (status === "INVOICED" && flags.isFinance) {
    panels.push(
      <StepForm key="settle" title="Règlement" hint="Réglez la facture de l'agence (ordre de dépense)."
        onSubmit={(form) => run(() => settle(fd({ amount: String(form.get("amount") || "") })))} saving={saving} err={err} submit="Régler la facture">
        <Field name="amount" label="Montant à régler (DZD)" type="number" defaultValue={props.amount != null ? String(props.amount) : ""} />
      </StepForm>,
    );
  }

  // Annulation (sauf dossier clôturé)
  const canCancel = status !== "SETTLED" && status !== "CANCELLED" && (flags.isMarketing || flags.isAssistant || flags.isDirection);

  if (panels.length === 0 && !canCancel) return null;

  return (
    <div className="space-y-4">
      {panels}
      {canCancel && (
        <CancelButton id={id} />
      )}
    </div>
  );
}

function CancelButton({ id }: { id: string }) {
  const { saving, err, run } = useRun();
  const [confirm, setConfirm] = React.useState(false);
  return (
    <div className="space-y-2">
      <Err msg={err} />
      {!confirm ? (
        <button onClick={() => setConfirm(true)} className="text-xs text-muted-foreground hover:text-destructive">Annuler ce dossier</button>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Annuler le dossier ?</span>
          <Button size="sm" variant="destructive" onClick={() => { const f = new FormData(); f.set("id", id); run(() => cancelPromoMaterial(f)); }} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Confirmer</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={saving}>Non</Button>
        </div>
      )}
    </div>
  );
}

function Step({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <Card className="border-primary/40">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{hint}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function StepForm({ title, hint, children, onSubmit, saving, err, submit }: { title: string; hint: string; children: React.ReactNode; onSubmit: (fd: FormData) => void; saving: boolean; err: string | null; submit: string }) {
  return (
    <Card className="border-primary/40">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-3">
          <p className="text-xs text-muted-foreground">{hint}</p>
          {children}
          <Err msg={err} />
          <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} {submit}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ name, label, type = "text", required, defaultValue }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} step={type === "number" ? "any" : undefined} />
    </div>
  );
}
function Area({ name, label }: { name: string; label: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} className="min-h-[60px]" />
    </div>
  );
}
function FileField({ name, label }: { name: string; label: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <input id={name} name={name} type="file" multiple className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/80" />
    </div>
  );
}
