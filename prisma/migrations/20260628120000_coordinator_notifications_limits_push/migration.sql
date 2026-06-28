-- Nouveau rôle Coordinateur (coursier / acheteur, espace restreint)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'COORDINATOR';

-- Statuts de tâche : demandée (en attente d'acceptation) / refusée
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'REQUESTED';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

-- Champs « course / livraison » sur les tâches (adresse + suivi de durée)
ALTER TABLE "Task" ADD COLUMN "address" TEXT;
ALTER TABLE "Task" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "expectedMinutes" INTEGER;

-- Réglages d'instance (limites de taille d'upload, etc.)
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "maxUploadMb" INTEGER NOT NULL DEFAULT 25,
    "maxDriveUploadMb" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- Abonnements Web Push (PWA) — notifications poussées sur le téléphone
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
