import { redirect } from "next/navigation";

/**
 * « MON TRAVAIL » A FONDU DANS « MON ESPACE ».
 *
 * C'étaient deux écrans pour une seule question — « qu'est-ce qui me concerne ? ». On ouvrait
 * l'un, puis l'autre, et l'on manquait celui auquel on n'avait pas pensé. Ce qui attend une
 * signature se lit désormais EN TÊTE de son espace, les tâches en dessous.
 *
 * L'adresse survit : elle vit dans des notifications déjà envoyées, dans des favoris et dans
 * des liens collés en conversation. Une page supprimée renverrait une erreur à des gens qui
 * n'ont rien fait de mal.
 */
export default function MonTravailRedirect() {
  redirect("/mon-espace");
}
