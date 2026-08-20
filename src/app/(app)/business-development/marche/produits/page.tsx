import { redirect } from "next/navigation";

/**
 * ANCIENNE ADRESSE — l'explorateur produits est devenu un module à part.
 *
 * La route reste et redirige : des liens internes et des favoris pointent ici, et l'explorateur
 * est l'écran le plus consulté du pôle.
 */
export default function LegacyMarketProductsPage() {
  redirect("/explorateur-produits");
}
