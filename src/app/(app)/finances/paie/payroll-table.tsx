"use client";

import * as React from "react";
import { Loader2, Banknote } from "lucide-react";
import { payPayroll } from "@/lib/actions/finance-actions";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYROLL_STATUS } from "@/lib/labels";
import { formatCurrency } from "@/lib/utils";

const MONTHS = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export interface PayrollRow {
  id: string;
  employee: string;
  year: number;
  month: number;
  gross: number;
  bonuses: number;
  deductions: number;
  net: number;
  status: string;
  canPay: boolean;
}

function PayButton({ id }: { id: string }) {
  const [saving, setSaving] = React.useState(false);
  return (
    <form action={async (fd) => { setSaving(true); await payPayroll(fd); setSaving(false); }} className="inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-secondary">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />} Payer
      </button>
    </form>
  );
}

export function PayrollTable({ rows }: { rows: PayrollRow[] }) {
  if (rows.length === 0) return <EmptyState icon="ReceiptText" title="Aucun bulletin" description="Créez un bulletin de paie." />;
  return (
    <div className="surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employé</TableHead>
            <TableHead>Période</TableHead>
            <TableHead className="text-right">Brut</TableHead>
            <TableHead className="text-right">Primes</TableHead>
            <TableHead className="text-right">Retenues</TableHead>
            <TableHead className="text-right">Net à payer</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.employee}</TableCell>
              <TableCell>{MONTHS[r.month]} {r.year}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.gross)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.bonuses)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.deductions)}</TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(r.net)}</TableCell>
              <TableCell><StatusBadge map={PAYROLL_STATUS} value={r.status} /></TableCell>
              <TableCell className="text-right">
                {r.status !== "PAID" && r.canPay ? <PayButton id={r.id} /> : <Badge tone="success" dot={false}>Réglé</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
