import { redirect } from "next/navigation";

/**
 * LES FACTURES N'ONT PLUS D'ADRESSE À ELLES — elles sont dans le registre.
 *
 * Une facture est un document légal de nature « facture », au milieu des devis et des bons de
 * commande dont elle découle. Cette page ne fait plus que conduire là-bas : les liens déjà
 * envoyés, les favoris et les raccourcis des mois passés continuent d'aboutir. Une adresse qui
 * meurt fait chercher un écran supprimé, et conclure que la donnée a disparu avec lui.
 */
export default function FacturesRedirectPage() {
  redirect("/legal?nature=INVOICE");
}
