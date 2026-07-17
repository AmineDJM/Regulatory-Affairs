import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { aiConfigured } from "@/lib/ai";
import { getPchTenderDetail } from "@/lib/queries/pch";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PCH_TENDER_STATUS } from "@/lib/labels";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { EditTenderButton, OrdersManager } from "./pch-detail-client";
import { TenderLines } from "./tender-lines";
import { TenderLogistics } from "./tender-logistics";

export default async function PchTenderPage({ params }: { params: { id: string } }) {
  const user = await requireModule("PCH");
  const t = await getPchTenderDetail(params.id);
  if (!t) notFound();
  const canEdit = userCan(user, "PCH", "UPDATE");
  const canDelete = userCan(user, "PCH", "DELETE");
  const cautionExpired = t.cautionEnd && new Date(t.cautionEnd) < new Date();

  return (
    <div className="space-y-5">
      <Link href="/pch" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Marchés PCH
      </Link>
      <PageHeader title={`${t.reference}${t.title ? ` — ${t.title}` : ""}`} description="Appel d'offres gagné — bons de commande et caution.">
        <StatusBadge map={PCH_TENDER_STATUS} value={t.status} />
        {canEdit && <EditTenderButton tender={t} canDelete={canDelete} />}
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Info label="Produits" value={t.products} />
            <Info label="Fournisseur" value={t.supplier} />
            <Info label="Pays du fournisseur" value={t.supplierCountry} />
            <Info label="Client" value={t.client} />
            <Info label="Quantité totale" value={formatNumber(t.quantity)} />
            <Info label="Valeur" value={t.value !== null ? formatCurrency(t.value) : "—"} />
            <Info label="Date d'attribution" value={t.awardDate ? formatDate(t.awardDate) : "—"} />
            <Info label="Valeur des bons reçus" value={formatCurrency(t.orderedValue)} />
            {t.notes && <div className="col-span-full"><p className="text-xs text-muted-foreground">Notes</p><p className="whitespace-pre-wrap">{t.notes}</p></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Caution</CardTitle>
            <Badge tone={t.cautionDeposited ? (cautionExpired ? "danger" : "success") : "warning"} dot={false}>
              {t.cautionDeposited ? (cautionExpired ? "Expirée" : "Déposée") : "Non déposée"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info label="Montant" value={t.cautionAmount !== null ? formatCurrency(t.cautionAmount) : "—"} />
            <Info label="Début de validité" value={t.cautionStart ? formatDate(t.cautionStart) : "—"} />
            <Info label="Fin de validité" value={t.cautionEnd ? formatDate(t.cautionEnd) : "—"} />
            {cautionExpired && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">⚠ Caution expirée — à renouveler.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <TenderLines tenderId={t.id} lines={t.lines} canEdit={canEdit} aiConfigured={aiConfigured()} />
        </CardContent>
      </Card>

      <OrdersManager tenderId={t.id} orders={t.orders} canEdit={canEdit} canDelete={canDelete} />

      {t.orders.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <TenderLogistics tenderId={t.id} orders={t.orders} canEdit={canEdit} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>;
}
