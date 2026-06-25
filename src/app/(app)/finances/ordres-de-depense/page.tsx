import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { OrdersTable, type OrderRow } from "./orders-table";

export default async function OrdresDepensePage() {
  const user = await requireModule("FINANCES");
  const canSettle = userCan(user, "FINANCES", "UPDATE");

  const orders = await prisma.expenseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { requestedBy: { select: { name: true } } },
    take: 300,
  });

  const toRow = (o: (typeof orders)[number]): OrderRow => ({
    id: o.id, reference: o.reference, label: o.label, beneficiary: o.beneficiary,
    category: o.category, amount: toNumber(o.amount), status: o.status,
    requestedBy: o.requestedBy?.name ?? null, createdAt: o.createdAt.toISOString(),
  });

  const pending = orders.filter((o) => o.status === "PENDING");
  const others = orders.filter((o) => o.status !== "PENDING");
  const totalPending = pending.reduce((a, o) => a + toNumber(o.amount), 0);

  return (
    <div className="space-y-6">
      <Link href="/finances" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour aux finances
      </Link>
      <PageHeader title="Ordres de dépense" description="Dépenses validées par la Direction, à exécuter par la comptabilité. Le règlement génère l'écriture de trésorerie." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Ordres à régler" value={pending.length} icon="ReceiptText" tone={pending.length > 0 ? "warning" : "default"} />
        <KpiCard label="Montant à régler" value={formatCurrency(totalPending)} icon="Banknote" tone="warning" />
        <KpiCard label="Total ordres émis" value={orders.length} icon="ListChecks" tone="info" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">À régler</h2>
        <OrdersTable rows={pending.map(toRow)} canSettle={canSettle} emptyLabel="Aucun ordre à régler" />
      </section>

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Historique</h2>
          <OrdersTable rows={others.map(toRow)} canSettle={false} />
        </section>
      )}
    </div>
  );
}
