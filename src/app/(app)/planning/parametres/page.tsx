import { redirect } from "next/navigation";

/**
 * L'ANCIENNE ADRESSE des paramètres de la Force de vente (« ⋯ › Réglages › Paramètres »). Ils vivent dans le module
 * « Business Units » (Direction, 08/10) : un lien gardé y mène toujours.
 */
export default function AnciensParametres() {
  redirect("/business-units/parametres");
}
