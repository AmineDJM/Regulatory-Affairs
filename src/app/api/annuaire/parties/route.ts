import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { listPartyOptions } from "@/lib/queries/company-contacts";

export const dynamic = "force-dynamic";

/**
 * L'ANNUAIRE, POUR LES ÉCRANS QUI NE PEUVENT PAS SE LE FAIRE PASSER.
 *
 * Le sélecteur de parties reçoit normalement ses options du serveur qui rend le formulaire.
 * Certains points d'entrée n'ont pas ce chemin — « Déclarer dans Legal » vit dans une ligne du
 * Drive, à cinq composants clients de toute page serveur. Plutôt que de faire traverser la liste
 * à toute la colonne, ils la demandent ici.
 *
 * Le cloisonnement est le MÊME (`listPartyOptions` applique `companyScopedWhere`) : cette route
 * n'ouvre rien de plus que l'écran de l'annuaire. Elle exige seulement d'être connecté et d'avoir
 * l'espace de travail — c'est-à-dire exactement qui peut lire l'annuaire depuis « Mon espace ».
 */
export async function GET() {
  const user = await requireUser();
  if (!userCan(user, "WORKSPACE", "VIEW")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  const parties = await listPartyOptions(user.id);
  return NextResponse.json({ parties, canCreate: userCan(user, "GENERAL_MEANS", "CREATE") });
}
