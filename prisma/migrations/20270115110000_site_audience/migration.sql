-- L'AUDIENCE DU SITE PUBLIC (Direction, 07/10) : pages vues et clics envoyés par adventumdz.com, sans cookie. Additive et idempotente.
CREATE TABLE IF NOT EXISTS "SiteAnalyticsEvent" (
  "id" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "type" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "title" TEXT,
  "referrer" TEXT,
  "source" TEXT,
  "medium" TEXT,
  "campaign" TEXT,
  "visitor" TEXT NOT NULL,
  "session" TEXT,
  "device" TEXT,
  "browser" TEXT,
  "os" TEXT,
  "country" TEXT,
  "label" TEXT,
  "target" TEXT,
  "durationMs" INTEGER,
  CONSTRAINT "SiteAnalyticsEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SiteAnalyticsEvent_at_idx" ON "SiteAnalyticsEvent"("at");
CREATE INDEX IF NOT EXISTS "SiteAnalyticsEvent_type_at_idx" ON "SiteAnalyticsEvent"("type", "at");
CREATE INDEX IF NOT EXISTS "SiteAnalyticsEvent_path_at_idx" ON "SiteAnalyticsEvent"("path", "at");