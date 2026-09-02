"use client";

import * as React from "react";
import Link from "next/link";
import { ItemAskPanel } from "@/components/ad-pro/item-ask-panel";
import { useRouter } from "next/navigation";
import { Loader2, Banknote, CalendarClock, RotateCcw, AlertCircle, FileText, Lock } from "lucide-react";
import { settleExpenseOrder, deferExpenseOrder, resumeExpenseOrder, requestInvoice } from "@/lib/actions/expense-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { DocumentUpload } from "@/components/documents/document-upload";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FINANCE_CATEGORY } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";
import { settlementState, deferralNote, SETTLEMENT_LABEL, type SettlementState } from "@/lib/finance/settlement";
import { deadlineNatureLabel, deadlineNatureOf, deferralWarning } from "@/lib/finance/deadline-nature";
import type { ActionResult } from "@/lib/actions/types";

export interface OrderRow {
  id: string;
  reference: string;
  label: string;
  beneficiary: string | null;
  category: string;
  amount: number;
  status: string;
  requestedBy: string | null;
  createdAt: string;
  requiresInvoice: boolean;
  hasInvoice: boolean;
  /** L'échéance demandée, et CE QU'ELLE PÈSE — les deux, ou la date ne dit qu'à moitié. */
  dueDate: string | null;
  deadlineNature: string | null;
  /** Le report en cours, s'il y en a un. */
  deferredUntil: string | null;
  deferredReason: string | null;
  /**
   * LE DOSSIER DE LA DEMANDE DE PAIEMENT, quand l'ordre en vient : son montant, SES PIÈCES, son
   * fil. C'est là qu'on va voir la facture — pas dans la demande SOURCE, qui appartient à un
   * autre module et à d'autres droits.
   */
  dossierHref: string | null;
}

/** Facture obligatoire : joindre la facture à l'ordre, ou la demander au demandeur. */
function InvoiceControl({ id, hasInvoice }: { id: string; hasInvoice: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  if (hasInvoice) {
    return <span className="inline-flex items-center gap-1 rounded-md border border-success/30 px-2 py-1 text-xs font-medium text-success"><FileText className="h-3.5 w-3.5" /> Facture</span>;
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-warning/50 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/10">
        <AlertCircle className="h-3.5 w-3.5" /> Facture requise
      </button>
      <Sheet open={open} onClose={() => { setOpen(false); router.refresh(); }} title="Facture obligatoire" description="Joignez la facture pour pouvoir régler cet ordre, ou demandez-la au demandeur." width="md">
        <div className="space-y-4">
          <DocumentUpload entityType="EXPENSE_ORDER" entityId={id} categories={["INVOICE", "OTHER"]} />
          <div className="flex items-center justify-between border-t border-border pt-3">
            <SubmitForm action={requestInvoice} id={id}><MiniBtn tone="purple"><AlertCircle className="h-3.5 w-3.5" /> Demander la facture</MiniBtn></SubmitForm>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); router.refresh(); }}>Fermer</Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

function SubmitForm({ action, id, extra, children, className }: { action: (fd: FormData) => Promise<ActionResult>; id: string; extra?: Record<string, string>; children: React.ReactNode; className?: string }) {
  const [saving, setSaving] = React.useState(false);
  return (
    <form action={async (fd) => { setSaving(true); fd.set("id", id); if (extra) for (const k in extra) fd.set(k, extra[k]); await action(fd); setSaving(false); }} className={className ?? "inline"}>
      {saving ? <span className="inline-flex items-center"><Loader2 className="h-3.5 w-3.5 animate-spin" /></span> : children}
    </form>
  );
}

function MiniBtn({ tone = "default", children }: { tone?: "success" | "warning" | "default" | "purple"; children: React.ReactNode }) {
  const cls = {
    success: "border-success/30 text-success hover:bg-success/10",
    warning: "border-warning/50 text-warning hover:bg-warning/10",
    purple: "border-purple-400/40 text-purple-600 hover:bg-purple-500/10",
    default: "border-border text-foreground hover:bg-secondary",
  }[tone];
  return <button type="submit" className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${cls}`}>{children}</button>;
}

/**
 * REPORTER LE PAIEMENT À UNE DATE — le seul autre geste que régler.
 *
 * On ne demande pas « voulez-vous reporter ? » mais « à quand ? » : un report sans date n'est pas
 * un report, c'est un oubli qui porte un nom. Le motif n'est exigé que sur une échéance déclarée
 * fixe et non négociable, et la raison est dite à l'écran plutôt que découverte dans une erreur.
 */
function DeferControl({ row }: { row: OrderRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const avertissement = deferralWarning(row.deadlineNature);
  const motifRequis = deadlineNatureOf(row.deadlineNature) === "FIXED";
  return (
    <>
      <button
        type="button" onClick={() => { setErr(null); setOpen(true); }}
        className="inline-flex items-center gap-1 rounded-md border border-warning/50 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/10"
      >
        <CalendarClock className="h-3.5 w-3.5" /> Reporter
      </button>
      <Sheet
        open={open} onClose={() => !saving && setOpen(false)}
        title="Reporter le paiement"
        description="L'ordre reste dû et reste dans la file : il est daté, pas classé. Le demandeur en est averti."
        width="md"
      >
        <form
          action={async (fd) => {
            setSaving(true); setErr(null); fd.set("id", row.id);
            const r = await deferExpenseOrder(fd);
            setSaving(false);
            if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error ?? "Erreur.");
          }}
          className="space-y-3"
        >
          <p className="text-xs text-muted-foreground">
            {row.reference} — {row.label} · <span className="font-semibold text-foreground">{formatCurrency(row.amount)}</span>
            {row.dueDate && <> · échéance demandée : <span className="font-semibold text-foreground">{formatDate(row.dueDate)}</span> ({deadlineNatureLabel(row.deadlineNature).toLowerCase()})</>}
          </p>
          {avertissement && (
            <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${motifRequis ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-foreground"}`}>
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {avertissement}
            </p>
          )}
          <div className="space-y-1">
            <Label htmlFor={`defer-${row.id}`}>Paiement reporté au <span className="text-destructive">*</span></Label>
            <Input id={`defer-${row.id}`} name="until" type="date" required defaultValue={row.deferredUntil?.slice(0, 10) ?? ""} />
          </div>
          <div className="space-y-1">
            <Label>Motif {motifRequis ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(optionnel)</span>}</Label>
            <Textarea name="reason" required={motifRequis} defaultValue={row.deferredReason ?? ""} className="min-h-[60px]" placeholder="Ex. trésorerie insuffisante avant le 25." />
          </div>
          {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Reporter le paiement</Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

const TONE: Record<SettlementState, "neutral" | "warning" | "success"> = {
  UNPAID: "neutral", DEFERRED: "warning", PAID: "success",
};

/**
 * LA FILE DU DÉCAISSEMENT — trois états, et rien d'autre.
 *
 * Les Finances ne peuvent NI annuler, NI demander une révision de budget : l'ordre leur arrive
 * autorisé par le centre de paiement, qui a vu le montant, la file entière et l'engagement pris.
 * Il ne reste que la question du décaissement, qui a trois réponses — **non payé** (par défaut),
 * **paiement reporté à** une date, **payé**. Les actions correspondantes ont été SUPPRIMÉES, pas
 * masquées : un bouton retiré laisse une porte ouverte à l'assistant et à l'API.
 *
 * `focusId` — LA LIGNE QU'ON VIENT DE CLIQUER, mise en évidence et atteignable par ancre. On
 * arrivait ici depuis « Mon espace » sur un tableau de trois cents ordres, à chercher des yeux
 * celui qu'on venait de cliquer.
 */
export function OrdersTable({ rows, canSettle, emptyLabel, focusId = null }: { rows: OrderRow[]; canSettle: boolean; emptyLabel?: string; focusId?: string | null }) {
  // `now` est figé au premier rendu : recalculer l'expiration d'un report à chaque re-render
  // ferait sauter une ligne d'une section à l'autre pendant qu'on la regarde.
  const now = React.useMemo(() => new Date(), []);
  if (rows.length === 0) {
    return <EmptyState icon="ReceiptText" title={emptyLabel ?? "Aucun ordre de dépense"} description="Les ordres autorisés par le centre de paiement apparaîtront ici." />;
  }
  return (
    <div className="surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead>Bénéficiaire</TableHead>
            <TableHead>Poste</TableHead>
            <TableHead>Échéance</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Demandé par</TableHead>
            <TableHead>Règlement</TableHead>
            {canSettle && <TableHead className="text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const etat = settlementState(r, now);
            const note = deferralNote(r, (d) => d.toLocaleDateString("fr-FR"), now);
            return (
              <TableRow
                key={r.id}
                id={`ord-${r.id}`}
                className={r.id === focusId ? "scroll-mt-24 bg-primary/5 outline outline-2 -outline-offset-2 outline-primary/40" : "scroll-mt-24"}
              >
                <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                <TableCell>{formatDate(r.createdAt)}</TableCell>
                <TableCell className="max-w-[220px]">
                  {/* LE LIBELLÉ EST LE LIEN vers le dossier et ses pièces. Le bouton séparé qui
                      vivait dans la colonne « Action » disait la même chose une seconde fois, au
                      milieu des gestes de décaissement — alors qu'ouvrir n'est pas décider. */}
                  {r.dossierHref ? (
                    <Link href={r.dossierHref} className="block truncate font-medium text-primary hover:underline" title="Voir les pièces du dossier">
                      {r.label}
                    </Link>
                  ) : (
                    <p className="truncate font-medium">{r.label}</p>
                  )}
                  {note && <p className="truncate text-xs text-warning" title={note}>{note}</p>}
                </TableCell>
                <TableCell>{r.beneficiary || "—"}</TableCell>
                <TableCell>{FINANCE_CATEGORY[r.category] ?? r.category}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {r.dueDate ? (
                    <>
                      {formatDate(r.dueDate)}
                      {/* LA NATURE SE LIT AVEC LA DATE, jamais ailleurs : « le 15 » ne dit rien
                          sans savoir si ce 15 est un engagement ou un repère. */}
                      <span className={deadlineNatureOf(r.deadlineNature) === "FIXED" ? "block font-semibold text-destructive" : "block text-muted-foreground"}>
                        {deadlineNatureLabel(r.deadlineNature)}
                      </span>
                    </>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(r.amount)}</TableCell>
                <TableCell>{r.requestedBy || "—"}</TableCell>
                <TableCell><Badge tone={TONE[etat]} dot={false}>{SETTLEMENT_LABEL[etat]}</Badge></TableCell>
                {canSettle && (
                  <TableCell className="text-right">
                    {r.status === "PENDING" ? (
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {/* RÉCLAMER LA FACTURE, LE BON, N'IMPORTE QUELLE PIÈCE — plutôt que de
                            relancer par message. La demande atterrit dans « Pièces demandées » de
                            la personne, avec son fil : elle dépose sans qu'on lui ouvre le module.
                            Demander une pièce n'est pas décider du paiement — c'est ce qui permet
                            de le décider. DEMANDER UNE VALIDATION, en revanche, n'a plus de sens :
                            l'ordre est ici PARCE QUE le centre l'a autorisé. */}
                        <ItemAskPanel entityType="EXPENSE_ORDER" entityId={r.id} link="/finances/paiements-a-faire" subject={`${r.reference} — ${r.label}`} canAskValidation={false} />
                        {r.requiresInvoice && <InvoiceControl id={r.id} hasInvoice={r.hasInvoice} />}
                        <SubmitForm action={settleExpenseOrder} id={r.id}><MiniBtn tone="success"><Banknote className="h-3.5 w-3.5" /> Payé</MiniBtn></SubmitForm>
                        <DeferControl row={r} />
                        {/* LEVER LE REPORT, c'est revenir à « non payé » — le premier des trois
                            états, pas un quatrième geste. Sans lui, une date saisie trop loin ne
                            se corrigerait qu'en attendant qu'elle arrive. */}
                        {r.deferredUntil && (
                          <SubmitForm action={resumeExpenseOrder} id={r.id}><MiniBtn><RotateCcw className="h-3.5 w-3.5" /> Lever le report</MiniBtn></SubmitForm>
                        )}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
