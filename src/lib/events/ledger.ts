import { prisma } from "@/lib/prisma";
import type { Prisma, EntityType } from "@prisma/client";
import { EXPECTED_EVENTS, matchEvent, type BusinessEventLike, type TaskLike } from "@/lib/tasks/evidence";
import { reveillerMissions } from "@/lib/missions/events/router";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE REGISTRE D'ÉVÉNEMENTS — écrire un fait, et laisser l'ERP en tirer les conséquences.
 *
 * ── LA SEULE PORTE ───────────────────────────────────────────────────────────────────────
 *
 * `recordEvent` est le seul endroit qui écrit dans `BusinessEvent`. Ce n'est pas de la
 * discipline : c'est ce qui permet aux RÉACTIONS (réconciliation des tâches aujourd'hui,
 * notifications et frises demain) d'exister en un seul point plutôt qu'en trente.
 *
 * ── UN ÉVÉNEMENT NE FAIT JAMAIS ÉCHOUER SON ÉMETTEUR ─────────────────────────────────────
 *
 * Le dépôt d'un contrat doit réussir même si l'inscription du fait échoue. Un registre qui
 * fait tomber l'écriture métier qu'il observe est une régression, pas une observabilité. Les
 * erreurs sont donc journalisées et avalées — et c'est le SEUL endroit du produit où avaler
 * une erreur est le bon choix.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface RecordEventInput {
  type: string;
  sourceDomain: string;
  actorId?: string | null;
  entityType?: EntityType | null;
  entityId?: string | null;
  /** Les autres entités concernées, en « TYPE:id ». */
  relatedRefs?: string[];
  payload?: Prisma.InputJsonValue;
  correlationId?: string | null;
  missionId?: string | null;
  /** Quand le fait s'est produit, s'il est ANTÉRIEUR à son inscription (import, rattrapage). */
  occurredAt?: Date;
}

/**
 * INSCRIT UN FAIT, puis réconcilie ce qui l'attendait.
 *
 * Rend l'identifiant du fait, ou `null` si l'inscription a échoué — auquel cas l'appelant
 * continue son travail : c'est le point de l'en-tête.
 */
export async function recordEvent(input: RecordEventInput): Promise<string | null> {
  try {
    const evt = await prisma.businessEvent.create({
      data: {
        type: input.type,
        sourceDomain: input.sourceDomain,
        occurredAt: input.occurredAt ?? new Date(),
        actorId: input.actorId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        relatedRefs: input.relatedRefs ?? [],
        ...(input.payload !== undefined ? { payload: input.payload } : {}),
        correlationId: input.correlationId ?? null,
        missionId: input.missionId ?? null,
      },
      select: { id: true, type: true, occurredAt: true, sourceDomain: true, entityType: true, entityId: true, actorId: true },
    });

    await reconcileTasks(evt).catch((err) => {
      console.error("[events] réconciliation impossible", evt.type, err);
    });

    // LE RÉVEIL DES MISSIONS (§18) — la deuxième conséquence d'un fait, après la réconciliation
    // des tâches. Elle passe par le MÊME registre : une mission qui attend « la réponse de
    // Redouane » se règle quand le fait arrive, sans que personne ait à dire « il a répondu ».
    //
    // Le routeur ne fait PAS tourner la mission : il règle l'attente et rend la main. Sans quoi
    // le dépôt d'un contrat attendrait la fin d'une mission de trente-trois envois.
    await reveillerMissions({
      type: evt.type,
      actorId: evt.actorId,
      entityType: evt.entityType,
      entityId: evt.entityId,
      relatedRefs: input.relatedRefs ?? [],
      payload: input.payload,
      missionId: input.missionId ?? null,
    }).catch((err) => {
      console.error("[events] réveil de mission impossible", evt.type, err);
    });

    return evt.id;
  } catch (err) {
    console.error("[events] inscription impossible", input.type, err);
    return null;
  }
}

/**
 * LE RAPPROCHEMENT — ce qui rend « la tâche est en retard » enfin exact.
 *
 * La décision (« ce fait satisfait-il cette tâche ? ») est PURE et vit dans
 * `src/lib/tasks/evidence.ts` : elle se teste au jeton près, sans base. Ici, on ne fait que
 * chercher les candidates et écrire le résultat.
 *
 * LA FENÊTRE DE RECHERCHE est bornée à 400 tâches ouvertes récentes. Sans borne, un dépôt de
 * document ferait relire toutes les tâches de l'histoire à chaque fois — le genre de coût
 * invisible qui n'apparaît qu'en production, deux ans plus tard.
 */
async function reconcileTasks(
  // `entityType` est resserré au type Prisma : le contrat PUR de `evidence.ts` le déclare
  // `string` (il ne connaît pas la base, et c'est ce qui le rend testable sans elle), mais
  // l'écriture, elle, a besoin de l'enum réel.
  evt: Omit<BusinessEventLike, "entityType"> & { id: string; entityType: EntityType | null },
): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────────────────
  // LE PRÉ-FILTRE QUI ÉVITE 400 LIGNES LUES POUR RIEN.
  //
  // Depuis que l'audit alimente le registre, un fait est inscrit à chaque changement de statut
  // de l'ERP. Or une tâche ne peut attendre qu'un des sept faits d'`EXPECTED_EVENTS` : pour
  // tous les autres, la recherche ne pourrait RIEN trouver — elle lirait 400 tâches pour
  // conclure à l'évidence. C'est exactement le coût invisible que l'en-tête ci-dessus décrit,
  // et il fallait le fermer AVANT de brancher les cinq cents points d'émission, pas après.
  //
  // La liste vient d'`evidence.ts` : la garde ne peut donc pas se désynchroniser de la règle
  // qu'elle protège.
  // ─────────────────────────────────────────────────────────────────────────────────────
  if (!(EXPECTED_EVENTS as readonly string[]).includes(evt.type)) return;

  const ouvertes = await prisma.task.findMany({
    where: { status: { notIn: ["DONE", "CANCELLED"] } },
    select: {
      id: true, title: true, description: true, status: true, assignedToId: true,
      createdAt: true, expectedEvent: true, relatedEntityType: true, relatedEntityId: true,
      evidenceAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 400,
  });

  const candidates: TaskLike[] = ouvertes.map((t) => ({
    id: t.id, title: t.title, description: t.description, status: t.status,
    assignedToId: t.assignedToId, createdAt: t.createdAt,
    expectedEvent: t.expectedEvent, relatedEntityType: t.relatedEntityType, relatedEntityId: t.relatedEntityId,
  }));

  const dejaPreuve = new Map(ouvertes.map((t) => [t.id, t.evidenceAt]));

  for (const m of matchEvent(evt, candidates)) {
    // LA PREMIÈRE PREUVE FAIT FOI. Un second dépôt ne doit pas réécrire la date du premier :
    // « déposé le 22/08 » est un fait, et il ne se met pas à jour.
    if (dejaPreuve.get(m.taskId)) continue;

    await prisma.task.update({
      where: { id: m.taskId },
      data: {
        evidenceEntityType: evt.entityType ?? null,
        evidenceEntityId: evt.entityId ?? null,
        evidenceAt: evt.occurredAt,
        evidenceActorId: evt.actorId ?? null,
        evidenceNote: m.reason,
        // CLÔTURE AUTOMATIQUE : seulement sur une attente DÉCLARÉE à la création. Une
        // déduction de texte inscrit la preuve et s'arrête là — voir `evidence.ts`.
        ...(m.autoComplete ? { status: "DONE" as const, completedAt: evt.occurredAt } : {}),
      },
    }).catch((err) => console.error("[events] preuve non inscrite sur", m.taskId, err));

    console.info("[events] preuve", {
      task: m.taskId, event: evt.type, confidence: m.confidence, autoComplete: m.autoComplete,
    });
  }
}

/**
 * LA FRISE d'une entité — tous les faits qui la concernent, du plus récent au plus ancien.
 *
 * Cherche dans les DEUX sens : l'entité principale du fait, et les entités secondaires
 * (`relatedRefs`). Un dépôt de contrat inscrit sous « le contrat » doit remonter aussi quand
 * on interroge « le consultant ».
 */
export async function timelineOf(
  entityType: EntityType,
  entityId: string,
  limit = 50,
): Promise<{ type: string; occurredAt: Date; sourceDomain: string; actorId: string | null; payload: unknown }[]> {
  const ref = `${entityType}:${entityId}`;
  const rows = await prisma.businessEvent.findMany({
    where: { OR: [{ entityType, entityId }, { relatedRefs: { has: ref } }] },
    orderBy: { occurredAt: "desc" },
    take: Math.min(limit, 200),
    select: { type: true, occurredAt: true, sourceDomain: true, actorId: true, payload: true },
  });
  return rows;
}
