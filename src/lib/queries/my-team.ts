import { prisma } from "@/lib/prisma";
import { loadReportingLine } from "@/lib/departments";
import { directReportsOf } from "@/lib/hr/reporting-line";
import { toNumber } from "@/lib/utils";
import type { SessionUser } from "@/lib/rbac";

/**
 * MON ÉQUIPE — ce qu'un encadrant a réellement besoin de voir sur ses N-1.
 *
 * ── CE QUE CET ÉCRAN N'EST PAS ──────────────────────────────────────────────────────────────
 *
 * Ce n'est pas un mini-module RH. Un encadrant n'administre pas les fiches, ne fixe pas les
 * salaires et n'ouvre pas les dossiers médicaux : cela reste aux ressources humaines, et le
 * copier ici en ferait une seconde porte sur des données qu'on a cloisonnées exprès.
 *
 * C'est l'écran de trois questions, et de trois seulement :
 *
 *   1. **QUI est dans mon équipe** — la liste, telle que la hiérarchie la définit vraiment ;
 *   2. **QU'EST-CE QUI M'ATTEND** — congés, achats, formations : ce qui dort chez moi et bloque
 *      quelqu'un. C'était éparpillé dans autant d'écrans qu'il y a de circuits, et l'on
 *      découvrait une demande de congé vieille de six jours en cherchant autre chose ;
 *   3. **QUI EST LÀ CETTE SEMAINE** — les absences en cours et à venir, parce que c'est la seule
 *      donnée qui change un planning.
 *
 * ── L'ÉQUIPE SE DÉDUIT, ELLE NE SE DÉCLARE PAS ──────────────────────────────────────────────
 *
 * `directReportsOf` définit mon équipe comme « ceux dont la cascade dit que je suis le N+1 » —
 * la MÊME fonction qui route les demandes. Les deux ne peuvent donc pas diverger : personne
 * n'apparaît dans mon équipe sans que ses demandes m'arrivent, et réciproquement.
 */

export interface TeamMember {
  employeeId: string;
  userId: string | null;
  fullName: string;
  position: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  hiredAt: string | null;
  /** Fin de contrat proche — l'échéance qu'un encadrant doit anticiper, pas la RH seule. */
  contractEnd: string | null;
  /** Absent AUJOURD'HUI (congé approuvé en cours) : ce qui change la journée. */
  absentToday: boolean;
  /** Prochaine absence approuvée à venir. */
  nextLeave: { start: string; end: string; type: string } | null;
  /** Ce que J'ai à décider le concernant, tous circuits confondus. */
  pending: number;
}

export interface TeamPending {
  id: string;
  kind: "LEAVE" | "PURCHASE" | "TRAINING";
  who: string;
  title: string;
  detail: string | null;
  amount: number | null;
  createdAt: string;
  /** Échéance quand le circuit en porte une (dates de congé, date de formation). */
  deadline: string | null;
  href: string;
}

export interface MyTeam {
  /** La fiche employé de l'encadrant — absente, il n'a pas d'équipe à montrer. */
  selfEmployeeId: string | null;
  members: TeamMember[];
  pending: TeamPending[];
}

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

/**
 * L'ÉQUIPE ET SA FILE, en une passe.
 *
 * Tout est borné aux N-1 : un encadrant ne voit ni les congés des autres services, ni les
 * demandes qu'il n'a pas à trancher. Le cloisonnement ne vient pas d'un droit de module — il
 * vient de la hiérarchie elle-même, et c'est ce qui le rend juste sans réglage.
 */
export async function getMyTeam(user: SessionUser): Promise<MyTeam> {
  const me = await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!me) return { selfEmployeeId: null, members: [], pending: [] };

  const { employees, departments } = await loadReportingLine();
  const reports = directReportsOf(me.id, employees, departments);
  if (reports.length === 0) return { selfEmployeeId: me.id, members: [], pending: [] };

  const employeeIds = reports.map((r) => r.id);
  const userIds = reports.map((r) => r.userId).filter((v): v is string => Boolean(v));
  const now = new Date();

  const [fiches, conges, achats, formations] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true, fullName: true, userId: true, position: true, email: true, phone: true,
        hireDate: true, contractEnd: true, department: true,
      },
      orderBy: { fullName: "asc" },
    }),
    // Les congés APPROUVÉS (pour savoir qui est là) ET ceux qui attendent MA décision.
    prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        OR: [
          { status: "APPROVED", endDate: { gte: now } },
          { status: "PENDING", stage: "MANAGER" },
        ],
      },
      select: {
        id: true, employeeId: true, type: true, startDate: true, endDate: true, days: true,
        reason: true, status: true, stage: true, createdAt: true,
      },
      orderBy: { startDate: "asc" },
    }),
    // Les demandes d'achat de mon équipe qui attendent MA validation.
    prisma.administrativeRequest.findMany({
      where: {
        type: "PURCHASE", deletedAt: null, requesterId: { in: userIds },
        approvals: { some: { status: "PENDING" } },
      },
      select: {
        id: true, reference: true, title: true, requesterId: true, createdAt: true, fields: true,
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    // Les demandes de formation arrêtées à la marche du responsable.
    prisma.training.findMany({
      where: { requesterId: { in: userIds }, status: "PENDING", stage: "MANAGER" },
      select: { id: true, reference: true, title: true, requesterId: true, amount: true, startDate: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
  ]);

  const nomParEmploye = new Map(fiches.map((f) => [f.id, f.fullName]));
  const nomParUser = new Map(fiches.filter((f) => f.userId).map((f) => [f.userId as string, f.fullName]));

  const pending: TeamPending[] = [
    ...conges.filter((c) => c.status === "PENDING").map((c) => ({
      id: `leave-${c.id}`,
      kind: "LEAVE" as const,
      who: nomParEmploye.get(c.employeeId) ?? "—",
      title: `Congé — ${toNumber(c.days)} jour(s)`,
      detail: c.reason,
      amount: null,
      createdAt: c.createdAt.toISOString(),
      deadline: c.startDate.toISOString(),
      href: `/rh/conges`,
    })),
    ...achats.map((a) => {
      const champs = (a.fields as Record<string, unknown> | null) ?? {};
      return {
        id: `purchase-${a.id}`,
        kind: "PURCHASE" as const,
        who: nomParUser.get(a.requesterId ?? "") ?? "—",
        title: a.title,
        detail: a.reference,
        amount: typeof champs.estimatedTotal === "number" ? champs.estimatedTotal : null,
        createdAt: a.createdAt.toISOString(),
        deadline: null,
        href: `/demandes/${a.id}`,
      };
    }),
    ...formations.map((f) => ({
      id: `training-${f.id}`,
      kind: "TRAINING" as const,
      who: nomParUser.get(f.requesterId ?? "") ?? "—",
      title: f.title,
      detail: f.reference,
      amount: toNumber(f.amount) || null,
      createdAt: f.createdAt.toISOString(),
      deadline: iso(f.startDate),
      href: `/formations`,
    })),
  // La plus ANCIENNE en tête : c'est elle qui fait attendre quelqu'un depuis le plus longtemps.
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const enAttenteParEmploye = new Map<string, number>();
  for (const c of conges) {
    if (c.status !== "PENDING") continue;
    enAttenteParEmploye.set(c.employeeId, (enAttenteParEmploye.get(c.employeeId) ?? 0) + 1);
  }
  const employeParUser = new Map(fiches.filter((f) => f.userId).map((f) => [f.userId as string, f.id]));
  for (const src of [achats, formations]) {
    for (const r of src) {
      const empId = employeParUser.get(r.requesterId ?? "");
      if (empId) enAttenteParEmploye.set(empId, (enAttenteParEmploye.get(empId) ?? 0) + 1);
    }
  }

  const approuves = conges.filter((c) => c.status === "APPROVED");
  const members: TeamMember[] = fiches.map((f) => {
    const siens = approuves.filter((c) => c.employeeId === f.id);
    const enCours = siens.find((c) => c.startDate <= now && c.endDate >= now);
    const aVenir = siens.find((c) => c.startDate > now);
    return {
      employeeId: f.id,
      userId: f.userId,
      fullName: f.fullName,
      position: f.position,
      department: f.department,
      email: f.email,
      phone: f.phone,
      hiredAt: iso(f.hireDate),
      contractEnd: iso(f.contractEnd),
      absentToday: Boolean(enCours),
      nextLeave: aVenir
        ? { start: aVenir.startDate.toISOString(), end: aVenir.endDate.toISOString(), type: aVenir.type }
        : null,
      pending: enAttenteParEmploye.get(f.id) ?? 0,
    };
  });

  return { selfEmployeeId: me.id, members, pending };
}
