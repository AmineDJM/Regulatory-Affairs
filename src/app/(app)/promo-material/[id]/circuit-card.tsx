"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, BadgeCheck, CheckCircle2, Circle, FileCheck2, Rocket, Send, XCircle } from "lucide-react";
import {
  startPromoCircuit, markQuoteReceived, validatePromoStep, refusePromoStep, completePromoTrack,
} from "@/lib/actions/promo-circuit-actions";
import { demanderDevisPromo } from "@/lib/actions/promo-devis-actions";
import type { PromoTrack } from "@/lib/promo-material/circuit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea, Label } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { ActionResult } from "@/lib/actions/types";

/**
 * LE SUIVI DU CIRCUIT — ce que chacun voit dépend de qui il est.
 *
 * PDG et Super Admin voient la CHAÎNE ENTIÈRE : les étapes de CE dossier, où il en est, les
 * chantiers parallèles. Tous les autres ne voient que l'ÉTAPE EN COURS et une barre d'avancement :
 * un délégué n'a pas à savoir que la comptabilité a mis onze jours à signer — afficher toute la
 * chaîne à tout le monde transformerait un outil de travail en tableau de surveillance mutuelle.
 *
 * Tout arrive DÉJÀ TRANCHÉ, en props : la frise (les étapes que CE dossier traverse, selon sa
 * version — `etapesDuDossier`), les libellés, qui peut agir, ce qui manque à chaque chantier. Ce
 * composant ne décide rien : il affiche ce qu'on lui a permis d'afficher, et une règle recopiée
 * ici finirait par montrer un bouton que l'action refuse (§118.5).
 */

export interface ChantierAffiche {
  key: PromoTrack;
  label: string;
  closed: boolean;
  /** (circuit 2) Ce qui manque encore, dit par le serveur — `null` = le chantier peut se clore. */
  manque: string | null;
}

interface Props {
  id: string;
  /** L'état du circuit, ou null pour un dossier d'avant la réforme. */
  state: string | null;
  version: 1 | 2;
  /** Tranché CÔTÉ SERVEUR par seesFullCircuit — jamais recalculé ici. */
  showFull: boolean;
  /** Les étapes que CE dossier traverse, dans l'ordre (frise). */
  etapes: { key: string; label: string }[];
  stateLabel: string;
  /** L'utilisateur peut valider / refuser l'étape en cours (canValidate, côté serveur). */
  canAct: boolean;
  /** Le bouton « Valider » a-t-il sa place ici ? Au choix des lignes du circuit 2, la validation
   *  passe par la sélection (carte « Devis ») : valider sans ligne retenue ne veut rien dire. */
  validerIci: boolean;
  /** (circuit 1) Peut confirmer la réception du devis. */
  canConfirmQuote: boolean;
  /** Peut basculer un dossier d'avant la réforme sur le circuit actuel. */
  canStart: boolean;
  /** (circuit 2) Peut demander les devis au secrétariat — le demandeur, à l'étape « devis à demander ». */
  canRequestQuotes: boolean;
  /** Peut clore un chantier (pilote de l'exécution). */
  canDrive: boolean;
  chantiers: ChantierAffiche[];
  waitingLabel: string;
  progressStep: number;
  progressTotal: number;
}

function useRun() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const run = async (fn: () => Promise<ActionResult>) => {
    setSaving(true); setErr(null); setMsg(null);
    const r = await fn();
    setSaving(false);
    if (r.ok) { setMsg(r.message ?? null); router.refresh(); } else setErr(r.error ?? "Action impossible.");
  };
  return { saving, err, msg, run };
}

const Err = ({ msg }: { msg: string | null }) =>
  msg ? <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{msg}</span></div> : null;
const Ok = ({ msg }: { msg: string | null }) =>
  msg ? <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> <span>{msg}</span></div> : null;

export function PromoCircuitCard(p: Props) {
  const { saving, err, msg, run } = useRun();
  const [refusing, setRefusing] = React.useState(false);
  const fd = (extra?: Record<string, string>) => {
    const f = new FormData(); f.set("id", p.id);
    if (extra) for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  };

  // ── Dossier d'avant la réforme : proposer de basculer sur le circuit actuel. ──
  if (!p.state) {
    if (!p.canStart) return null;
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Ce dossier suit encore l&apos;ancien parcours. Le circuit actuel peut prendre le relais : validation de la
          demande (N+1, ou directrice marketing), devis demandés au secrétariat et retranscrits ligne à ligne,
          choix des lignes, Direction Marketing (et Directeur Général au-dessus du seuil), puis bons de commande
          générés, factures et paiements, et demande de visa à chaque paiement.
        </p>
        <Err msg={err} />
        <Button size="sm" onClick={() => run(() => startPromoCircuit(fd()))} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Basculer sur le circuit actuel
        </Button>
      </div>
    );
  }

  const refused = p.state === "REFUSED";
  const completed = p.state === "COMPLETED";
  const inExec = p.state === "IN_EXECUTION";
  const stepIndex = p.etapes.findIndex((e) => e.key === p.state);
  const total = Math.max(1, p.progressTotal);

  return (
    <div className="space-y-4">
      {/* La frise ENTIÈRE pour le PDG / Super Admin ; l'étape en cours pour les autres. */}
      {p.showFull ? (
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {p.etapes.filter((e) => e.key !== "COMPLETED").map((e, i) => {
            const isPast = !refused && (completed || (stepIndex >= 0 && stepIndex > i));
            const isCurrent = p.state === e.key;
            return (
              <li key={e.key} className="flex items-center gap-1">
                {i > 0 && <span className="mx-1 h-px w-4 bg-border" aria-hidden />}
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                  isCurrent ? "bg-primary/10 font-medium text-primary ring-1 ring-primary/30"
                  : isPast ? "text-muted-foreground"
                  : "text-muted-foreground/60"
                }`}>
                  {isPast ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Circle className="h-3 w-3" />}
                  {e.label}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone={refused ? "danger" : completed ? "success" : "info"}>{p.stateLabel}</Badge>
          <span className="text-xs text-muted-foreground">Étape {Math.min(p.progressStep, total)} / {total}</span>
        </div>
      )}

      <div className="space-y-1">
        <Progress value={(Math.min(p.progressStep, total) / total) * 100} />
        <p className="text-xs text-muted-foreground">En attente de : <span className="font-medium text-foreground">{p.waitingLabel}</span></p>
      </div>

      {/* Les chantiers parallèles — chacun se CONSTATE sur ses pièces : ce qui manque est dit. */}
      {(inExec || completed) && (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {p.chantiers.map((t) => {
            const closed = completed || t.closed;
            return (
              <li key={t.key} className={`space-y-2 rounded-lg border px-3 py-2 text-sm ${closed ? "border-emerald-600/30 bg-emerald-500/5" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    {closed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    {t.label}
                  </span>
                  {!closed && p.canDrive && (
                    <Button size="sm" variant="outline" onClick={() => run(() => completePromoTrack(fd({ track: t.key })))} disabled={saving || Boolean(t.manque)}>
                      Clore
                    </Button>
                  )}
                </div>
                {!closed && t.manque && <p className="text-xs text-muted-foreground">{t.manque}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <Err msg={err} />
      <Ok msg={msg} />

      {/* CIRCUIT 2 — le demandeur demande les devis au secrétariat, une fois la demande validée. */}
      {p.state === "QUOTE_TO_REQUEST" && p.canRequestQuotes && (
        <form
          action={(f: FormData) => { f.set("promoMaterialId", p.id); run(() => demanderDevisPromo(f)); }}
          className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3"
        >
          <Label htmlFor="promo-quote-note">Précisions pour le secrétariat (facultatif)</Label>
          <Textarea id="promo-quote-note" name="note" className="min-h-[60px]" placeholder="Agences à consulter, quantités, délai souhaité…" />
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Demander les devis à l&apos;assistante de direction
          </Button>
        </form>
      )}

      {/* CIRCUIT 1 — le devis est déposé comme pièce, puis confirmé. */}
      {p.version === 1 && p.state === "QUOTE_REQUESTED" && p.canConfirmQuote && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => run(() => markQuoteReceived(fd()))} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Devis reçu et déposé
          </Button>
          <span className="text-xs text-muted-foreground">Déposez d&apos;abord le devis dans les documents ci-dessous.</span>
        </div>
      )}

      {p.canAct && !refusing && (
        <div className="flex flex-wrap gap-2">
          {p.validerIci && (
            <Button size="sm" variant="success" onClick={() => run(() => validatePromoStep(fd()))} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Valider cette étape
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setRefusing(true)} disabled={saving}>
            <XCircle className="h-4 w-4" /> Refuser
          </Button>
        </div>
      )}
      {p.canAct && refusing && (
        <form
          action={(f: FormData) => { f.set("id", p.id); run(() => refusePromoStep(f)); }}
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
