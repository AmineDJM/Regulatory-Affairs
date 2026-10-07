import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/session";
import { contentDisposition } from "@/lib/http/content-disposition";
import { DOCTOR_TITLE } from "@/lib/labels";
import { chargerStrategie, chargerPanel } from "@/lib/segmentation/service";
import { droitsSegmentation, porteeSegmentation } from "@/lib/segmentation/droits";
import { STATUT_LABELS } from "@/lib/segmentation/regles";
import { enteteQ1, enteteQ2, libelleLettre } from "@/lib/segmentation/charge";

export const dynamic = "force-dynamic";

/**
 * L'EXPORT DE LA SEGMENTATION D'UNE BU (Direction, 07/10) — exactement les colonnes du classeur : Secteur, CDR,
 * Spécialité, Nom, Prénom, Grade, Statut, Q1, Q2, %, Potentiel. Les lignes sont celles que la personne voit (son panel
 * pour un KAM), la lettre celle qui s'applique (forcée ou calculée).
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !droitsSegmentation(user).voir) return new Response("Non autorisé.", { status: 403 });
  const id = new URL(req.url).searchParams.get("s") ?? "";
  const s = id ? await chargerStrategie(id) : null;
  if (!s) return new Response("Stratégie introuvable.", { status: 404 });
  const panel = await chargerPanel(s, porteeSegmentation(user));
  const p1 = s.produits[0];
  const metrique = s.regle?.regles?.produits.find((p) => p.productId === p1?.productId)?.metrique ?? null;
  const lignes: (string | number | null)[][] = [
    ["Secteur", "CDR", "Spécialité", "Nom", "Prénom", "Grade", "Statut", enteteQ1(metrique), enteteQ2(p1?.nom), "%", "Potentiel"],
    ...panel.map((l) => [
      l.secteurNom ?? "Sans secteur",
      l.etablissement ?? "",
      l.specialite ?? "",
      l.nomFamille,
      l.prenom ?? "",
      DOCTOR_TITLE[l.grade] ?? l.grade,
      l.statut ? STATUT_LABELS[l.statut] : "",
      l.q1,
      l.q2,
      l.q2 === null ? null : Math.round(l.q2 * 100) / 10,
      l.resultat ? libelleLettre(l.resultat.lettre) : "",
    ]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lignes), "Segmentation");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const nom = `segmentation-${s.businessUnit.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(nom),
    },
  });
}
