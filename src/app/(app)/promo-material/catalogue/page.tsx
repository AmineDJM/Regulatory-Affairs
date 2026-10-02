import { redirect } from "next/navigation";
import { CHEMIN_CATALOGUE_PROMO } from "@/lib/chemins/stock-promo";

/**
 * L'ANCIENNE ADRESSE DU CATALOGUE PROMOTIONNEL — une escale, plus un écran (§118.173).
 *
 * Le catalogue vit désormais sous le stock promotionnel, sous-module à part du pôle Sales &
 * Marketing. L'adresse d'avant reste citée par des liens et des favoris : elle y conduit.
 */
export default function AncienCataloguePromo() {
  redirect(CHEMIN_CATALOGUE_PROMO);
}
