import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ensureCycle } from "@/lib/actions/sales-planning-actions";
import { getSfeConfig, monthLabel, fieldVisitsCapacity, repCapacity, assignmentEffort, fteFromEffort, resolveRepScope } from "@/lib/sfe";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PlanningTabs } from "./tabs";
import { ForecastGrid } from "./forecast-grid";

export const dynamic = "force-dynamic";

export default async function PlanningPage({ searchParams }: { searchParams: { y?: string; m?: string } }) {
  const user = await requireModule("SALES_PLANNING");
  const canConfigure = userCan(user, "SALES_PLANNING", "UPDATE") || hasGlobalView(user);
  // La prévision Direction (par produit, toute l'entreprise) est réservée aux configurateurs.
  // Superviseurs & KAM sont dirigés vers leur tableau de bord Pilotage.
  if (!canConfigure) redirect("/planning/pilotage");
  const scope = await resolveRepScope(user);

  const now = new Date();
  const year = Number(searchParams.y) || now.getFullYear();
  const month = Number(searchParams.m) || now.getMonth() + 1;

  const [cycle, config, products] = await Promise.all([
    ensureCycle(year, month),
    getSfeConfig(),
    prisma.promoProduct.findMany({
      where: { isActive: true },
      include: { businessUnit: { select: { id: true, name: true, color: true, sortOrder: true } } },
      orderBy: [{ businessUnit: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const [forecasts, assignments, profiles] = cycle
    ? await Promise.all([
        prisma.productForecast.findMany({ where: { cycleId: cycle.id } }),
        prisma.promotionAssignment.findMany({ where: { cycleId: cycle.id } }),
        prisma.salesRepProfile.findMany({ select: { repId: true, capDaysPerMonth: true, capVisitsPerDay: true, capFieldPct: true } }),
      ])
    : [[], [], []];
  const fMap = new Map(forecasts.map((f) => [f.productId, f]));

  // FTE affecté par produit = Σ (effort pondéré / capacité du KAM), sur toutes les affectations du cycle.
  const profileMap = new Map(profiles.map((p) => [p.repId, p]));
  const assignedFteByProduct = new Map<string, number>();
  for (const a of assignments) {
    const cap = repCapacity(profileMap.get(a.repId), config);
    const fte = fteFromEffort(assignmentEffort(a.plannedVisits, a.position, config.positionWeights), cap);
    assignedFteByProduct.set(a.productId, (assignedFteByProduct.get(a.productId) ?? 0) + fte);
  }

  const rows = products.map((p) => {
    const f = fMap.get(p.id);
    return {
      productId: p.id,
      productName: p.name,
      buName: p.businessUnit?.name ?? "Sans BU",
      buColor: p.businessUnit?.color ?? null,
      targetFte: f ? Number(f.targetFte) : 0,
      assignedFte: assignedFteByProduct.get(p.id) ?? 0,
      coverageTargetPct: f?.coverageTargetPct ?? null,
      plannedVisits: f?.plannedVisits ?? null,
      budget: f?.budget != null ? Number(f.budget) : null,
      note: f?.note ?? null,
    };
  });

  const totalFte = rows.reduce((s, r) => s + r.targetFte, 0);
  const totalAssigned = rows.reduce((s, r) => s + r.assignedFte, 0);
  const totalVisits = rows.reduce((s, r) => s + (r.plannedVisits ?? 0), 0);
  const visitCapPerRep = fieldVisitsCapacity(config.capacity);

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div className="space-y-5">
      <PageHeader title="Prévisions & Force de vente" description="Planification mensuelle par produit : FTE cible, couverture, visites et budget. Prévu par la Direction, affecté aux KAM, mesuré sur le terrain." />
      <PlanningTabs active="previsions" canConfigure={canConfigure} isSupervisor={scope.isSupervisor} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/planning?y=${prev.y}&m=${prev.m}`} className="rounded-lg border border-input p-2 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="min-w-40 text-center text-lg font-semibold">{monthLabel(year, month)}</span>
          <Link href={`/planning?y=${next.y}&m=${next.m}`} className="rounded-lg border border-input p-2 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="FTE cible (total)" value={totalFte.toFixed(2)} icon="Users" />
        <KpiCard label="FTE affecté (KAM)" value={totalAssigned.toFixed(2)} icon="UserCheck" tone={totalAssigned + 0.01 < totalFte ? "warning" : "success"} />
        <KpiCard label="Visites prévues" value={totalVisits} icon="Route" />
        <KpiCard label="Capacité / KAM (visites)" value={visitCapPerRep} icon="Gauge" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="Package" title="Aucun produit" description="Ajoutez des produits promus dans l'onglet « Catalogue » pour commencer à prévoir." />
      ) : cycle ? (
        <Card>
          <CardContent className="p-0">
            <ForecastGrid cycleId={cycle.id} rows={rows} canEdit={canConfigure} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
