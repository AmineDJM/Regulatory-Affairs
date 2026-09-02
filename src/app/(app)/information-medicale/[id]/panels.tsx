"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Upload, Trash2, ShieldCheck, AlertCircle, FileText, BadgeCheck, Lock, HandCoins, PackageCheck } from "lucide-react";
import {
  requestDocument, cancelDocRequest, fulfillDocRequest, validateDeclaration, validateDeclarationByDirection, recordAuthorityDeclaration,
  requestDeclareDecision, addMedicalInfoSlip, removeMedicalInfoSlip, requestSlipsValidation,
  requestSlipPayment, deliverMedicalInfoSlip, skipMedicalInfoBv, createMedicalInfoItem,
} from "@/lib/actions/medical-info-actions";
import {
  declareMessage, declareStage, declareStageLabel, DECLARE_INTENT_LABEL, type DeclareInput,
} from "@/lib/medical-info/declare-decision";
import {
  slipStage, slipsMessage, SLIP_STAGE_LABEL, SLIPS_LOT_LABEL,
  type SlipsLotStage, type SlipsSummary, type SlipInput,
} from "@/lib/medical-info/slips";
import { DECLARATION_KINDS, DECLARATION_KIND_LABEL, DECLARATION_KIND_HINT } from "@/lib/medical-info/circuits";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/labels";
import type { ActionResult } from "@/lib/actions/types";
import { useAction } from "@/components/shared/use-action";

interface UserOpt { id: string; name: string; role: string }

const Err = ({ msg }: { msg: string | null }) =>
  msg ? <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" /> {msg}</div> : null;


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
/**
 * CIRCUIT ÉVÉNEMENT — « faut-il déclarer ? », et rien d'autre.
 *
 * Une prise en charge, un sponsoring, un événement n'appellent AUCUN versement. C'était le
 * défaut : chacun sortait par la porte « ce dossier n'appelle aucun versement », motif à l'appui.
 * Un contournement obligatoire n'est plus une porte de sortie, c'est le chemin normal mal nommé.
 */
export function DeclareDecisionCard({
  id, state, authorityRef, canRequest, validationHref,
}: {
  id: string;
  state: DeclareInput;
  authorityRef: string | null;
  canRequest: boolean;
  validationHref: string | null;
}) {
  const { saving, err, run } = useAction();
  const etape = declareStage(state);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-medium">{declareStageLabel(etape)}</span>
        {state.intent && (
          <span className="rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
            {DECLARE_INTENT_LABEL[state.intent === "SKIP" ? "SKIP" : "DECLARE"]}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{declareMessage(state, { authorityRef })}</p>
      {validationHref && (
        <a href={validationHref} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <FileText className="h-3.5 w-3.5" /> Ouvrir la demande de validation
        </a>
      )}

      {canRequest && (
        <form
          action={(fd) => { fd.set("id", id); run(() => requestDeclareDecision(undefined, fd)); }}
          className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3"
        >
          <div className="space-y-1">
            <Label>Ce que vous comptez faire</Label>
            <Select name="intent" defaultValue="DECLARE">
              <option value="DECLARE">{DECLARE_INTENT_LABEL.DECLARE}</option>
              <option value="SKIP">{DECLARE_INTENT_LABEL.SKIP}</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Motif / note</Label>
            <Textarea name="note" className="min-h-[60px]" placeholder="Ce que lira le validateur — exigé si le dossier ne se déclare pas." />
          </div>
          <Err msg={err} />
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Faire valider cette lecture
          </Button>
        </form>
      )}
    </div>
  );
}

/**
 * CIRCUIT MATÉRIEL PROMOTIONNEL — un bon de versement par matériel.
 *
 * On sépare le dossier en matériels, on fait valider le dépôt des bons EN UNE FOIS, puis on
 * demande le paiement de chaque quittance SÉPARÉMENT. Il n'y avait qu'un bon par dossier : on
 * additionnait les montants, et ce qui n'entrait pas dans la case se réglait hors ERP.
 */
export interface SlipView extends SlipInput {
  id: string;
  label: string;
  amount: number | null;
  note: string | null;
  deliveredAtIso: string | null;
}

export function SlipsCard({
  id, lot, slips, summary, canEdit, canValidate, canManage, canDeliver, canSkip, skipReason, validationHref,
}: {
  id: string;
  lot: SlipsLotStage;
  slips: SlipView[];
  summary: SlipsSummary;
  canEdit: boolean;
  canValidate: boolean;
  /** Le pharmacien : c'est lui qui demande les paiements. */
  canManage: boolean;
  /** Les Finances : elles remettent les quittances réglées. */
  canDeliver: boolean;
  canSkip: boolean;
  skipReason: string | null;
  validationHref: string | null;
}) {
  const { saving, err, run } = useAction();
  const [pane, setPane] = React.useState<string | null>(null);

  if (skipReason) {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
        <span>Ce dossier a été déclaré <strong>sans versement</strong> — {skipReason}</span>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <HandCoins className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-medium">{SLIPS_LOT_LABEL[lot]}</span>
        {summary.count > 0 && (
          <span className="text-xs text-muted-foreground">
            {summary.count} matériel(s) · {formatCurrency(summary.announced)} annoncés · {summary.delivered}/{summary.count} remis
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{slipsMessage(lot, summary)}</p>
      {validationHref && (
        <a href={validationHref} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <FileText className="h-3.5 w-3.5" /> Ouvrir la demande de validation
        </a>
      )}

      {/* LA LISTE DES MATÉRIELS — chacun sa route, et elle se lit d'un coup d'œil. */}
      {slips.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {slips.map((sl) => {
            const etape = slipStage(sl);
            return (
              <li key={sl.id} className="space-y-2 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 flex-1 font-medium">{sl.label}</span>
                  {sl.amount != null && <span className="tabular-nums">{formatCurrency(sl.amount)}</span>}
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                    {SLIP_STAGE_LABEL[etape]}
                  </span>
                  {canEdit && !sl.requestId && (
                    <button
                      type="button" title="Retirer ce matériel" disabled={saving}
                      onClick={() => { const fd = new FormData(); fd.set("slipId", sl.id); run(() => removeMedicalInfoSlip(fd)); }}
                      className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {sl.note && <p className="text-xs text-muted-foreground">{sl.note}</p>}
                {sl.deliveredAtIso && (
                  <p className="text-xs text-success">Quittance remise le {formatDate(sl.deliveredAtIso)}</p>
                )}

                {/* DEMANDER LE PAIEMENT DE CE BON — son montant RÉEL, qui n'est pas toujours celui annoncé. */}
                {canManage && lot === "QUITTANCE_A_DEMANDER" && (etape === "A_DEMANDER" || etape === "REFUSE") && (
                  pane === `pay:${sl.id}` ? (
                    <form
                      action={(fd) => { fd.set("slipId", sl.id); run(() => requestSlipPayment(undefined, fd)); }}
                      className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2"
                    >
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Montant réel (DZD)</Label>
                          <Input name="amount" inputMode="decimal" required defaultValue={sl.amount ?? ""} className="h-9 text-right tabular-nums" />
                        </div>
                        <div className="space-y-1">
                          <Label>Bénéficiaire</Label>
                          <Input name="payee" defaultValue="Autorités sanitaires" className="h-9" />
                        </div>
                        <div className="space-y-1">
                          <Label>Échéance souhaitée</Label>
                          <Input name="dueDate" type="date" className="h-9" />
                        </div>
                      </div>
                      <Textarea name="note" className="min-h-[48px]" placeholder="Précisions pour le centre de paiement (facultatif)" />
                      <label className="block text-xs text-muted-foreground">
                        Pièces (quittance, avis de versement…)
                        <input type="file" name="files" multiple className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium" />
                      </label>
                      <Err msg={err} />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={saving}>
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Demander le paiement
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setPane(null)}>Annuler</Button>
                      </div>
                    </form>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setPane(`pay:${sl.id}`)}>
                      <HandCoins className="h-4 w-4" /> Demander le paiement de cette quittance
                    </Button>
                  )
                )}

                {/* LES FINANCES REMETTENT — un geste, pas un état déduit du règlement. */}
                {canDeliver && etape === "PAYE" && (
                  <form
                    action={(fd) => { fd.set("slipId", sl.id); run(() => deliverMedicalInfoSlip(fd)); }}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <div className="min-w-[12rem] flex-1 space-y-1">
                      <Label>Note de remise (facultatif)</Label>
                      <Input name="note" className="h-9" placeholder="Remis en main propre le…" />
                    </div>
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Quittance remise au PRIM
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* SÉPARER LE DOSSIER EN MATÉRIELS — tant que le dépôt n'est pas signé. */}
      {canEdit && (
        <form
          action={(fd) => { fd.set("declarationId", id); run(() => addMedicalInfoSlip(undefined, fd)); }}
          className="grid gap-2 rounded-lg border border-border bg-secondary/30 p-3 sm:grid-cols-[2fr,1fr,auto]"
        >
          <div className="space-y-1">
            <Label>Matériel</Label>
            <Input name="label" required placeholder="Présentoir comptoir, affiches A2…" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label>Montant annoncé (DZD)</Label>
            <Input name="amount" inputMode="decimal" placeholder="0" className="h-9 text-right tabular-nums" />
          </div>
          <div className="flex items-end">
            <Button type="submit" size="sm" variant="outline" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Ajouter
            </Button>
          </div>
        </form>
      )}

      <Err msg={err} />

      <div className="flex flex-wrap gap-2">
        {canValidate && (
          <form action={(fd) => { fd.set("id", id); run(() => requestSlipsValidation(undefined, fd)); }} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] space-y-1">
              <Label>Note pour les validateurs</Label>
              <Input name="note" className="h-9" placeholder="Facultatif" />
            </div>
            <Button type="submit" size="sm" disabled={saving || slips.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Faire valider le dépôt des bons
            </Button>
          </form>
        )}
        {canSkip && (
          pane === "skip" ? (
            <form
              action={(fd) => { fd.set("id", id); run(() => skipMedicalInfoBv(fd)); }}
              className="w-full space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-3"
            >
              <Label>Pourquoi ce dossier n&apos;appelle aucun versement</Label>
              <Textarea name="reason" required className="min-h-[60px]" placeholder="C'est ce que lira l'audit." />
              <div className="flex gap-2">
                <Button type="submit" size="sm" variant="outline" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Déclarer sans versement
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setPane(null)}>Annuler</Button>
              </div>
            </form>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setPane("skip")}>
              <Lock className="h-4 w-4" /> Ce dossier n&apos;appelle aucun versement
            </Button>
          )
        )}
      </div>
    </div>
  );
}

/** Le dépôt aux autorités, FERMÉ tant que le circuit du dossier ne l'a pas ouvert. */
export function AuthorityLocked({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

/**
 * LE PHARMACIEN OUVRE LUI-MÊME UN DOSSIER.
 *
 * Une obligation réglementaire se découvre aussi de son côté : un support à faire viser, une
 * déclaration au ministère qu'aucun événement n'a déclenchée, un versement à faire. Il n'avait
 * pour cela aucun geste — le module ne se remplissait que par la validation d'un autre — et ce
 * qui n'entre pas dans l'ERP se traite dans un carnet.
 */
export function CreateDeclarationButton() {
  const router = useRouter();
  const { saving, err, run } = useAction();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<string>("MIP");

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Ouvrir un dossier
      </Button>
    );
  }
  return (
    <form
      action={(fd) => {
        void run(async () => {
          const r = await createMedicalInfoItem(undefined, fd);
          if (r.ok && r.id) { setOpen(false); router.push(`/information-medicale/${r.id}`); }
          return r;
        });
      }}
      className="w-full space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3"
    >
      <p className="text-sm font-medium">Ouvrir un dossier d&apos;information médicale</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Objet</Label>
          <Input name="label" required placeholder="Ce qu'il y a à déclarer, viser ou verser" className="h-9" />
        </div>
        <div className="space-y-1">
          <Label>Nature</Label>
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {DECLARATION_KINDS.map((k) => <option key={k} value={k}>{DECLARATION_KIND_LABEL[k]}</option>)}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Bénéficiaire (facultatif)</Label>
          <Input name="beneficiary" className="h-9" />
        </div>
        <div className="space-y-1">
          <Label>Montant (facultatif, DZD)</Label>
          <Input name="amount" inputMode="decimal" className="h-9 text-right tabular-nums" />
        </div>
      </div>
      {/* LA NATURE DÉCIDE DU CIRCUIT, et on le dit AVANT de créer : le découvrir après coup
          obligerait à supprimer le dossier pour en rouvrir un autre. */}
      <p className="text-xs text-muted-foreground">
        {DECLARATION_KIND_HINT[kind as keyof typeof DECLARATION_KIND_HINT] ?? ""}
      </p>
      <Err msg={err} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Ouvrir
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
      </div>
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
