-- « Autre rôle » (fonction secondaire) par utilisateur, réglé par le Super Admin.
-- L'utilisateur cumule les capacités de son rôle principal ET de son rôle secondaire.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "secondaryRole" "UserRole";
