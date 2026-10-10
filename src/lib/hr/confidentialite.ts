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

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UN ENCADRANT LIT D'UNE ABSENCE — « Congé » ou « Absent », jamais la nature médicale.
 *
 * Mon Équipe cachait le type de congé (§118.184) : un arrêt maladie s'affichait donc « Congé », ce qui
 * faussait la lecture (on croyait la personne partie en vacances) sans protéger davantage. La
 * distinction se fait à deux niveaux, sans rien révéler de plus que nécessaire :
 *
 *   • TOUT ENCADRANT lit « Congé » pour un congé annuel (et ses proches : sans solde, récupération) et
 *     « Absent » pour toute autre absence — maladie, maternité / paternité, événement familial,
 *     autre. « Absent » couvre plusieurs natures à la fois : il ne dit PAS « malade ».
 *   • qui GÈRE les RH (la même règle que la paie : modifier ou valider le module) lit en plus le TYPE
 *     précis — c'est son travail, et la fiche RH le lui montre déjà.
 *
 * Une nature inconnue tombe sur « Absent » : dans le doute, on en dit le moins.
 * Module PUR — la nature se calcule côté serveur, seul le résultat part vers le navigateur.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export type NatureAbsence = "CONGE" | "ABSENCE";

/** Les types de congé qu'on peut nommer « Congé » à un encadrant — le reste se dit « Absent ». */
const TYPES_DITS_CONGE: ReadonlySet<string> = new Set(["ANNUAL", "UNPAID", "RECOVERY"]);

export function natureDeLAbsence(type: string | null | undefined): NatureAbsence {
  return type && TYPES_DITS_CONGE.has(type) ? "CONGE" : "ABSENCE";
}

/** Voit le TYPE précis d'une absence (maladie, maternité…) — la règle des RH, celle de la paie. */
export function voitLeTypeDesAbsences(user: SessionUser): boolean {
  return voitLesSalaires(user);
}
