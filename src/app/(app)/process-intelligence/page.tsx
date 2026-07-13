import Link from "next/link";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getProcessOverview } from "@/lib/queries/process-intelligence";
import { runIntelligencePulse, getPulse } from "@/lib/adventum/pulse";
import { PulseStrip } from "@/components/adventum/pulse-strip";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { BRAIN_TABS } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PiTabs } from "./pi-tabs";
import { AiSynthesis } from "./ai-synthesis";

export const dynamic = "force-dynamic";

const ageTone = (d: number) => (d >= 21 ? "text-destructive" : d >= 14 ? "text-warning" : "text-muted-foreground");

export default async function ProcessIntelligencePage() {
  const user = await requireModule("PROCESS_INTELLIGENCE");
  // Analyse EN CONTINU : rafraîchit l'instantané (auto-débounce 1×/h) puis lit la tendance.
  await runIntelligencePulse();
  const [o, pulse] = await Promise.all([getProcessOverview(), getPulse()]);

  return (
    <div className="space-y-5">
      <ModuleTabs tabs={BRAIN_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />
      <PageHeader title="Process Intelligence" description="Où la société ralentit : durées par étape, blocages, dossiers sans action et validations en attente. Réservé au Super Admin." />
      <PiTabs />

      <PulseStrip pulse={pulse} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Dossiers en cours" value={o.stats.inProgress} icon="GitBranch" />
        <KpiCard label="Bloqués (>14 j)" value={o.stats.stuck} icon="AlertTriangle" tone={o.stats.stuck > 0 ? "warning" : "default"} />
        <KpiCard label="Échéances dépassées" value={o.stats.overdue} icon="CalendarX" tone={o.stats.overdue > 0 ? "danger" : "default"} />
        <KpiCard label="Validations en attente" value={o.stats.validationsPending} icon="ShieldAlert" tone={o.stats.validationsPending > 0 ? "warning" : "default"} />
      </div>

      <AiSynthesis scope="overview" />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Alertes */}
        <Card>
          <CardHeader><CardTitle>Alertes ({o.alerts.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {o.alerts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aucune alerte. Tout avance dans les délais. 👍</p>
            ) : (
              <ul className="divide-y divide-border">
                {o.alerts.map((a, i) => (
                  <li key={i}>
                    <Link href={a.link} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-secondary/40">
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.level === "danger" ? "bg-destructive" : a.level === "warning" ? "bg-warning" : "bg-primary")} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Étapes les plus lentes */}
        <Card>
          <CardHeader><CardTitle>Étapes les plus lentes</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {o.bottleneckStages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Pas assez de données.</p>
            ) : (
              o.bottleneckStages.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{s.label}</span>
                    <span className={cn("font-semibold tabular-nums", ageTone(s.avgAge))}>{s.avgAge} j</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(s.avgAge * 3, 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{s.count} dossier{s.count > 1 ? "s" : ""}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top blocages */}
      <Card>
        <CardHeader><CardTitle>Top blocages — dossiers les plus lents</CardTitle></CardHeader>
        <CardContent className="p-0">
          {o.topBlockers.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucun dossier en cours.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Objet</TableHead><TableHead>Module</TableHead><TableHead>Statut</TableHead>
                  <TableHead>Responsable</TableHead><TableHead className="text-right">Sans action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.topBlockers.map((b) => (
                  <TableRow key={b.key}>
                    <TableCell className="font-medium"><Link href={b.link} className="hover:underline">{b.label}</Link>{b.reference && <span className="ml-1 text-xs text-muted-foreground">{b.reference}</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{b.moduleName}</TableCell>
                    <TableCell><Badge tone="neutral" dot={false}>{b.statusLabel}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{b.ownerName ?? "— non assigné"}</TableCell>
                    <TableCell className={cn("text-right font-semibold tabular-nums", ageTone(b.ageDays))}>{b.ageDays} j{b.overdue && " ⚠"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Par module + validations en attente */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Par module</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Module</TableHead><TableHead className="text-right">En cours</TableHead><TableHead className="text-right">Âge moyen</TableHead><TableHead className="text-right">Bloqués</TableHead></TableRow></TableHeader>
              <TableBody>
                {o.byModule.map((m) => (
                  <TableRow key={m.moduleKey}>
                    <TableCell className="font-medium">{m.moduleName}</TableCell>
                    <TableCell className="text-right">{m.count}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", ageTone(m.avgAge))}>{m.avgAge} j</TableCell>
                    <TableCell className="text-right">{m.stuck > 0 ? <Badge tone="warning" dot={false}>{m.stuck}</Badge> : "0"}</TableCell>
                  </TableRow>
                ))}
                {o.byModule.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Aucune donnée.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Validations en attente ({o.pendingValidations.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {o.pendingValidations.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aucune validation en attente.</p>
            ) : (
              <ul className="divide-y divide-border">
                {o.pendingValidations.slice(0, 12).map((v) => (
                  <li key={v.id}>
                    <Link href={v.link} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{v.title}</p>
                        <p className="text-xs text-muted-foreground">{v.reference}{v.validatorName ? ` · ${v.validatorName}` : ""}</p>
                      </div>
                      <span className={cn("text-sm font-semibold tabular-nums", ageTone(v.ageDays))}>{v.ageDays} j</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
