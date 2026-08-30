import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireModule } from "@/lib/session";
import { accessibleModules, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getMyWorkspace, getMyLeaveRequests, getLeavesToDecide } from "@/lib/queries/hr";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { createTask } from "@/lib/actions/task-actions";
import { getActionCenter, type ActionItem } from "@/lib/queries/action-center";
import { Badge } from "@/components/ui/badge";
import { formatDate, daysUntil } from "@/lib/utils";
import { ROLE_LABELS, PRIORITY, WORKSPACE_TABS, MODULE_LABELS } from "@/lib/labels";
import { listMyReminders } from "@/lib/queries/reminders";
import { MyReminders } from "@/components/reminders/my-reminders";
import { ReminderButton } from "@/components/reminders/reminder-button";
import { TaskList, type TaskItem } from "./task-list";
import { MyLeaves } from "@/components/hr/my-leaves";
import { LeaveApprovals } from "@/components/hr/leave-approvals";
import { MyAdvances, type AdvanceItem } from "./my-advances";
import { MyPortfolioCard } from "@/components/planning/my-portfolio-card";
import { getMyPortfolio } from "@/lib/queries/portfolio";

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

  // Le cercle d'une tâche, en clair : « Participants : … · Lecture : … ». Les identifiants sont
  // résolus une fois, contre la liste déjà chargée.
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const involvedText = (participantIds: string[], readerIds: string[]): string | null => {
    const names = (ids: string[]) => ids.map((id) => nameById.get(id)).filter((n): n is string => Boolean(n));
    const parts: string[] = [];
    const p = names(participantIds); if (p.length) parts.push(`Participants : ${p.join(", ")}`);
    const r = names(readerIds); if (r.length) parts.push(`Lecture : ${r.join(", ")}`);
    return parts.length ? parts.join(" · ") : null;
  };

  // Course / livraison : on remonte aussi adresse + horodatages pour le suivi de durée.
  const toItem = (t: (typeof data.myTasks)[number]): TaskItem => ({
    id: t.id, title: t.title, description: t.description, status: t.status,
    priority: t.priority, dueDate: t.dueDate ? t.dueDate.toISOString() : null, module: t.module,
    address: t.address, startedAt: t.startedAt ? t.startedAt.toISOString() : null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null, expectedMinutes: t.expectedMinutes,
    requestedAt: t.requestedAt ? t.requestedAt.toISOString() : null,
    declineReason: t.declineReason, completionNote: t.completionNote,
    involved: involvedText(t.participantIds, t.readerIds),
  });
  const myTasks: TaskItem[] = data.myTasks.map(toItem);
  // Ce que J'AI demandé à quelqu'un, séparé de ce que j'ai simplement délégué : le premier
  // attend une réponse (ou en a reçu une), le second est déjà en route. Les mélanger, c'est
  // perdre de vue la demande qu'on vient d'envoyer — exactement ce qui manquait.
  const delegatedAll: TaskItem[] = data.delegated.map((t) => ({ ...toItem(t), assignee: t.assignedTo?.name ?? null }));
  const myRequests: TaskItem[] = delegatedAll.filter((t) => t.requestedAt || t.status === "REQUESTED" || t.status === "DECLINED");
  const delegated: TaskItem[] = delegatedAll.filter((t) => !myRequests.includes(t));
  const requestedTasks: TaskItem[] = requested.map((t) => ({ ...toItem(t), requestedBy: t.createdBy?.name ?? null }));
  // Tâches partagées avec moi : je PARTICIPE (je peux agir) ou je suis en LECTURE (je vois).
  const participating: TaskItem[] = data.shared
    .filter((t) => t.participantIds.includes(user.id))
    .map((t) => ({ ...toItem(t), assignee: t.assignedTo?.name ?? null }));
  const watching: TaskItem[] = data.shared
    .filter((t) => !t.participantIds.includes(user.id))
    .map((t) => ({ ...toItem(t), assignee: t.assignedTo?.name ?? null }));
  // Mes congés ET les congés que je dois trancher : le responsable d'équipe n'a pas le module
  // RH, sa file de validation ne peut donc vivre qu'ici.
  // LA DEMANDE DE CONGÉ SE FAIT DANS « MON DOSSIER RH », et là seulement : c'est le dossier de
  // la personne, avec sa fiche, ses documents et ses demandes. Deux boutons pour la même
  // demande, sur deux écrans, faisaient croire à deux circuits. Ici on LIT ses congés et l'on
  // signe ceux des autres.
  const [myLeaves, leavesToDecide, { items: actionItems }] = await Promise.all([
    getMyLeaveRequests(user.id),
    getLeavesToDecide(user),
    // « MON TRAVAIL » A FONDU ICI : ce qui attend une signature se lit en tête de son espace,
    // au lieu d'un second écran qu'on ouvrait — ou pas.
    getActionCenter(user),
  ]);
  const validations = actionItems.filter((i) => i.kind === "validation" || i.kind === "payment");
  // Les TÂCHES du centre d'action ne sont pas reprises : elles ont déjà leurs sections ici,
  // plus riches. Les répéter ferait lire deux fois la même to-do.
  const toHandle = actionItems.filter((i) => i.kind === "request" || i.kind === "regulatory" || i.kind === "hr");
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
    // LE DESTINATAIRE DÉCIDE DE LA NATURE DU GESTE. Pour soi, c'est une to-do ; pour quelqu'un
    // d'autre, c'est une DEMANDE qu'il accepte ou refuse. On le dit ici, sur le champ qui
    // tranche — pas dans la description du formulaire, que personne ne relit.
    { type: "select", name: "assignedToId", label: "Assignée à", options: userOptions, defaultValue: user.id,
      hint: "Vous-même : simple to-do. Quelqu'un d'autre : une demande, qu'il accepte ou refuse — il est prévenu tout de suite." },
    { type: "select", name: "priority", label: "Priorité", options: optionsFromMap(PRIORITY), defaultValue: "MEDIUM" },
    { type: "date", name: "dueDate", label: "Échéance" },
    { type: "select", name: "module", label: "Module concerné", options: moduleOptions, placeholder: "—" },
    { type: "multiselect", name: "participantIds", label: "Participants", options: userOptions.filter((o) => o.value !== user.id), hint: "Ils peuvent agir sur la tâche (démarrer, terminer).", full: true },
    { type: "multiselect", name: "readerIds", label: "En lecture", options: userOptions.filter((o) => o.value !== user.id), hint: "Ils voient la tâche sans pouvoir la modifier.", full: true },
    { type: "text", name: "address", label: "Adresse / lieu (course, livraison)", full: true, placeholder: "ex. PCH, Route de…, Alger" },
    { type: "number", name: "expectedMinutes", label: "Durée estimée (min, pour détecter un retard)" },
    // Les pièces DÈS LA CRÉATION : une demande arrive avec le bon de commande à retirer ou le
    // plan du lieu. Les faire déposer après coup, c'est envoyer une demande incomplète puis
    // rouvrir le dossier — deux gestes pour un.
    { type: "file", name: "files", label: "Pièces jointes (facultatif)", multiple: true, full: true,
      hint: "Le contexte de la tâche : bon de commande, plan, facture à régler…" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour ${user.name.split(" ")[0]} 👋`}
        description={`Votre espace de travail — ${ROLE_LABELS[user.role] ?? user.role}.`}
      >
        {/* UN SEUL BOUTON. Il y en avait deux — « Nouvelle tâche » et « Demander une tâche » —
            pour un même geste, et personne ne devinait lequel prendre : on choisissait presque
            toujours le premier, et la tâche atterrissait chez l'autre sans qu'il l'ait acceptée
            ni qu'il ait où déposer son travail. C'est le champ « Assignée à » qui tranche
            désormais, à l'endroit où l'on choisit la personne. */}
        <CreateRecordButton label="Nouvelle tâche" title="Créer une tâche" width="md"
          description="Pour vous, c'est une to-do. Pour quelqu'un d'autre, c'est une demande : il l'accepte ou la refuse, puis dépose son travail dans le dossier."
          action={createTask} fields={taskFields} />
        {data.employee && (
          <Link
            href="/mon-dossier"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Demander un congé <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </PageHeader>
      <ModuleTabs tabs={await visibleTabs(user, WORKSPACE_TABS)} />

      {/* Ce que je porte ce cycle. L'affectation existait dans « Prévisions & Force de vente »
          mais personne ne la voyait depuis son espace. */}
      <MyPortfolioCard portfolio={await getMyPortfolio(user.id)} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Tâches ouvertes" value={data.stats.openTasks} icon="ListTodo" />
        <KpiCard label="En retard" value={data.stats.overdue} icon="AlarmClock" tone={data.stats.overdue > 0 ? "danger" : "default"} />
        <KpiCard label="Congés en attente" value={data.stats.pendingLeaves} icon="Hourglass" tone={data.stats.pendingLeaves > 0 ? "warning" : "default"} />
        <KpiCard label="Solde congés" value={data.stats.leaveBalance === null ? "—" : `${data.stats.leaveBalance} j`} icon="Plane" tone="info" />
      </div>

      {/* CE QUI ATTEND MA SIGNATURE — en tête, parce que c'est ce qui bloque quelqu'un d'autre.
          Validations et paiements sont un seul bloc : un paiement à régler n'est rien d'autre
          qu'une validation qui porte un montant. */}
      {validations.length > 0 && (
        <ActionSection
          title={`Validations à faire (${validations.length})`}
          items={validations}
          cta="/validations"
          ctaLabel="Toutes mes validations"
        />
      )}

      {toHandle.length > 0 && (
        <ActionSection title={`Demandes & dossiers à traiter (${toHandle.length})`} items={toHandle} />
      )}

      {requestedTasks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tâches demandées ({requestedTasks.length})</h2>
          <p className="text-xs text-muted-foreground">
            Acceptez ou refusez. En acceptant, vous entrez directement dans la demande — aucune
            étape de plus : vous y déposez les pièces et vous validez votre travail.
          </p>
          <TaskList tasks={requestedTasks} userId={user.id} />
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
        <TaskList tasks={myTasks} userId={user.id} canCreateDossier={canCreateDossier} />
      </section>

      {participating.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tâches où je participe ({participating.length})</h2>
          <TaskList tasks={participating} userId={user.id} showAssignee canCreateDossier={canCreateDossier} />
        </section>
      )}

      {watching.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tâches partagées en lecture ({watching.length})</h2>
          <TaskList tasks={watching} userId={user.id} showAssignee readOnly />
        </section>
      )}

      {myRequests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Tâches que j'ai demandées ({myRequests.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Où en est chaque demande : en attente de réponse, acceptée, refusée (avec son motif)
            ou travail validé.
          </p>
          <TaskList tasks={myRequests} userId={user.id} showAssignee />
        </section>
      )}

      {delegated.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tâches que j'ai déléguées</h2>
          <TaskList tasks={delegated} userId={user.id} showAssignee canCreateDossier={canCreateDossier} />
        </section>
      )}

      {leavesToDecide.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Congés qui attendent votre signature
          </h2>
          <p className="text-xs text-muted-foreground">
            Circuit <strong>responsable (N+1) → ressources humaines → direction générale</strong>.
            Approuver fait monter d&apos;une marche ; refuser arrête le circuit.
          </p>
          <LeaveApprovals leaves={leavesToDecide} />
        </section>
      )}

      {data.employee ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes congés</h2>
            <MyLeaves leaves={myLeaves} />
          </section>
          {/* L'AVANCE SUR SALAIRE NE SE DEMANDE PLUS ICI. L'historique reste tant qu'il y en a
              un — effacer l'écran effacerait la trace de ce que la personne a demandé et
              reçu — mais rien ne se crée depuis cet espace. */}
          {myAdvances.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes avances sur salaire</h2>
              <MyAdvances advances={myAdvances} />
            </section>
          )}
        </div>
      ) : (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">
          Aucune fiche employé n'est liée à votre compte. Demandez à l'administrateur de la créer pour activer les congés et les avances sur salaire.
        </CardContent></Card>
      )}

    </div>
  );
}

/**
 * UNE SECTION D'ACTIONS — reprise telle quelle de « Mon travail », qui n'existe plus.
 *
 * Le lien de chaque ligne mène DANS l'élément (la validation ouverte, ses pièces lisibles),
 * pas sur l'écran du module : arriver sur une liste pour y rechercher ce qu'on venait de
 * cliquer est un pas de trop, et c'est celui qu'on ne fait pas.
 */
function ActionSection({ title, items, cta, ctaLabel }: { title: string; items: ActionItem[]; cta?: string; ctaLabel?: string }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
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
