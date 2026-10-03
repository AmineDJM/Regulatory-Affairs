-- UN GESTE À LA FOIS SUR UN CIRCUIT (§118.186).
--
-- Chaque geste du moteur Ad & Pro (approuver, refuser, renvoyer, resoumettre, retirer, relancer,
-- faire appel) prend le circuit avant son premier effet et le rend à la fin. Une prise de plus de
-- deux minutes est réputée abandonnée et se reprend. Colonne nullable, aucune donnée réécrite.
ALTER TABLE "WorkflowInstance" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);
