"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Banknote, X, TrendingDown, Check, AlertCircle, FileText } from "lucide-react";
import { settleExpenseOrder, cancelExpenseOrder, requestBudgetRevision, resolveBudgetRevision, requestInvoice } from "@/lib/actions/expense-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DocumentUpload } from "@/components/documents/document-upload";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EXPENSE_ORDER_STATUS, FINANCE_CATEGORY } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";
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
  revisionReason: string | null;
  proposedAmount: number | null;
  requiresInvoice: boolean;
  hasInvoice: boolean;
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

function MiniBtn({ tone = "default", children }: { tone?: "success" | "danger" | "default" | "purple"; children: React.ReactNode }) {
  const cls = {
    success: "border-success/30 text-success hover:bg-success/10",
    danger: "border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
    purple: "border-purple-400/40 text-purple-600 hover:bg-purple-500/10",
    default: "border-border text-foreground hover:bg-secondary",
  }[tone];
  return <button type="submit" className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${cls}`}>{children}</button>;
}

/** Comptable : demander à la Direction de revoir le budget (manque de fonds). */
function RevisionRequest({ id }: { id: string }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => { setErr(null); setOpen(true); }} className="inline-flex items-center gap-1 rounded-md border border-purple-400/40 px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-500/10">
        <TrendingDown className="h-3.5 w-3.5" /> Demander révision
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Demander une révision de budget" description="La Direction sera sollicitée pour ajuster (ou maintenir) le montant." width="md">
        <form action={async (fd) => { setSaving(true); setErr(null); fd.set("id", id); const r = await requestBudgetRevision(fd); setSaving(false); if (r.ok) setOpen(false); else setErr(r.error ?? "Erreur."); }} className="space-y-3">
          <div className="space-y-1"><Label>Motif</Label><Textarea name="reason" required placeholder="Ex. budget insuffisant ce mois-ci…" className="min-h-[70px]" /></div>
          <div className="space-y-1"><Label>Montant proposé (optionnel, DZD)</Label><Input name="proposedAmount" type="number" step="any" /></div>
          {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer à la Direction</Button></div>
        </form>
      </Sheet>
    </>
  );
}

/** Direction : trancher une demande de révision (ajuster le montant ou refuser). */
function RevisionResolve({ id, currentAmount, proposed }: { id: string; currentAmount: number; proposed: number | null }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const run = async (fd: FormData, decision: string) => {
    setSaving(true); setErr(null); fd.set("id", id); fd.set("decision", decision);
    const r = await resolveBudgetRevision(fd); setSaving(false);
    if (r.ok) setOpen(false); else setErr(r.error ?? "Erreur.");
  };
  return (
    <>
      <button type="button" onClick={() => { setErr(null); setOpen(true); }} className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">
        Traiter
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Révision de budget" description="Ajustez le montant accordé, ou refusez (l'ordre repart à régler tel quel)." width="md">
        <form action={(fd) => run(fd, "ADJUST")} className="space-y-3">
          <p className="text-xs text-muted-foreground">Montant actuel : <span className="font-semibold text-foreground">{formatCurrency(currentAmount)}</span>{proposed != null && <> · Proposé par le comptable : <span className="font-semibold text-foreground">{formatCurrency(proposed)}</span></>}</p>
          <div className="space-y-1"><Label>Nouveau montant accordé (DZD)</Label><Input name="amount" type="number" step="any" defaultValue={proposed ?? currentAmount} required /></div>
          <div className="space-y-1"><Label>Commentaire (optionnel)</Label><Textarea name="comment" className="min-h-[50px]" /></div>
          {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={(e) => { const fd = new FormData((e.currentTarget.closest("form") as HTMLFormElement)); run(fd, "REJECT"); }}>Refuser (maintenir)</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Ajuster le budget</Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

/**
 * `focusId` — LA LIGNE QU'ON VIENT DE CLIQUER, mise en évidence et atteignable par ancre.
 *
 * On arrivait ici depuis « Mon espace » sur un tableau de trois cents ordres, à chercher des
 * yeux celui qu'on venait de cliquer. L'ancre `#ord-<id>` amène le navigateur dessus, le liseré
 * dit lequel c'est.
 */
export function OrdersTable({ rows, canSettle, canDirection = false, emptyLabel, focusId = null }: { rows: OrderRow[]; canSettle: boolean; canDirection?: boolean; emptyLabel?: string; focusId?: string | null }) {
  if (rows.length === 0) {
    return <EmptyState icon="ReceiptText" title={emptyLabel ?? "Aucun ordre de dépense"} description="Les ordres émis par la Direction apparaîtront ici." />;
  }
  const showActions = canSettle || canDirection;
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
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Demandé par</TableHead>
            <TableHead>Statut</TableHead>
            {showActions && <TableHead className="text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.id}
              id={`ord-${r.id}`}
              className={r.id === focusId ? "scroll-mt-24 bg-primary/5 outline outline-2 -outline-offset-2 outline-primary/40" : "scroll-mt-24"}
            >
              <TableCell className="font-mono text-xs">{r.reference}</TableCell>
              <TableCell>{formatDate(r.createdAt)}</TableCell>
              <TableCell className="max-w-[220px]">
                <p className="truncate font-medium">{r.label}</p>
                {r.status === "REVISION_REQUESTED" && r.revisionReason && (
                  <p className="truncate text-xs text-purple-600">Révision : {r.revisionReason}{r.proposedAmount != null ? ` → ${formatCurrency(r.proposedAmount)}` : ""}</p>
                )}
              </TableCell>
              <TableCell>{r.beneficiary || "—"}</TableCell>
              <TableCell>{FINANCE_CATEGORY[r.category] ?? r.category}</TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(r.amount)}</TableCell>
              <TableCell>{r.requestedBy || "—"}</TableCell>
              <TableCell><StatusBadge map={EXPENSE_ORDER_STATUS} value={r.status} /></TableCell>
              {showActions && (
                <TableCell className="text-right">
                  {r.status === "PENDING" && canSettle ? (
                    <div className="flex items-center justify-end gap-1.5">
                      {r.requiresInvoice && <InvoiceControl id={r.id} hasInvoice={r.hasInvoice} />}
                      <SubmitForm action={settleExpenseOrder} id={r.id}><MiniBtn tone="success"><Banknote className="h-3.5 w-3.5" /> Régler</MiniBtn></SubmitForm>
                      <RevisionRequest id={r.id} />
                      <SubmitForm action={cancelExpenseOrder} id={r.id}><MiniBtn tone="danger"><X className="h-3.5 w-3.5" /> Annuler</MiniBtn></SubmitForm>
                    </div>
                  ) : r.status === "REVISION_REQUESTED" && canDirection ? (
                    <div className="flex items-center justify-end"><RevisionResolve id={r.id} currentAmount={r.amount} proposed={r.proposedAmount} /></div>
                  ) : r.status === "REVISION_REQUESTED" ? (
                    <span className="text-xs text-purple-600">En attente Direction</span>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
