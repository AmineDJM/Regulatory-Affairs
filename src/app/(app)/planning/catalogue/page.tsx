import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { PlanningTabs } from "../tabs";
import { CatalogueManager } from "./catalogue-manager";

export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const user = await requireModule("SALES_PLANNING");
  if (!userCan(user, "SALES_PLANNING", "UPDATE")) {
    return (
      <div className="space-y-5">
        <PageHeader title="Prévisions & Force de vente" description="Catalogue des BU et produits promus." />
        <PlanningTabs active="catalogue" canConfigure={false} />
        <p className="text-sm text-muted-foreground">Accès en lecture seule.</p>
      </div>
    );
  }

  const [companies, businessUnits, products, users] = await Promise.all([
    prisma.company.findMany({ where: { isActive: true }, select: { id: true, name: true, shortName: true }, orderBy: { sortOrder: "asc" } }),
    prisma.businessUnit.findMany({ include: { _count: { select: { products: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.promoProduct.findMany({ include: { businessUnit: { select: { name: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Prévisions & Force de vente" description="Catalogue des BU (franchises) et des produits promus." />
      <PlanningTabs active="catalogue" canConfigure />
      <CatalogueManager
        companies={companies.map((c) => ({ id: c.id, name: c.shortName || c.name }))}
        businessUnits={businessUnits.map((b) => ({ id: b.id, name: b.name, code: b.code, color: b.color, companyId: b.companyId, headId: b.headId, isActive: b.isActive, productCount: b._count.products }))}
        products={products.map((p) => ({ id: p.id, name: p.name, code: p.code, channel: p.channel, businessUnitId: p.businessUnitId, buName: p.businessUnit?.name ?? null, managerId: p.managerId, isActive: p.isActive }))}
        users={users}
      />
    </div>
  );
}
