import { prisma } from "@/lib/prisma";
import { userCan, hasGlobalView, scopeRegulatory, scopeDirectives, type SessionUser } from "@/lib/rbac";
import { getPendingValidations } from "@/lib/queries/validations";
import { toNumber, formatCurrency } from "@/lib/utils";
import {
  type BadgeTone, TASK_STATUS, ADMIN_REQUEST_STATUS, REGULATORY_STATUS, EXPENSE_ORDER_STATUS, LEAVE_STATUS, CONGRESS_REQUEST_STATUS, MEDICAL_INFO_STATUS, DIRECTIVE_STATUS, SUPPORT_STATUS,
} from "@/lib/labels";

export interface ActionItem {
  key: string;
  title: string;
  subtitle: string;
  module: string;
  href: string;
  kind: "validation" | "request" | "payment" | "regulatory" | "task" | "hr";
  priority: string | null;
  deadline: string | null;
  owner: string;
  statusLabel: string | null;
  statusTone: BadgeTone | null;
}

export interface ActionNotification {
  id: string;
  title: string;
  body: string;
  link: string;
  type: string;
  createdAt: string;
}

const resolve = (map: Record<string, { label: string; tone: BadgeTone }>, v: string) => ({
  statusLabel: map[v]?.label ?? v,
  statusTone: map[v]?.tone ?? ("neutral" as BadgeTone),
});

export async function getActionCenter(user: SessionUser) {
  const now = new Date();
  const items: ActionItem[] = [];

  // 1. Mes tâches (WORKSPACE — tout le monde)
  const tasks = await prisma.task.findMany({
    where: { assignedToId: user.id, status: { in: ["TODO", "IN_PROGRESS"] } },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    take: 60,
  });
  for (const t of tasks) {
    items.push({
      key: `task-${t.id}`, title: t.title, subtitle: t.module ?? "", module: "Mon espace",
      href: "/mon-espace", kind: "task", priority: t.priority,
      deadline: t.dueDate?.toISOString() ?? null, owner: "", ...resolve(TASK_STATUS, t.status),
    });
  }

  // 2. Validations à faire
  if (userCan(user, "VALIDATIONS", "VIEW")) {
    const pending = await getPendingValidations(user.id);
    for (const v of pending) {
      items.push({
        key: `val-${v.stepId}`, title: v.title,
        subtitle: v.amount !== null ? formatCurrency(v.amount) : v.objectType,
        module: "Validations", href: "/validations", kind: "validation", priority: v.priority,
        deadline: v.deadline, owner: v.requester, statusLabel: "À valider", statusTone: "warning",
      });
    }
  }

  // 3. Demandes administratives qui me sont assignées / que je dois valider
  if (userCan(user, "ADMIN_REQUESTS", "VIEW")) {
    const reqs = await prisma.administrativeRequest.findMany({
      where: { OR: [{ assignedToId: user.id }, { validatorId: user.id }], status: { notIn: ["DONE", "CANCELLED"] } },
      include: { requester: { select: { name: true } } },
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }], take: 60,
    });
    for (const r of reqs) {
      items.push({
        key: `req-${r.id}`, title: r.title, subtitle: r.reference, module: "Demandes administratives",
        href: `/demandes/${r.id}`, kind: "request", priority: r.priority,
        deadline: r.deadline?.toISOString() ?? null, owner: r.requester?.name ?? "", ...resolve(ADMIN_REQUEST_STATUS, r.status),
      });
    }
  }

  // 4. Paiements / ordres de dépense à régler (comptable)
  if (userCan(user, "FINANCES", "UPDATE")) {
    const orders = await prisma.expenseOrder.findMany({ where: { status: "PENDING" }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }], take: 60 });
    for (const o of orders) {
      items.push({
        key: `pay-${o.id}`, title: o.label, subtitle: `${o.reference} · ${formatCurrency(toNumber(o.amount))}`,
        module: "Espace comptable", href: "/finances/ordres-de-depense", kind: "payment", priority: null,
        deadline: o.dueDate?.toISOString() ?? null, owner: o.beneficiary ?? "", ...resolve(EXPENSE_ORDER_STATUS, o.status),
      });
    }
  }

  // 5. Dossiers Regulatory à mettre à jour (les miens, non clôturés)
  if (userCan(user, "REGULATORY", "VIEW")) {
    const products = await prisma.regulatoryProduct.findMany({
      where: { AND: [scopeRegulatory(user), { OR: [{ responsibleId: user.id }, { assistantId: user.id }] }, { status: { notIn: ["CLOSED", "DECISION_OBTAINED"] } }] },
      orderBy: [{ targetDate: "asc" }, { updatedAt: "desc" }], take: 40,
    });
    for (const p of products) {
      items.push({
        key: `reg-${p.id}`, title: p.dci, subtitle: p.reference, module: "Regulatory",
        href: `/regulatory/${p.id}`, kind: "regulatory", priority: p.priority,
        deadline: p.targetDate?.toISOString() ?? null, owner: "", ...resolve(REGULATORY_STATUS, p.status),
      });
    }
  }

  // 6. Demandes de congé à décider (RH)
  if (userCan(user, "RH", "UPDATE")) {
    const leaves = await prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      include: { employee: { select: { user: { select: { name: true } } } } },
      orderBy: { startDate: "asc" }, take: 40,
    });
    for (const l of leaves) {
      items.push({
        key: `leave-${l.id}`, title: `Congé — ${l.employee?.user?.name ?? "Employé"}`, subtitle: `${Number(l.days)} j`,
        module: "Ressources humaines", href: "/rh", kind: "hr", priority: null,
        deadline: l.startDate.toISOString(), owner: l.employee?.user?.name ?? "", ...resolve(LEAVE_STATUS, l.status),
      });
    }
  }

  // 6b. Congrès / événements à valider (Direction) ou à analyser (chef de produit)
  const congressTone = (s: string): { statusLabel: string; statusTone: BadgeTone } => ({
    statusLabel: CONGRESS_REQUEST_STATUS[s]?.label ?? s,
    statusTone: CONGRESS_REQUEST_STATUS[s]?.tone ?? "warning",
  });
  for (const cfg of [
    { module: "CONGRESS_INTERNATIONAL" as const, label: "Congrès internationaux", href: "/congress-international" },
    { module: "CONGRESS_NATIONAL" as const, label: "Événements nationaux", href: "/congress-national" },
  ]) {
    if (!userCan(user, cfg.module, "VIEW")) continue;
    const canValidate = userCan(user, cfg.module, "VALIDATE") || hasGlobalView(user.role);
    const or: { requestStatus?: unknown; productManagerId?: string }[] = [{ requestStatus: "PRELIMINARY_APPROVED", productManagerId: user.id }];
    if (canValidate) or.push({ requestStatus: { in: ["AWAITING_PRELIMINARY", "AWAITING_FINAL"] } });
    const where = { OR: or } as never;
    const list = cfg.module === "CONGRESS_INTERNATIONAL"
      ? await prisma.congressInternational.findMany({ where, orderBy: { createdAt: "desc" }, take: 30 })
      : await prisma.congressNational.findMany({ where, orderBy: { createdAt: "desc" }, take: 30 });
    for (const c of list) {
      items.push({
        key: `cong-${c.id}`, title: c.name,
        subtitle: c.requestStatus === "PRELIMINARY_APPROVED" ? "À analyser (chef de produit)" : c.requestStatus === "AWAITING_FINAL" ? "Validation définitive" : "Validation préliminaire",
        module: cfg.label, href: `${cfg.href}/${c.id}`, kind: "request", priority: null,
        deadline: null, owner: "", ...congressTone(c.requestStatus),
      });
    }
  }

  // 6c. Information médicale — déclarations à instruire (pharmacien responsable)
  if (userCan(user, "MEDICAL_INFO", "VALIDATE") || hasGlobalView(user.role)) {
    const decls = await prisma.medicalInfoDeclaration.findMany({
      where: { status: { in: ["AWAITING_REVIEW", "DOCS_REQUESTED", "READY"] } },
      orderBy: { createdAt: "desc" }, take: 40,
    });
    for (const d of decls) {
      items.push({
        key: `mi-${d.id}`, title: d.label, subtitle: d.reference,
        module: "Information médicale", href: `/information-medicale/${d.id}`, kind: "validation", priority: null,
        deadline: null, owner: "", ...resolve(MEDICAL_INFO_STATUS, d.status),
      });
    }
  }

  // 6d. Pièces qui me sont demandées au titre de l'information médicale (tout utilisateur)
  const myDocReqs = await prisma.medicalInfoDocRequest.findMany({
    where: { targetUserId: user.id, status: "PENDING" },
    include: { declaration: { select: { id: true, reference: true } } },
    orderBy: { createdAt: "desc" }, take: 30,
  });
  for (const r of myDocReqs) {
    items.push({
      key: `midoc-${r.id}`, title: `Pièce à déposer — ${r.label}`, subtitle: r.declaration.reference,
      module: "Information médicale", href: `/information-medicale/${r.declaration.id}`, kind: "request", priority: null,
      deadline: null, owner: "", statusLabel: "À déposer", statusTone: "warning",
    });
  }

  // 6e. Directives de la Direction qui me concernent (non clôturées)
  if (userCan(user, "DIRECTIVES", "VIEW")) {
    const directives = await prisma.directive.findMany({
      where: { AND: [scopeDirectives(user), { status: { notIn: ["DONE", "ARCHIVED"] } }] },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 40,
    });
    for (const d of directives) {
      items.push({
        key: `dir-${d.id}`, title: d.title, subtitle: d.reference, module: "Directives",
        href: `/directives/${d.id}`, kind: "task", priority: d.priority,
        deadline: d.dueDate?.toISOString() ?? null, owner: "", ...resolve(DIRECTIVE_STATUS, d.status),
      });
    }
  }

  // 6f. Demandes de support qui m'attendent (destinataire / répondant)
  if (userCan(user, "SUPPORT", "VIEW")) {
    const reqs = await prisma.supportRequest.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        OR: [{ targetUserId: user.id }, { targetRole: user.role }, { assignedToId: user.id }],
      },
      include: { requester: { select: { name: true } } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 40,
    });
    for (const r of reqs) {
      items.push({
        key: `sup-${r.id}`, title: r.subject, subtitle: r.reference, module: "Support",
        href: `/support/${r.id}`, kind: "request", priority: r.priority,
        deadline: null, owner: r.requester?.name ?? "", ...resolve(SUPPORT_STATUS, r.status),
      });
    }
  }

  // 7. Notifications non lues
  let notifications: ActionNotification[] = [];
  if (userCan(user, "NOTIFICATIONS", "VIEW")) {
    const notifs = await prisma.notification.findMany({ where: { userId: user.id, isRead: false }, orderBy: { createdAt: "desc" }, take: 20 });
    notifications = notifs.map((n) => ({ id: n.id, title: n.title, body: n.body ?? "", link: n.link ?? "", type: n.type, createdAt: n.createdAt.toISOString() }));
  }

  const isOverdue = (i: ActionItem) => i.deadline !== null && new Date(i.deadline) < now;
  const isUrgent = (i: ActionItem) => i.priority === "HIGH" || i.priority === "CRITICAL";

  const stats = {
    todo: items.length,
    urgent: items.filter(isUrgent).length,
    overdue: items.filter(isOverdue).length,
    validations: items.filter((i) => i.kind === "validation").length,
    unread: notifications.length,
  };

  return { items, notifications, stats };
}
