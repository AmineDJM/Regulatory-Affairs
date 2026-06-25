-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "accuracy" DOUBLE PRECISION,
ADD COLUMN     "geoSource" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

