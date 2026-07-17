import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView, anyRoleFilter } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getSfeConfig } from "@/lib/sfe";
import { PageHeader } from "@/components/shared/page-header";
import { PlanningTabs } from "../tabs";
import { TeamsManager } from "./teams-manager";

export const dynamic = "force-dynamic";

export default async function EquipesPage() {
  const user = await requireModule("SALES_PLANNING");
  const canConfigure = userCan(user, "SALES_PLANNING", "UPDATE") || hasGlobalView(user);
  if (!canConfigure) redirect("/planning/pilotage");

  const [teams, bus, supervisors, kamUsers, profiles, config] = await Promise.all([
    prisma.salesTeam.findMany({ include: { _count: { select: { members: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.businessUnit.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    // Superviseurs nationaux candidats : National Sales / Direction / Manager promo médicale.
    prisma.user.findMany({ where: { isActive: true, ...anyRoleFilter(["NATIONAL_SALES", "DIRECTION", "MEDICAL_PROMOTION_MANAGER"]) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    // KAM candidats : délégués médicaux + National Sales.
    prisma.user.findMany({ where: { isActive: true, ...anyRoleFilter(["MEDICAL_DELEGATE", "NATIONAL_SALES"]) }, select: { id: true, name: true, role: true, region: true }, orderBy: { name: "asc" } }),
    prisma.salesRepProfile.findMany(),
    getSfeConfig(),
  ]);

  const profileByRep = new Map(profiles.map((p) => [p.repId, p]));

  return (
    <div className="space-y-5">
      <PageHeader title="Prévisions & Force de vente" description="Équipes de KAM (superviseur national) et configuration individuelle de chaque KAM (capacité, ETP, secteur)." />
      <PlanningTabs active="equipes" canConfigure isSupervisor />
      <TeamsManager
        teams={teams.map((t) => ({ id: t.id, name: t.name, code: t.code, color: t.color, supervisorId: t.supervisorId, businessUnitId: t.businessUnitId, isActive: t.isActive, memberCount: t._count.members }))}
        businessUnits={bus}
        supervisors={supervisors}
        config={{ daysPerMonth: config.capacity.daysPerMonth, visitsPerDay: config.capacity.visitsPerDay, fieldPct: config.capacity.fieldPct }}
        kams={kamUsers.map((u) => {
          const p = profileByRep.get(u.id);
          return {
            repId: u.id, name: u.name, role: u.role,
            teamId: p?.teamId ?? null,
            region: p?.region ?? u.region ?? null,
            capDaysPerMonth: p?.capDaysPerMonth ?? null,
            capVisitsPerDay: p?.capVisitsPerDay ?? null,
            capFieldPct: p?.capFieldPct ?? null,
            fteBudget: p ? Number(p.fteBudget) : 1,
            seniority: p?.seniority ?? null,
            isActive: p?.isActive ?? true,
            hasProfile: !!p,
          };
        })}
      />
    </div>
  );
}
