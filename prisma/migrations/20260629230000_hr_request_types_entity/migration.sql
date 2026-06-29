-- Nouveaux types de demande RH + entité polymorphe pour pièces/échanges.
ALTER TYPE "HrRequestType" ADD VALUE IF NOT EXISTS 'EXCEPTIONAL_EXIT';
ALTER TYPE "HrRequestType" ADD VALUE IF NOT EXISTS 'SICK_LEAVE';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'HR_REQUEST';
