import { redirect } from "next/navigation";
import { CHEMIN_BONS_DE_COMMANDE } from "@/lib/chemins/bons-de-commande";

/**
 * L'ANCIENNE ADRESSE DES BONS DE COMMANDE — une escale, pas un écran (§118.176).
 *
 * La file des bons de commande à signer était un sous-module des Finances ; elle est devenue un
 * module à part (« le module bon de commande doit être à part et le super admin donne les accès à
 * qui il veut »), à sa propre adresse. Des notifications « Bon de commande à signer » déjà envoyées
 * portent celle-ci, en base, comme des favoris et des liens copiés : une adresse qui meurt fait
 * chercher un écran supprimé et conclure que la file a disparu. Elle conduit donc au module — dont
 * la porte, elle, est le droit du module « Bons de commande », vérifié là-bas (le patron de
 * `/finances`, §118.169).
 */
export default function AncienneAdresseBonsDeCommande() {
  redirect(CHEMIN_BONS_DE_COMMANDE);
}
