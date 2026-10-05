import type { LegalDocKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AVAL_QUI_FIGE, pieceEmise, type TypePieceEmise } from "@/lib/legal/piece-emise";

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



export interface AvoirDeFacture { id: string; reference: string | null; montant: number; actif: boolean }

/** Les avoirs d'une facture, actifs ET annulés — la fiche les montre tous, et ne compte que les actifs. */
export async function avoirsDeLaFacture(factureId: string): Promise<AvoirDeFacture[]> {
  const rows = await prisma.legalDocument.findMany({
    where: { chainFromId: factureId, kind: "CREDIT_NOTE" },
    select: { id: true, reference: true, amount: true, status: true }, orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ id: r.id, reference: r.reference, montant: r.amount == null ? 0 : Number(r.amount), actif: r.status !== "CANCELLED" }));
}

/**
 * LA FACTURE À CRÉDITER, telle que l'avoir et sa phrase la lisent (§118.195) — sa société, son numéro, son TTC et
 * si elle est déjà réglée. `null` pour une pièce qui n'est pas une facture émise par la plateforme : la fabrique en
 * dira la raison, ce lecteur ne la devine pas.
 */
export async function factureACrediter(factureId: string): Promise<{ companyId: string | null; numero: string; ttc: number; regleeLe: Date | null } | null> {
  const doc = await prisma.legalDocument.findUnique({ where: { id: factureId }, select: { kind: true, companyId: true, amount: true, paidDate: true, custom: true } });
  const emise = doc ? pieceEmise(doc.custom) : null;
  if (!doc || doc.kind !== "INVOICE" || emise?.type !== "FACTURE") return null;
  return { companyId: doc.companyId, numero: emise.numero, ttc: doc.amount == null ? 0 : Number(doc.amount), regleeLe: doc.paidDate };
}
