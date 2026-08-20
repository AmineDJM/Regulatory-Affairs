import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { currentCompanyWhereFor } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { KpiCard } from "@/components/shared/kpi-card";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { toNumber } from "@/lib/utils";
import { createInvoice } from "@/lib/actions/invoice-actions";
import { InvoiceTable, type InvoiceRow } from "./invoice-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Factures — AMD Internal OS" };

/**
 * FACTURES — toutes au même endroit, avec leur règlement.
 *
 * Sous-module des Finances : c'est de là qu'il découle, mais on l'ouvre POUR LUI-MÊME (retrouver
 * une facture, savoir ce qui reste à payer), d'où son entrée propre dans le menu.
 *
 * `destinataire` et `payeur` sont saisis en clair plutôt que déduits d'un sens « entrante /
 * sortante » : selon la facture, la même société est l'un ou l'autre — et c'est justement ce
 * qu'on vient vérifier des mois plus tard.
 */
export default async function FacturesPage() {
  const user = await requireModule("FINANCES");
  const canCreate = userCan(user, "FINANCES", "CREATE");
  const canEdit = userCan(user, "FINANCES", "UPDATE");

  const invoices = await prisma.invoice.findMany({
    where: { ...await currentCompanyWhereFor(user.id) },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  const rows: InvoiceRow[] = invoices.map((i) => ({
    id: i.id,
    number: i.number,
    title: i.title,
    issueDate: i.issueDate?.toISOString() ?? null,
    dueDate: i.dueDate?.toISOString() ?? null,
    paidDate: i.paidDate?.toISOString() ?? null,
    amount: i.amount !== null ? toNumber(i.amount) : null,
    status: i.status,
    recipient: i.recipient,
    payer: i.payer,
  }));

  const unpaid = rows.filter((r) => r.status === "UNPAID" || r.status === "PARTIAL");
  const unpaidTotal = unpaid.reduce((a, r) => a + (r.amount ?? 0), 0);
  const now = new Date();
  const late = unpaid.filter((r) => r.dueDate && new Date(r.dueDate) < now).length;

  const fields: FieldDef[] = [
    { type: "text", name: "title", label: "Objet de la facture", required: true, full: true },
    { type: "text", name: "number", label: "N° de facture" },
    { type: "number", name: "amount", label: "Montant (DZD)" },
    { type: "date", name: "issueDate", label: "Date d'émission" },
    { type: "date", name: "dueDate", label: "Échéance de règlement" },
    { type: "date", name: "paidDate", label: "Date de paiement (si déjà réglée)" },
    {
      type: "select", name: "direction", label: "Sens", defaultValue: "OUT",
      options: [
        { value: "OUT", label: "Reçue — nous payons" },
        { value: "IN", label: "Émise — nous encaissons" },
      ],
    },
    { type: "text", name: "recipient", label: "Destinataire (à qui elle est adressée)" },
    { type: "text", name: "payer", label: "Payeur (qui règle)" },
    { type: "textarea", name: "notes", label: "Notes", full: true },
  ];

  return (
    <div className="space-y-5">
      <BackLink href="/finances"><ArrowLeft className="h-4 w-4" /> Finances</BackLink>
      <PageHeader
        title="Factures"
        description="Toutes les factures, avec leur émission, leur échéance et leur règlement. Filtrez : le total affiché suit le filtre."
      >
        {canCreate && (
          <CreateRecordButton
            label="Nouvelle facture" title="Enregistrer une facture" width="lg"
            description="Renseigner la date de paiement suffit à la déclarer réglée — le statut suit la date, jamais l'inverse."
            action={createInvoice} fields={fields}
          />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Factures" value={rows.length} icon="ReceiptText" />
        <KpiCard label="À régler" value={unpaid.length} icon="Hourglass" tone={unpaid.length > 0 ? "warning" : "default"} />
        <KpiCard label="Reste à payer" value={new Intl.NumberFormat("fr-DZ").format(Math.round(unpaidTotal))} icon="Wallet" />
        <KpiCard label="Échéance dépassée" value={late} icon="AlertTriangle" tone={late > 0 ? "danger" : "default"} />
      </div>

      <InvoiceTable rows={rows} canEdit={canEdit} />
    </div>
  );
}
