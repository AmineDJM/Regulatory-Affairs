import { prisma } from "@/lib/prisma";
import { peutPiloterMissionsAdam } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { canTransition, type MissionState } from "@/lib/missions/runtime/state";
import { journaliser, transitionner } from "@/lib/missions/runtime/store";

/**
 * ═══════════════════════════════════════════════════════════
 * L'AUTORITÉ D'UN PROPRIÉTAIRE DE MISSION, RELUE À CHAQUE PASSAGE (§118.136, §118.119b).
 *
 * Les missions d'Adam sont réservées au Super Admin (`peutPiloterMissionsAdam`, `rbac.ts`).
 * Cette règle a une seconde moitié, et c'est celle qui protège : une mission déjà en base dont
 * le propriétaire n'a pas — ou n'a plus — ce droit ne doit plus tourner. Le battement, le
 * balayage des surveillances et le filet des lancements perdus rebâtissent le propriétaire à
 * chaque passage (`proprietaire()`) ; ils passent ensuite par ICI, et une mission hors droit est
 * mise en PAUSE, jamais supprimée : la pause porte son motif, la suppression ne dirait rien.
 *
 * ── POURQUOI PAS `mettreEnPause` DU RUNTIME ────────────────────────────────────────────
 *
 * Elle ne connaît que `kind: "RUNTIME"` (une surveillance est une mission `WATCH`), et elle
 * ATTRIBUE la pause au propriétaire (`actorId`) : ici, c'est le moteur qui suspend, au nom d'une
 * règle, et le journal doit le dire ainsi — sinon la personne lirait qu'elle a suspendu elle-même
 * une mission qu'on lui a fermée. La machine à états reste la même (`canTransition`).
 * ═══════════════════════════════════════════════════════════
 */

/** Le motif que porte la pause — relu à l'écran (« en pause depuis…, parce que… ») et au journal. */
export const MOTIF_HORS_DROIT = "le propriétaire n'a pas (ou plus) le droit aux missions d'Adam — réservées au Super Admin";

/** Le propriétaire existe, est actif ET a le droit de faire tourner des missions. */
export function proprietaireHabilite(u: CurrentUser | null): u is CurrentUser {
  return u !== null && peutPiloterMissionsAdam(u);
}

/**
 * MET EN PAUSE une mission (RUNTIME ou WATCH) dont le propriétaire n'a pas le droit aux missions.
 * Rend `true` si la mission vient d'être suspendue ; `false` si elle l'était déjà, si elle est
 * close, ou si elle n'existe pas pour ce propriétaire. Jamais une mission de COORDINATION (RH).
 */
export async function suspendreMissionHorsDroit(missionId: string, ownerId: string): Promise<boolean> {
  const m = await prisma.mission.findFirst({
    where: { id: missionId, ownerId, kind: { in: ["RUNTIME", "WATCH"] } },
    select: { status: true },
  });
  if (!m) return false;
  const depuis = m.status as MissionState;
  if (depuis === "PAUSED" || !canTransition(depuis, "PAUSED")) return false;
  await transitionner(missionId, "PAUSED", `Suspendue : ${MOTIF_HORS_DROIT}`);
  await prisma.mission.updateMany({
    where: { id: missionId, ownerId },
    data: { pausedAt: new Date(), pausedReason: MOTIF_HORS_DROIT, pausedFrom: depuis },
  });
  await journaliser(missionId, "PAUSED", `Mise en pause — ${MOTIF_HORS_DROIT}`, { motif: MOTIF_HORS_DROIT, depuis, horsDroit: true });
  return true;
}
