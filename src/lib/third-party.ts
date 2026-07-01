/**
 * « Impliquer une tierce personne » — cœur partagé (sans "use server") réutilisé par
 * les actions Sponsoring / Congrès / Événements. Ne lit jamais la session : l'auteur
 * est passé explicitement (`actorId`).
 *
 * La personne sollicitée :
 *   1. reçoit une **demande de validation directe** dans SON espace (sans accès au
 *      module concerné) ;
 *   2. se voit ouvrir un **dossier de suivi** auto-créé qui indique DE QUEL événement
 *      il s'agit, SANS aucun détail de budget ni information confidentielle. La demande
 *      pointe vers ce dossier (accessible), pas vers la fiche de l'événement.
 */
import type { EntityType } from "@prisma/client";
import { createDirectValidation } from "@/lib/validation";
import { createDossierRecord } from "@/lib/dossiers-core";

interface InvolveThirdPartyInput {
  actorId: string;
  personId: string;
  /** Libellé de l'événement, SANS budget (ex. « Congrès — Cardio 2026 »). */
  eventLabel: string;
  /** Module d'origine, pour l'étiquette de la demande de validation. */
  moduleLabel?: string;
  /** Message libre du demandeur (optionnel) — ne doit pas contenir de budget. */
  note?: string | null;
}

export async function involveThirdParty(input: InvolveThirdPartyInput): Promise<{ ok: boolean; error?: string; dossierId?: string }> {
  const personId = input.personId?.trim();
  if (!personId) return { ok: false, error: "Indiquez la personne à impliquer." };
  if (personId === input.actorId) return { ok: false, error: "Vous ne pouvez pas vous impliquer vous-même." };

  // 1) Dossier de suivi : indique l'événement (sans budget) et sert d'espace d'échange.
  const dossier = await createDossierRecord(
    {
      title: input.eventLabel,
      description: input.note?.trim() || "Vous êtes sollicité(e) pour cet événement. Merci d'apporter votre avis / contribution depuis votre espace.",
      category: "Implication",
      assignedToId: personId,
    },
    input.actorId,
  );

  // 2) Demande de validation directe dans l'espace de la personne, pointant vers le
  //    dossier (accessible) — jamais vers la fiche de l'événement (budget masqué).
  const res = await createDirectValidation({
    requesterId: input.actorId,
    title: `Avis demandé — ${input.eventLabel}`,
    description: input.note ?? null,
    link: `/dossiers/${dossier.id}`,
    module: input.moduleLabel ?? "Ad & Pro",
    validatorIds: [personId],
    entityType: "DOSSIER" as EntityType,
    entityId: dossier.id,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, dossierId: dossier.id };
}
