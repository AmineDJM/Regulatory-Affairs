import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { grilleCourante, lecteurCoaching } from "@/lib/coaching/serveur";
import { listerFichesVisibles } from "@/lib/coaching/fiches";
import { construireClasseurSuivi, type LignePourListe } from "@/lib/coaching/classeur";
import { contentDisposition } from "@/lib/http/content-disposition";

/**
 * EXPORTER LE SUIVI DU COACHING (§118.157) — toutes les fiches VISIBLES, une par ligne, plus la
 * synthèse. La portée est la même que l'écran (`listerFichesVisibles`) : un KAM exporte ses
 * fiches, un superviseur celles de son équipe, le directeur des opérations tout.
 */
const LIMITE = 5000;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!userCan(user, "MEDICAL", "VIEW")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const url = new URL(req.url);
  const statut = url.searchParams.get("statut");
  const l = await lecteurCoaching(user);
  const [courante, liste] = await Promise.all([
    grilleCourante(),
    listerFichesVisibles(l, {
      collaboratorId: url.searchParams.get("collaborateur") || null,
      statut: statut === "DRAFT" || statut === "FINALIZED" ? statut : null,
      limite: LIMITE,
    }),
  ]);
  if (liste.tronque) {
    // UNE COUPE SE DIT (§118.60) — et ici elle refuse : un classeur de suivi partiel se lirait
    // comme complet. Filtrer par collaborateur ramène l'export sous la borne.
    return NextResponse.json({ error: `Plus de ${LIMITE} fiches : filtrez par collaborateur pour exporter.` }, { status: 413 });
  }
  const lignes: LignePourListe[] = liste.fiches.flatMap((f) => (f.grille
    ? [{
      collaboratorId: f.collaboratorId, collaborateur: f.collaborateur, visitDate: f.visitDate, status: f.status,
      grille: f.grille, notes: f.notes, manager: f.manager, sector: f.sector, gridVersion: f.gridVersion,
      strengths: f.strengths, improvements: f.improvements,
    }]
    : []));
  const octets = await construireClasseurSuivi(lignes, courante.grille);
  await recordAudit({
    actorId: user.id, action: "EXPORT", module: "Promotion médicale",
    summary: `Export du suivi du coaching — ${lignes.length} fiche(s)`,
  });
  return new NextResponse(octets as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(`Suivi_coaching_${new Date().toISOString().slice(0, 10)}.xlsx`),
      "Cache-Control": "no-store",
    },
  });
}
