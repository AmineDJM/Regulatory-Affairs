import type { CurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";

/**
 * QUI TIENT L'ANNUAIRE — et pourquoi ce n'est pas tout le monde.
 *
 * L'annuaire est une donnée d'IDENTITÉ à l'échelle de l'entreprise : c'est lui qui décide à
 * quelle adresse part un message signé du PDG. Laisser n'importe quel compte y écrire, ce serait
 * offrir un moyen simple de détourner du courrier — il suffirait de changer une adresse.
 *
 * Le geste attendu est celui de l'ASSISTANTE DE DIRECTION : elle enrichit, corrige, marque une
 * adresse comme vérifiée. Elle a le module Moyens généraux, comme pour l'annuaire des
 * prestataires. La Direction et le Super Admin l'ont aussi ; les RH également, parce que ce sont
 * eux qui savent quand une adresse professionnelle change.
 *
 * Prédicats PURS, dans leur propre fichier : un module « use server » n'exporte que des fonctions
 * asynchrones, et ces règles doivent rester testables sans base ni session.
 */

/** Lire l'annuaire : tout compte actif de l'entreprise. Un annuaire secret ne sert personne. */
export function canReadDirectory(user: CurrentUser): boolean {
  return Boolean(user.id);
}

/** Écrire dans l'annuaire — ajouter, corriger, désactiver une coordonnée. */
export function canEditDirectory(user: CurrentUser): boolean {
  if (user.role === "SUPER_ADMIN" || user.role === "DIRECTION") return true;
  if (user.secondaryRole === "SUPER_ADMIN" || user.secondaryRole === "DIRECTION") return true;
  // L'assistante de direction et les RH tiennent l'annuaire au quotidien : le droit suit le
  // MODULE (celui de leur écran), pas une liste de noms à maintenir à la main.
  return userCan(user, "GENERAL_MEANS", "UPDATE") || userCan(user, "RH", "UPDATE");
}

/**
 * MARQUER UNE ADRESSE COMME VÉRIFIÉE — le geste le plus lourd de l'annuaire.
 *
 * « Vérifiée en interne » est la provenance la plus forte : elle bat tout le reste au moment de
 * choisir où envoyer. Elle engage donc celui qui la pose, et se limite à ceux qui écrivent.
 */
export function canVerifyEndpoint(user: CurrentUser): boolean {
  return canEditDirectory(user);
}
