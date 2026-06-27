-- Seuils ajustables du Risk Radar (Adventum Brain), réglables par le Super Admin.
CREATE TABLE "RiskSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "pchCautionWarnDays" INTEGER NOT NULL DEFAULT 30,
    "congressStaleDays" INTEGER NOT NULL DEFAULT 4,
    "sponsoringStaleDays" INTEGER NOT NULL DEFAULT 4,
    "expenseStaleDays" INTEGER NOT NULL DEFAULT 7,
    "budgetWarnPct" INTEGER NOT NULL DEFAULT 85,
    "kolVisitStaleDays" INTEGER NOT NULL DEFAULT 60,
    "medicalInfoStaleDays" INTEGER NOT NULL DEFAULT 5,
    "silentSupplierDays" INTEGER NOT NULL DEFAULT 14,
    "stockLowThreshold" INTEGER NOT NULL DEFAULT 10,
    "deliveryGraceDays" INTEGER NOT NULL DEFAULT 3,
    "eventHorizonDays" INTEGER NOT NULL DEFAULT 7,
    "eventMinAttendance" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "RiskSetting_pkey" PRIMARY KEY ("id")
);
