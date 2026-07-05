-- Types de demande RH supplémentaires : congés (annuel, sans solde, exceptionnel, maternité).
ALTER TYPE "HrRequestType" ADD VALUE IF NOT EXISTS 'ANNUAL_LEAVE';
ALTER TYPE "HrRequestType" ADD VALUE IF NOT EXISTS 'UNPAID_LEAVE';
ALTER TYPE "HrRequestType" ADD VALUE IF NOT EXISTS 'SPECIAL_LEAVE';
ALTER TYPE "HrRequestType" ADD VALUE IF NOT EXISTS 'MATERNITY_LEAVE';
