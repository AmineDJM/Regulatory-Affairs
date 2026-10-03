import type { LegalDocKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AVAL_QUI_FIGE, type TypePieceEmise } from "@/lib/legal/piece-emise";

/**
 * LA PIÈCE ACTIVE QUI DÉCOULE D'UNE PIÈCE ÉMISE ET LA FIGE (§118.194) — la facture d'un bon de commande ; le bon
 * de commande ou la facture d'un devis. Une pièce annulée ne compte pas : annulée, elle ne retient plus l'amont.
 *
 * Seules les natures qui DÉCOULENT commercialement comptent (`AVAL_QUI_FIGE`) : le menu « Fait suite à » du
 * registre laisse n'importe quelle pièce en suivre une autre, et un courrier rattaché à un bon de commande ne
 * facture rien — le compter refuserait la révision à tort (§118.27), et la phrase dirait « une facture » d'une
 * pièce qui n'en est pas une.
 *
 * Une seule lecture, pour la fabrique (qui refuse de réviser) et pour la fiche (qui dit pourquoi avant le clic) :
 * deux copies de « en découle-t-il quelque chose ? » finiraient par répondre différemment, et la fiche offrirait
 * un geste que la fabrique refuse (§118.83).
 */
export async function avalActif(
  legalDocumentId: string, type: TypePieceEmise,
): Promise<{ id: string; kind: string; reference: string | null } | null> {
  const natures = AVAL_QUI_FIGE[type] as readonly LegalDocKind[];
  if (natures.length === 0) return null;
  const aval = await prisma.legalDocument.findFirst({
    where: { chainFromId: legalDocumentId, status: { not: "CANCELLED" }, kind: { in: [...natures] } },
    select: { id: true, kind: true, reference: true },
    orderBy: { createdAt: "asc" },
  });
  return aval ? { id: aval.id, kind: String(aval.kind), reference: aval.reference } : null;
}
