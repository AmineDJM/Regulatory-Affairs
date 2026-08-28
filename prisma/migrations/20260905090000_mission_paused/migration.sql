-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- METTRE UNE MISSION EN PAUSE (§39-40) — un état, et pas un drapeau à côté.
--
-- POURQUOI PAS UN BOOLÉEN `paused`. Parce que la question « cette mission peut-elle avancer ? »
-- aurait alors DEUX sources : le statut et le drapeau. Deux sources finissent toujours par se
-- contredire, et le jour où elles divergent, une mission suspendue continue d'envoyer des
-- e-mails pendant que l'écran affiche « en pause ». L'état est le seul endroit où l'on lit ce
-- qu'une mission a le droit de faire.
--
-- POURQUOI PAS `BLOCKED`. Bloqué décrit une mission qui NE PEUT PAS avancer — il lui manque
-- quelque chose. En pause décrit une mission qui POURRAIT avancer et à qui on a dit d'attendre.
-- Les confondre ferait proposer une « reprise » à une mission qui n'a rien pour reprendre, et
-- perdrait l'information qui compte : qui a appuyé sur le bouton, et pourquoi.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TYPE "MissionStatus" ADD VALUE IF NOT EXISTS 'PAUSED';
