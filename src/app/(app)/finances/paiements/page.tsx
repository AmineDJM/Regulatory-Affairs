import { redirect } from "next/navigation";

/**
 * ANCIENNE ADRESSE — les demandes de paiement sont revenues dans les Demandes de validations.
 *
 * Elles y avaient déjà vécu, puis étaient passées aux Finances : le va-et-vient tient à une
 * distinction qui n'était pas claire au départ et qui l'est devenue. Une demande de paiement est
 * une DEMANDE — elle se dépose là où l'on dépose ses demandes, avec les autres. Les Finances,
 * elles, la voient depuis LEUR module, où elles instruisent : c'est leur travail, pas leur
 * boîte de réception.
 *
 * On ne supprime pas la route : des notifications déjà envoyées, des messages et des favoris
 * pointent ici. Les faire tomber sur une page d'erreur, c'est perdre un dossier de paiement au
 * moment précis où quelqu'un le cherche.
 */
export default function LegacyFinancePaymentsPage() {
  redirect("/validations/paiements");
}
