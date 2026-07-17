import { Fragment } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { anyRoleFilter } from "@/lib/rbac";
import { ensureCycle } from "@/lib/actions/sales-planning-actions";
import {
  getSfeConfig, monthLabel, repCapacity, assignmentEffort, fteFromEffort,
  panelRequiredVisits, resolveRepScope, TIERS, TIER_LABELS,
} from "@/lib/sfe";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PlanningTabs } from "../tabs";

export const dynamic = "force-dynamic";

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);
const toneOf = (p: number) => (p >= 90 ? "text-success" : p >= 60 ? "text-warning" : "text-destructive");

export default async function PilotagePage({ searchParams }: { searchParams: { y?: string; m?: string } }) {
  const user = await requireModule("SALES_PLANNING");
  const scope = await resolveRepScope(user);

  const now = new Date();
  const year = Number(searchParams.y) || now.getFullYear();
  const month = Number(searchParams.m) || now.getMonth() + 1;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [cycle, config] = await Promise.all([ensureCycle(year, month), getSfeConfig()]);

  const kamUsers = await prisma.user.findMany({
    where: { isActive: true, ...anyRoleFilter(["MEDICAL_DELEGATE", "NATIONAL_SALES"]), ...(scope.repIds ? { id: { in: scope.repIds } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const repIds = kamUsers.map((u) => u.id);

  const [profiles, teams, assignments, panel, visits] = await Promise.all([
    prisma.salesRepProfile.findMany({ where: { repId: { in: repIds } } }),
    prisma.salesTeam.findMany({ select: { id: true, name: true, sortOrder: true } }),
    cycle ? prisma.promotionAssignment.findMany({ where: { cycleId: cycle.id, repId: { in: repIds } } }) : Promise.resolve([]),
    prisma.medicalDoctor.findMany({ where: { delegateId: { in: repIds } }, select: { delegateId: true, potential: true } }),
    prisma.medicalVisit.findMany({ where: { delegateId: { in: repIds }, status: "COMPLETED", date: { gte: monthStart, lt: monthEnd } }, select: { delegateId: true, doctorId: true } }),
  ]);

  const profileByRep = new Map(profiles.map((p) => [p.repId, p]));
  const teamById = new Map(teams.map((t) => [t.id, t]));

  // Panel par KAM et par palier de potentiel.
  const panelByRep = new Map<string, Record<string, number>>();
  for (const d of panel) {
    if (!d.delegateId) continue;
    const rec = panelByRep.get(d.delegateId) ?? {};
    rec[d.potential] = (rec[d.potential] ?? 0) + 1;
    panelByRep.set(d.delegateId, rec);
  }
  // Visites réalisées + praticiens distincts visités (couverture).
  const realVisitsByRep = new Map<string, number>();
  const visitedDoctorsByRep = new Map<string, Set<string>>();
  for (const v of visits) {
    if (!v.delegateId) continue;
    realVisitsByRep.set(v.delegateId, (realVisitsByRep.get(v.delegateId) ?? 0) + 1);
    if (v.doctorId) {
      const set = visitedDoctorsByRep.get(v.delegateId) ?? new Set<string>();
      set.add(v.doctorId);
      visitedDoctorsByRep.set(v.delegateId, set);
    }
  }
  // Affectations par KAM.
  const plannedByRep = new Map<string, { visits: number; fte: number }>();
  for (const a of assignments) {
    const cap = repCapacity(profileByRep.get(a.repId), config);
    const fte = fteFromEffort(assignmentEffort(a.plannedVisits, a.position, config.positionWeights), cap);
    const cur = plannedByRep.get(a.repId) ?? { visits: 0, fte: 0 };
    cur.visits += a.plannedVisits; cur.fte += fte;
    plannedByRep.set(a.repId, cur);
  }

  const rows = kamUsers
    .map((u) => {
      const p = profileByRep.get(u.id);
      const team = p?.teamId ? teamById.get(p.teamId) : null;
      const capacity = repCapacity(p, config);
      const panelRec = panelByRep.get(u.id) ?? {};
      const panelSize = Object.values(panelRec).reduce((s, n) => s + n, 0);
      const planned = plannedByRep.get(u.id) ?? { visits: 0, fte: 0 };
      const required = panelRequiredVisits(panelRec, config.frequencyByTier);
      const real = realVisitsByRep.get(u.id) ?? 0;
      const covered = visitedDoctorsByRep.get(u.id)?.size ?? 0;
      return {
        repId: u.id, name: u.name,
        teamName: team?.name ?? "Sans équipe", teamSort: team?.sortOrder ?? 9999,
        capacity, panelRec, panelSize,
        plannedVisits: planned.visits, plannedFte: planned.fte, required,
        real, realFte: fteFromEffort(real, capacity), covered,
      };
    })
    .sort((a, b) => a.teamSort - b.teamSort || a.teamName.localeCompare(b.teamName) || a.name.localeCompare(b.name));

  // KPIs (portée).
  const tCapacity = rows.reduce((s, r) => s + r.capacity, 0);
  const tPlanned = rows.reduce((s, r) => s + r.plannedVisits, 0);
  const tReal = rows.reduce((s, r) => s + r.real, 0);
  const tFte = rows.reduce((s, r) => s + r.plannedFte, 0);

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  // Groupement par équipe.
  const groups: { teamName: string; items: typeof rows }[] = [];
  for (const r of rows) {
    const g = groups[groups.length - 1];
    if (g && g.teamName === r.teamName) g.items.push(r);
    else groups.push({ teamName: r.teamName, items: [r] });
  }

  const scopeLabel = scope.mode === "all" ? "Toute la force de vente" : scope.mode === "team" ? "Mes équipes" : "Mon activité";
  const cell = "px-2 py-1.5 text-sm border-b border-border/60";

  return (
    <div className="space-y-5">
      <PageHeader title="Prévisions & Force de vente" description={`Pilotage — planifié vs réalisé, panel et couverture. ${scopeLabel}.`} />
      <PlanningTabs active="pilotage" canConfigure={scope.canConfigure} isSupervisor={scope.isSupervisor} />

      <div className="flex items-center gap-2">
        <Link href={`/planning/pilotage?y=${prev.y}&m=${prev.m}`} className="rounded-lg border border-input p-2 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></Link>
        <span className="min-w-40 text-center text-lg font-semibold">{monthLabel(year, month)}</span>
        <Link href={`/planning/pilotage?y=${next.y}&m=${next.m}`} className="rounded-lg border border-input p-2 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Effectif KAM" value={rows.length} icon="Users" />
        <KpiCard label="FTE affecté" value={tFte.toFixed(2)} icon="UserCheck" />
        <KpiCard label="Visites planifiées" value={tPlanned} icon="CalendarClock" />
        <KpiCard label="Réalisation" value={`${pct(tReal, tPlanned)}%`} icon="Route" tone={pct(tReal, tPlanned) >= 80 ? "success" : "warning"} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="Users" title="Aucun KAM" description="Aucun KAM dans votre périmètre pour ce cycle." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-2 py-2">KAM</th>
                    <th className="px-2 py-2 w-20" title="Capacité terrain (visites/mois)">Capacité</th>
                    <th className="px-2 py-2 w-24" title="Panel (praticiens) par palier">Panel</th>
                    <th className="px-2 py-2 w-24" title="Visites cibles selon la fréquence par palier">Fréq. cible</th>
                    <th className="px-2 py-2 w-20" title="Visites planifiées (affectations)">Planifié</th>
                    <th className="px-2 py-2 w-16" title="FTE affecté">FTE</th>
                    <th className="px-2 py-2 w-20" title="Visites réalisées (mois)">Réalisé</th>
                    <th className="px-2 py-2 w-20" title="Réalisé / Planifié">Réal. %</th>
                    <th className="px-2 py-2 w-24" title="Praticiens visités / panel">Couverture</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const sCap = g.items.reduce((s, r) => s + r.capacity, 0);
                    const sPlan = g.items.reduce((s, r) => s + r.plannedVisits, 0);
                    const sReal = g.items.reduce((s, r) => s + r.real, 0);
                    const sFte = g.items.reduce((s, r) => s + r.plannedFte, 0);
                    return (
                      <Fragment key={g.teamName}>
                        <tr className="bg-accent/40">
                          <td colSpan={9} className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide">{g.teamName}</td>
                        </tr>
                        {g.items.map((r) => {
                          const realPct = pct(r.real, r.plannedVisits || r.required);
                          const covPct = pct(r.covered, r.panelSize);
                          return (
                            <tr key={r.repId} className="hover:bg-secondary/30">
                              <td className={`${cell} font-medium`}>{r.name}</td>
                              <td className={`${cell} tabular-nums`}>{r.capacity}</td>
                              <td className={cell}>
                                <span className="font-medium tabular-nums">{r.panelSize}</span>
                                <span className="ml-1 text-[10px] text-muted-foreground">{TIERS.map((t) => r.panelRec[t] ? `${TIER_LABELS[t][0]}${r.panelRec[t]}` : "").filter(Boolean).join(" ")}</span>
                              </td>
                              <td className={`${cell} tabular-nums text-muted-foreground`}>{r.required}</td>
                              <td className={`${cell} tabular-nums`}>{r.plannedVisits}</td>
                              <td className={`${cell} tabular-nums`}>{r.plannedFte.toFixed(2)}</td>
                              <td className={`${cell} tabular-nums`}>{r.real}</td>
                              <td className={`${cell} tabular-nums font-medium ${toneOf(realPct)}`}>{realPct}%</td>
                              <td className={`${cell} tabular-nums ${toneOf(covPct)}`}>{covPct}% <span className="text-[10px] text-muted-foreground">({r.covered}/{r.panelSize})</span></td>
                            </tr>
                          );
                        })}
                        <tr className="bg-secondary/30 text-sm font-medium">
                          <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">Sous-total {g.teamName}</td>
                          <td className="px-2 py-1.5 tabular-nums">{sCap}</td>
                          <td className="px-2 py-1.5" />
                          <td className="px-2 py-1.5" />
                          <td className="px-2 py-1.5 tabular-nums">{sPlan}</td>
                          <td className="px-2 py-1.5 tabular-nums">{sFte.toFixed(2)}</td>
                          <td className="px-2 py-1.5 tabular-nums">{sReal}</td>
                          <td className="px-2 py-1.5 tabular-nums">{pct(sReal, sPlan)}%</td>
                          <td className="px-2 py-1.5" />
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-primary/5 text-sm font-bold">
                    <td className="px-2 py-2 text-right">Total</td>
                    <td className="px-2 py-2 tabular-nums">{tCapacity}</td>
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2 tabular-nums">{tPlanned}</td>
                    <td className="px-2 py-2 tabular-nums">{tFte.toFixed(2)}</td>
                    <td className="px-2 py-2 tabular-nums">{tReal}</td>
                    <td className="px-2 py-2 tabular-nums">{pct(tReal, tPlanned)}%</td>
                    <td className="px-2 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
