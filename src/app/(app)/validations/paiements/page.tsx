import { redirect } from "next/navigation";

/**
 * ANCIENNE ADRESSE — les demandes de paiement ont rejoint les Finances.
 *
 * On ne supprime pas la route : des notifications déjà envoyées, des messages et des favoris
 * pointent ici. Les faire tomber sur une page d'erreur, c'est perdre un dossier de paiement au
 * moment où quelqu'un le cherche.
 */
export default function LegacyPaymentRequestsPage() {
  redirect("/finances/paiements");
}
