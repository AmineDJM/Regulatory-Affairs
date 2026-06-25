"use client";

import * as React from "react";
import { Loader2, Banknote, X } from "lucide-react";
import { settleExpenseOrder, cancelExpenseOrder } from "@/lib/actions/expense-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EXPENSE_ORDER_STATUS, FINANCE_CATEGORY } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";

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
}

function SettleButton({ id }: { id: string }) {
  const [saving, setSaving] = React.useState(false);
  return (
    <form action={async (fd) => { setSaving(true); await settleExpenseOrder(fd); setSaving(false); }} className="inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={saving}
        className="inline-flex items-center gap-1 rounded-md border border-success/30 px-2 py-1 text-xs font-medium text-success hover:bg-success/10 disabled:opacity-50">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />} Régler
      </button>
    </form>
  );
}

function CancelButton({ id }: { id: string }) {
  const [saving, setSaving] = React.useState(false);
  return (
    <form action={async (fd) => { setSaving(true); await cancelExpenseOrder(fd); setSaving(false); }} className="inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={saving}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Annuler
      </button>
    </form>
  );
}

export function OrdersTable({ rows, canSettle, emptyLabel }: { rows: OrderRow[]; canSettle: boolean; emptyLabel?: string }) {
  if (rows.length === 0) {
    return <EmptyState icon="ReceiptText" title={emptyLabel ?? "Aucun ordre de dépense"} description="Les ordres émis par la Direction apparaîtront ici." />;
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
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Demandé par</TableHead>
            <TableHead>Statut</TableHead>
            {canSettle && <TableHead className="text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.reference}</TableCell>
              <TableCell>{formatDate(r.createdAt)}</TableCell>
              <TableCell className="max-w-[220px] truncate font-medium">{r.label}</TableCell>
              <TableCell>{r.beneficiary || "—"}</TableCell>
              <TableCell>{FINANCE_CATEGORY[r.category] ?? r.category}</TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(r.amount)}</TableCell>
              <TableCell>{r.requestedBy || "—"}</TableCell>
              <TableCell><StatusBadge map={EXPENSE_ORDER_STATUS} value={r.status} /></TableCell>
              {canSettle && (
                <TableCell className="text-right">
                  {r.status === "PENDING" ? (
                    <div className="flex items-center justify-end gap-1.5"><SettleButton id={r.id} /><CancelButton id={r.id} /></div>
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
