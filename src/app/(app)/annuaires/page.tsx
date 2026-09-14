import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { premierOngletOuvert } from "./en-tete";

export const dynamic = "force-dynamic";

/**
 * « ANNUAIRES » — le sous-module du pôle Administration qui centralise tous les annuaires
 * (décision de la Direction, 09/2026). L'adresse racine ne porte aucun écran : elle mène au
 * premier onglet que la personne peut ouvrir. Une page d'accueil vide qu'il faut quitter aussitôt
 * est un écran d'escale, pas un écran.
 */
export default async function AnnuairesPage() {
  const user = await requireModule("DIRECTORIES");
  const premier = await premierOngletOuvert(user);
  redirect(premier ?? "/dashboard?denied=DIRECTORIES");
}
