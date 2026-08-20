import { prisma } from "@/lib/prisma";
import type { Action, Module } from "@/lib/rbac";
import { delegationsFor, isDelegationActive, type StandInLeave } from "./stand-in";

/**
 * LES INTÉRIMS EN COURS — la couche qui va chercher en base ce que `stand-in.ts` décide.
 *
 * Séparée exprès : les RÈGLES (quand une délégation joue, jusqu'où elle porte) sont pures et
 * testées à côté ; ici on ne fait que lire, et l'on peut donc lire depuis n'importe où — le
 * calcul des droits, une garde d'action, un bandeau d'écran — sans dupliquer une condition.
 */

export interface ActiveStandIn {
  leaveId: string;
  /** Le compte de l'absent — celui qu'on remplace. */
  absenteeUserId: string;
  absenteeName: string;
  absenteeRole: string;
  endDate: Date;
  /** Ce qui est réellement prêté : modules et actions, déjà bornés par les droits de l'absent. */
  delegations: { module: Module; actions: Action[] }[];
}

/**
 * Les intérims qu'une personne exerce AUJOURD'HUI.
 *
 * On filtre en base sur le strict nécessaire (être l'intérimaire, validé, congé accordé, fenêtre
 * de dates), puis on repasse par la règle pure : la clause SQL et la règle doivent dire la même
 * chose, et c'est la règle qui fait foi.
 */
export async function activeStandInsFor(userId: string, now: Date = new Date()): Promise<ActiveStandIn[]> {
  const rows = await prisma.leaveRequest.findMany({
    where: {
      standInId: userId,
      standInStatus: "APPROVED",
      status: "APPROVED",
      startDate: { lte: now },
      endDate: { gte: startOfDay(now) },
    },
    select: {
      id: true, startDate: true, endDate: true, status: true,
      standInId: true, standInStatus: true, standInModules: true,
      employee: { select: { fullName: true, user: { select: { id: true, role: true } } } },
    },
  });

  const out: ActiveStandIn[] = [];
  for (const r of rows) {
    const absentee = r.employee?.user;
    // Sans compte applicatif, il n'y a rien à déléguer : on ne remplace pas quelqu'un qui n'a
    // jamais eu accès à la plateforme.
    if (!absentee) continue;
    const leave: StandInLeave = {
      leaveApproved: r.status === "APPROVED",
      standInId: r.standInId,
      standInStatus: r.standInStatus,
      standInModules: r.standInModules,
      startDate: r.startDate,
      endDate: r.endDate,
    };
    if (!isDelegationActive(leave, now)) continue;
    const delegations = delegationsFor(absentee.role, r.standInModules);
    if (delegations.length === 0) continue;
    out.push({
      leaveId: r.id,
      absenteeUserId: absentee.id,
      absenteeName: r.employee?.fullName ?? "—",
      absenteeRole: absentee.role,
      endDate: r.endDate,
      delegations,
    });
  }
  return out;
}

/** Cette personne remplace-t-elle CET absent en ce moment ? (garde d'action) */
export async function actsForUser(viewerId: string, absenteeUserId: string, now: Date = new Date()): Promise<boolean> {
  if (viewerId === absenteeUserId) return false;
  const active = await activeStandInsFor(viewerId, now);
  return active.some((a) => a.absenteeUserId === absenteeUserId);
}

/** Les comptes qu'une personne remplace aujourd'hui — pour élargir une requête de liste. */
export async function standInForUserIds(viewerId: string, now: Date = new Date()): Promise<string[]> {
  return (await activeStandInsFor(viewerId, now)).map((a) => a.absenteeUserId);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
