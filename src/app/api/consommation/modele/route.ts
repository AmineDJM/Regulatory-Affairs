import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { contentDisposition } from "@/lib/http/content-disposition";

export const dynamic = "force-dynamic";

/**
 * LE FICHIER MODÈLE de Consumption Intelligence — un exemple de ce que l'import comprend : une ligne par établissement,
 * produit (ou molécule) et mois, avec la quantité et son unité. Ce n'est qu'un exemple : l'import reconnaît aussi les
 * fichiers des hôpitaux tels qu'ils arrivent (autres noms de colonnes, une colonne par mois, une feuille par hôpital).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !userCan(user, "CONSUMPTION", "VIEW")) return new Response("Non autorisé.", { status: 403 });
  const lignes = [
    ["Etablissement", "Désignation", "DCI", "Présentation", "Mois", "Quantité", "Unité", "Valeur (DA)"],
    ["CHU Oran", "Raltégravir 400 mg comprimé", "Raltégravir", "B/60", "janvier 2026", 120, "boîte", ""],
    ["CHU Oran", "Dolutégravir 50 mg comprimé", "Dolutégravir", "B/30", "janvier 2026", 400, "boîte", ""],
    ["CHU Oran", "Darunavir 600 mg comprimé", "Darunavir", "B/60", "janvier 2026", 80, "boîte", ""],
    ["EHS El Kettar", "Raltégravir 400 mg comprimé", "Raltégravir", "B/60", "janvier 2026", 210, "boîte", ""],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lignes), "Consommation");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition("modele-consommation.xlsx"),
    },
  });
}
