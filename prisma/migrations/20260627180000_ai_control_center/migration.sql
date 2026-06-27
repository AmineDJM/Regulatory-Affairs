-- Centre de contrôle IA : réglages globaux + journal d'usage.
CREATE TABLE "AiSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "masterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "assistantEnabled" BOOLEAN NOT NULL DEFAULT true,
    "proactiveNudgesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "brainEnabled" BOOLEAN NOT NULL DEFAULT true,
    "processIntelEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fieldReportAiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "voiceTranscriptEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "AiSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "model" TEXT,
    "userId" TEXT,
    "ok" BOOLEAN NOT NULL,
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiUsageLog_feature_idx" ON "AiUsageLog"("feature");
CREATE INDEX "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");
CREATE INDEX "AiUsageLog_userId_idx" ON "AiUsageLog"("userId");
