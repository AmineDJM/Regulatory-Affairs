import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { resolveRepScope } from "@/lib/sfe";
import { contentDisposition } from "@/lib/http/content-disposition";
import { busDuPerimetre, chargerPilotage } from "@/lib/queries/force-de-vente";
import { ETAT_PLAN_LABELS, nomDuMois } from "@/lib/force-de-vente/calculs";

export const dynamic = "force-dynamic";

/**
 * L'EXPORT DU PILOTAGE (Force de vente, Direction 07/10) — le tableau des délégués tel que l'écran le montre, pour la
 * portée de la personne : délégué, BU, secteur, couverture H · A · B, réalisé, requis, attendu, plan, rapports en retard.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !userCan(user, "SALES_PLANNING", "VIEW")) return new Response("Non autorisé.", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const maintenant = new Date();
  const year = Number(sp.get("y")) || maintenant.getFullYear();
  const m = Number(sp.get("m"));
  const month = m >= 1 && m <= 12 ? m : maintenant.getMonth() + 1;
  const scope = await resolveRepScope(user);
  const bus = await busDuPerimetre(scope, user.id);
  const buId = bus.some((b) => b.id === sp.get("bu")) ? sp.get("bu") : null;
  const { lignes, jour, total } = await chargerPilotage({ scope, userId: user.id, buId, year, month });

  const feuille: (string | number | null)[][] = [
    ["Délégué", "BU", "Secteur", "Cibles H·A·B", "Vues à fréquence", "Couverture %", "Réalisé", "Requis", `Attendu à J${jour}/${total}`, "Plan", "Rapports en retard"],
    ...lignes.map((l) => [
      l.nom, l.buNom ?? "", l.secteurNom ?? "",
      l.couverture.cibles, l.couverture.vues, l.couverture.pct,
      l.realise, l.requis, l.attendu, ETAT_PLAN_LABELS[l.plan.etat], l.rapportsEnRetard,
    ]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(feuille), "Délégués");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const bu = buId ? bus.find((b) => b.id === buId)?.nom ?? "" : "toutes-bu";
  const nom = `force-de-vente-${nomDuMois(year, month, new Date(0)).replace(/\s+/g, "-")}-${bu.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(nom),
    },
  });
}
