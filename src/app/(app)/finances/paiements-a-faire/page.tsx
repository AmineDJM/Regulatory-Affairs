import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { platformScope } from "@/lib/company";
import { toNumber, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { visibleToFinance, type CentralStatus } from "@/lib/payments/authorization";
import { OrdersTable, type OrderRow } from "./orders-table";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { FINANCES_TABS } from "@/lib/labels";

/**
 * PAIEMENTS À FAIRE — la file du décaissement, et elle n'a QU'UNE source.
 *
 * Rien n'atterrit ici qui ne soit passé par le CENTRE DE PAIEMENT. Ce n'est pas un filtre
 * d'affichage : les ordres non autorisés sont écartés en amont, si bien qu'ils n'existent ni en
 * ligne, ni en total, ni en compteur pour la comptabilité. Un ordre REFUSÉ, lui, reste visible —
 * les Finances doivent savoir qu'il ne faut pas payer, et pourquoi.
 */
export default async function PaiementsAFairePage({ searchParams }: { searchParams: { focus?: string } }) {
  // `?focus=` : la ligne qu'on vient de cliquer depuis « Mon espace ». Voir OrdersTable.
  const focusId = searchParams.focus ?? null;
  const user = await requireModule("FINANCES");
  const canSettle = userCan(user, "FINANCES", "UPDATE");
  const canDirection = hasGlobalView(user.role) || userCan(user, "FINANCES", "VALIDATE") || userCan(user, "BUDGETS", "VALIDATE");

  // LES FINANCES NE REÇOIVENT RIEN tant que le centre de paiement n'a pas tranché — quel que
  // soit le montant, depuis que le seuil a été retiré. Un ordre n'apparaît ici qu'une fois
  // autorisé (ou refusé : il faut savoir qu'il ne faut pas payer). Les écarter en amont plutôt
  // qu'à l'écran est délibéré : un ordre non autorisé ne doit pas exister pour la comptabilité,
  // pas même en total ou en compteur.
  const orders = (await prisma.expenseOrder.findMany({
    where: await platformScope(user.id),
    orderBy: { createdAt: "desc" },
    include: { requestedBy: { select: { name: true } } },
    take: 300,
  })).filter((o) => visibleToFinance(o.centralStatus as CentralStatus));

  // Présence d'une facture (catégorie INVOICE) sur l'ordre ou son dossier source.
  const orderIds = orders.map((o) => o.id);
  const sourceFilters = orders
    .filter((o) => o.sourceType && o.sourceId)
    .map((o) => ({ entityType: o.sourceType!, entityId: o.sourceId! }));
  const invoiceDocs = await prisma.document.findMany({
    where: {
      category: "INVOICE",
      OR: [{ entityType: "EXPENSE_ORDER", entityId: { in: orderIds } }, ...sourceFilters],
    },
    select: { entityType: true, entityId: true },
  });
  const invoiceSet = new Set(invoiceDocs.map((d) => `${d.entityType}:${d.entityId}`));
  const hasInvoice = (o: (typeof orders)[number]) =>
    invoiceSet.has(`EXPENSE_ORDER:${o.id}`) || Boolean(o.sourceType && o.sourceId && invoiceSet.has(`${o.sourceType}:${o.sourceId}`));

  const toRow = (o: (typeof orders)[number]): OrderRow => ({
    id: o.id, reference: o.reference, label: o.label, beneficiary: o.beneficiary,
    category: o.category, amount: toNumber(o.amount), status: o.status,
    requestedBy: o.requestedBy?.name ?? null, createdAt: o.createdAt.toISOString(),
    revisionReason: o.revisionReason, proposedAmount: o.proposedAmount ? toNumber(o.proposedAmount) : null,
    requiresInvoice: o.requiresInvoice, hasInvoice: hasInvoice(o),
  });

  const pending = orders.filter((o) => o.status === "PENDING");
  const revisions = orders.filter((o) => o.status === "REVISION_REQUESTED");
  const others = orders.filter((o) => o.status === "PAID" || o.status === "CANCELLED");
  const totalPending = pending.reduce((a, o) => a + toNumber(o.amount), 0);

  const tabs = await visibleTabs(user, FINANCES_TABS);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finances — Paiements à faire"
        description="Les dépenses AUTORISÉES par le centre de paiement, à régler par la comptabilité. Le règlement génère l'écriture de trésorerie."
      />
      <ModuleTabs tabs={tabs} arrows />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Ordres à régler" value={pending.length} icon="ReceiptText" tone={pending.length > 0 ? "warning" : "default"} />
        <KpiCard label="Montant à régler" value={formatCurrency(totalPending)} icon="Banknote" tone="warning" />
        <KpiCard label="Total ordres émis" value={orders.length} icon="ListChecks" tone="info" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">À régler</h2>
        <OrdersTable rows={pending.map(toRow)} canSettle={canSettle} canDirection={canDirection} emptyLabel="Aucun ordre à régler" focusId={focusId} />
      </section>

      {revisions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Révisions de budget demandées ({revisions.length})</h2>
          <OrdersTable rows={revisions.map(toRow)} canSettle={canSettle} canDirection={canDirection} focusId={focusId} />
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Historique</h2>
          <OrdersTable rows={others.map(toRow)} canSettle={false} focusId={focusId} />
        </section>
      )}
    </div>
  );
}
