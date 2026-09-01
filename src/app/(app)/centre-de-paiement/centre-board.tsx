"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldX, MessageSquare, Coins, Loader2, Send, ChevronDown, Paperclip } from "lucide-react";
import { decidePayment, respondToPaymentCentre } from "@/lib/actions/payment-centre-actions";
import {
  CENTRAL_STATUS_LABEL, CENTRAL_DECISION_LABEL, awaitsCentre, awaitsRequester,
  type CentralStatus, type CentralDecision,
} from "@/lib/payments/authorization";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/lib/labels";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { ItemAskPanel } from "@/components/ad-pro/item-ask-panel";

export interface CentreMessage {
  id: string;
  decision: string | null;
  body: string;
  author: string | null;
  createdAt: string;
}

export interface CentreOrder {
  id: string;
  reference: string;
  label: string;
  beneficiary: string | null;
  amount: number;
  proposedAmount: number | null;
  centralStatus: CentralStatus;
  requestedBy: string | null;
  companyLabel: string | null;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  /** L'échéance DEMANDÉE par le demandeur — un souhait, formé sans voir la trésorerie. */
  dueDate: string | null;
  /**
   * LE DOSSIER DE LA DEMANDE, quand l'ordre est né d'une demande de paiement : son montant, ses
   * pièces, son fil. Autoriser une sortie d'argent sans pouvoir ouvrir la facture, c'est
   * autoriser une ligne de tableau.
   */
  dossierHref: string | null;
  /** L'origine de la dépense en clair (« Demande administrative », « Avance sur salaire »…). */
  sourceLabel: string | null;
  messages: CentreMessage[];
  /** L'utilisateur courant est-il le demandeur ? Il peut alors répondre et resoumettre. */
  isMine: boolean;
}

const TONE: Record<CentralStatus, BadgeTone> = {
  NOT_REQUIRED: "neutral",
  AWAITING: "warning",
  CHANGES_REQUESTED: "info",
  INFO_REQUESTED: "info",
  APPROVED: "success",
  REFUSED: "danger",
};

/**
 * LE CENTRE DE PAIEMENT — ce que le PDG voit avant que l'argent sorte.
 *
 * Une file par entité : « autoriser un paiement d'Adventum » et « autoriser un paiement de
 * Pharmagène » sont deux gestes comptablement distincts, et les mélanger dans une seule liste fait
 * perdre de vue combien chaque société engage.
 *
 * Quatre issues, pas deux. Un refus sec oblige à tout refaire et fait perdre la discussion ; le
 * centre peut aussi demander une RÉVISION DU MONTANT ou une ARGUMENTATION, et le demandeur répond
 * dans le même fil — autant d'allers-retours qu'il en faut.
 */
export function CentreBoard({ orders, canDecide }: { orders: CentreOrder[]; canDecide: boolean }) {
  const router = useRouter();
  const [acting, setActing] = React.useState<{ order: CentreOrder; decision: CentralDecision } | null>(null);
  const [replying, setReplying] = React.useState<CentreOrder | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Par ENTITÉ — un centre par société, comme demandé.
  const groups = React.useMemo(() => {
    const map = new Map<string, CentreOrder[]>();
    for (const o of orders) {
      const key = o.companyLabel ?? "Sans entité";
      map.set(key, [...(map.get(key) ?? []), o]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [orders]);

  if (orders.length === 0) {
    return (
      <EmptyState
        icon="ShieldCheck"
        title="Aucun paiement en attente d'autorisation"
        description="Les paiements au-dessus du seuil arrivent ici avant d'atteindre les Finances. Au-dessous, ils suivent le circuit habituel."
      />
    );
  }

  return (
    <div className="space-y-5">
      {groups.map(([company, list]) => {
        const waiting = list.filter((o) => awaitsCentre(o.centralStatus));
        const total = waiting.reduce((a, o) => a + o.amount, 0);
        return (
          <section key={company} className="surface space-y-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Coins className="h-4 w-4 text-primary" /> {company}
                <span className="text-xs font-normal text-muted-foreground">({list.length})</span>
              </h2>
              {waiting.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-warning">{formatCurrency(total)}</span> en attente d&apos;autorisation
                </p>
              )}
            </div>

            <ul className="divide-y divide-border">
              {list.map((o) => {
                const isOpen = open === o.id;
                return (
                  <li key={o.id} className="py-2.5">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          <span className="truncate">{o.label}</span>
                          <Badge tone={TONE[o.centralStatus]}>{CENTRAL_STATUS_LABEL[o.centralStatus]}</Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {o.reference} · {o.beneficiary ?? "bénéficiaire non précisé"} · demandé par {o.requestedBy ?? "—"} · {formatDateTime(o.createdAt)}
                        </p>
                        {o.proposedAmount != null && (
                          <p className="text-xs text-info">
                            Montant proposé par le centre : {formatCurrency(o.proposedAmount)}
                          </p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(o.amount)}</p>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {o.messages.length > 0 && (
                        <button
                          type="button" onClick={() => setOpen(isOpen ? null : o.id)}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary"
                        >
                          <MessageSquare className="h-3 w-3" /> {o.messages.length} échange{o.messages.length > 1 ? "s" : ""}
                          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                      )}

                      {/* OUVRIR EST UNE LECTURE, PAS UN POUVOIR DE DÉCISION.
                          Ce lien vivait à l'intérieur du bloc « je peux encore décider » : une
                          fois le paiement autorisé ou refusé, plus personne ne pouvait rouvrir ce
                          qui l'avait justifié — et le DEMANDEUR, lui, n'y avait jamais eu droit,
                          alors que c'est son propre dossier. On lit ce qu'on voit, à tout état. */}
                      {o.dossierHref ? (
                        <Link
                          href={o.dossierHref}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-sm font-medium hover:bg-secondary"
                        >
                          <Paperclip className="h-4 w-4" /> Ouvrir le dossier &amp; ses pièces
                        </Link>
                      ) : (
                        // Le silence laisse croire à une panne : on clique, rien ne se passe, on
                        // recommence. On nomme donc l'origine et l'on dit qu'elle n'a pas de fiche.
                        <span className="text-xs text-muted-foreground">
                          {o.sourceLabel ? `${o.sourceLabel} — pas de fiche à ouvrir` : "Pas de fiche à ouvrir"}
                        </span>
                      )}

                      {canDecide && awaitsCentre(o.centralStatus) && (
                        <>
                          {/* RÉCLAMER CE QUI MANQUE plutôt que refuser faute de pièce : la
                              demande atterrit dans « Pièces demandées » de la personne, avec son
                              fil — elle dépose sans qu'on lui ouvre le module. */}
                          <ItemAskPanel
                            entityType="EXPENSE_ORDER"
                            entityId={o.id}
                            link="/centre-de-paiement"
                            subject={`${o.reference} — ${o.label}`}
                          />
                          <Button size="sm" onClick={() => { setErr(null); setActing({ order: o, decision: "APPROVE" }); }}>
                            <ShieldCheck className="h-4 w-4" /> Autoriser
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setErr(null); setActing({ order: o, decision: "REQUEST_CHANGES" }); }}>
                            Réviser le montant
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setErr(null); setActing({ order: o, decision: "REQUEST_INFO" }); }}>
                            Demander une argumentation
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => { setErr(null); setActing({ order: o, decision: "REFUSE" }); }}>
                            <ShieldX className="h-4 w-4" /> Refuser
                          </Button>
                        </>
                      )}

                      {/* LE DEMANDEUR RÉPOND — c'est ce qui rend les allers-retours possibles. */}
                      {o.isMine && awaitsRequester(o.centralStatus) && (
                        <Button size="sm" onClick={() => { setErr(null); setReplying(o); }}>
                          <Send className="h-4 w-4" /> Répondre et resoumettre
                        </Button>
                      )}
                    </div>

                    {isOpen && (
                      <ul className="mt-2 space-y-1.5 border-l-2 border-border pl-3">
                        {o.messages.map((m) => (
                          <li key={m.id} className="text-xs">
                            <p className="text-muted-foreground">
                              <span className="font-medium text-foreground">{m.author ?? "—"}</span>
                              {m.decision && ` · ${CENTRAL_DECISION_LABEL[m.decision as CentralDecision] ?? m.decision}`}
                              {" · "}{formatDateTime(m.createdAt)}
                            </p>
                            <p className="whitespace-pre-wrap">{m.body}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {acting && (
        <Sheet
          open onClose={() => !busy && setActing(null)} width="md"
          title={CENTRAL_DECISION_LABEL[acting.decision]}
          description={`${acting.order.reference} — ${acting.order.label} (${formatCurrency(acting.order.amount)})`}
        >
          <form
            action={async (fd) => {
              setBusy(true); setErr(null);
              fd.set("id", acting.order.id);
              fd.set("decision", acting.decision);
              const r = await decidePayment(fd);
              setBusy(false);
              if (r.ok) { setActing(null); router.refresh(); } else setErr(r.error ?? "Échec.");
            }}
            className="space-y-4"
          >
            {acting.decision === "APPROVE" && (
              <div className="space-y-1.5">
                <Label htmlFor="pc-due">Échéance imposée aux Finances</Label>
                <Input id="pc-due" name="dueDate" type="date" defaultValue={acting.order.dueDate?.slice(0, 10) ?? ""} />
                <p className="text-xs text-muted-foreground">
                  {acting.order.dueDate
                    ? <>Le demandeur a souhaité le <strong>{formatDate(acting.order.dueDate)}</strong>. Vous voyez la file entière : c&apos;est vous qui arbitrez.</>
                    : <>Aucune échéance demandée. Laissez vide si rien ne presse — une date posée est une date que la comptabilité doit tenir.</>}
                </p>
              </div>
            )}
            {acting.decision === "REQUEST_CHANGES" && (
              <div className="space-y-1.5">
                <Label htmlFor="pc-amount">Montant que vous proposez de retenir</Label>
                <Input id="pc-amount" name="proposedAmount" type="number" step="0.01" min="0" placeholder={String(acting.order.amount)} />
                <p className="text-xs text-muted-foreground">
                  Une proposition, pas une réécriture : c&apos;est au demandeur de corriger et de resoumettre.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pc-body">
                {acting.decision === "APPROVE" ? "Note (facultative)" : "Motif"}
                {acting.decision !== "APPROVE" && <span className="ml-0.5 text-destructive">*</span>}
              </Label>
              <Textarea
                id="pc-body" name="body" rows={3}
                required={acting.decision !== "APPROVE"}
                placeholder={
                  acting.decision === "REFUSE" ? "Pourquoi ce paiement ne doit pas partir…"
                    : acting.decision === "REQUEST_CHANGES" ? "Ce qui justifie une révision du montant…"
                      : acting.decision === "REQUEST_INFO" ? "Ce que vous voulez voir argumenté…"
                        : "À quelles conditions vous autorisez…"
                }
              />
            </div>
            {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setActing(null)} disabled={busy}>Annuler</Button>
              <Button type="submit" disabled={busy} variant={acting.decision === "REFUSE" ? "destructive" : "primary"}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} {CENTRAL_DECISION_LABEL[acting.decision]}
              </Button>
            </div>
          </form>
        </Sheet>
      )}

      {replying && (
        <Sheet
          open onClose={() => !busy && setReplying(null)} width="md"
          title="Répondre au centre de paiement"
          description={`${replying.reference} — ${replying.label}. Votre réponse renvoie le dossier au centre.`}
        >
          <form
            action={async (fd) => {
              setBusy(true); setErr(null);
              fd.set("id", replying.id);
              const r = await respondToPaymentCentre(fd);
              setBusy(false);
              if (r.ok) { setReplying(null); router.refresh(); } else setErr(r.error ?? "Échec.");
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="pc-reply">Votre réponse</Label>
              <Textarea id="pc-reply" name="body" rows={4} required placeholder="Votre argumentation, ou le montant corrigé et ce qui le justifie…" />
            </div>
            {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReplying(null)} disabled={busy}>Annuler</Button>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer</Button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  );
}
