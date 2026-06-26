-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "HrRequestType" ADD VALUE 'LEAVE_TITLE';
ALTER TYPE "HrRequestType" ADD VALUE 'MISSION_ORDER';
ALTER TYPE "HrRequestType" ADD VALUE 'EXPENSE_REPORT';

