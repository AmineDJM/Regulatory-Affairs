import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import type { SessionUser } from "@/lib/rbac";

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

export async function getMyValidations(user: SessionUser) {
  const [toValidate, myRequests] = await Promise.all([
    getPendingValidations(user.id),
    getMyValidationRequests(user.id),
  ]);
  return { toValidate, myRequests };
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
