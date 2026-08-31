"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, Check, X, RotateCcw, PauseCircle, PlayCircle, Send, Plus, ShieldCheck,
  MessageSquare, Download, Paperclip, FileQuestion, Gavel, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileGlyph } from "@/components/drive/file-glyph";
import { PAYMENT_PIECE_STATUS, PAYMENT_PIECE_KIND, PAYMENT_PIECE_KIND_OPTIONS, VALIDATION_STATUS } from "@/lib/labels";
import { needsReplacement, tallyPieces } from "@/lib/finance/payment-request";
import {
  addPaymentPiece, commentPaymentPiece, reviewPaymentPiece, addPaymentComment,
  submitPaymentRequest, decidePaymentRequest, cancelPaymentRequest, askPaymentValidation,
  askPieceValidation,
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
}: {
  id: string;
  reference: string;
  status: string;
  isRequester: boolean;
  isFinance: boolean;
  pieces: PieceView[];
  events: EventView[];
  people: { id: string; name: string }[];
  canApproveNow: boolean;
  approveBlocker: string | null;
  resubmitBlocker: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [askOpen, setAskOpen] = React.useState(false);
  const [askPieces, setAskPieces] = React.useState<Set<string>>(new Set());
  const [validator, setValidator] = React.useState("");

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

      {/* ───────────── Les gestes ───────────── */}
      {open && (isRequester || isFinance) && (
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
                <Button variant="outline" disabled={busy !== null} onClick={() => setAskOpen((v) => !v)}>
                  <ShieldCheck className="h-4 w-4" /> Demander une validation
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

          {/* Les Finances ne tranchent pas seules au-delà de leur seuil : elles font valider, et
              elles disent SUR QUOI — un validateur qui reçoit « valider PAY-2026-014 » sans savoir
              quelles pièces sont en cause rouvre tout le dossier pour rien. */}
          {isFinance && askOpen && (
            <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <Label>Validateur</Label>
              <Select value={validator} onChange={(e) => setValidator(e.target.value)}>
                <option value="">— Choisir —</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              <p className="text-xs text-muted-foreground">Pièces visées (aucune cochée = dossier complet)</p>
              <div className="max-h-40 space-y-1 overflow-auto rounded-lg bg-background p-2">
                {pieces.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary">
                    <input
                      type="checkbox" className="h-4 w-4 rounded border-input"
                      checked={askPieces.has(p.id)}
                      onChange={() => setAskPieces((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                    />
                    <span className="truncate">{PAYMENT_PIECE_KIND[p.kind] ?? p.kind} — {p.name}</span>
                  </label>
                ))}
              </div>
              <Button
                disabled={busy !== null || !validator}
                onClick={async () => {
                  setBusy("ask"); setErr(null);
                  const fd = new FormData();
                  fd.set("id", id); fd.set("validatorId", validator); fd.set("note", note);
                  for (const pid of askPieces) fd.append("pieceId", pid);
                  const r = await askPaymentValidation(fd);
                  setBusy(null);
                  if (!r.ok) { setErr(r.error ?? "Échec."); return; }
                  setAskOpen(false); setAskPieces(new Set()); setValidator(""); setNote("");
                  router.refresh();
                }}
              >
                {busy === "ask" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Envoyer la demande de validation
              </Button>
            </div>
          )}
        </section>
      )}

      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
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
            {/* FAIRE VALIDER CETTE PIÈCE — et elle part AU CENTRE, pas à quelqu'un qu'on choisit.
                Choisir son validateur dans une liste, c'est choisir qui vous dit oui ; et une
                demande qui dit « valider PAY-2026-014 » sans nommer la pièce en cause fait
                rouvrir un dossier de six pièces, ou signer sans lire. */}
            {piece.validation?.status === "PENDING" ? (
              <span className="self-center text-xs text-muted-foreground">Déjà au centre de validations.</span>
            ) : (
              <Button
                size="sm" variant="outline" disabled={busy !== null}
                title="Envoyer cette pièce au centre de validations (Directeur Général)"
                onClick={() => void run(`val-${piece.id}`, askPieceValidation, { pieceId: piece.id, note: review })}
              >
                {busy === `val-${piece.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gavel className="h-3.5 w-3.5" />} Faire valider
              </Button>
            )}
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
  const [due, setDue] = React.useState("");
  const [note, setNote] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);

  const ouvrir = async () => {
    setOpen(true); setErr(null); setDone(null);
    setWho(""); setLabel(""); setDue(""); setNote("");
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
                fd.set("dueDate", due);
                fd.set("note", note);
                const r = await requestDocument(fd);
                setSending(false);
                if (!r.ok) { setErr(r.error ?? "La demande n'a pas pu être créée."); return; }
                setDone(label.trim());
                setWho(""); setLabel(""); setDue(""); setNote("");
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
