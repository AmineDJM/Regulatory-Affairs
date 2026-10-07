"use client";

import * as React from "react";
import { Loader2, AlertCircle, BadgeCheck, CheckCircle2, Circle, Clock, FileCheck2, Rocket, XCircle, Undo2, RotateCcw } from "lucide-react";
import {
  startPromoCircuit, markQuoteReceived, validatePromoStep, refusePromoStep, completePromoTrack,
  renvoyerPromoStep, resoumettrePromoDemande,
} from "@/lib/actions/promo-circuit-actions";
import type { PromoTrack } from "@/lib/promo-material/circuit";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { InfoBulle } from "@/components/ui/info-bulle";
import type { ActionResult } from "@/lib/actions/types";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { BoutonDecisif } from "@/components/ui/bouton-decisif";

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
  /** Peut clore un chantier (pilote de l'exécution). */
  canDrive: boolean;
  /** Le renvoi pour correction en cours (§118.190) — affiché à tous, pour que personne ne cherche
   *  pourquoi le dossier est revenu en arrière. */
  renvoi: { depuis: string; quand: string; motif: string } | null;
  /** Les trois issues d'une validation, tranchées CÔTÉ SERVEUR par les mêmes règles que les actions. */
  canRenvoyer: boolean;
  canRefuser: boolean;
  /** Le demandeur peut resoumettre la demande corrigée (validation de la demande renvoyée). */
  canResoumettre: boolean;
  chantiers: ChantierAffiche[];
  waitingLabel: string;
  progressStep: number;
  progressTotal: number;
}

function useRun() {
  // LE RAFRAÎCHISSEMENT SUIVI (§118.172) : tant que les nouvelles données ne sont pas là, l'écran montre
  // l'état d'avant — renvoyer, valider ou resoumettre dessus agirait deux fois. Les gestes restent
  // fermés jusqu'à la fin du rafraîchissement.
  const { enCours, rafraichir } = useRafraichir();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  /** `apres` referme le formulaire du geste qui vient d'aboutir : resté ouvert, il offrirait un second
   *  envoi que l'action refuserait — un bouton offert puis refusé n'est pas un geste (§118.83). */
  const run = async (fn: () => Promise<ActionResult>, apres?: () => void) => {
    setSaving(true); setErr(null); setMsg(null);
    const r = await fn();
    setSaving(false);
    if (r.ok) { setMsg(r.message ?? null); apres?.(); rafraichir(); } else setErr(r.error ?? "Action impossible.");
  };
  return { saving: saving || enCours, err, msg, run };
}

const Err = ({ msg }: { msg: string | null }) =>
  msg ? <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{msg}</span></div> : null;
const Ok = ({ msg }: { msg: string | null }) =>
  msg ? <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> <span>{msg}</span></div> : null;

export function PromoCircuitCard(p: Props) {
  const { saving, err, msg, run } = useRun();
  const [mode, setMode] = React.useState<null | "renvoi" | "refus">(null);
  const [motif, setMotif] = React.useState("");
  const [correction, setCorrection] = React.useState("");
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
        <Err msg={err} />
        <div className="flex flex-wrap items-center gap-2">
          <BoutonDecisif size="sm" onClick={() => run(() => startPromoCircuit(fd()))} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Basculer sur le circuit actuel
          </BoutonDecisif>
          <InfoBulle align="left" label="Ce que fait la bascule">
            Ce dossier suit encore l&apos;ancien parcours. Le circuit actuel prend le relais : validation de la demande,
            devis demandés au secrétariat et retranscrits, choix des lignes, Direction Marketing (et Directeur Général
            au-dessus du seuil), puis bons de commande, factures, paiements et visa.
          </InfoBulle>
        </div>
      </div>
    );
  }

  const refused = p.state === "REFUSED";
  const completed = p.state === "COMPLETED";
  const inExec = p.state === "IN_EXECUTION";
  const stepIndex = p.etapes.findIndex((e) => e.key === p.state);
  const total = Math.max(1, p.progressTotal);

  return (
    <div className="space-y-3">
      {/* La frise ENTIÈRE pour le PDG / Super Admin — une barre horizontale qui défile dans son propre
          conteneur au téléphone ; l'avancement seul pour les autres. Le statut est déjà dans l'en-tête. */}
      {p.showFull ? (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <ol className="flex w-max items-center gap-1">
            {p.etapes.filter((e) => e.key !== "COMPLETED").map((e, i) => {
              const isPast = !refused && (completed || (stepIndex >= 0 && stepIndex > i));
              const isCurrent = p.state === e.key;
              return (
                <li key={e.key} className="flex shrink-0 items-center gap-1" aria-current={isCurrent ? "step" : undefined}>
                  {i > 0 && <span className={`h-px w-3 ${isPast || isCurrent ? "bg-emerald-500/50" : "bg-border"}`} aria-hidden />}
                  <span className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${
                    isCurrent ? "bg-blue-500/10 font-medium text-blue-700 ring-1 ring-blue-500/30 dark:text-blue-300"
                    : isPast ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground/70"
                  }`}>
                    {isPast ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      : isCurrent ? <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      : <Circle className="h-3 w-3" />}
                    {e.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <Progress value={(Math.min(p.progressStep, total) / total) * 100} />
      )}

      {/* UNE phrase : où en est le dossier, et chez qui. */}
      <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span className="flex min-w-0 items-start gap-1.5 [overflow-wrap:anywhere]">
          {refused ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            : completed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />}
          {p.waitingLabel}
        </span>
        {!p.showFull && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">Étape {Math.min(p.progressStep, total)} / {total}</span>}
      </p>

      {/* Les chantiers parallèles — chacun se CONSTATE sur ses pièces : ce qui manque est dit. */}
      {(inExec || completed) && (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {p.chantiers.map((t) => {
            const closed = completed || t.closed;
            return (
              <li key={t.key} className={`space-y-2 rounded-lg border px-3 py-2 text-sm ${closed ? "border-emerald-600/30 bg-emerald-500/5" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {closed ?<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    {t.label}
                  </span>
                  {!closed && p.canDrive && (
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => run(() => completePromoTrack(fd({ track: t.key })))} disabled={saving || Boolean(t.manque)}>
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

      {/* CIRCUIT 2 — LA DEMANDE DE DEVIS PART D'ELLE-MÊME (§118.204) : à la création, ou à la validation de
          la demande. Son aperçu, ses précisions et, au besoin, son envoi vivent dans « Articles demandés » —
          plus de bouton « Demander les devis » ni de champ de précisions séparé ici. */}
      {/* CIRCUIT 1 — le devis est déposé comme pièce, puis confirmé. */}
      {p.version === 1 && p.state === "QUOTE_REQUESTED" && p.canConfirmQuote && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => run(() => markQuoteReceived(fd()))} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Devis reçu et déposé
          </Button>
          <span className="text-xs text-muted-foreground">Déposez d&apos;abord le devis dans les documents ci-dessous.</span>
        </div>
      )}

      {/* LE RENVOI POUR CORRECTION (§118.190) — dit à tous, avec son motif. */}
      {p.renvoi && (
        <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm [overflow-wrap:anywhere]">
          <span className="font-medium">À corriger</span> — renvoyé à l&apos;étape « {p.renvoi.depuis} » le {p.renvoi.quand} : « {p.renvoi.motif} »
        </div>
      )}
      {p.canResoumettre && (
        <form
          action={(f: FormData) => { f.set("id", p.id); run(() => resoumettrePromoDemande(f), () => setCorrection("")); }}
          className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3"
        >
          <Label htmlFor="promo-resoumission">Ce qui a changé</Label>
          <Textarea id="promo-resoumission" name="note" value={correction} onChange={(e) => setCorrection(e.target.value)} className="min-h-[60px]" placeholder="Ex. quantités revues, article ajouté, précision du brief." />
          <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={saving || !correction.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Resoumettre la demande
          </Button>
        </form>
      )}

      {/* LES TROIS ISSUES — valider, renvoyer pour correction, refuser (audit 360°, R05). */}
      {mode === null && ((p.canAct && p.validerIci) || p.canRenvoyer || p.canRefuser) && (
        <div className="flex flex-wrap gap-2">
          {p.canAct && p.validerIci && (
            <BoutonDecisif size="sm" variant="success" onClick={() => run(() => validatePromoStep(fd()))} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Valider cette étape
            </BoutonDecisif>
          )}
          {p.canRenvoyer && (
            <Button size="sm" variant="outline" onClick={() => setMode("renvoi")} disabled={saving}>
              <Undo2 className="h-4 w-4" /> Renvoyer pour correction
            </Button>
          )}
          {p.canRefuser && (
            <Button size="sm" variant="outline" onClick={() => setMode("refus")} disabled={saving}>
              <XCircle className="h-4 w-4" /> Refuser
            </Button>
          )}
        </div>
      )}
      {mode === "renvoi" && p.canRenvoyer && (
        <form
          action={(f: FormData) => { f.set("id", p.id); run(() => renvoyerPromoStep(f), () => { setMode(null); setMotif(""); }); }}
          className="space-y-2 rounded-lg border border-amber-500/40 p-3"
        >
          <Label htmlFor="promo-renvoi-motif">Ce qu&apos;il faut corriger</Label>
          <Textarea id="promo-renvoi-motif" name="motif" value={motif} onChange={(e) => setMotif(e.target.value)} className="min-h-[60px]" placeholder="Ex. retenez plutôt le devis de l'imprimeur B, moins cher à qualité égale." />
          <div className="flex flex-wrap gap-2">
            <BoutonDecisif type="submit" size="sm" disabled={saving || !motif.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Renvoyer au demandeur
            </BoutonDecisif>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)} disabled={saving}>Annuler</Button>
          </div>
        </form>
      )}
      {mode === "refus" && p.canRefuser && (
        <form
          action={(f: FormData) => { f.set("id", p.id); run(() => refusePromoStep(f), () => { setMode(null); setMotif(""); }); }}
          className="space-y-2 rounded-lg border border-destructive/30 p-3"
        >
          <Label htmlFor="promo-refuse-reason">Motif du refus</Label>
          <Textarea id="promo-refuse-reason" name="reason" value={motif} onChange={(e) => setMotif(e.target.value)} className="min-h-[60px]" placeholder="Un refus est définitif : pour une correction, renvoyez plutôt le dossier." />
          <div className="flex flex-wrap gap-2">
            <BoutonDecisif type="submit" size="sm" variant="destructive" disabled={saving || !motif.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Confirmer le refus
            </BoutonDecisif>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)} disabled={saving}>Annuler</Button>
          </div>
        </form>
      )}
    </div>
  );
}
