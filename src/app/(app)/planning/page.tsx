import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ensureCycle } from "@/lib/actions/sales-planning-actions";
import { getSfeConfig, monthLabel, fieldVisitsCapacity } from "@/lib/sfe";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PlanningTabs } from "./tabs";
import { ForecastGrid } from "./forecast-grid";

export const dynamic = "force-dynamic";

export default async function PlanningPage({ searchParams }: { searchParams: { y?: string; m?: string } }) {
  const user = await requireModule("SALES_PLANNING");
  const canEdit = userCan(user, "SALES_PLANNING", "UPDATE");

  const now = new Date();
  const year = Number(searchParams.y) || now.getFullYear();
  const month = Number(searchParams.m) || now.getMonth() + 1;

  const [cycle, config, products, reps] = await Promise.all([
    ensureCycle(year, month),
    getSfeConfig(),
    prisma.promoProduct.findMany({
      where: { isActive: true },
      include: { businessUnit: { select: { id: true, name: true, color: true, sortOrder: true } } },
      orderBy: [{ businessUnit: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    // Capacité globale disponible = nb de délégués/KAM actifs (portée simple pour la Phase 1).
    prisma.user.count({ where: { isActive: true, OR: [{ role: "MEDICAL_DELEGATE" }, { role: "NATIONAL_SALES" }, { secondaryRole: "MEDICAL_DELEGATE" }, { secondaryRole: "NATIONAL_SALES" }] } }),
  ]);

  const forecasts = cycle
    ? await prisma.productForecast.findMany({ where: { cycleId: cycle.id } })
    : [];
  const fMap = new Map(forecasts.map((f) => [f.productId, f]));

  const rows = products.map((p) => {
    const f = fMap.get(p.id);
    return {
      productId: p.id,
      productName: p.name,
      buId: p.businessUnit?.id ?? "—",
      buName: p.businessUnit?.name ?? "Sans BU",
      buColor: p.businessUnit?.color ?? null,
      targetFte: f ? Number(f.targetFte) : 0,
      coverageTargetPct: f?.coverageTargetPct ?? null,
      plannedVisits: f?.plannedVisits ?? null,
      budget: f?.budget != null ? Number(f.budget) : null,
      note: f?.note ?? null,
    };
  });

  const totalFte = rows.reduce((s, r) => s + r.targetFte, 0);
  const totalVisits = rows.reduce((s, r) => s + (r.plannedVisits ?? 0), 0);
  const availableFte = reps; // 1 KAM = 1,0 ETP terrain
  const visitCapPerRep = fieldVisitsCapacity(config.capacity);

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div className="space-y-5">
      <PageHeader title="Prévisions & Force de vente" description="Planification mensuelle par produit : FTE cible, couverture, visites et budget. Prévu par la Direction, mesuré sur le terrain." />
      <PlanningTabs active="previsions" canEdit={canEdit} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/planning?y=${prev.y}&m=${prev.m}`} className="rounded-lg border border-input p-2 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="min-w-40 text-center text-lg font-semibold">{monthLabel(year, month)}</span>
          <Link href={`/planning?y=${next.y}&m=${next.m}`} className="rounded-lg border border-input p-2 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="FTE cible (total)" value={totalFte.toFixed(2)} icon="Users" />
        <KpiCard label="ETP disponibles (KAM)" value={availableFte} icon="UserCheck" tone={totalFte > availableFte ? "warning" : "success"} />
        <KpiCard label="Visites prévues" value={totalVisits} icon="Route" />
        <KpiCard label="Capacité / KAM (visites)" value={visitCapPerRep} icon="Gauge" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="Package" title="Aucun produit" description="Ajoutez des produits promus dans l'onglet « Catalogue » pour commencer à prévoir." />
      ) : cycle ? (
        <Card>
          <CardContent className="p-0">
            <ForecastGrid cycleId={cycle.id} rows={rows} canEdit={canEdit} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
