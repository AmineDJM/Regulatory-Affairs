import { redirect } from "next/navigation";

/**
 * L'organigramme a QUITTÉ la console d'administration : il vit désormais sur `/organigramme`,
 * ouvert par le Super Admin aux rôles et personnes de son choix (les RH le tiennent à jour au
 * quotidien). L'ancienne adresse reste valable et redirige — les liens et favoris survivent.
 */
export default function AdminOrganigrammeRedirect() {
  redirect("/organigramme");
}
