import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { companyScopedWhere } from "@/lib/company";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { EVENTS_TABS } from "@/lib/labels";
import { stockOf, stockLevel, type MovementKind } from "@/lib/promo/stock";
import { StockBoard, type StockItemRow } from "./stock-board";

export const dynamic = "force-dynamic";

/**
 * STOCK DU MATÉRIEL PROMOTIONNEL — sous-module de la direction marketing.
 *
 * Le module des campagnes répond à « où en est la commande ? » ; celui-ci à « qu'est-ce qu'il
 * nous reste, et où ? ». Ce sont deux questions différentes, posées à des moments différents —
 * les mêler dans un écran unique revient à ne bien répondre à aucune des deux.
 *
 * La quantité n'est jamais lue dans un champ : elle est CALCULÉE à partir des mouvements, par la
 * même fonction pure que celle qui garde les sorties. Le chiffre affiché et le chiffre qui
 * autorise une distribution ne peuvent donc pas diverger.
 */
export default async function PromoStockPage() {
  const user = await requireModule("PROMO_MATERIAL");
  const canManage = userCan(user, "PROMO_MATERIAL", "UPDATE") || hasGlobalView(user);

  const [rows, tabs] = await Promise.all([
    prisma.promoStockItem.findMany({
      where: await companyScopedWhere(user.id, {}),
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        movements: { orderBy: { occurredAt: "desc" }, take: 100 },
      },
    }),
    visibleTabs(user, EVENTS_TABS),
  ]);

  // Les auteurs des mouvements, en un lot : afficher « par qui » sans N+1.
  const authorIds = [...new Set(rows.flatMap((r) => r.movements.map((m) => m.createdById)).filter((x): x is string => Boolean(x)))];
  const authors = authorIds.length
    ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } })
    : [];
  const authorName = new Map(authors.map((a) => [a.id, a.name]));

  const items: StockItemRow[] = rows.map((r) => {
    const movements = r.movements.map((m) => ({
      id: m.id,
      kind: m.kind as MovementKind,
      delta: toNumber(m.delta),
      recipient: m.recipient,
      reason: m.reason,
      occurredAt: m.occurredAt.toISOString(),
      by: m.createdById ? authorName.get(m.createdById) ?? null : null,
    }));
    return {
      id: r.id,
      name: r.name,
      materialType: r.materialType,
      reference: r.reference,
      unit: r.unit,
      location: r.location,
      alertThreshold: r.alertThreshold === null ? null : toNumber(r.alertThreshold),
      notes: r.notes,
      isActive: r.isActive,
      stock: stockOf(movements),
      movements,
    };
  });

  const active = items.filter((i) => i.isActive);
  const out = active.filter((i) => stockLevel(i.stock, i.alertThreshold) === "OUT").length;
  const low = active.filter((i) => stockLevel(i.stock, i.alertThreshold) === "LOW").length;
  const totalUnits = active.reduce((a, i) => a + Math.max(0, i.stock), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock promotionnel"
        description="Ce que nous avons en magasin, ce qui en sort, et pour qui. La quantité se calcule à partir des mouvements — elle ne se saisit jamais."
      />
      <ModuleTabs tabs={tabs} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Articles suivis" value={active.length} icon="Package" />
        <KpiCard label="Unités en stock" value={totalUnits} icon="Boxes" tone="info" />
        <KpiCard label="Sous le seuil" value={low} icon="TrendingDown" tone={low > 0 ? "warning" : "default"} />
        <KpiCard label="En rupture" value={out} icon="TriangleAlert" tone={out > 0 ? "danger" : "default"} />
      </div>

      <StockBoard items={items} canManage={canManage} />
    </div>
  );
}
