"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Check, X, AlertCircle, Send, MessageSquarePlus, DoorOpen,
  Star, StarOff, CalendarCheck, UserCheck, UserX, IdCard, Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Textarea } from "@/components/ui/input";
import { RecordForm, type FieldDef } from "@/components/shared/create-record-button";
import {
  decideRecruitmentStep, cancelRecruitmentRequest, askRecruitmentInfo, answerRecruitmentInfo,
  openRecruitmentSourcing, closeRecruitmentRequest, addRecruitmentCandidate,
  moveRecruitmentCandidate, onboardRecruitment,
} from "@/lib/actions/recruitment-actions";
import type { ActionResult } from "@/lib/actions/types";
import { useKeyedAction as useAction } from "@/components/shared/use-action";

/**
 * LES GESTES DU CIRCUIT DE RECRUTEMENT.
 *
 * Chaque bouton correspond à UNE capacité calculée par `abilities()` côté serveur et repassée
 * ici : l'écran ne décide de rien, il montre ce qui est permis. Un bouton visible correspond donc
 * toujours à une action qui aboutira — et le serveur revérifie de toute façon.
 */

/** Enveloppe commune : l'attente, l'erreur, et le rafraîchissement après succès. */

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" /> {error}
    </p>
  );
}

const fd = (entries: Record<string, string | undefined>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) if (v) f.set(k, v);
  return f;
};

// ───────────────────────────── Validation hiérarchique ─────────────────────────────

export function ChainDecisionPanel({ id, stepLabel }: { id: string; stepLabel: string }) {
  const { busy, error, run } = useAction();
  const [reason, setReason] = React.useState("");

  return (
    <div className="space-y-3 rounded-xl border border-warning/40 bg-warning/5 p-4">
      <div>
        <p className="text-sm font-semibold">Votre validation est attendue</p>
        <p className="text-xs text-muted-foreground">{stepLabel}</p>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Motif (obligatoire en cas de refus)</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. Budget non prévu cette année." className="h-9 text-sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm" disabled={busy !== null}
          onClick={() => run("ok", () => decideRecruitmentStep(fd({ id, decision: "APPROVED", reason })))}
        >
          {busy === "ok" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Valider
        </Button>
        <Button
          size="sm" variant="outline" disabled={busy !== null || !reason.trim()}
          title={reason.trim() ? undefined : "Un refus se motive — c'est ce que le demandeur lira."}
          onClick={() => run("no", () => decideRecruitmentStep(fd({ id, decision: "REJECTED", reason })))}
        >
          {busy === "no" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Refuser
        </Button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

export function CancelRequestButton({ id }: { id: string }) {
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline" size="sm" disabled={busy !== null}
        onClick={() => {
          if (!window.confirm("Retirer cette demande de recrutement ?")) return;
          void run("cancel", () => cancelRecruitmentRequest(fd({ id })));
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Retirer la demande
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ───────────────────────────── Les RH ─────────────────────────────

export function HrPanel({ id, canAsk, canOpen, canReject }: {
  id: string; canAsk: boolean; canOpen: boolean; canReject: boolean;
}) {
  const { busy, error, run } = useAction();
  const [question, setQuestion] = React.useState("");
  const [note, setNote] = React.useState("");

  return (
    <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
      <p className="text-sm font-semibold">Instruction RH</p>

      {canAsk && (
        <div className="space-y-1">
          <Label className="text-xs">Demander une précision au demandeur</Label>
          <Textarea
            value={question} onChange={(e) => setQuestion(e.target.value)} rows={2}
            placeholder="Compétences attendues ? Fourchette tenable ? Date de début ferme ?"
            className="text-sm"
          />
          <div className="flex justify-end">
            <Button
              size="sm" variant="outline" disabled={busy !== null || !question.trim()}
              onClick={async () => {
                if (await run("ask", () => askRecruitmentInfo(fd({ id, question })))) setQuestion("");
              }}
            >
              {busy === "ask" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
              Demander
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            La demande retourne au demandeur tant qu&apos;il n&apos;a pas répondu : elle quitte votre file.
          </p>
        </div>
      )}

      {(canOpen || canReject) && (
        <div className="space-y-1 border-t border-border pt-3">
          <Label className="text-xs">Décision</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (motif de refus, conditions…)" className="h-9 text-sm" />
          <div className="flex flex-wrap gap-2 pt-1">
            {canOpen && (
              <Button size="sm" disabled={busy !== null} onClick={() => run("open", () => openRecruitmentSourcing(fd({ id })))}>
                {busy === "open" ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
                Ouvrir le poste
              </Button>
            )}
            {canReject && (
              <Button
                size="sm" variant="outline" disabled={busy !== null || !note.trim()}
                title={note.trim() ? undefined : "Un refus se motive."}
                onClick={() => run("rej", () => closeRecruitmentRequest(fd({ id, decision: "REJECTED", note })))}
              >
                {busy === "rej" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Refuser
              </Button>
            )}
          </div>
        </div>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

export function AnswerInfoForm({ id, infoId }: { id: string; infoId: string }) {
  const { busy, error, run } = useAction();
  const [answer, setAnswer] = React.useState("");
  return (
    <div className="mt-2 space-y-1">
      <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} placeholder="Votre réponse…" className="text-sm" />
      <div className="flex justify-end">
        <Button
          size="sm" disabled={busy !== null || !answer.trim()}
          onClick={async () => {
            if (await run("a", () => answerRecruitmentInfo(fd({ id, infoId, answer })))) setAnswer("");
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Répondre
        </Button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

// ───────────────────────────── Les candidats ─────────────────────────────

export function AddCandidateButton({ requestId }: { requestId: string }) {
  const [open, setOpen] = React.useState(false);
  const fields: FieldDef[] = [
    { type: "hidden", name: "requestId", value: requestId },
    { type: "text", name: "fullName", label: "Nom et prénom", required: true, full: true },
    { type: "text", name: "email", label: "Courriel" },
    { type: "text", name: "phone", label: "Téléphone" },
    { type: "text", name: "source", label: "Origine", placeholder: "Candidature spontanée, cabinet, cooptation…" },
    { type: "textarea", name: "notes", label: "Notes", full: true },
    { type: "file", name: "attachment", label: "CV et pièces", multiple: true, full: true, hint: "Le CV reste rattaché à CETTE personne." },
  ];

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Déposer un CV</Button>
      <Sheet
        open={open} onClose={() => setOpen(false)} width="lg"
        title="Déposer un CV reçu"
        description="Le demandeur sera prévenu : c'est lui qui présélectionne."
      >
        <RecordForm
          fields={fields}
          action={addRecruitmentCandidate}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
          submitLabel="Enregistrer le candidat"
        />
      </Sheet>
    </>
  );
}

export function CandidateActions({ candidateId, status, can }: {
  candidateId: string;
  status: string;
  can: { shortlist: boolean; select: boolean; interview: boolean; hire: boolean };
}) {
  const { busy, error, run } = useAction();
  const move = (m: string, extra: Record<string, string> = {}) =>
    run(m, () => moveRecruitmentCandidate(fd({ candidateId, move: m, ...extra })));

  const done = status === "HIRED" || status === "DECLINED";
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {can.shortlist && !done && status !== "SHORTLISTED" && status !== "SELECTED" && (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => move("SHORTLIST")}>
            {busy === "SHORTLIST" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
            Présélectionner
          </Button>
        )}
        {can.shortlist && status === "SHORTLISTED" && (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => move("UNSHORTLIST")}>
            {busy === "UNSHORTLIST" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StarOff className="h-3.5 w-3.5" />}
            Retirer
          </Button>
        )}
        {/* Le PDG retient un candidat PRÉSÉLECTIONNÉ OU NON : la présélection est un avis, pas un
            tri éliminatoire opposable au dernier décideur. */}
        {can.select && !done && (status === "RECEIVED" || status === "SHORTLISTED") && (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => move("SELECT")}>
            {busy === "SELECT" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
            Retenir
          </Button>
        )}
        {can.interview && !done && status !== "INTERVIEWED" && (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => move("INTERVIEW")}>
            {busy === "INTERVIEW" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
            Entretien passé
          </Button>
        )}
        {can.hire && !done && (
          <Button size="sm" disabled={busy !== null} onClick={() => move("HIRE")}>
            {busy === "HIRE" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Recruter
          </Button>
        )}
        {(can.shortlist || can.select || can.interview) && !done && (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => move("DECLINE")}>
            {busy === "DECLINE" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
            Écarter
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ───────────────────────────── L'intégration ─────────────────────────────

export function OnboardPanel({ id, hiredName, external }: {
  id: string; hiredName: string; external: boolean;
}) {
  const { busy, error, run } = useAction();
  return (
    <div className="space-y-2 rounded-xl border border-success/40 bg-success/5 p-4">
      <p className="text-sm font-semibold">{hiredName} est recruté</p>
      <p className="text-xs text-muted-foreground">
        {external
          ? "Consulting : intervenant EXTERNE. Aucune fiche employé n'est créée — il n'entre ni dans l'effectif, ni dans la paie, ni dans l'organigramme."
          : "Créez la fiche employé : elle sera pré-remplie depuis la demande (poste, direction, contrat, dates) et depuis le candidat. Le salaire réel et le compte applicatif se complètent ensuite depuis les RH."}
      </p>
      <Button size="sm" disabled={busy !== null} onClick={() => run("on", () => onboardRecruitment(fd({ id })))}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <IdCard className="h-4 w-4" />}
        {external ? "Clôturer — consultant externe" : "Créer la fiche employé"}
      </Button>
      <ErrorLine error={error} />
    </div>
  );
}

export function CloseRequestButton({ id }: { id: string }) {
  const { busy, error, run } = useAction();
  const [note, setNote] = React.useState("");
  return (
    <div className="space-y-1.5 rounded-xl border border-border p-3">
      <Label className="text-xs">Clôturer sans suite</Label>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motif (poste abandonné, gel des embauches…)" className="h-9 text-sm" />
      <Button
        size="sm" variant="outline" disabled={busy !== null || !note.trim()}
        onClick={() => run("close", () => closeRecruitmentRequest(fd({ id, note })))}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Clôturer
      </Button>
      <ErrorLine error={error} />
    </div>
  );
}
