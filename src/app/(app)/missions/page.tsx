import { redirect } from "next/navigation";

/**
 * L'ANCIENNE ADRESSE DES ORDRES DE MISSION — les missions vivent désormais dans « Mon espace › Mes missions »
 * (Direction, 10/2026). Les liens et notifications d'avant pointent encore ici : on les y renvoie.
 * (`/missions/<id>` reste la fiche d'une mission d'Adam, une autre chose.)
 */
export default function AncienneAdresseMissions() {
  redirect("/mon-espace/missions");
}
