-- COMPLÉMENTS KPI (Direction, 10/2026 : « comble tous les manques ») — la brique « demandes traitées ».
--   1. SupportRequest.resolvedAt : le moment où la demande de support a été traitée (première réponse du répondant ou
--      sa clôture). Rien ne le datait : seul `updatedAt` bougeait à chaque relance.
--   2. HrDocumentRequest.handledAt : le moment où les RH ont traité la demande (prête, remise, accordée, refusée).
--   3. Rattrapage SANS ESTIMATION : on ne date que ce qu'une trace prouve (premier message d'un répondant, journal
--      d'audit, document RH rattaché, confirmation d'entrevue). Sans trace : reste nul, la brique l'écarte.
--   (Les demandes administratives portent déjà `completedAt` : rien à ajouter.)
--
-- Idempotente : rejouée, elle ne change plus rien.

-- 1. SUPPORT ─────────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "SupportRequest" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);

UPDATE "SupportRequest" r
SET "resolvedAt" = t.quand
FROM (
  SELECT r2."id", LEAST(
    (SELECT MIN(m."createdAt") FROM "SupportMessage" m
      WHERE m."requestId" = r2."id" AND m."authorId" IS NOT NULL AND m."authorId" IS DISTINCT FROM r2."requesterId"),
    (SELECT MIN(a."createdAt") FROM "AuditLog" a
      WHERE a."entityType"::text = 'SUPPORT_REQUEST' AND a."entityId" = r2."id"
        AND (a."summary" LIKE 'Statut → ANSWERED%' OR a."summary" LIKE 'Statut → CLOSED%')
        AND a."actorId" IS DISTINCT FROM r2."requesterId")
  ) AS quand
  FROM "SupportRequest" r2
  WHERE r2."resolvedAt" IS NULL AND r2."status"::text IN ('ANSWERED', 'CLOSED')
) t
WHERE r."id" = t."id" AND t.quand IS NOT NULL AND r."resolvedAt" IS NULL;

-- 2. DEMANDES RH ─────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "handledAt" TIMESTAMP(3);

UPDATE "HrDocumentRequest" h
SET "handledAt" = t.quand
FROM (
  SELECT h2."id", LEAST(
    (SELECT MIN(d."createdAt") FROM "EmployeeDocument" d WHERE d."requestId" = h2."id"),
    h2."meetingConfirmedAt"
  ) AS quand
  FROM "HrDocumentRequest" h2
  WHERE h2."handledAt" IS NULL AND h2."handledById" IS NOT NULL
    AND h2."status"::text IN ('READY', 'DELIVERED', 'APPROVED', 'REJECTED')
) t
WHERE h."id" = t."id" AND t.quand IS NOT NULL AND h."handledAt" IS NULL;
