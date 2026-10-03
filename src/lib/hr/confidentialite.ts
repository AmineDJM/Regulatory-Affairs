import { userCan, type SessionUser } from "@/lib/rbac";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * QUI VOIT LES SALAIRES — une règle, lue par chaque porte qui en montre (§118.184, audit 360° S5).
 *
 * Mesuré par l'audit : le KPI « Masse salariale » et sa carte par entité, le « Salaire de base », les
 * nets des cinq derniers bulletins, le NIN et le n° CNAS de la fiche, et tout bulletin ou contrat
 * téléchargeable — étaient montrés aux rôles qui n'ont des RH que la LECTURE (le Directeur des
 * Opérations, les Finances). Pendant ce temps `/rh/equipe` réservait déjà le salaire, mais au seul
 * droit de VALIDER : deux règles pour la même question, et la plus large fuyait (§118.5).
 *
 * La règle : qui GÈRE les RH (modifier ou valider le module) voit les salaires et les pièces des
 * dossiers ; la lecture seule voit l'annuaire, pas la paie. Modifier suffit parce que le formulaire
 * d'une fiche salarié PORTE ces montants : cacher à quelqu'un ce qu'il saisit n'aurait pas de sens.
 * Ce que chacun voit de SON propre dossier (« Mon dossier RH ») ne passe pas par ici.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function voitLesSalaires(user: SessionUser): boolean {
  return userCan(user, "RH", "UPDATE") || userCan(user, "RH", "VALIDATE");
}
