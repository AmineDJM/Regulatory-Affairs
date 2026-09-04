import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { companyScopedWhere } from "@/lib/company";
import { toNumber, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { visibleToFinance, type CentralStatus } from "@/lib/payments/authorization";
import { settlementState, sortForSettlement } from "@/lib/finance/settlement";
import { dossierHrefByOrder } from "@/lib/expense-orders";
import { needsBudgetChoice } from "@/lib/finance/settle-budget";
import { pickAutoCategory } from "@/lib/budget/auto-category";
import { ENTITY_MODULE } from "@/lib/entity-access";
import { getFinanceData } from "@/lib/queries/finance";
import { TreasuryUpdateRequestButton } from "../treasury-update-request";
import { OrdersTable, type OrderRow, type BudgetChoice } from "./orders-table";
import { PurgeHistoryButton } from "./purge-history";

/**
 * BANQUE & PAIEMENTS — ce qu'il y a en banque, et ce qu'il faut en sortir.
 *
 * ── POURQUOI LES DEUX SUR LE MÊME ÉCRAN ─────────────────────────────────────────────────────
 *
 * Le solde de trésorerie vivait sur un tableau de bord, un écran plus tôt. On y regardait ce
 * qu'il restait en banque, puis on venait ici décider ce qu'on paie — de mémoire. C'est
 * exactement au moment de régler qu'on veut voir le solde : il est donc en tête de la file qu'il
 * gouverne, avec le détail par compte.
 *
 * ── LA FILE DU DÉCAISSEMENT N'A QU'UNE SOURCE ───────────────────────────────────────────────
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
  // `companyScopedWhere` ET NON LE FILTRE BRUT : celui-ci vaut `companyId = X`, et `NULL` n'est
  // pas `X`. Un ordre qu'on n'a pas su rattacher disparaissait de la file du décaissement pour
  // tout comptable cloisonné sur une société — et un paiement invisible n'est pas un paiement
  // classé, c'est un paiement qu'on ne fera jamais.
  const orders = (await prisma.expenseOrder.findMany({
    where: await companyScopedWhere(user.id, {}),
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

  // LE DOSSIER DE CHAQUE ORDRE — de TOUS les ordres, désormais. La règle testait `sourceType ===
  // "PAYMENT_REQUEST"` et ne reconnaissait donc qu'un circuit sur treize : un matériel
  // promotionnel, un bon de versement, un sponsoring arrivaient ici avec un libellé mort, et
  // joindre une facture obligeait à retrouver le module d'origine — quand on y avait accès.
  // Depuis qu'un ordre ouvre son dossier en naissant (`createExpenseOrder`), le lien se lit sur
  // `expenseOrderId`, qui vaut pour les deux sens de l'histoire.
  const dossiers = await dossierHrefByOrder(orderIds);

  // ── OÙ CETTE DÉPENSE TOMBERA-T-ELLE ? ───────────────────────────────────────────────────────
  //
  // La question se pose AVANT le clic, avec la MÊME fonction que le serveur (`pickAutoCategory`,
  // puis `needsBudgetChoice`) : deux règles séparées auraient divergé, et l'on aurait fini avec un
  // bouton qui promet un règlement que le serveur refuse. Les catégories sont chargées ici une
  // fois pour toute la table — l'écran en a besoin pour PROPOSER le classement, pas seulement
  // pour le calculer.
  const [envelopes, categoryLines] = await Promise.all([
    prisma.budgetEnvelope.findMany({
      where: { isActive: true },
      select: { id: true, isActive: true, modules: true, module: true, periodStart: true, name: true },
    }),
    prisma.budgetCategoryLine.findMany({
      where: { envelope: { isActive: true } },
      select: { id: true, envelopeId: true, module: true, parentId: true, createdAt: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const envelopeName = new Map(envelopes.map((e) => [e.id, e.name]));
  // Le libellé porte l'enveloppe : « Marketing 2026 · Congrès » — « Congrès » seul se répète
  // d'une enveloppe à l'autre, et l'on classe alors dans l'exercice de l'an dernier.
  const budgets: BudgetChoice[] = categoryLines.map((c) => ({
    id: c.id,
    label: `${envelopeName.get(c.envelopeId) ?? "Budget"} · ${c.name}`,
  }));
  const autoOf = (o: (typeof orders)[number]): string | null =>
    o.sourceType ? pickAutoCategory(ENTITY_MODULE[o.sourceType], envelopes, categoryLines) : null;

  const toRow = (o: (typeof orders)[number]): OrderRow => ({
    id: o.id, reference: o.reference, label: o.label, beneficiary: o.beneficiary,
    category: o.category, amount: toNumber(o.amount), status: o.status,
    requestedBy: o.requestedBy?.name ?? null, createdAt: o.createdAt.toISOString(),
    requiresInvoice: o.requiresInvoice, hasInvoice: hasInvoice(o),
    dueDate: o.dueDate?.toISOString() ?? null, deadlineNature: o.deadlineNature,
    deferredUntil: o.deferredUntil?.toISOString() ?? null, deferredReason: o.deferredReason,
    // On ouvre LE DOSSIER DU PAIEMENT et ses pièces — pas la demande source, qui vit dans un
    // autre module, avec d'autres droits, et que le comptable n'a pas à traverser pour lire une
    // facture.
    dossierHref: dossiers.get(o.id) ?? null,
    needsBudget: needsBudgetChoice({
      onOrder: o.budgetCategoryId,
      auto: autoOf(o),
      availableCount: categoryLines.length,
    }),
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

  // LA BANQUE — le même calcul que la comptabilité (`getFinanceData`) : soldes d'ouverture plus
  // les flux réglés. Un second calcul aurait donné deux soldes, et l'on n'aurait plus su lequel
  // croire au moment précis où il faut décider si l'on peut payer.
  const tresorerie = await getFinanceData(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finances — Banque & paiements"
        description="Ce qu'il y a en banque, et les dépenses AUTORISÉES par le centre de paiement qu'il reste à régler. Le règlement génère l'écriture de trésorerie."
      >
        {/* L'ADMINISTRATION DEMANDE l'actualisation, les Finances la font — et « l'administration »
            veut dire LE SUPER ADMIN, lui seul. Le geste notifie tous les responsables Finances :
            ouvert plus largement, il devient une sonnerie que personne n'écoute plus.
            La MÊME règle garde l'action serveur (`requestTreasuryUpdate`) et l'opération d'Adam
            (`request_treasury_update`) — un bouton masqué n'est pas un contrôle d'accès. */}
        {user.role === "SUPER_ADMIN" && <TreasuryUpdateRequestButton />}
      </PageHeader>

      {/* ───────────── LA BANQUE ─────────────
          Le solde d'abord : c'est lui qui dit si la file ci-dessous peut être servie. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard
          label="Solde trésorerie" value={formatCurrency(tresorerie.totalBalance)} icon="Landmark"
          tone={tresorerie.totalBalance >= 0 ? "success" : "danger"}
        />
        <KpiCard label="Ordres à régler" value={pending.length} icon="ReceiptText" tone={pending.length > 0 ? "warning" : "default"} />
        <KpiCard label="Montant à régler" value={formatCurrency(totalPending)} icon="Banknote" tone="warning" />
        <KpiCard label="Paiements reportés" value={reportes.length} icon="CalendarClock" tone={reportes.length > 0 ? "info" : "default"} />
        <KpiCard label="Total ordres émis" value={orders.length} icon="ListChecks" tone="info" />
      </div>

      {tresorerie.accounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {tresorerie.accounts.map((a) => (
            <div key={a.account} className="surface flex items-center gap-3 px-4 py-2.5">
              <span className="text-sm text-muted-foreground">{a.account}</span>
              <span className={`font-semibold ${a.balance >= 0 ? "text-foreground" : "text-destructive"}`}>{formatCurrency(a.balance)}</span>
            </div>
          ))}
          {tresorerie.openingTotal !== 0 && (
            <span className="text-xs text-muted-foreground">
              dont {formatCurrency(tresorerie.openingTotal)} de solde d&apos;ouverture + flux réglés
            </span>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">À régler</h2>
        <OrdersTable rows={pending.map(toRow)} canSettle={canSettle} emptyLabel="Aucun ordre à régler" focusId={focusId} budgets={budgets} />
      </section>

      {reportes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Paiements reportés ({reportes.length})</h2>
          {/* Ils ne quittent pas la file : ils y reviennent seuls le jour dit. */}
          <p className="text-xs text-muted-foreground">
            Ces ordres sont dus — leur règlement est daté, pas abandonné. Ils redescendent dans « À régler » à l&apos;échéance du report, sans que personne n&apos;ait à y penser.
          </p>
          <OrdersTable rows={reportes.map(toRow)} canSettle={canSettle} focusId={focusId} budgets={budgets} />
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
