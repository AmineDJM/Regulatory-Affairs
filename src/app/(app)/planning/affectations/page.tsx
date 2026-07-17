import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { anyRoleFilter } from "@/lib/rbac";
import { ensureCycle } from "@/lib/actions/sales-planning-actions";
import { getSfeConfig, monthLabel, repCapacity, resolveRepScope } from "@/lib/sfe";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PlanningTabs } from "../tabs";
import { AssignmentMatrix } from "./assignment-matrix";

export const dynamic = "force-dynamic";

export default async function AffectationsPage({ searchParams }: { searchParams: { y?: string; m?: string } }) {
  const user = await requireModule("SALES_PLANNING");
  const scope = await resolveRepScope(user);
  if (!scope.canConfigure && !scope.isSupervisor) redirect("/planning/pilotage");

  const now = new Date();
  const year = Number(searchParams.y) || now.getFullYear();
  const month = Number(searchParams.m) || now.getMonth() + 1;

  const [cycle, config, products, teams] = await Promise.all([
    ensureCycle(year, month),
    getSfeConfig(),
    prisma.promoProduct.findMany({ where: { isActive: true }, include: { businessUnit: { select: { name: true, color: true, sortOrder: true } } }, orderBy: [{ businessUnit: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }] }),
    prisma.salesTeam.findMany({ select: { id: true, name: true, sortOrder: true } }),
  ]);

  // KAM visibles selon la portée (tous / équipe supervisée).
  const kamUsers = await prisma.user.findMany({
    where: { isActive: true, ...anyRoleFilter(["MEDICAL_DELEGATE", "NATIONAL_SALES"]), ...(scope.repIds ? { id: { in: scope.repIds } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const repIds = kamUsers.map((u) => u.id);
  const [profiles, assignments] = await Promise.all([
    prisma.salesRepProfile.findMany({ where: { repId: { in: repIds } } }),
    cycle ? prisma.promotionAssignment.findMany({ where: { cycleId: cycle.id, repId: { in: repIds } } }) : Promise.resolve([]),
  ]);
  const profileByRep = new Map(profiles.map((p) => [p.repId, p]));
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const kams = kamUsers
    .map((u) => {
      const p = profileByRep.get(u.id);
      const team = p?.teamId ? teamById.get(p.teamId) : null;
      return {
        repId: u.id, name: u.name,
        teamName: team?.name ?? "Sans équipe",
        teamSort: team?.sortOrder ?? 9999,
        capacity: repCapacity(p, config),
        active: p?.isActive ?? true,
      };
    })
    .sort((a, b) => a.teamSort - b.teamSort || a.teamName.localeCompare(b.teamName) || a.name.localeCompare(b.name));

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div className="space-y-5">
      <PageHeader title="Prévisions & Force de vente" description="Matrice d'affectation KAM × produit : rang de détail (P1/P2/P3) et visites prévues. Le FTE en découle et remonte dans les Prévisions." />
      <PlanningTabs active="affectations" canConfigure={scope.canConfigure} isSupervisor={scope.isSupervisor} />

      <div className="flex items-center gap-2">
        <Link href={`/planning/affectations?y=${prev.y}&m=${prev.m}`} className="rounded-lg border border-input p-2 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></Link>
        <span className="min-w-40 text-center text-lg font-semibold">{monthLabel(year, month)}</span>
        <Link href={`/planning/affectations?y=${next.y}&m=${next.m}`} className="rounded-lg border border-input p-2 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></Link>
      </div>

      {kams.length === 0 ? (
        <EmptyState icon="Users" title="Aucun KAM" description="Configurez les équipes et les KAM dans l'onglet « Équipes & KAM »." />
      ) : products.length === 0 ? (
        <EmptyState icon="Package" title="Aucun produit" description="Ajoutez des produits promus dans l'onglet « Catalogue »." />
      ) : cycle ? (
        <AssignmentMatrix
          cycleId={cycle.id}
          canConfigure={scope.canConfigure}
          fromYear={prev.y}
          fromMonth={prev.m}
          positionWeights={config.positionWeights}
          kams={kams}
          products={products.map((p) => ({ id: p.id, name: p.name, buName: p.businessUnit?.name ?? "Sans BU", buColor: p.businessUnit?.color ?? null }))}
          assignments={assignments.map((a) => ({ repId: a.repId, productId: a.productId, position: a.position, plannedVisits: a.plannedVisits }))}
        />
      ) : null}
    </div>
  );
}
