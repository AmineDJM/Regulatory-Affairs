"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, Check, X, RotateCcw, PauseCircle, PlayCircle, Send, Plus, ShieldCheck,
  MessageSquare, Download, Paperclip, FileQuestion, Gavel, ExternalLink, Info, BellRing, Siren,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileGlyph } from "@/components/drive/file-glyph";
import { PAYMENT_PIECE_STATUS, PAYMENT_PIECE_KIND, PAYMENT_PIECE_KIND_OPTIONS, VALIDATION_STATUS } from "@/lib/labels";
import { needsReplacement, tallyPieces } from "@/lib/finance/payment-request";
import { dossierHint, isBonDeVersement } from "@/lib/finance/payment-dossier";
import { companionNotice } from "@/lib/finance/dossier-auto";
import { pieceKindOptions, filingNotice } from "@/lib/legal/from-piece";
import {
  addPaymentPiece, commentPaymentPiece, reviewPaymentPiece, addPaymentComment,
  submitPaymentRequest, decidePaymentRequest, cancelPaymentRequest, updatePaymentRequestDetails,
  nudgePaymentRequest,
} from "@/lib/actions/payment-request-actions";
import { requestDocument, askablePeople } from "@/lib/actions/document-request-actions";

export interface PieceView {
  id: string;
  documentId: string;
  name: string;
  kind: string;
  note: string | null;
  status: string;
  reviewNote: string | null;
  reviewedBy: string | null;
  replacedById: string | null;
  addedBy: string | null;
  createdAt: string;
  /**
   * LA VALIDATION EN COURS SUR CETTE PIÈCE, quand il y en a une — sa référence et son sort.
   * Sans elle, on redemande à valider ce qui est déjà chez le Directeur Général, et deux
   * demandes identiques arrivent sur son écran.
   */
  validation: { id: string; reference: string; status: string } | null;
}

export interface EventView {
  id: string;
  kind: string;
  message: string | null;
  actor: string | null;
  at: string;
}

type Runner = (fd: FormData) => Promise<{ ok: boolean; error?: string }>;

/**
 * RELANCER, OU SIGNALER UNE URGENCE — les deux gestes du demandeur quand la balle n'est plus
 * dans son camp.
 *
 * Ils ne disent PAS la même chose, et c'est pourquoi ils ne partagent pas un bouton :
 *   • **relancer** demande où l'on en est ; personne n'est pris en faute ;
 *   • **signaler une urgence** REMONTE le dossier dans la file des Finances — ce qui n'est pas
 *     gratuit, d'où le motif exigé, que les Finances liront pour arbitrer entre deux dossiers
 *     pressants.
 *
 * Un bouton unique aurait fait de chaque relance une urgence, et une file où tout est urgent n'a
 * plus de priorité du tout.
 */
function NudgePanel({ id, onDone }: { id: string; onDone: () => void }) {
  const [kind, setKind] = React.useState<"REMINDER" | "URGENT" | null>(null);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  const envoyer = async () => {
    if (!kind) return;
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("id", id); fd.set("kind", kind); fd.set("comment", comment);
    const r = await nudgePaymentRequest(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "La relance n'a pas pu être envoyée."); return; }
    setDone(r.message ?? "Envoyé."); setKind(null); setComment("");
    onDone();
  };

  return (
    <section className="surface space-y-3 p-4">
      <div>
        <h2 className="text-sm font-semibold">Votre demande est chez les Finances</h2>
        <p className="text-xs text-muted-foreground">
          Vous n&apos;avez plus la main sur le dossier — mais vous pouvez faire savoir que vous attendez.
        </p>
      </div>
      {done && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{done}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant={kind === "REMINDER" ? "primary" : "outline"} onClick={() => { setKind("REMINDER"); setDone(null); setErr(null); }}>
          <BellRing className="h-4 w-4" /> Relancer
        </Button>
        <Button variant={kind === "URGENT" ? "primary" : "outline"} className={kind === "URGENT" ? "" : "text-destructive"} onClick={() => { setKind("URGENT"); setDone(null); setErr(null); }}>
          <Siren className="h-4 w-4" /> Signaler une urgence de paiement
        </Button>
      </div>
      {kind && (
        <div className="space-y-2">
          <Label htmlFor={`nudge-${id}`}>
            Commentaire {kind === "URGENT" ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(facultatif)</span>}
          </Label>
          <Textarea
            id={`nudge-${id}`} value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
            placeholder={kind === "URGENT"
              ? "Ex. le fournisseur bloque la livraison tant que la facture n'est pas réglée."
              : "Ex. le fournisseur a rappelé ce matin."}
          />
          {kind === "URGENT" && (
            <p className="text-xs text-muted-foreground">
              Une urgence remonte ce dossier dans la file des Finances. Dites pourquoi : c&apos;est ce
              qu&apos;elles liront pour arbitrer entre deux paiements pressants.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => { setKind(null); setComment(""); }}>Annuler</Button>
            <Button disabled={busy || (kind === "URGENT" && comment.trim().length === 0)} onClick={() => void envoyer()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer
            </Button>
          </div>
        </div>
      )}
      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
    </section>
  );
}

/**
 * LE DOSSIER DE PAIEMENT — la conversation, pièce par pièce.
 *
 * Tout se joue ici : les Finances se prononcent sur CHAQUE pièce (accepter, faire revoir,
 * refuser), le demandeur répond sur la pièce visée — en la commentant à nouveau, ou en la
 * remplaçant. Refuser un dossier entier parce qu'une facture est floue obligerait à redéposer le
 * bon de commande et le devis qui, eux, allaient très bien.
 *
 * Chaque bouton correspond à une transition réelle (`lib/finance/payment-request.ts`), et les
 * refus portent toujours un MOTIF : sans lui, la pièce revient identique et l'on a perdu un tour.
 */
export function PaymentDossier({
  id, reference, status, isRequester, isFinance, pieces, events, people, canApproveNow, approveBlocker, resubmitBlocker,
  entityType, paymentMethodStated, contact, isCompanion = false, orderReference = null, withFinance = false,
}: {
  id: string;
  reference: string;
  status: string;
  isRequester: boolean;
  isFinance: boolean;
  /**
   * CE DOSSIER ACCOMPAGNE-T-IL UN ORDRE DE DÉPENSE né ailleurs (matériel promotionnel, bon de
   * versement, sponsoring…) ? Alors le paiement a DÉJÀ été décidé par son circuit puis autorisé
   * par le centre : on rassemble ici les pièces et la discussion, on ne tranche pas une seconde
   * fois. Les gestes de décision sont retirés — et le serveur les refuse aussi (§118-7).
   */
  isCompanion?: boolean;
  orderReference?: string | null;
  /** Le dossier est-il chez les Finances ? C'est la condition de la relance. */
  withFinance?: boolean;
  pieces: PieceView[];
  events: EventView[];
  people: { id: string; name: string }[];
  canApproveNow: boolean;
  approveBlocker: string | null;
  resubmitBlocker: string | null;
  /** Le rattachement — c'est lui qui exempte un BON DE VERSEMENT des pièces obligatoires. */
  entityType: string | null;
  paymentMethodStated: boolean;
  contact: { name: string | null; phone: string | null; email: string | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [message, setMessage] = React.useState("");

  const run = async (key: string, fn: Runner, fields: Record<string, string>, files?: Record<string, File>) => {
    setBusy(key); setErr(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    for (const [k, f] of Object.entries(files ?? {})) fd.set(k, f);
    const r = await fn(fd);
    setBusy(null);
    if (!r.ok) { setErr(r.error ?? "L'opération a échoué."); return false; }
    setNote(""); setMessage("");
    router.refresh();
    return true;
  };

  const t = tallyPieces(pieces);
  const enValidation = pieces.filter((p) => p.validation?.status === "PENDING").length;
  const open = status !== "APPROVED" && status !== "REJECTED" && status !== "CANCELLED";

  return (
    <div className="space-y-5">
      {/* CE DOSSIER DIT CE QU'IL EST, avant qu'on cherche le bouton qui n'existe pas. Le silence
          d'une interface se lit toujours comme une panne, et un comptable qui ne trouve pas
          « bon à payer » en conclut qu'il lui manque un droit. */}
      {isCompanion && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {companionNotice(orderReference)}
        </p>
      )}

      {/* ───────────── Les pièces, et leur conversation ───────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Dossier &amp; pièces</h2>
            <span className="text-xs text-muted-foreground">
              {t.accepted} acceptée·s · {t.toFix + t.rejected} en cause · {t.pending} à examiner
              {enValidation > 0 ? ` · ${enValidation} en validation` : ""}
            </span>
          </div>
          {/* DEMANDER LA PIÈCE QUI MANQUE, D'ICI. La facture est chez le commercial, le bon chez
              l'assistante : la pièce absente n'est presque jamais chez celui qui l'attend. On la
              réclamait par message, et l'on perdait la trace de ce qu'on attendait, de qui,
              depuis quand. La personne sollicitée dépose sans accéder au module. */}
          {(isRequester || isFinance) && open && (
            <AskPiece requestId={id} reference={reference} busy={busy} setErr={setErr} />
          )}
        </div>

        {pieces.length === 0 ? (
          <p className="surface p-6 text-center text-sm text-muted-foreground">
            Aucune pièce. Un paiement sans justificatif ne s&apos;autorise pas.
          </p>
        ) : (
          <ul className="space-y-2">
            {pieces.map((p) => (
              <PieceCard
                key={p.id} requestId={id} piece={p} busy={busy} run={run}
                isRequester={isRequester} isFinance={isFinance} open={open}
              />
            ))}
          </ul>
        )}

        {(isRequester || isFinance) && open && (
          <AddPiece id={id} busy={busy} run={run} />
        )}

        {/* CE QUE LE DOSSIER DOIT PORTER POUR PARTIR, et ce qu'il peut porter en plus.
            Le demandeur y coche l'attestation et y met son contact. Sans ce bloc, un brouillon
            ouvert avant la règle — ou un dossier renvoyé pour correction — serait bloqué à la
            transmission sans aucun moyen de se débloquer : le formulaire de création est passé,
            et rien d'autre n'écrit ces champs. */}
        {isRequester && open && (
          <DossierRequirements
            id={id} entityType={entityType} pieces={pieces}
            paymentMethodStated={paymentMethodStated} contact={contact}
            busy={busy} run={run}
          />
        )}
      </section>

      {/* ───────────── Le fil ───────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Fil du dossier</h2>
        <ol className="surface divide-y divide-border p-0">
          {events.length === 0 ? (
            <li className="px-3 py-4 text-center text-xs text-muted-foreground">Rien encore.</li>
          ) : events.map((e) => (
            <li key={e.id} className="flex gap-2 px-3 py-2 text-sm">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{e.actor ?? "Système"} · {e.at} · {EVENT_LABEL[e.kind] ?? e.kind}</p>
                {e.message && <p className="whitespace-pre-wrap">{e.message}</p>}
              </div>
            </li>
          ))}
        </ol>
        {open && (
          <div className="flex gap-2">
            <Input value={message} onChange={(ev) => setMessage(ev.target.value)} placeholder="Écrire un message…" />
            <Button
              variant="outline" disabled={busy !== null || !message.trim()}
              onClick={() => void run("msg", addPaymentComment, { requestId: id, message })}
            >
              {busy === "msg" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </section>

      {/* ───────────── LA RELANCE — le seul geste du demandeur quand tout est parti ─────────────
          Une fois sa demande chez les Finances, le demandeur n'avait plus qu'un statut à regarder.
          C'est pourtant le moment où il en a le plus besoin : son fournisseur rappelle, sa
          quittance a une date. Il décrochait son téléphone, et la relance n'existait nulle part —
          ni trace, ni preuve qu'elle a eu lieu. */}
      {isRequester && withFinance && <NudgePanel id={id} onDone={() => router.refresh()} />}

      {/* ───────────── Les gestes ───────────── */}
      {open && !isCompanion && (isRequester || isFinance) && (
        <section className="surface space-y-3 p-4">
          <h2 className="text-sm font-semibold">Que faire de ce dossier ?</h2>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Motif / commentaire — obligatoire pour une mise en attente ou un refus." />

          <div className="flex flex-wrap gap-2">
            {isRequester && (status === "DRAFT" || status === "CHANGES_REQUESTED") && (
              <Button
                disabled={busy !== null || Boolean(resubmitBlocker)} title={resubmitBlocker ?? undefined}
                onClick={() => void run("send", submitPaymentRequest, { id, note })}
              >
                {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer aux Finances
              </Button>
            )}
            {isRequester && resubmitBlocker && <span className="self-center text-xs text-muted-foreground">{resubmitBlocker}</span>}

            {isFinance && status === "SUBMITTED" && (
              <Button variant="outline" disabled={busy !== null} onClick={() => void run("review", decidePaymentRequest, { id, move: "REVIEW", note })}>
                {busy === "review" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} Prendre en instruction
              </Button>
            )}
            {isFinance && status !== "ON_HOLD" && (
              <Button variant="outline" disabled={busy !== null} onClick={() => void run("hold", decidePaymentRequest, { id, move: "HOLD", note })}>
                {busy === "hold" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />} Mettre en attente
              </Button>
            )}
            {isFinance && status === "ON_HOLD" && (
              <Button variant="outline" disabled={busy !== null} onClick={() => void run("resume", decidePaymentRequest, { id, move: "RESUME", note })}>
                {busy === "resume" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} Reprendre
              </Button>
            )}
            {isFinance && status !== "CHANGES_REQUESTED" && (
              <Button variant="outline" disabled={busy !== null} onClick={() => void run("back", decidePaymentRequest, { id, move: "REQUEST_CHANGES", note })}>
                {busy === "back" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Renvoyer au demandeur
              </Button>
            )}
            {isFinance && (
              <>
                <Button
                  disabled={busy !== null || !canApproveNow} title={approveBlocker ?? undefined}
                  onClick={() => void run("ok", decidePaymentRequest, { id, move: "APPROVE", note })}
                >
                  {busy === "ok" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Bon à payer
                </Button>
                <Button variant="outline" className="text-destructive" disabled={busy !== null} onClick={() => void run("no", decidePaymentRequest, { id, move: "REJECT", note })}>
                  {busy === "no" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Refuser
                </Button>
              </>
            )}
            {isRequester && (
              <Button variant="outline" className="text-muted-foreground" disabled={busy !== null} onClick={() => void run("cancel", cancelPaymentRequest, { id, note })}>
                Retirer la demande
              </Button>
            )}
          </div>
          {isFinance && approveBlocker && <p className="text-xs text-muted-foreground">{approveBlocker}</p>}

        </section>
      )}

      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}

/**
 * CE QUE LE DOSSIER DOIT PORTER — dit ici, pendant qu'on le complète.
 *
 * Deux gestes que SEUL LE DEMANDEUR peut poser, et qui vivent donc ensemble :
 *
 *   • **l'attestation** que le moyen de paiement figure sur le document. C'est une attestation,
 *     pas une case administrative : elle engage celui qui a la pièce sous les yeux, et ni les
 *     Finances ni l'assistant ne peuvent la cocher à sa place — ils n'ont pas fourni la pièce ;
 *   • **le contact** chez le bénéficiaire, facultatif, celui qu'on appelle quand une pièce manque
 *     ou qu'un virement n'arrive pas.
 *
 * L'exigence de pièce (bon de commande ou facture) est RAPPELÉE ici et non recodée : c'est
 * `dossierHint`, la même fonction que celle qui garde l'action serveur.
 */
function DossierRequirements({
  id, entityType, pieces, paymentMethodStated, contact, busy, run,
}: {
  id: string;
  entityType: string | null;
  pieces: PieceView[];
  paymentMethodStated: boolean;
  contact: { name: string | null; phone: string | null; email: string | null };
  busy: string | null;
  run: (k: string, f: Runner, fields: Record<string, string>, files?: Record<string, File>) => Promise<boolean>;
}) {
  const [stated, setStated] = React.useState(paymentMethodStated);
  const [name, setName] = React.useState(contact.name ?? "");
  const [phone, setPhone] = React.useState(contact.phone ?? "");
  const [email, setEmail] = React.useState(contact.email ?? "");

  const manque = dossierHint({ entityType, pieces, paymentMethodStated: stated });
  const modifie = stated !== paymentMethodStated
    || name !== (contact.name ?? "") || phone !== (contact.phone ?? "") || email !== (contact.email ?? "");

  const enregistrer = () =>
    void run("details", updatePaymentRequestDetails, {
      id, paymentMethodStated: stated ? "1" : "0", contactName: name, contactPhone: phone, contactEmail: email,
    });

  return (
    <div className="surface space-y-3 p-3">
      <h3 className="text-sm font-semibold">Ce que le dossier doit porter</h3>

      {isBonDeVersement({ entityType }) ? (
        // L'EXEMPTION SE DIT, elle ne se devine pas au silence de l'écran : un pharmacien qui ne
        // voit pas l'exigence croit que l'écran a oublié de la lui montrer.
        <p className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          <strong className="text-foreground">Bon de versement</strong> — ni bon de commande ni facture ne sont exigés :
          ils n&apos;existent pas pour un versement aux autorités, et la quittance ne vient qu&apos;après. Le bon a déjà
          été validé en amont (N+1, chef de produit, centre de validations).
        </p>
      ) : (
        <p className={`rounded-lg px-3 py-2 text-xs ${manque ? "border border-warning/40 bg-warning/5 text-foreground" : "bg-success/10 text-success"}`}>
          {manque ?? "Le dossier est complet : bon de commande ou facture joint, moyen de paiement déclaré."}
        </p>
      )}

      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" checked={stated} onChange={(e) => setStated(e.target.checked)} />
        <span>
          <strong>Le moyen de paiement est mentionné dans le document</strong> (RIB, chèque, espèces).
          <span className="block text-xs text-muted-foreground">C&apos;est ce qui permet à la comptabilité de payer sans vous rappeler.</span>
        </span>
      </label>

      <div className="space-y-1.5">
        <Label>Contact chez le bénéficiaire <span className="text-xs font-normal text-muted-foreground">— facultatif</span></Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" />
          <Input value={email} type="email" onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" />
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" disabled={busy !== null || !modifie} onClick={enregistrer}>
          {busy === "details" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer
        </Button>
      </div>
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  SUBMIT: "Transmis aux Finances",
  REVIEW: "Prise en instruction",
  HOLD: "Mis en attente",
  RESUME: "Repris",
  REQUEST_CHANGES: "Renvoyé au demandeur",
  CHANGES: "Renvoyé au demandeur",
  APPROVE: "Bon à payer",
  REJECT: "Refusé",
  CANCEL: "Retiré",
  COMMENT: "Message",
  PIECE_ADDED: "Pièce ajoutée",
  PIECE_REVIEWED: "Pièce examinée",
  VALIDATION_ASKED: "Validation demandée",
};

/** Une pièce, son commentaire, son verdict, et la réponse qu'elle appelle. */
function PieceCard({
  requestId, piece, busy, run, isRequester, isFinance, open,
}: {
  requestId: string; piece: PieceView; busy: string | null; run: (k: string, f: Runner, fields: Record<string, string>, files?: Record<string, File>) => Promise<boolean>;
  isRequester: boolean; isFinance: boolean; open: boolean;
}) {
  const [note, setNote] = React.useState(piece.note ?? "");
  const [review, setReview] = React.useState("");
  const [replacing, setReplacing] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const inCause = needsReplacement(piece.status);
  const superseded = Boolean(piece.replacedById);

  return (
    <li className={`surface space-y-2 p-3 ${superseded ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <FileGlyph name={piece.name} isFile />
        <a href={`/api/documents/${piece.documentId}?dl=1`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
          {piece.name}
        </a>
        <Badge tone="neutral" dot={false}>{PAYMENT_PIECE_KIND[piece.kind] ?? piece.kind}</Badge>
        <StatusBadge map={PAYMENT_PIECE_STATUS} value={piece.status} dot={false} />
        {superseded && <Badge tone="neutral" dot={false}>remplacée</Badge>}
        <a href={`/api/documents/${piece.documentId}?dl=1`} className="rounded p-1 text-muted-foreground hover:bg-secondary" aria-label="Télécharger">
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* CE QUI EST PARTI AU CENTRE DE VALIDATIONS, sur CETTE pièce. */}
      {piece.validation && (
        <p className={`flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${piece.validation.status === "PENDING" ? "bg-primary/10" : "bg-secondary/40"}`}>
          <Gavel className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="font-mono text-xs text-muted-foreground">{piece.validation.reference}</span>
          <StatusBadge map={VALIDATION_STATUS} value={piece.validation.status} dot={false} />
          <span className="text-muted-foreground">au centre de validations</span>
          <Link href={`/validations/${piece.validation.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
            suivre <ExternalLink className="h-3 w-3" />
          </Link>
        </p>
      )}

      {piece.note && <p className="rounded-lg bg-secondary/40 px-2.5 py-1.5 text-sm"><strong>Demandeur :</strong> {piece.note}</p>}
      {piece.reviewNote && (
        <p className={`rounded-lg px-2.5 py-1.5 text-sm ${inCause ? "bg-warning/10" : "bg-secondary/40"}`}>
          <strong>Finances{piece.reviewedBy ? ` (${piece.reviewedBy})` : ""} :</strong> {piece.reviewNote}
        </p>
      )}

      {open && !superseded && isRequester && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Commenter cette pièce…" />
            <Button variant="outline" disabled={busy !== null} onClick={() => void run(`note-${piece.id}`, commentPaymentPiece, { pieceId: piece.id, note })}>
              {busy === `note-${piece.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
          {/* Une pièce mise en cause se REMPLACE — l'originale reste, c'est elle qui explique
              pourquoi il y a eu un second tour. */}
          {inCause && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef} type="file" className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setReplacing(true);
                  await run(`repl-${piece.id}`, addPaymentPiece, { requestId, replacesId: piece.id, kind: piece.kind, note }, { file: f });
                  setReplacing(false);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <Button size="sm" variant="outline" disabled={busy !== null || replacing} onClick={() => fileRef.current?.click()}>
                {replacing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />} Remplacer cette pièce
              </Button>
            </div>
          )}
        </div>
      )}

      {open && !superseded && isFinance && (
        <div className="space-y-2 border-t border-border pt-2">
          <Input value={review} onChange={(e) => setReview(e.target.value)} placeholder="Ce qui ne va pas (obligatoire pour « à revoir » ou « refusée »)" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run(`ok-${piece.id}`, reviewPaymentPiece, { pieceId: piece.id, verdict: "ACCEPTED", note: review })}>
              <Check className="h-3.5 w-3.5" /> Accepter
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run(`fix-${piece.id}`, reviewPaymentPiece, { pieceId: piece.id, verdict: "CHANGES_REQUESTED", note: review })}>
              <RotateCcw className="h-3.5 w-3.5" /> À revoir
            </Button>
            <Button size="sm" variant="outline" className="text-destructive" disabled={busy !== null} onClick={() => void run(`no-${piece.id}`, reviewPaymentPiece, { pieceId: piece.id, verdict: "REJECTED", note: review })}>
              <X className="h-3.5 w-3.5" /> Refuser
            </Button>
            {/* PLUS DE « FAIRE VALIDER » ICI.
                Le dossier n'arrive dans cet écran QU'AUTORISÉ par le centre de paiement : demander
                une validation sur ce qui vient d'être autorisé n'avait plus de sens, et proposer un
                geste sans effet est pire que ne rien proposer — on l'exerce, on attend une réponse,
                elle ne vient jamais. Les Finances lisent les pièces et RÉCLAMENT celles qui
                manquent ; ce qui se décide se décide dans « Banque & paiements ». */}
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * DEMANDER UNE PIÈCE À QUELQU'UN — depuis le dossier, et rattachée à lui.
 *
 * Elle atterrit dans « Pièces demandées » de la personne visée, qui la dépose SANS avoir accès
 * au module : le fil lui ouvre la seule chose qui la concerne. Ce qu'on demande s'écrit en
 * clair — « la facture définitive de l'agence », jamais « pièce n° 3 » : le destinataire n'a pas
 * le dossier sous les yeux.
 *
 * L'annuaire se charge À L'OUVERTURE du volet, pas avec la page : un dossier de paiement n'a
 * aucune raison de transporter la liste de tout le monde pour un panneau que la plupart des
 * visites n'ouvriront pas.
 */
function AskPiece({
  requestId, reference, busy, setErr,
}: {
  requestId: string; reference: string; busy: string | null; setErr: (v: string | null) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [people, setPeople] = React.useState<{ id: string; name: string }[] | null>(null);
  const [who, setWho] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [kind, setKind] = React.useState("INVOICE");
  const [due, setDue] = React.useState("");
  const [note, setNote] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);

  const ouvrir = async () => {
    setOpen(true); setErr(null); setDone(null);
    setWho(""); setLabel(""); setKind("INVOICE"); setDue(""); setNote("");
    if (people === null) setPeople(await askablePeople());
  };

  return (
    <>
      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void ouvrir()}>
        <FileQuestion className="h-4 w-4" /> Demander une pièce
      </Button>

      <Sheet open={open} onClose={() => !sending && setOpen(false)} title="Demander une pièce" description={`Elle se rattachera au dossier ${reference}. La personne sollicitée la déposera sans avoir accès au module.`} width="md">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ap-who">À qui <span className="text-destructive">*</span></Label>
            <Select id="ap-who" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">{people === null ? "Chargement…" : "— Choisir —"}</option>
              {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-label">Ce que vous demandez <span className="text-destructive">*</span></Label>
            <Input id="ap-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. la facture définitive de l'agence, signée" />
            <p className="text-xs text-muted-foreground">
              Dites-le en clair : la personne n&apos;a pas le dossier sous les yeux, « pièce n° 3 » ne lui apprend rien.
            </p>
          </div>
          {/* LA NATURE DE LA PIÈCE — et ce qu'elle entraîne, DIT AVANT l'envoi. Une facture ou
              un bon de commande acceptés rejoignent le registre des engagements (Legal) ; un
              classement qui se produit sans être annoncé se découvre par accident. */}
          <div className="space-y-1.5">
            <Label htmlFor="ap-kind">Nature de la pièce</Label>
            <Select id="ap-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {pieceKindOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            {filingNotice(kind) && <p className="text-xs text-muted-foreground">{filingNotice(kind)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-due">Pour le</Label>
            <Input id="ap-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-note">Précisions</Label>
            <Textarea id="ap-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contexte utile — où la trouver, à quoi elle sert…" />
          </div>
          {done && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
              Demande envoyée ({done}). Elle apparaît dans « Pièces demandées » de la personne.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={sending}>Fermer</Button>
            <Button
              type="button" disabled={sending || !who || !label.trim()}
              onClick={async () => {
                setSending(true); setErr(null);
                const fd = new FormData();
                fd.set("entityType", "PAYMENT_REQUEST");
                fd.set("entityId", requestId);
                fd.set("link", `/validations/paiements/${requestId}`);
                fd.set("askedToId", who);
                fd.set("label", label.trim());
                fd.set("kind", kind);
                fd.set("dueDate", due);
                fd.set("note", note);
                const r = await requestDocument(fd);
                setSending(false);
                if (!r.ok) { setErr(r.error ?? "La demande n'a pas pu être créée."); return; }
                setDone(label.trim());
                setWho(""); setLabel(""); setKind("INVOICE"); setDue(""); setNote("");
                router.refresh();
              }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer la demande
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

/** Ajouter une pièce au dossier en cours — avec sa nature et son commentaire. */
function AddPiece({ id, busy, run }: { id: string; busy: string | null; run: (k: string, f: Runner, fields: Record<string, string>, files?: Record<string, File>) => Promise<boolean> }) {
  const [kind, setKind] = React.useState("INVOICE");
  const [note, setNote] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="surface space-y-2 p-3">
      <Label>Ajouter une pièce</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select value={kind} onChange={(e) => setKind(e.target.value)}>
          {PAYMENT_PIECE_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Input className="sm:col-span-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Commentaire sur cette pièce" />
      </div>
      <input
        ref={fileRef} type="file" className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const ok = await run("add-piece", addPaymentPiece, { requestId: id, kind, note }, { file: f });
          if (ok) setNote("");
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <Button variant="outline" className="w-full" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
        {busy === "add-piece" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Choisir un fichier
      </Button>
    </div>
  );
}
