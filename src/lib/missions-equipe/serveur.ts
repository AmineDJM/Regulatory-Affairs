import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { recordAudit } from "@/lib/audit";
import { CHEMIN_PARENT_AD_PRO, lienDemandeAdPro, type ParentAdPro } from "@/lib/chemins/ad-pro";
import { CHEMIN_MES_MISSIONS } from "@/lib/chemins/espace";

/**
 * MISSIONS AD & PRO — l'orchestration côté SERVEUR (base, notifications). Les règles vivent dans
 * `missions-equipe/etat.ts` (pur) ; ce module n'est jamais importé par un composant client.
 */

export const MES_MISSIONS = CHEMIN_MES_MISSIONS;

/** Les demandes Ad & Pro qui portent une équipe Adventum. */
export const PARENT_TYPES: EntityType[] = ["CONGRESS_INTERNATIONAL", "CONGRESS_NATIONAL", "EVENT", "SPONSORING"];

/** Chemin de la fiche de la demande parente. */
export function parentPath(entityType: EntityType, entityId: string): string {
  return entityType in CHEMIN_PARENT_AD_PRO ? lienDemandeAdPro(entityType as ParentAdPro, entityId) : MES_MISSIONS;
}

/** Ce que la demande dit de la mission — libellé, ville, dates (pour pré-remplir). */
export async function parentMission(entityType: EntityType, entityId: string): Promise<{ label: string; ville: string | null; debut: Date | null; fin: Date | null }> {
  try {
    if (entityType === "EVENT") {
      const e = await prisma.event.findUnique({ where: { id: entityId }, select: { name: true, city: true, startDate: true, endDate: true } });
      if (e) return { label: e.name, ville: e.city, debut: e.startDate, fin: e.endDate ?? e.startDate };
    } else if (entityType === "SPONSORING") {
      const r = await prisma.sponsoringRequest.findUnique({ where: { id: entityId }, select: { institution: true, reference: true, city: true } });
      if (r) return { label: `${r.reference} — ${r.institution}`, ville: r.city, debut: null, fin: null };
    } else if (entityType === "CONGRESS_INTERNATIONAL") {
      const c = await prisma.congressInternational.findUnique({ where: { id: entityId }, select: { name: true, city: true, startDate: true, endDate: true } });
      if (c) return { label: c.name, ville: c.city, debut: c.startDate, fin: c.endDate ?? c.startDate };
    } else if (entityType === "CONGRESS_NATIONAL") {
      const c = await prisma.congressNational.findUnique({ where: { id: entityId }, select: { name: true, city: true, date: true, endDate: true } });
      if (c) return { label: c.name, ville: c.city, debut: c.date, fin: c.endDate ?? c.date };
    }
  } catch { /* best-effort */ }
  return { label: "mission", ville: null, debut: null, fin: null };
}

/**
 * L'ORDRE EST PRÊT → LA MISSION LE SAIT. Appelé quand les RH produisent (ou joignent) l'ordre de
 * mission d'une demande reliée à une assignation : `orderStatus` passe ISSUED, la personne est
 * prévenue depuis « Mes missions ». Idempotent ; ne fait jamais échouer le traitement RH.
 */
export async function synchroniserOrdreEmis(requestId: string, actorId: string): Promise<void> {
  try {
    const req = await prisma.hrDocumentRequest.findUnique({
      where: { id: requestId },
      select: { type: true, status: true, missionAssignmentId: true },
    });
    if (!req || req.type !== "MISSION_ORDER" || !req.missionAssignmentId) return;
    if (!["READY", "DELIVERED", "APPROVED"].includes(req.status)) return;
    const maj = await prisma.missionAssignment.updateMany({
      where: { id: req.missionAssignmentId, NOT: { orderStatus: "ISSUED" } },
      data: { orderStatus: "ISSUED", issuedAt: new Date(), issuedById: actorId },
    });
    if (maj.count === 0) return;
    const a = await prisma.missionAssignment.findUnique({ where: { id: req.missionAssignmentId }, select: { entityType: true, entityId: true, createdById: true, userId: true } });
    if (!a) return;
    const p = await parentMission(a.entityType, a.entityId);
    if (a.createdById && a.createdById !== a.userId) {
      await notifyUser({ userId: a.createdById, type: "GENERIC", title: "Ordre de mission émis", body: p.label, link: parentPath(a.entityType, a.entityId) }).catch(() => undefined);
    }
    await recordAudit({ actorId, action: "UPDATE", module: "Congrès", entityType: "MISSION_ASSIGNMENT", entityId: req.missionAssignmentId, summary: `Ordre de mission émis par les RH — ${p.label}` });
  } catch (err) {
    console.error("[missions] synchronisation de l'ordre impossible", err);
  }
}
