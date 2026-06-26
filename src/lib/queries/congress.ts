import { prisma } from "@/lib/prisma";
import { scopeCongressIntl, scopeCongressNational, type SessionUser } from "@/lib/rbac";
import { toNumber } from "@/lib/utils";

export type CongressType = "INTL" | "NATIONAL";

export interface CongressListRow {
  id: string;
  name: string;
  location: string;
  date: string | null;
  specialty: string;
  eventType: string | null;
  requestStatus: string;
  estimatedBudget: number | null;
  productManagerBudget: number | null;
  requester: string;
  participantCount: number;
  doctorCount: number;
}

const dec = (v: unknown): number | null => (v === null || v === undefined ? null : toNumber(v));

async function userNameMap(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: uniq } }, select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name]));
}

export async function getCongressList(type: CongressType, user: SessionUser): Promise<CongressListRow[]> {
  const items =
    type === "INTL"
      ? await prisma.congressInternational.findMany({ where: scopeCongressIntl(user), orderBy: [{ createdAt: "desc" }] })
      : await prisma.congressNational.findMany({ where: scopeCongressNational(user), orderBy: [{ createdAt: "desc" }] });

  const names = await userNameMap(items.map((c) => c.requesterId ?? "").filter(Boolean));

  return items.map((c) => ({
    id: c.id,
    name: c.name,
    location: type === "INTL"
      ? [(c as { country?: string | null }).country, (c as { city?: string | null }).city].filter(Boolean).join(", ")
      : [(c as { city?: string | null }).city, (c as { hostInstitution?: string | null }).hostInstitution].filter(Boolean).join(" · "),
    date: (type === "INTL" ? (c as { startDate?: Date | null }).startDate : (c as { date?: Date | null }).date)?.toISOString() ?? null,
    specialty: c.specialty ?? "",
    eventType: type === "NATIONAL" ? (c as { eventType?: string }).eventType ?? null : null,
    requestStatus: c.requestStatus,
    estimatedBudget: dec(c.estimatedBudget),
    productManagerBudget: dec(c.productManagerBudget),
    requester: c.requesterId ? names.get(c.requesterId) ?? "" : "",
    participantCount: c.participantIds.length,
    doctorCount: c.invitedDoctorIds.length,
  }));
}

export async function getCongressDetail(type: CongressType, user: SessionUser, id: string) {
  const c =
    type === "INTL"
      ? await prisma.congressInternational.findFirst({ where: { id, ...scopeCongressIntl(user) } })
      : await prisma.congressNational.findFirst({ where: { id, ...scopeCongressNational(user) } });
  if (!c) return null;

  const names = await userNameMap([c.requesterId, c.productManagerId, c.preliminaryById, c.finalById].filter((x): x is string => Boolean(x)));
  const doctors = c.invitedDoctorIds.length
    ? await prisma.medicalDoctor.findMany({ where: { id: { in: c.invitedDoctorIds } }, select: { id: true, name: true, specialty: true, institution: true } })
    : [];
  const participants = c.participantIds.length
    ? await prisma.user.findMany({ where: { id: { in: c.participantIds } }, select: { id: true, name: true, title: true } })
    : [];
  const expenseOrder = c.expenseOrderId
    ? await prisma.expenseOrder.findUnique({ where: { id: c.expenseOrderId }, select: { reference: true, status: true, amount: true } })
    : null;

  return {
    type,
    id: c.id,
    name: c.name,
    specialty: c.specialty ?? "",
    location: type === "INTL"
      ? [(c as { country?: string | null }).country, (c as { city?: string | null }).city].filter(Boolean).join(", ")
      : [(c as { city?: string | null }).city, (c as { hostInstitution?: string | null }).hostInstitution].filter(Boolean).join(" · "),
    date: (type === "INTL" ? (c as { startDate?: Date | null }).startDate : (c as { date?: Date | null }).date)?.toISOString() ?? null,
    endDate: type === "INTL" ? (c as { endDate?: Date | null }).endDate?.toISOString() ?? null : null,
    eventType: type === "NATIONAL" ? (c as { eventType?: string }).eventType ?? null : null,
    requestStatus: c.requestStatus,
    estimatedBudget: dec(c.estimatedBudget),
    productManagerBudget: dec(c.productManagerBudget),
    productManagerNotes: c.productManagerNotes ?? "",
    preliminaryNote: c.preliminaryNote ?? "",
    finalNote: c.finalNote ?? "",
    rejectionReason: c.rejectionReason ?? "",
    preliminaryAt: c.preliminaryAt?.toISOString() ?? null,
    finalAt: c.finalAt?.toISOString() ?? null,
    requester: c.requesterId ? names.get(c.requesterId) ?? "" : "",
    requesterId: c.requesterId,
    productManager: c.productManagerId ? names.get(c.productManagerId) ?? "" : "",
    productManagerId: c.productManagerId,
    preliminaryBy: c.preliminaryById ? names.get(c.preliminaryById) ?? "" : "",
    finalBy: c.finalById ? names.get(c.finalById) ?? "" : "",
    doctors: doctors.map((d) => ({ id: d.id, name: d.name, specialty: d.specialty ?? "", institution: d.institution ?? "" })),
    participants: participants.map((p) => ({ id: p.id, name: p.name, title: p.title ?? "" })),
    expenseOrder: expenseOrder ? { reference: expenseOrder.reference, status: expenseOrder.status, amount: toNumber(expenseOrder.amount) } : null,
    createdAt: c.createdAt.toISOString(),
  };
}

export type CongressDetail = NonNullable<Awaited<ReturnType<typeof getCongressDetail>>>;

/** Données pour le formulaire de demande : médecins (groupés par spécialité), users, chefs de produit. */
export async function getCongressFormData() {
  const [doctors, users, productManagers] = await Promise.all([
    prisma.medicalDoctor.findMany({ select: { id: true, name: true, specialty: true, city: true }, orderBy: [{ specialty: "asc" }, { name: "asc" }] }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true, role: "PRODUCT_MANAGER" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    doctors: doctors.map((d) => ({ id: d.id, name: d.name, specialty: d.specialty ?? "Sans spécialité", city: d.city ?? "" })),
    users: users.map((u) => ({ id: u.id, name: u.name, role: u.role })),
    productManagers: productManagers.map((u) => ({ id: u.id, name: u.name })),
  };
}
