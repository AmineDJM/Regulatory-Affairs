import { redirect } from "next/navigation";

/**
 * L'ANNUAIRE A DÉMÉNAGÉ DANS « MON ESPACE » — et l'ancienne adresse continue d'y mener.
 *
 * Elle est écrite dans des liens, des notifications et des favoris. La supprimer donnerait une
 * page introuvable à des gens qui n'ont rien fait de mal : on redirige, et c'est tout.
 */
export default function AnnuaireDeplace() {
  redirect("/mon-espace/annuaire");
}
