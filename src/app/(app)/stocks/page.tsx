import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getProductOptions } from "@/lib/queries/stock";
import { currentCompanyWhere } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { StocksView, type SnapshotDTO } from "./stocks-view";

export default async function StocksPage() {
  const user = await requireModule("STOCKS");
  const canCreate = userCan(user, "STOCKS", "CREATE");
  const canEdit = userCan(user, "STOCKS", "UPDATE");
  const canDelete = userCan(user, "STOCKS", "DELETE");

  const [products, annexes, snapshots] = await Promise.all([
    getProductOptions(),
    prisma.stockAnnex.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.stockSnapshot.findMany({ where: { ...currentCompanyWhere() }, orderBy: { date: "asc" }, take: 5000 }),
  ]);

  const snaps: SnapshotDTO[] = snapshots.map((s) => ({
    id: s.id, scope: s.scope, annexId: s.annexId, productId: s.productId,
    date: s.date.toISOString(), quantity: s.quantity, mine: s.createdById === user.id,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stocks"
        description="États de stock datés, par produit : PCH, stock hospitalier et annexes PCH. On enregistre simplement « à cette date, il reste X » — la courbe se construit au fil des relevés."
      />
      <StocksView
        products={products.map((p) => ({ id: p.id, label: p.label }))}
        annexes={annexes}
        snapshots={snaps}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
