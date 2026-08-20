/**
 * QUI VOIT UN DOCUMENT RH — le salarié, ou les RH seuls.
 *
 * Deux natures de pièces cohabitent dans le dossier d'un employé, et elles n'ont pas la même
 * destination :
 *
 *   • celles qu'on lui REMET — bulletin de paie, attestation de travail, attestation CNAS,
 *     relevé d'émoluments, domiciliation de salaire. Elles existent POUR lui : les lui cacher
 *     rendrait le module « Mon dossier RH » vide de ce qu'il est censé contenir.
 *   • celles que les RH CONSERVENT — contrat de travail, avenant, pièce d'identité, diplôme,
 *     certificat médical. Ce sont des pièces de gestion, versées au dossier de l'employeur.
 *
 * Le défaut suit donc la nature du document, pas une case à cocher qu'on oublie. Et il reste un
 * DÉFAUT : les RH peuvent toujours partager une pièce avec le salarié (leur remettre leur
 * contrat signé est un geste normal) — c'est alors un acte explicite, tracé.
 *
 * ⚠️ Un document RH-only n'est PAS répliqué dans le Drive : le miroir range les contrats sous
 * « RH — Contrats », un arbre que la Direction lit en vue globale. Copier là ce qu'on vient de
 * réserver aux RH annulerait la restriction sans que rien ne le signale.
 *
 * Module PUR — testé, sans base de données.
 */

/** Les catégories destinées AU SALARIÉ : visibles de lui par défaut. */
const EMPLOYEE_FACING: readonly string[] = [
  "PAYSLIP",
  "WORK_CERTIFICATE",
  "CNAS_CERTIFICATE",
  "SALARY_STATEMENT",
  "DOMICILIATION",
];

/**
 * Le document est-il visible du salarié PAR DÉFAUT ?
 *
 * Tout ce qui n'est pas explicitement destiné au salarié reste aux RH — contrat et avenant en
 * tête. C'est le sens de la liste : on ne raisonne pas « ce qui est confidentiel » (liste qu'on
 * oublie d'allonger quand une catégorie apparaît), mais « ce qu'on remet ».
 */
export function defaultVisibleToEmployee(category: string): boolean {
  return EMPLOYEE_FACING.includes(category);
}

/**
 * La visibilité EFFECTIVE d'un dépôt : le choix explicite des RH s'il y en a un, le défaut de
 * la catégorie sinon.
 *
 * `choice` vient d'un formulaire : `undefined` = « rien coché », qui n'est pas la même chose
 * que « décoché ». Confondre les deux ferait basculer tous les bulletins de paie en RH-only au
 * premier dépôt fait depuis un écran qui n'envoie pas la case.
 */
export function resolveVisibility(category: string, choice?: boolean): boolean {
  return choice === undefined ? defaultVisibleToEmployee(category) : choice;
}

/**
 * Ce document doit-il être répliqué dans le Drive ?
 *
 * Le miroir sert à retrouver un contrat depuis le Drive. Mais un document réservé aux RH n'a
 * rien à faire dans un arbre que d'autres lisent : on ne réplique QUE ce qui est déjà partagé.
 */
export function shouldMirrorToDrive(category: string, visibleToEmployee: boolean): boolean {
  const mirrored = category === "CONTRACT" || category === "AMENDMENT";
  return mirrored && visibleToEmployee;
}

/** Libellé d'état, tel qu'il s'affiche sur la ligne du document. */
export function visibilityLabel(visibleToEmployee: boolean): string {
  return visibleToEmployee ? "Partagé avec le salarié" : "RH uniquement";
}
