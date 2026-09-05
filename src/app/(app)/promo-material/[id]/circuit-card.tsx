"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, BadgeCheck, CheckCircle2, Circle, FileCheck2, Rocket, XCircle } from "lucide-react";
import {
  startPromoCircuit, markQuoteReceived, validatePromoStep, refusePromoStep, completePromoTrack,
} from "@/lib/actions/promo-circuit-actions";
import {
  PROMO_STEPS, PROMO_STEP_LABEL, PROMO_TRACKS, PROMO_TRACK_LABEL,
  type PromoState, type PromoTrack,
} from "@/lib/promo-material/circuit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea, Label } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { ActionResult } from "@/lib/actions/types";

/**
 * LE SUIVI DU CIRCUIT COURT — ce que chacun voit dépend de qui il est.
 *
 * PDG et Super Admin voient la CHAÎNE ENTIÈRE : les cinq marches, où en est le dossier, les trois
 * chantiers parallèles. Tous les autres ne voient que l'ÉTAPE EN COURS et une barre d'avancement :
 * un délégué n'a pas à savoir que la comptabilité a mis onze jours à signer — afficher toute la
 * chaîne à tout le monde transformerait un outil de travail en tableau de surveillance mutuelle.
 * La règle vient de `seesFullCircuit` (module pur) et arrive ici DÉJÀ TRANCHÉE, en props : ce
 * composant ne décide rien, il affiche ce qu'on lui a permis d'afficher.
 */

interface Props {
  id: string;
  /** L'état du circuit court, ou null pour un dossier d'avant la réforme. */
  state: string | null;
  tracksDone: string[];
  /** Tranché CÔTÉ SERVEUR par seesFullCircuit — jamais recalculé ici. */
  showFull: boolean;
  /** L'utilisateur peut valider / refuser l'étape en cours (canValidate, côté serveur). */
  canAct: boolean;
  /** Peut confirmer la réception du devis / clore un chantier (demandeur, assistante, direction). */
  canDrive: boolean;
  waitingLabel: string;
  progressStep: number;
  progressTotal: number;
}

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

const Err = ({ msg }: { msg: string | null }) =>
  msg ? <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" /> {msg}</div> : null;

export function PromoCircuitCard({ id, state, tracksDone, showFull, canAct, canDrive, waitingLabel, progressStep, progressTotal }: Props) {
  const { saving, err, run } = useRun();
  const [refusing, setRefusing] = React.useState(false);
  const fd = (extra?: Record<string, string>) => {
    const f = new FormData(); f.set("id", id);
    if (extra) for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  };

  // ── Dossier d'avant la réforme : proposer de basculer sur le circuit court. ──
  if (!state) {
    if (!canDrive) return null;
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Ce dossier suit encore l&apos;ancien parcours. Le circuit court — devis → demandeur → N+1 →
          PDG/Super Admin → information médicale, puis bon de commande, paiement et visa <strong>en parallèle</strong> —
          peut prendre le relais.
        </p>
        <Err msg={err} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => run(() => startPromoCircuit(fd({ hasQuote: "1" })))} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Basculer (devis déjà en main)
          </Button>
          <Button size="sm" variant="outline" onClick={() => run(() => startPromoCircuit(fd()))} disabled={saving}>
            Basculer (devis à demander)
          </Button>
        </div>
      </div>
    );
  }

  const s = state as PromoState;
  const done = tracksDone as PromoTrack[];
  const refused = s === "REFUSED";
  const completed = s === "COMPLETED";
  const inExec = s === "IN_EXECUTION";
  const stepIndex = PROMO_STEPS.indexOf(s as (typeof PROMO_STEPS)[number]);

  return (
    <div className="space-y-4">
      {/* La frise ENTIÈRE pour le PDG / Super Admin ; l'étape en cours pour les autres. */}
      {showFull ? (
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {PROMO_STEPS.filter((st) => st !== "COMPLETED").map((st, i) => {
            const isPast = !refused && stepIndex > i;
            const isCurrent = s === st;
            return (
              <li key={st} className="flex items-center gap-1">
                {i > 0 && <span className="mx-1 h-px w-4 bg-border" aria-hidden />}
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                  isCurrent ? "bg-primary/10 font-medium text-primary ring-1 ring-primary/30"
                  : isPast || completed ? "text-muted-foreground"
                  : "text-muted-foreground/60"
                }`}>
                  {isPast || completed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Circle className="h-3 w-3" />}
                  {PROMO_STEP_LABEL[st]}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <Badge tone={refused ? "danger" : completed ? "success" : "info"}>{PROMO_STEP_LABEL[s]}</Badge>
          <span className="text-xs text-muted-foreground">Étape {Math.min(progressStep, progressTotal)} / {progressTotal}</span>
        </div>
      )}

      <div className="space-y-1">
        <Progress value={(Math.min(progressStep, progressTotal) / progressTotal) * 100} />
        <p className="text-xs text-muted-foreground">En attente de : <span className="font-medium text-foreground">{waitingLabel}</span></p>
      </div>

      {/* Les trois chantiers parallèles — le vrai gain du circuit court. */}
      {(inExec || completed) && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PROMO_TRACKS.map((t) => {
            const closed = completed || done.includes(t);
            return (
              <li key={t} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${closed ? "border-emerald-600/30 bg-emerald-500/5" : "border-border"}`}>
                <span className="flex items-center gap-2">
                  {closed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  {PROMO_TRACK_LABEL[t]}
                </span>
                {!closed && canDrive && (
                  <Button size="sm" variant="outline" onClick={() => run(() => completePromoTrack(fd({ track: t })))} disabled={saving}>
                    Clore
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Err msg={err} />

      {/* L'action de l'étape en cours. */}
      {s === "QUOTE_REQUESTED" && canDrive && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => run(() => markQuoteReceived(fd()))} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Devis reçu et déposé
          </Button>
          <span className="text-xs text-muted-foreground">Déposez d&apos;abord le devis dans les documents ci-dessous.</span>
        </div>
      )}

      {canAct && !refusing && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="success" onClick={() => run(() => validatePromoStep(fd()))} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Valider cette étape
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRefusing(true)} disabled={saving}>
            <XCircle className="h-4 w-4" /> Refuser
          </Button>
        </div>
      )}
      {canAct && refusing && (
        <form
          action={(f: FormData) => { f.set("id", id); run(() => refusePromoStep(f)); }}
          className="space-y-2 rounded-lg border border-destructive/30 p-3"
        >
          <Label htmlFor="promo-refuse-reason">Motif du refus</Label>
          <Textarea id="promo-refuse-reason" name="reason" required className="min-h-[60px]" placeholder="Un refus sans motif fait recommencer à l'identique." />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="destructive" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Confirmer le refus
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRefusing(false)} disabled={saving}>Annuler</Button>
          </div>
        </form>
      )}
    </div>
  );
}
