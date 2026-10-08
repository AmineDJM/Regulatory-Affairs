import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency } from "@/lib/utils";
import { clauseVentesVisibles } from "@/lib/queries/visibilite-listes";
import { KpiCard } from "@/components/shared/kpi-card";
import { InfoBulle } from "@/components/ui/info-bulle";
import { EnteteVentesPch } from "../entete";
import { SalesTable, type SaleRow } from "./sales-table";

export const dynamic = "force-dynamic";

/**
 * L'HISTORIQUE DE L'ANCIENNE SAISIE MANUELLE DES VENTES — en lecture seule (Direction, 08/10 : « Ventes PCH » remplace
 * la saisie à la main). Rien n'est supprimé ; plus rien ne se saisit ici. Le module d'origine (`SALES`) est retiré du
 * service : l'historique se lit avec « Ventes PCH ».
 */
export default async function HistoriqueVentesPage() {
  const user = await requireModule("PCH_VENTES");
  const where = await clauseVentesVisibles(user);

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { date: "desc" },
    take: 500,
    include: { salesUser: { select: { name: true } } },
  });

  const rows: SaleRow[] = sales.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    saleType: s.saleType,
    product: s.product,
    productId: userCan(user, "PRODUCTS", "VIEW") ? s.productId : null,
    dci: s.dci ?? "",
    client: s.client,
    institution: s.institution ?? "",
    isPch: s.isPch,
    quantity: s.quantity,
    unitPrice: toNumber(s.unitPrice),
    revenue: toNumber(s.revenue),
    paymentStatus: s.paymentStatus,
    deliveryStatus: s.deliveryStatus,
    salesUser: s.salesUser?.name ?? "",
  }));

  const total = rows.reduce((a, r) => a + r.revenue, 0);
  const pch = rows.filter((r) => r.isPch).reduce((a, r) => a + r.revenue, 0);

  return (
    <div className="space-y-5">
      <EnteteVentesPch user={user} />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Saisie manuelle — lecture seule</span>
        <InfoBulle>Les ventes saisies à la main avant « Ventes PCH ». Elles restent consultables ; les ventes se lisent désormais dans les fichiers de la PCH.</InfoBulle>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Total saisi" value={formatCurrency(total)} icon="Coins" />
        <KpiCard label="Dont PCH" value={formatCurrency(pch)} icon="Building2" tone="info" />
        <KpiCard label="Transactions" value={rows.length} icon="ShoppingCart" />
      </div>
      <SalesTable rows={rows} />
    </div>
  );
}
