import Link from "next/link";
import { requireModule } from "@/lib/session";
import { accessibleModules, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getMyWorkspace } from "@/lib/queries/hr";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { createTask } from "@/lib/actions/task-actions";
import { requestLeave, requestAdvance } from "@/lib/actions/hr-actions";
import { NAVIGATION, ROLE_LABELS, PRIORITY, LEAVE_TYPE, WORKSPACE_TABS } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { TaskList, type TaskItem } from "./task-list";
import { MyLeaves, type LeaveItem } from "./my-leaves";
import { MyAdvances, type AdvanceItem } from "./my-advances";

export default async function MonEspacePage() {
  const user = await requireModule("WORKSPACE");
  const data = await getMyWorkspace(user.id);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const mods = accessibleModules(user);
  const quickLinks = NAVIGATION.filter((n) => mods.includes(n.module) && n.module !== "WORKSPACE");

  const myTasks: TaskItem[] = data.myTasks.map((t) => ({
    id: t.id, title: t.title, description: t.description, status: t.status,
    priority: t.priority, dueDate: t.dueDate ? t.dueDate.toISOString() : null, module: t.module,
  }));
  const delegated: TaskItem[] = data.delegated.map((t) => ({
    id: t.id, title: t.title, description: t.description, status: t.status,
    priority: t.priority, dueDate: t.dueDate ? t.dueDate.toISOString() : null, module: t.module,
    assignee: t.assignedTo?.name ?? null,
  }));
  const myLeaves: LeaveItem[] = data.myLeaves.map((l) => ({
    id: l.id, type: l.type, startDate: l.startDate.toISOString(), endDate: l.endDate.toISOString(),
    days: Number(l.days), status: l.status,
  }));
  const myAdvances: AdvanceItem[] = data.myAdvances.map((a) => ({
    id: a.id, amount: Number(a.amount), reason: a.reason, status: a.status, createdAt: a.createdAt.toISOString(),
  }));

  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));
  const moduleOptions = quickLinks.map((n) => ({ value: n.module, label: n.label }));

  const taskFields: FieldDef[] = [
    { type: "text", name: "title", label: "Intitulé", required: true, full: true },
    { type: "textarea", name: "description", label: "Description" },
    { type: "select", name: "assignedToId", label: "Assignée à", options: userOptions, defaultValue: user.id },
    { type: "select", name: "priority", label: "Priorité", options: optionsFromMap(PRIORITY), defaultValue: "MEDIUM" },
    { type: "date", name: "dueDate", label: "Échéance" },
    { type: "select", name: "module", label: "Module concerné", options: moduleOptions, placeholder: "—" },
  ];

  const leaveFields: FieldDef[] = [
    { type: "select", name: "type", label: "Type (congé, maladie, arrêt exceptionnel…)", options: optionsFromMap(LEAVE_TYPE), defaultValue: "ANNUAL", full: true },
    { type: "date", name: "startDate", label: "Du", required: true },
    { type: "date", name: "endDate", label: "Au", required: true },
    { type: "number", name: "days", label: "Nombre de jours (optionnel)" },
    { type: "textarea", name: "reason", label: "Motif" },
  ];

  const advanceFields: FieldDef[] = [
    { type: "number", name: "amount", label: "Montant souhaité (DZD)", required: true, full: true },
    { type: "textarea", name: "reason", label: "Motif" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour ${user.name.split(" ")[0]} 👋`}
        description={`Votre espace de travail — ${ROLE_LABELS[user.role] ?? user.role}.`}
      >
        <CreateRecordButton label="Nouvelle tâche" title="Créer une tâche" width="md"
          description="Une to-do pour vous ou à déléguer." action={createTask} fields={taskFields} />
        {data.employee && (
          <>
            <CreateRecordButton label="Demander un congé" title="Demande de congé / absence" width="md"
              description="Congé annuel, maladie, arrêt exceptionnel… Soumis aux RH pour validation." action={requestLeave} fields={leaveFields} />
            <CreateRecordButton label="Demander une avance" title="Avance sur salaire" width="md"
              description="Soumise aux RH, puis réglée par la comptabilité." action={requestAdvance} fields={advanceFields} />
          </>
        )}
      </PageHeader>
      <ModuleTabs tabs={WORKSPACE_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Tâches ouvertes" value={data.stats.openTasks} icon="ListTodo" />
        <KpiCard label="En retard" value={data.stats.overdue} icon="AlarmClock" tone={data.stats.overdue > 0 ? "danger" : "default"} />
        <KpiCard label="Congés en attente" value={data.stats.pendingLeaves} icon="Hourglass" tone={data.stats.pendingLeaves > 0 ? "warning" : "default"} />
        <KpiCard label="Solde congés" value={data.stats.leaveBalance === null ? "—" : `${data.stats.leaveBalance} j`} icon="Plane" tone="info" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes tâches</h2>
        <TaskList tasks={myTasks} />
      </section>

      {delegated.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tâches que j'ai déléguées</h2>
          <TaskList tasks={delegated} showAssignee />
        </section>
      )}

      {data.employee ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes congés</h2>
            <MyLeaves leaves={myLeaves} />
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes avances sur salaire</h2>
            <MyAdvances advances={myAdvances} />
          </section>
        </div>
      ) : (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">
          Aucune fiche employé n'est liée à votre compte. Demandez à l'administrateur de la créer pour activer les congés et les avances sur salaire.
        </CardContent></Card>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Activité récente</h2>
        <Card>
          <CardContent className="p-0">
            {data.activity.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aucune activité enregistrée.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="truncate text-foreground">{a.module ?? a.path ?? "—"}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Accès rapides</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {quickLinks.map((n) => (
            <Link key={n.module} href={n.href} className="surface flex items-center gap-3 p-4 transition-colors hover:bg-secondary">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon name={n.icon} className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">{n.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
