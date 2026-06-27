import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { hasGlobalView, userCan, type SessionUser } from "@/lib/rbac";

export interface PendingValidationItem {
  stepId: string;
  requestId: string;
  reference: string;
  title: string;
  description: string;
  module: string;
  objectType: string;
  amount: number | null;
  priority: string;
  requester: string;
  deadline: string | null;
  link: string;
  createdAt: string;
}

export interface MyValidationStep {
  order: number;
  validator: string;
  status: string;
  reason: string;
}

export interface MyValidationItem {
  id: string;
  reference: string;
  title: string;
  module: string;
  amount: number | null;
  status: string;
  mode: string;
  createdAt: string;
  steps: MyValidationStep[];
}

/** Étapes en attente où je suis le validateur actif (séquentiel = mon tour ; parallèle = toujours actif). */
export async function getPendingValidations(userId: string): Promise<PendingValidationItem[]> {
  const steps = await prisma.validationStep.findMany({
    where: { validatorId: userId, status: "PENDING", request: { status: "PENDING" } },
    include: { request: { include: { requester: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return steps
    .filter((s) => s.request.mode === "PARALLEL" || s.order === s.request.currentOrder)
    .map((s) => ({
      stepId: s.id,
      requestId: s.request.id,
      reference: s.request.reference,
      title: s.request.title,
      description: s.request.description ?? "",
      module: s.request.module,
      objectType: s.request.objectType ?? "",
      amount: s.request.amount === null ? null : toNumber(s.request.amount),
      priority: s.request.priority,
      requester: s.request.requester?.name ?? "",
      deadline: s.request.deadline?.toISOString() ?? null,
      link: s.request.link ?? "",
      createdAt: s.request.createdAt.toISOString(),
    }));
}

export async function getMyValidationRequests(userId: string): Promise<MyValidationItem[]> {
  const reqs = await prisma.validationRequest.findMany({
    where: { requesterId: userId },
    include: { steps: { include: { validator: { select: { name: true } } }, orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return reqs.map((r) => ({
    id: r.id,
    reference: r.reference,
    title: r.title,
    module: r.module,
    amount: r.amount === null ? null : toNumber(r.amount),
    status: r.status,
    mode: r.mode,
    createdAt: r.createdAt.toISOString(),
    steps: r.steps.map((s) => ({ order: s.order, validator: s.validator?.name ?? "", status: s.status, reason: s.reason ?? "" })),
  }));
}

// ─────────── Validations transverses : tout ce qui attend MA validation, agrégé ───────────

export interface CrossValidationItem {
  id: string;
  reference: string;
  title: string;
  module: string;
  stage: string;
  amount: number | null;
  requester: string;
  createdAt: string;
  link: string;
}

const SPO_STAGE: Record<string, string> = { AWAITING_PRELIMINARY: "Préliminaire", AWAITING_FINAL: "Définitive", AWAITING_FINAL_APPEAL: "Définitive (appel)" };
const CONG_STAGE: Record<string, string> = { AWAITING_PRELIMINARY: "Préliminaire", AWAITING_FINAL: "Définitive" };

/**
 * Centre de validation : agrège dans un seul endroit TOUTES les validations en
 * attente de l'utilisateur, issues des autres modules — demandes administratives
 * escaladées (AdminApproval), sponsoring et congrès en attente de Direction.
 * Chaque ligne renvoie vers la fiche où la décision se prend réellement.
 */
export async function getCrossModuleValidations(user: SessionUser): Promise<CrossValidationItem[]> {
  const out: CrossValidationItem[] = [];
  const global = hasGlobalView(user.role);

  // 1) Demandes administratives escaladées (l'assistante « demande validation » → Direction).
  const approvals = await prisma.adminApproval.findMany({
    where: { status: "PENDING", validatorId: user.id },
    include: { request: { include: { requester: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" }, take: 100,
  });
  for (const a of approvals) {
    out.push({
      id: `aa-${a.id}`, reference: a.request.reference, title: a.request.title,
      module: "Demande administrative", stage: "Validation demandée",
      amount: a.amount === null ? null : toNumber(a.amount),
      requester: a.request.requester?.name ?? "", createdAt: a.createdAt.toISOString(),
      link: `/demandes/${a.request.id}`,
    });
  }

  // 2) Sponsoring en attente de Direction.
  if (global || userCan(user, "SPONSORING", "VALIDATE")) {
    const spo = await prisma.sponsoringRequest.findMany({
      where: { status: { in: ["AWAITING_PRELIMINARY", "AWAITING_FINAL", "AWAITING_FINAL_APPEAL"] } },
      include: { requester: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 100,
    });
    for (const s of spo) out.push({
      id: `spo-${s.id}`, reference: s.reference, title: s.institution, module: "Sponsoring",
      stage: SPO_STAGE[s.status] ?? s.status,
      amount: s.amountProposed ? toNumber(s.amountProposed) : s.amountRequested ? toNumber(s.amountRequested) : null,
      requester: s.requester?.name ?? "", createdAt: s.createdAt.toISOString(), link: `/sponsoring/${s.id}`,
    });
  }

  // 3) Congrès (international + national) en attente de Direction.
  const congress: { id: string; name: string; requestStatus: string; estimatedBudget: unknown; requesterId: string | null; createdAt: Date; kind: "ci" | "cn" }[] = [];
  if (global || userCan(user, "CONGRESS_INTERNATIONAL", "VALIDATE")) {
    const ci = await prisma.congressInternational.findMany({ where: { requestStatus: { in: ["AWAITING_PRELIMINARY", "AWAITING_FINAL"] } }, select: { id: true, name: true, requestStatus: true, estimatedBudget: true, requesterId: true, createdAt: true }, take: 100 });
    congress.push(...ci.map((c) => ({ ...c, kind: "ci" as const })));
  }
  if (global || userCan(user, "CONGRESS_NATIONAL", "VALIDATE")) {
    const cn = await prisma.congressNational.findMany({ where: { requestStatus: { in: ["AWAITING_PRELIMINARY", "AWAITING_FINAL"] } }, select: { id: true, name: true, requestStatus: true, estimatedBudget: true, requesterId: true, createdAt: true }, take: 100 });
    congress.push(...cn.map((c) => ({ ...c, kind: "cn" as const })));
  }
  if (congress.length) {
    const ids = [...new Set(congress.map((c) => c.requesterId).filter(Boolean) as string[])];
    const names = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
    for (const c of congress) out.push({
      id: `${c.kind}-${c.id}`, reference: c.name, title: c.name,
      module: c.kind === "ci" ? "Congrès international" : "Congrès national",
      stage: CONG_STAGE[c.requestStatus] ?? c.requestStatus,
      amount: c.estimatedBudget ? toNumber(c.estimatedBudget as never) : null,
      requester: c.requesterId ? names.get(c.requesterId) ?? "" : "",
      createdAt: c.createdAt.toISOString(), link: `/${c.kind === "ci" ? "congress-international" : "congress-national"}/${c.id}`,
    });
  }

  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getMyValidations(user: SessionUser) {
  const [toValidate, myRequests, crossModule] = await Promise.all([
    getPendingValidations(user.id),
    getMyValidationRequests(user.id),
    getCrossModuleValidations(user),
  ]);
  return { toValidate, myRequests, crossModule };
}

/** Vue Super Admin : règles + dernières demandes (supervision). */
export async function getValidationAdminData() {
  const [rules, requests] = await Promise.all([
    prisma.validationRule.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.validationRequest.findMany({
      include: { requester: { select: { name: true } }, steps: { include: { validator: { select: { name: true } } }, orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return { rules, requests };
}
