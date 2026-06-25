import Link from "next/link";
import { ArrowRight, Bell } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getActionCenter, type ActionItem } from "@/lib/queries/action-center";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PRIORITY, ROLE_LABELS } from "@/lib/labels";
import { formatDate, formatDateTime, daysUntil } from "@/lib/utils";

export default async function MonTravailPage() {
  const user = await requireModule("WORKSPACE");
  const { items, notifications, stats } = await getActionCenter(user);

  const overdue = items.filter((i) => i.deadline && new Date(i.deadline) < new Date());
  const soon = items.filter((i) => {
    if (!i.deadline) return false;
    const d = daysUntil(i.deadline);
    return d !== null && d >= 0 && d <= 3;
  });
  const validations = items.filter((i) => i.kind === "validation");
  const toHandle = items.filter((i) => i.kind === "request" || i.kind === "payment" || i.kind === "regulatory" || i.kind === "hr");
  const myTasks = items.filter((i) => i.kind === "task");
  const nothing = items.length === 0 && notifications.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Mon travail`}
        description={`Bonjour ${user.name.split(" ")[0]} — voici ce qui vous attend aujourd'hui. ${ROLE_LABELS[user.role] ?? ""}`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <KpiCard label="À faire" value={stats.todo} icon="ListChecks" />
        <KpiCard label="Urgent" value={stats.urgent} icon="Flame" tone={stats.urgent > 0 ? "danger" : "default"} />
        <KpiCard label="En retard" value={stats.overdue} icon="AlarmClock" tone={stats.overdue > 0 ? "danger" : "default"} />
        <KpiCard label="Validations" value={stats.validations} icon="ShieldCheck" tone={stats.validations > 0 ? "warning" : "default"} />
        <KpiCard label="Notifications" value={stats.unread} icon="Bell" tone={stats.unread > 0 ? "info" : "default"} />
      </div>

      {nothing && (
        <EmptyState icon="CheckCheck" title="Tout est à jour 🎉" description="Vous n'avez aucune action en attente pour le moment." />
      )}

      {overdue.length > 0 && (
        <ActionSection title={`En retard (${overdue.length})`} items={overdue} tone="danger" />
      )}
      {soon.length > 0 && (
        <ActionSection title={`À faire bientôt (${soon.length})`} items={soon} />
      )}
      {validations.length > 0 && (
        <ActionSection title={`Validations à faire (${validations.length})`} items={validations} cta="/validations" ctaLabel="Toutes mes validations" />
      )}
      {toHandle.length > 0 && (
        <ActionSection title={`Demandes & dossiers à traiter (${toHandle.length})`} items={toHandle} />
      )}
      {myTasks.length > 0 && (
        <ActionSection title={`Mes tâches (${myTasks.length})`} items={myTasks} cta="/mon-espace" ctaLabel="Mon espace" />
      )}

      {notifications.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notifications importantes ({notifications.length})</h2>
            <Link href="/notifications" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Toutes <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {notifications.map((n) => {
                  const inner = (
                    <div className="flex items-start gap-3 px-4 py-2.5">
                      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{n.title}</p>
                        {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                    </div>
                  );
                  return n.link ? <li key={n.id}><Link href={n.link} className="block hover:bg-secondary/50">{inner}</Link></li> : <li key={n.id}>{inner}</li>;
                })}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function ActionSection({ title, items, tone, cta, ctaLabel }: { title: string; items: ActionItem[]; tone?: "danger"; cta?: string; ctaLabel?: string }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${tone === "danger" ? "text-destructive" : "text-muted-foreground"}`}>{title}</h2>
        {cta && <Link href={cta} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">{ctaLabel} <ArrowRight className="h-3.5 w-3.5" /></Link>}
      </div>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {items.map((i) => <ActionRow key={i.key} item={i} />)}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

function ActionRow({ item }: { item: ActionItem }) {
  const d = item.deadline ? daysUntil(item.deadline) : null;
  const overdue = d !== null && d < 0;
  const prio = item.priority ? PRIORITY[item.priority] : null;
  return (
    <li>
      <Link href={item.href} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.title}</span>
            {prio && (prio.tone === "warning" || prio.tone === "danger") && <Badge tone={prio.tone} dot={false}>{prio.label}</Badge>}
            {item.statusLabel && <Badge tone={item.statusTone ?? "neutral"} dot={false}>{item.statusLabel}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{item.module}</span>
            {item.subtitle ? ` · ${item.subtitle}` : ""}
            {item.owner ? ` · ${item.owner}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {item.deadline && (
            <span className={`text-xs ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
              {formatDate(item.deadline)}{overdue ? " · en retard" : d === 0 ? " · aujourd'hui" : ""}
            </span>
          )}
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </Link>
    </li>
  );
}
