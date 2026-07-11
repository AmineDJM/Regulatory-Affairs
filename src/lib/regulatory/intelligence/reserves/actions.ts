"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "../access";
import { regAudit } from "../audit";

/** Actions des réserves ANPP (G9). regulatory.reserve.manage. Org-scopé. */

interface Result { ok: boolean; error?: string }
const str = (fd: FormData, k: string) => { const v = fd.get(k); return v ? String(v).trim() : null; };

async function guardPoint(pointId: string): Promise<{ ok: true; userId: string; dossierId: string } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.reserve.manage") && user.role !== "SUPER_ADMIN") return { ok: false, error: "Non autorisé." };
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return { ok: false, error: "Module non activé." };
  const point = await prisma.regulatoryReservePoint.findFirst({
    where: { id: pointId, cycle: { dossier: { companyId } } }, select: { cycle: { select: { dossierId: true } } },
  });
  if (!point) return { ok: false, error: "Point introuvable." };
  return { ok: true, userId: user.id, dossierId: point.cycle.dossierId };
}

export async function updateReservePoint(formData: FormData): Promise<Result> {
  const pointId = str(formData, "pointId");
  if (!pointId) return { ok: false, error: "Point manquant." };
  const g = await guardPoint(pointId);
  if (!g.ok) return g;

  const category = str(formData, "category");
  const proposedResponse = str(formData, "proposedResponse");
  const evidence = str(formData, "evidence");
  await prisma.regulatoryReservePoint.update({
    where: { id: pointId },
    data: {
      ...(category ? { category } : {}),
      proposedResponse: proposedResponse ?? undefined,
      evidence: evidence ?? undefined,
      status: proposedResponse ? "DRAFTED" : undefined,
    },
  });
  revalidatePath(`/regulatory/enregistrement/analyse/${g.dossierId}`);
  return { ok: true };
}

export async function approveReservePoint(formData: FormData): Promise<Result> {
  const pointId = str(formData, "pointId");
  if (!pointId) return { ok: false, error: "Point manquant." };
  const g = await guardPoint(pointId);
  if (!g.ok) return g;
  const finalResponse = str(formData, "finalResponse") ?? undefined;

  const point = await prisma.regulatoryReservePoint.findUnique({ where: { id: pointId }, select: { proposedResponse: true } });
  const answer = finalResponse ?? point?.proposedResponse ?? null;
  if (!answer) return { ok: false, error: "Aucune réponse à approuver." };

  await prisma.regulatoryReservePoint.update({
    where: { id: pointId },
    data: { finalResponse: answer, status: "APPROVED", resolvedById: g.userId, resolvedAt: new Date() },
  });
  await regAudit({ actorId: g.userId, dossierId: g.dossierId, action: "RESERVE_POINT_APPROVED", detail: "Réponse à une réserve approuvée." });
  revalidatePath(`/regulatory/enregistrement/analyse/${g.dossierId}`);
  return { ok: true };
}

export async function deleteReserveCycle(formData: FormData): Promise<Result> {
  const user = await requireUser();
  const cycleId = str(formData, "cycleId");
  if (!cycleId) return { ok: false, error: "Cycle manquant." };
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return { ok: false, error: "Module non activé." };
  const cycle = await prisma.regulatoryReserveCycle.findFirst({ where: { id: cycleId, dossier: { companyId } }, select: { id: true, dossierId: true, createdById: true } });
  if (!cycle) return { ok: false, error: "Cycle introuvable." };
  if (user.role !== "SUPER_ADMIN" && !regCan(user, "regulatory.reserve.manage") && cycle.createdById !== user.id) return { ok: false, error: "Non autorisé." };
  await prisma.regulatoryReserveCycle.delete({ where: { id: cycleId } });
  revalidatePath(`/regulatory/enregistrement/analyse/${cycle.dossierId}`);
  return { ok: true };
}
