import type { EntityType } from "@prisma/client";
import { personnesInvitables, type MissionAssignmentDTO } from "@/lib/queries/missions";
import { EquipeAdventum } from "./equipe-adventum";

/**
 * « ÉQUIPE ADVENTUM » sur une demande Ad & Pro (sponsoring, événement, congrès national / international) — composant
 * SERVEUR : il lit lui-même les salariés actifs, groupés par département, pour le sélecteur. Les fiches lui passent
 * encore `users` (liste à plat d'avant) : il n'en a plus besoin.
 */
export async function MissionAssignmentsCard({
  entityType, entityId, assignments, canManage, currentUserId,
}: {
  entityType: EntityType;
  entityId: string;
  assignments: MissionAssignmentDTO[];
  users?: { id: string; name: string }[];
  canManage: boolean;
  currentUserId: string;
  path?: string;
}) {
  const personnes = canManage ? await personnesInvitables() : [];
  return (
    <EquipeAdventum
      entityType={entityType} entityId={entityId} assignments={assignments}
      personnes={personnes} canManage={canManage} currentUserId={currentUserId}
    />
  );
}
