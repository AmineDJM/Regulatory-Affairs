import { requireModule } from "@/lib/session";
import { accessibleModules, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getMyWorkspace } from "@/lib/queries/hr";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { createTask, requestTask } from "@/lib/actions/task-actions";
import { requestLeave, requestAdvance } from "@/lib/actions/hr-actions";
import { ROLE_LABELS, PRIORITY, LEAVE_TYPE, WORKSPACE_TABS, MODULE_LABELS } from "@/lib/labels";
import { listMyReminders } from "@/lib/queries/reminders";
import { MyReminders } from "@/components/reminders/my-reminders";
import { ReminderButton } from "@/components/reminders/reminder-button";
import { TaskList, type TaskItem } from "./task-list";
import { MyLeaves, type LeaveItem } from "./my-leaves";
import { MyAdvances, type AdvanceItem } from "./my-advances";

export default async function MonEspacePage() {
  const user = await requireModule("WORKSPACE");
  const data = await getMyWorkspace(user.id);
  const canCreateDossier = userCan(user, "DOSSIERS", "CREATE");

  const [users, requested, reminders] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    // Tâches **demandées** à l'utilisateur (à accepter / refuser), comme des DM.
    prisma.task.findMany({
      where: { assignedToId: user.id, status: "REQUESTED" },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    listMyReminders(user.id),
  ]);
  const reminderRows = reminders.map((r) => ({ ...r, remindAt: r.remindAt.toISOString(), sentAt: r.sentAt ? r.sentAt.toISOString() : null }));

  // Course / livraison : on remonte aussi adresse + horodatages pour le suivi de durée.
  const toItem = (t: (typeof data.myTasks)[number]): TaskItem => ({
    id: t.id, title: t.title, description: t.description, status: t.status,
    priority: t.priority, dueDate: t.dueDate ? t.dueDate.toISOString() : null, module: t.module,
    address: t.address, startedAt: t.startedAt ? t.startedAt.toISOString() : null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null, expectedMinutes: t.expectedMinutes,
  });
  const myTasks: TaskItem[] = data.myTasks.map(toItem);
  const delegated: TaskItem[] = data.delegated.map((t) => ({ ...toItem(t), assignee: t.assignedTo?.name ?? null }));
  const requestedTasks: TaskItem[] = requested.map((t) => ({ ...toItem(t), requestedBy: t.createdBy?.name ?? null }));
  const myLeaves: LeaveItem[] = data.myLeaves.map((l) => ({
    id: l.id, type: l.type, startDate: l.startDate.toISOString(), endDate: l.endDate.toISOString(),
    days: Number(l.days), status: l.status,
  }));
  const myAdvances: AdvanceItem[] = data.myAdvances.map((a) => ({
    id: a.id, amount: Number(a.amount), reason: a.reason, status: a.status, createdAt: a.createdAt.toISOString(),
  }));

  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));
  const moduleOptions = accessibleModules(user)
    .filter((m) => m !== "WORKSPACE")
    .map((m) => ({ value: m, label: MODULE_LABELS[m] ?? m }));

  const taskFields: FieldDef[] = [
    { type: "text", name: "title", label: "Intitulé", required: true, full: true },
    { type: "textarea", name: "description", label: "Description" },
    { type: "select", name: "assignedToId", label: "Assignée à", options: userOptions, defaultValue: user.id },
    { type: "select", name: "priority", label: "Priorité", options: optionsFromMap(PRIORITY), defaultValue: "MEDIUM" },
    { type: "date", name: "dueDate", label: "Échéance" },
    { type: "select", name: "module", label: "Module concerné", options: moduleOptions, placeholder: "—" },
    { type: "text", name: "address", label: "Adresse / lieu (course, livraison)", full: true, placeholder: "ex. PCH, Route de…, Alger" },
    { type: "number", name: "expectedMinutes", label: "Durée estimée (min, pour détecter un retard)" },
  ];

  // Demande de tâche à un collègue (acceptée / refusée), comme un DM.
  const requestFields: FieldDef[] = [
    { type: "text", name: "title", label: "Que demandez-vous ?", required: true, full: true },
    { type: "textarea", name: "description", label: "Détails" },
    { type: "select", name: "assignedToId", label: "À qui ?", options: userOptions.filter((o) => o.value !== user.id), placeholder: "Choisir une personne" },
    { type: "select", name: "priority", label: "Priorité", options: optionsFromMap(PRIORITY), defaultValue: "MEDIUM" },
    { type: "date", name: "dueDate", label: "Pour le (optionnel)" },
    { type: "text", name: "address", label: "Adresse / lieu (si déplacement)", full: true },
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
          description="Une to-do pour vous ou à déléguer. Ajoutez une adresse pour une course (suivi de durée)." action={createTask} fields={taskFields} />
        <CreateRecordButton label="Demander une tâche" title="Demander une tâche à un collègue" width="md"
          description="Le destinataire l'accepte ou la refuse (comme un message). Elle apparaît dans ses « Tâches demandées »." action={requestTask} fields={requestFields} />
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

      {requestedTasks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tâches demandées ({requestedTasks.length})</h2>
          <TaskList tasks={requestedTasks} />
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes rappels{reminderRows.length > 0 ? ` (${reminderRows.length})` : ""}</h2>
          <ReminderButton label="Nouveau rappel" defaultTitle="" link="/mon-espace" />
        </div>
        <MyReminders reminders={reminderRows} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes tâches</h2>
        <TaskList tasks={myTasks} canCreateDossier={canCreateDossier} />
      </section>

      {delegated.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tâches que j'ai déléguées</h2>
          <TaskList tasks={delegated} showAssignee canCreateDossier={canCreateDossier} />
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

    </div>
  );
}
