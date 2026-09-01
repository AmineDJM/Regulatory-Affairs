import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { platformScope } from "@/lib/company";
import { toNumber, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { visibleToFinance, type CentralStatus } from "@/lib/payments/authorization";
import { settlementState, sortForSettlement } from "@/lib/finance/settlement";
import { OrdersTable, type OrderRow } from "./orders-table";
import { PurgeHistoryButton } from "./purge-history";

/**
 * PAIEMENTS À FAIRE — la file du décaissement, et elle n'a QU'UNE source.
 *
 * Rien n'atterrit ici qui ne soit passé par le CENTRE DE PAIEMENT. Ce n'est pas un filtre
 * d'affichage : les ordres non autorisés sont écartés en amont, si bien qu'ils n'existent ni en
 * ligne, ni en total, ni en compteur pour la comptabilité. Un ordre REFUSÉ, lui, reste visible —
 * les Finances doivent savoir qu'il ne faut pas payer, et pourquoi.
 *
 * TROIS ÉTATS, ET RIEN D'AUTRE. Les Finances ne peuvent ni annuler, ni demander une révision de
 * budget : l'ordre leur arrive AUTORISÉ, et rouvrir le montant à la caisse reviendrait à défaire
 * une décision prise par le centre, qui voit la file entière. Reste **non payé** (le défaut),
 * **paiement reporté à** une date, **payé**.
 */
export default async function PaiementsAFairePage({ searchParams }: { searchParams: { focus?: string } }) {
  // `?focus=` : la ligne qu'on vient de cliquer depuis « Mon espace ». Voir OrdersTable.
  const focusId = searchParams.focus ?? null;
  const user = await requireModule("FINANCES");
  const canSettle = userCan(user, "FINANCES", "UPDATE");

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
    requiresInvoice: o.requiresInvoice, hasInvoice: hasInvoice(o),
    dueDate: o.dueDate?.toISOString() ?? null, deadlineNature: o.deadlineNature,
    deferredUntil: o.deferredUntil?.toISOString() ?? null, deferredReason: o.deferredReason,
    // On ouvre la DEMANDE DE PAIEMENT et ses pièces — pas la demande source, qui vit dans un
    // autre module, avec d'autres droits, et que le comptable n'a pas à traverser pour lire une
    // facture.
    dossierHref: o.sourceType === "PAYMENT_REQUEST" && o.sourceId ? `/validations/paiements/${o.sourceId}` : null,
  });

  // UN ORDRE REPORTÉ RESTE DANS LA FILE — daté, pas classé. Le sortir d'ici ferait de « reporter »
  // le moyen commode de faire disparaître ce qu'on ne veut pas payer ; il est donc seulement
  // affiché à part, compté à part, et il redescend tout seul dans « à régler » à l'expiration de
  // sa date (`settlementState`).
  const now = new Date();
  const ouverts = orders.filter((o) => o.status === "PENDING");
  const pending = sortForSettlement(ouverts.filter((o) => settlementState(o, now) === "UNPAID"), now);
  const reportes = sortForSettlement(ouverts.filter((o) => settlementState(o, now) === "DEFERRED"), now);
  const others = orders.filter((o) => o.status === "PAID" || o.status === "CANCELLED");
  const totalPending = pending.reduce((a, o) => a + toNumber(o.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finances — Paiements à faire"
        description="Les dépenses AUTORISÉES par le centre de paiement, à régler par la comptabilité. Le règlement génère l'écriture de trésorerie."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Ordres à régler" value={pending.length} icon="ReceiptText" tone={pending.length > 0 ? "warning" : "default"} />
        <KpiCard label="Montant à régler" value={formatCurrency(totalPending)} icon="Banknote" tone="warning" />
        <KpiCard label="Paiements reportés" value={reportes.length} icon="CalendarClock" tone={reportes.length > 0 ? "info" : "default"} />
        <KpiCard label="Total ordres émis" value={orders.length} icon="ListChecks" tone="info" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">À régler</h2>
        <OrdersTable rows={pending.map(toRow)} canSettle={canSettle} emptyLabel="Aucun ordre à régler" focusId={focusId} />
      </section>

      {reportes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Paiements reportés ({reportes.length})</h2>
          {/* Ils ne quittent pas la file : ils y reviennent seuls le jour dit. */}
          <p className="text-xs text-muted-foreground">
            Ces ordres sont dus — leur règlement est daté, pas abandonné. Ils redescendent dans « À régler » à l&apos;échéance du report, sans que personne n&apos;ait à y penser.
          </p>
          <OrdersTable rows={reportes.map(toRow)} canSettle={canSettle} focusId={focusId} />
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Historique</h2>
            {/* Le Super Admin peut vider cette pile : elle ne sert plus qu'à faire défiler. Les
                écritures de trésorerie, elles, restent — on efface la FILE, pas la comptabilité. */}
            {user.role === "SUPER_ADMIN" && <PurgeHistoryButton count={others.length} />}
          </div>
          <OrdersTable rows={others.map(toRow)} canSettle={false} focusId={focusId} />
        </section>
      )}
    </div>
  );
}
