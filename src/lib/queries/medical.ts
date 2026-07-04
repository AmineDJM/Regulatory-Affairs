import type { DoctorTitle, InfluenceLevel, MedicalSector, Priority, SegmentLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { anyRoleFilter, scopeMedicalDoctors, scopeMedicalVisits, hasGlobalView, type SessionUser } from "@/lib/rbac";

/**
 * Lecture du module Promotion médicale, désormais structuré :
 * Spécialité → Secteur (Hôpital / Libéral) → médecins (titre, influence, potentiel).
 * Tout est borné par le scope du délégué (il ne voit que ses médecins).
 */

export interface DoctorDTO {
  id: string;
  name: string;
  title: DoctorTitle;
  specialtyId: string | null;
  specialtyName: string | null;
  sector: MedicalSector;
  institution: string;
  city: string;
  region: string;
  phone: string;
  email: string;
  influenceLevel: InfluenceLevel;
  prescriptionPotential: Priority;
  influence: SegmentLevel;
  potential: SegmentLevel;
  affinity: SegmentLevel;
  targetProducts: string;
  comments: string;
  delegate: string;
  delegateId: string | null;
  lastVisit: string | null;
  nextVisit: string | null;
}

export interface SpecialtyGroupDTO {
  id: string | null;
  name: string;
  color: string | null;
  notes: string | null;
  doctors: DoctorDTO[];
  count: number;
  kol: number;
}

export interface SpecialtyDTO {
  id: string;
  name: string;
  color: string | null;
  notes: string | null;
  count: number;
}

export interface MedicalVisitRow {
  id: string;
  date: string;
  doctor: string;
  delegate: string;
  region: string;
  objective: string;
  presentedProducts: string;
  status: string;
}

export interface MedicalData {
  groups: SpecialtyGroupDTO[];
  specialties: SpecialtyDTO[];
  visits: MedicalVisitRow[];
  delegates: { id: string; name: string }[];
  stats: { doctors: number; specialties: number; kol: number; visitsTotal: number; completedThisMonth: number; planned: number };
}

function mapDoctor(d: {
  id: string; name: string; title: DoctorTitle; specialtyId: string | null; specialty: string | null;
  specialtyRef: { name: string } | null; sector: MedicalSector; institution: string | null; city: string | null;
  region: string | null; phone: string | null; email: string | null; influenceLevel: InfluenceLevel;
  prescriptionPotential: Priority; influence: SegmentLevel; potential: SegmentLevel; affinity: SegmentLevel;
  targetProducts: string | null; comments: string | null;
  delegate: { name: string } | null; delegateId: string | null; lastVisit: Date | null; nextVisit: Date | null;
}): DoctorDTO {
  return {
    id: d.id,
    name: d.name,
    title: d.title,
    specialtyId: d.specialtyId,
    specialtyName: d.specialtyRef?.name ?? d.specialty ?? null,
    sector: d.sector,
    institution: d.institution ?? "",
    city: d.city ?? "",
    region: d.region ?? "",
    phone: d.phone ?? "",
    email: d.email ?? "",
    influenceLevel: d.influenceLevel,
    prescriptionPotential: d.prescriptionPotential,
    influence: d.influence,
    potential: d.potential,
    affinity: d.affinity,
    targetProducts: d.targetProducts ?? "",
    comments: d.comments ?? "",
    delegate: d.delegate?.name ?? "",
    delegateId: d.delegateId,
    lastVisit: d.lastVisit?.toISOString() ?? null,
    nextVisit: d.nextVisit?.toISOString() ?? null,
  };
}

export interface DelegatePlanDTO {
  id: string;
  delegateId: string | null;
  delegateName: string | null;
  weekStart: string;
  region: string | null;
  productTarget: string | null;
  visitsTarget: number;
  keyDoctorsTarget: number;
  achievedVisits: number;
  managerComment: string | null;
}

/**
 * Plans de tournée : le manager / la Direction voient tous les plans, le délégué
 * ne voit que les siens. Ordonnés par période décroissante.
 */
export async function getDelegatePlans(user: SessionUser): Promise<DelegatePlanDTO[]> {
  const isManager = hasGlobalView(user.role) || user.role === "MEDICAL_PROMOTION_MANAGER";
  const plans = await prisma.medicalDelegatePlan.findMany({
    where: isManager ? {} : { delegateId: user.id },
    orderBy: { weekStart: "desc" },
    include: { delegate: { select: { name: true } } },
  });
  return plans.map((p) => ({
    id: p.id,
    delegateId: p.delegateId,
    delegateName: p.delegate?.name ?? null,
    weekStart: p.weekStart.toISOString(),
    region: p.region,
    productTarget: p.productTarget,
    visitsTarget: p.visitsTarget,
    keyDoctorsTarget: p.keyDoctorsTarget,
    achievedVisits: p.achievedVisits,
    managerComment: p.managerComment,
  }));
}

export async function getMedicalData(user: SessionUser): Promise<MedicalData> {
  const isManager = hasGlobalView(user.role) || user.role === "MEDICAL_PROMOTION_MANAGER";

  const [doctors, specialties, visits, delegates] = await Promise.all([
    prisma.medicalDoctor.findMany({
      where: scopeMedicalDoctors(user),
      orderBy: [{ name: "asc" }],
      include: { delegate: { select: { name: true } }, specialtyRef: { select: { name: true } } },
    }),
    prisma.medicalSpecialty.findMany({ orderBy: { name: "asc" } }),
    prisma.medicalVisit.findMany({
      where: scopeMedicalVisits(user),
      orderBy: { date: "desc" },
      include: { doctor: { select: { name: true } }, delegate: { select: { name: true } } },
    }),
    isManager
      ? prisma.user.findMany({ where: { ...anyRoleFilter(["MEDICAL_DELEGATE", "NATIONAL_SALES"]), isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const byId = new Map<string, DoctorDTO[]>();
  const unassigned: DoctorDTO[] = [];
  for (const d of doctors) {
    const dto = mapDoctor(d);
    if (d.specialtyId) {
      if (!byId.has(d.specialtyId)) byId.set(d.specialtyId, []);
      byId.get(d.specialtyId)!.push(dto);
    } else {
      unassigned.push(dto);
    }
  }

  const groups: SpecialtyGroupDTO[] = [];
  for (const s of specialties) {
    const docs = byId.get(s.id);
    if (!docs || docs.length === 0) continue;
    groups.push({
      id: s.id, name: s.name, color: s.color, notes: s.notes,
      doctors: docs, count: docs.length,
      kol: docs.filter((d) => d.influenceLevel === "KEY_OPINION_LEADER").length,
    });
  }
  if (unassigned.length) {
    groups.push({
      id: null, name: "Sans spécialité", color: null, notes: null,
      doctors: unassigned, count: unassigned.length,
      kol: unassigned.filter((d) => d.influenceLevel === "KEY_OPINION_LEADER").length,
    });
  }

  const specialtyDTOs: SpecialtyDTO[] = specialties.map((s) => ({
    id: s.id, name: s.name, color: s.color, notes: s.notes, count: byId.get(s.id)?.length ?? 0,
  }));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const visitRows: MedicalVisitRow[] = visits.map((v) => ({
    id: v.id, date: v.date.toISOString(), doctor: v.doctor?.name ?? "—", delegate: v.delegate?.name ?? "",
    region: v.region ?? "", objective: v.objective ?? "", presentedProducts: v.presentedProducts ?? "", status: v.status,
  }));

  return {
    groups,
    specialties: specialtyDTOs,
    visits: visitRows,
    delegates,
    stats: {
      doctors: doctors.length,
      specialties: specialties.length,
      kol: doctors.filter((d) => d.influenceLevel === "KEY_OPINION_LEADER").length,
      visitsTotal: visits.length,
      completedThisMonth: visits.filter((v) => v.status === "COMPLETED" && v.date >= monthStart).length,
      planned: visits.filter((v) => v.status === "PLANNED").length,
    },
  };
}
