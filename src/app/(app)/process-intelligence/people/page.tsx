import { requireModule } from "@/lib/session";
import { getWorkloadAnalysis } from "@/lib/queries/process-intelligence";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import { PiTabs } from "../pi-tabs";
import { AiSynthesis } from "../ai-synthesis";

export const dynamic = "force-dynamic";

export default async function PeopleWorkloadPage() {
  await requireModule("PROCESS_INTELLIGENCE");
  const w = await getWorkloadAnalysis();
  const maxTotal = Math.max(1, ...w.topLoaded.map((r) => r.total));

  return (
    <div className="space-y-5">
      <PageHeader title="People & Workload Analyzer" description="Charge réelle des équipes, retards et blocages humains — pour rééquilibrer, pas pour surveiller. Réservé au Super Admin." />
      <PiTabs />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Personnes actives" value={w.rows.length} icon="Users" />
        <KpiCard label="Tâches sans responsable" value={w.tasksWithoutOwner} icon="UserX" tone={w.tasksWithoutOwner > 0 ? "warning" : "default"} />
        <KpiCard label="Top charge" value={w.topLoaded[0]?.total ?? 0} icon="Gauge" tone="info" />
        <KpiCard label="Inactifs (>7 j)" value={w.inactive.length} icon="MoonStar" tone={w.inactive.length > 0 ? "warning" : "default"} />
      </div>

      <AiSynthesis scope="people" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Top chargés */}
        <Card>
          <CardHeader><CardTitle>Utilisateurs les plus chargés</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {w.topLoaded.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune charge active.</p>
            ) : (
              w.topLoaded.map((r) => (
                <div key={r.userId}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.name} size="sm" />
                    <span className="flex-1 truncate text-sm font-medium">{r.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{r.total}</span>
                  </div>
                  <div className="ml-9 mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(r.total / maxTotal) * 100}%` }} />
                  </div>
                  <p className="ml-9 text-[0.6875rem] text-muted-foreground">
                    {r.openTasks} tâches · {r.openAdmin} demandes · {r.regulatory} regulatory · {r.pendingValidations} validations{r.overdueTasks > 0 ? ` · ${r.overdueTasks} en retard` : ""}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Charge par département */}
        <Card>
          <CardHeader><CardTitle>Charge par département</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Département</TableHead><TableHead className="text-right">Charge</TableHead><TableHead className="text-right">Retards</TableHead></TableRow></TableHeader>
              <TableBody>
                {w.byDepartment.map((d) => (
                  <TableRow key={d.department}>
                    <TableCell className="font-medium">{d.department}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.total}</TableCell>
                    <TableCell className="text-right">{d.overdue > 0 ? <Badge tone="danger" dot={false}>{d.overdue}</Badge> : "0"}</TableCell>
                  </TableRow>
                ))}
                {w.byDepartment.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">Aucune donnée.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Tableau détaillé */}
      <Card>
        <CardHeader><CardTitle>Charge détaillée par personne</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personne</TableHead><TableHead>Département</TableHead>
                  <TableHead className="text-right">Tâches</TableHead><TableHead className="text-right">Retard</TableHead>
                  <TableHead className="text-right">Demandes</TableHead><TableHead className="text-right">Regulatory</TableHead>
                  <TableHead className="text-right">Validations</TableHead><TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions 30 j</TableHead><TableHead>Vu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {w.rows.map((r) => (
                  <TableRow key={r.userId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.department ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.openTasks}</TableCell>
                    <TableCell className={cn("text-right", r.overdueTasks > 0 && "font-semibold text-destructive")}>{r.overdueTasks}</TableCell>
                    <TableCell className="text-right">{r.openAdmin}</TableCell>
                    <TableCell className="text-right">{r.regulatory}</TableCell>
                    <TableCell className="text-right">{r.pendingValidations}</TableCell>
                    <TableCell className="text-right font-semibold">{r.total}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.actions30}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.lastActivity ? formatDate(r.lastActivity) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
