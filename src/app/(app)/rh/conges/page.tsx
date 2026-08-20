import Link from "next/link";
import { CalendarOff, PlaneTakeoff, CheckCheck, AlarmClock } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getRhData } from "@/lib/queries/hr";
import { getHrPulse } from "@/lib/queries/hr-pulse";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { HR_TABS, LEAVE_TYPE, LEAVE_STATUS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { LeaveEditButton } from "@/components/hr/leave-edit";
import { prisma } from "@/lib/prisma";
import { MODULE_LABELS } from "@/lib/labels";
import { StandInBadge, StandInDecision } from "@/components/hr/stand-in-panel";
import type { StandInStatus } from "@/lib/hr/stand-in";

export const dynamic = "force-dynamic";

/**
 * RH — LES CONGÉS, vus depuis la seule question qui compte au quotidien :
 * **qui est absent aujourd'hui, et qui part bientôt ?**
 *
 * Le module savait lister les demandes à traiter et l'historique. Il ne savait pas dire l'état
 * de l'équipe *maintenant* — c'est pourtant ce qu'on demande aux RH quand on cherche
 * quelqu'un, qu'on planifie une réunion ou qu'on répartit une charge.
 */
export default async function RhLeavePage() {
  const user = await requireModule("RH");
  const canManage = userCan(user, "RH", "UPDATE");

  const [data, pulse, tabs] = await Promise.all([getRhData(user.id), getHrPulse(user.id), visibleTabs(user, HR_TABS)]);
  // Les intérims EN ATTENTE des RH : la marche qui manque pour que la délégation s'ouvre.
  const standIns = canManage
    ? await prisma.leaveRequest.findMany({
        where: { standInStatus: "PENDING", status: { notIn: ["REJECTED", "CANCELLED"] } },
        orderBy: { startDate: "asc" },
        include: { employee: { select: { fullName: true } }, standIn: { select: { name: true } } },
      })
    : [];
  const absentPct = pulse.activeCount > 0 ? Math.round((pulse.absentToday.length / pulse.activeCount) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Congés" description="Qui est absent aujourd'hui, qui part bientôt, et l'historique des décisions." />
      <ModuleTabs tabs={tabs} />

      {/* 1. MAINTENANT — l'état de l'équipe aujourd'hui. */}
      <section className="surface space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarOff className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Absents aujourd&apos;hui</h2>
          <Badge tone={pulse.absentToday.length > 0 ? "warning" : "success"} dot={false}>
            {pulse.absentToday.length} sur {pulse.activeCount}
            {pulse.activeCount > 0 ? ` · ${absentPct} %` : ""}
          </Badge>
        </div>
        {pulse.absentToday.length === 0 ? (
          <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <CheckCheck className="h-4 w-4 text-success" /> Toute l&apos;équipe est présente.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {pulse.absentToday.map((a) => (
              <li key={`${a.employeeId}-${a.startDate}`} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <Link href={`/rh/${a.employeeId}`} className="font-medium hover:underline">{a.employee}</Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {[a.position, a.department].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <Badge tone="neutral" dot={false}>{LEAVE_TYPE[a.type] ?? a.type}</Badge>
                <span className="shrink-0 text-xs text-muted-foreground">
                  jusqu&apos;au {formatDate(a.endDate)}
                  {a.daysLeft === 0 ? " · revient demain" : ` · encore ${a.daysLeft} j`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. BIENTÔT — anticiper plutôt que constater. */}
      {pulse.upcoming.length > 0 && (
        <section className="surface space-y-3 p-4">
          <div className="flex items-center gap-2">
            <PlaneTakeoff className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Départs dans les 14 jours</h2>
          </div>
          <ul className="divide-y divide-border">
            {pulse.upcoming.map((u) => (
              <li key={`${u.employeeId}-${u.startDate}`} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <Link href={`/rh/${u.employeeId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{u.employee}</Link>
                <Badge tone="neutral" dot={false}>{LEAVE_TYPE[u.type] ?? u.type}</Badge>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(u.startDate)} → {formatDate(u.endDate)} · dans {u.inDays} j
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3. Les échéances qu'on oublie : fin de période d'essai et fin de contrat. */}
      {pulse.deadlines.length > 0 && (
        <section className="surface space-y-3 p-4">
          <div className="flex items-center gap-2">
            <AlarmClock className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold">Échéances à ne pas manquer</h2>
            <span className="text-xs text-muted-foreground">période d&apos;essai et fin de contrat, sous 60 jours</span>
          </div>
          <ul className="divide-y divide-border">
            {pulse.deadlines.map((d) => (
              <li key={`${d.employeeId}-${d.kind}`} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <Link href={`/rh/${d.employeeId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{d.employee}</Link>
                <Badge tone={d.kind === "TRIAL" ? "info" : "warning"} dot={false}>
                  {d.kind === "TRIAL" ? "Fin de période d'essai" : "Fin de contrat"}
                </Badge>
                <span className={`shrink-0 text-xs ${d.inDays <= 15 ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                  {formatDate(d.date)} · dans {d.inDays} j
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 4. Soldes : ce qui risque d'être reporté ou perdu en fin d'année. */}
      {pulse.leaveBalance.heaviest.length > 0 && (
        <section className="surface space-y-2 p-4">
          <h2 className="text-sm font-semibold">Soldes de congés</h2>
          <p className="text-sm text-muted-foreground">
            {pulse.leaveBalance.totalDays} jours restants au total sur l&apos;effectif actif. Les soldes les plus élevés :
          </p>
          <ul className="flex flex-wrap gap-2">
            {pulse.leaveBalance.heaviest.map((b) => (
              <li key={b.employee} className="rounded-lg border border-border px-2.5 py-1 text-xs">
                {b.employee} · <strong>{b.days} j</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 4 bis. LES INTÉRIMAIRES À VALIDER — c'est la marche RH du dispositif.
          L'absent désigne (il sait qui peut le remplacer sur son métier), les RH vérifient que
          ce n'est pas un remplaçant de complaisance. Sans cette marche, la délégation
          deviendrait un moyen de contourner un circuit. */}
      {canManage && standIns.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Intérimaires à valider ({standIns.length})
          </h2>
          <ul className="divide-y rounded-xl border">
            {standIns.map((l) => (
              <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {l.employee.fullName} — congé du {formatDate(l.startDate)} au {formatDate(l.endDate)}
                  </p>
                  <StandInBadge
                    state={{
                      standInId: l.standInId,
                      standInName: l.standIn?.name ?? null,
                      standInStatus: l.standInStatus as StandInStatus | null,
                      standInModules: l.standInModules,
                      standInNote: l.standInNote,
                    }}
                    moduleLabels={MODULE_LABELS}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Une fois validé, l&apos;intérimaire pourra ouvrir ces modules et trancher les
                    validations adressées à l&apos;absent — pendant le congé seulement.
                  </p>
                </div>
                <StandInDecision leaveId={l.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 5. L'historique des décisions, modifiable par les RH. */}
      {data.recentLeaves.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Historique des décisions</h2>
          <div className="surface overflow-hidden">
            <Table mobileCards>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead className="text-right">Jours</TableHead>
                  <TableHead>Statut</TableHead>
                  {canManage && <TableHead className="text-right">Modifier</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentLeaves.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell label="Employé" className="font-medium">{l.employee.fullName}</TableCell>
                    <TableCell label="Type">{LEAVE_TYPE[l.type] ?? l.type}</TableCell>
                    <TableCell label="Période">{formatDate(l.startDate)} → {formatDate(l.endDate)}</TableCell>
                    <TableCell label="Jours" className="text-right">{Number(l.days)}</TableCell>
                    <TableCell label="Statut"><StatusBadge map={LEAVE_STATUS} value={l.status} /></TableCell>
                    {canManage && (
                      <TableCell label="Modifier" className="text-right">
                        <div className="flex justify-end">
                          <LeaveEditButton leave={{ id: l.id, employee: l.employee.fullName, type: l.type, startDate: l.startDate.toISOString(), endDate: l.endDate.toISOString(), days: Number(l.days), reason: l.reason, status: l.status, decisionNote: l.decisionNote }} />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
