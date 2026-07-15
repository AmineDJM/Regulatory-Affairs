import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * « Courrier » (boîte mail intégrée) retiré de la plateforme : la messagerie e-mail se gère
 * désormais dans l'app Infomaniak. Le module n'est plus exposé dans le menu et l'accès direct
 * par URL est neutralisé (redirection vers l'espace personnel). Le back-end mail reste dormant.
 */
export default async function CourrierPage() {
  redirect("/mon-espace");
}
