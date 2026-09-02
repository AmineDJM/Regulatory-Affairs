import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { companyScopedWhere } from "@/lib/company";
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
 * FACTURES — toutes au même endroit, DANS LEGAL, avec leur règlement.
 *
 * ── POURQUOI ELLES ONT DÉMÉNAGÉ ─────────────────────────────────────────────────────────────
 *
 * Cet écran vivait sous les Finances, à côté de la trésorerie. C'était un SECOND REGISTRE :
 * Legal tient déjà les engagements de la société — contrats, devis, bons de commande — et une
 * facture est le dernier maillon de cette même chaîne. Deux registres pour un même objet
 * finissent par diverger, et « quelles factures de ce fournisseur ? » n'a alors plus de réponse
 * unique. Le circuit des pièces réclamées y verse déjà les factures acceptées
 * (`lib/legal/from-piece.ts`) : elles arrivaient donc dans Legal pendant qu'on continuait de les
 * saisir dans les Finances.
 *
 * ── QUI Y ACCÈDE, ET POURQUOI PERSONNE N'A RIEN PERDU ───────────────────────────────────────
 *
 * L'écran s'ouvre à LEGAL **ou** à FINANCES. Le déplacer sous le seul droit Legal aurait fermé la
 * porte à la comptabilité, qui vient précisément y lire ce qui reste à payer — centraliser ne
 * doit rien retirer à personne. Les deux portes sont donc ouvertes, et c'est délibéré.
 *
 * `destinataire` et `payeur` sont saisis en clair plutôt que déduits d'un sens « entrante /
 * sortante » : selon la facture, la même société est l'un ou l'autre — et c'est justement ce
 * qu'on vient vérifier des mois plus tard.
 */
export default async function FacturesPage() {
  const user = await requireUser();
  // CENTRALISÉ NE VEUT PAS DIRE RESTREINT : Legal est le registre, mais la comptabilité garde sa
  // porte. Refuser l'un des deux ferait chercher une facture dans un écran qu'on ne peut ouvrir.
  if (!userCan(user, "LEGAL", "VIEW") && !userCan(user, "FINANCES", "VIEW")) redirect("/legal");
  const canCreate = userCan(user, "LEGAL", "CREATE") || userCan(user, "FINANCES", "CREATE");
  const canEdit = userCan(user, "LEGAL", "UPDATE") || userCan(user, "FINANCES", "UPDATE");

  const [invoices, pchOrders] = await Promise.all([
    prisma.invoice.findMany({
      where: await companyScopedWhere(user.id, {}),
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
    // Les BC PCH récents : une facture de marché peut naître RATTACHÉE à son bon depuis ici
    // aussi — c'est ce lien qui la fait apparaître sous son bon dans la fiche marché.
    prisma.pchOrder.findMany({
      select: { id: true, reference: true, tender: { select: { reference: true } } },
      orderBy: { createdAt: "desc" }, take: 100,
    }),
  ]);

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
    ...(pchOrders.length > 0
      ? [
          {
            type: "select", name: "sourceId", label: "Bon de commande PCH (facultatif)",
            options: pchOrders.map((o) => ({ value: o.id, label: `BC ${o.reference ?? "s/n"} — ${o.tender.reference}` })),
            placeholder: "— aucun —",
            hint: "Rattachée à son bon, la facture apparaît sur la fiche du marché.",
          } as FieldDef,
          { type: "hidden", name: "sourceType", value: "PCH_ORDER" } as FieldDef,
        ]
      : []),
    { type: "textarea", name: "notes", label: "Notes", full: true },
  ];

  return (
    <div className="space-y-5">
      <BackLink href="/legal"><ArrowLeft className="h-4 w-4" /> Legal</BackLink>
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
